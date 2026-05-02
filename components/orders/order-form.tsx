"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DataPill } from "@/components/dashboard/data-pill";
import { SectionCard } from "@/components/dashboard/section-card";
import { paymentModeLabels, paymentModeValues } from "@/lib/expenses/types";
import {
  customerTypeLabels,
  customerTypeValues,
  offerTypeLabels,
  type OfferCustomerType,
} from "@/lib/offers/types";
import type {
  AddOrderPageData,
  CreateOrderApiResponse,
  CreateOrderFieldName,
  CreateOrderFormValues,
  OrderCustomerOption,
  OrderOfferOption,
} from "@/lib/orders/types";
import { formatCurrency } from "@/lib/utils/format";

type OrderItemDraft = CreateOrderFormValues["items"][number];

function buildInitialValues(branchId: string): CreateOrderFormValues {
  return {
    branchId,
    customerMode: "existing",
    customerId: "",
    customerType: "",
    customerName: "",
    customerPhone: "",
    customerCode: "",
    customerNumericId: "",
    studioName: "",
    alternatePhone: "",
    customerAddress: "",
    items: [{ inventoryId: "", quantity: "1", unitPrice: "" }],
    offerIds: [],
    initialPaymentAmount: "",
    paymentMode: "",
    txnReference: "",
    vendorId: "",
    vendorChargeAmount: "",
    vendorPaidAmount: "",
    vendorExpectedDeliveryDate: "",
    vendorNotes: "",
  };
}

function FieldLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor: string;
  children: string;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold tracking-[0.16em] text-[rgb(var(--muted-foreground))] uppercase"
    >
      {children}
      {optional ? (
        <span className="ml-1.5 font-normal tracking-normal normal-case">Optional</span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-[rgb(var(--danger))]">{message}</p> : null;
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCustomerSearchText(customer: OrderCustomerOption) {
  return [
    customer.name,
    customer.phone,
    customer.customerCode,
    customer.customerNumericId,
    customer.studioName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function calculateOfferDiscount(offer: OrderOfferOption, remainingSubtotal: number) {
  if (offer.offerType === "percentage") {
    return Math.round(remainingSubtotal * ((offer.discountValue ?? 0) / 100) * 100) / 100;
  }
  if (offer.offerType === "flat") {
    return Math.min(remainingSubtotal, offer.discountValue ?? 0);
  }
  return 0;
}

export function OrderForm(props: AddOrderPageData) {
  const {
    branchOptions,
    selectedBranchId,
    canSelectBranch,
    customers,
    inventoryItems,
    offers,
    vendors,
  } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startNavTransition] = useTransition();
  const [values, setValues] = useState<CreateOrderFormValues>(() =>
    buildInitialValues(selectedBranchId),
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CreateOrderFieldName, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCustomer = customers.find((customer) => customer.id === values.customerId) ?? null;
  const resolvedCustomerType =
    values.customerMode === "existing" ? selectedCustomer?.type : values.customerType || null;

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers.slice(0, 20);
    return customers
      .filter((customer) => getCustomerSearchText(customer).includes(query))
      .slice(0, 20);
  }, [customerSearch, customers]);

  const lineItems = values.items.map((item) => {
    const inventory = inventoryItems.find((option) => option.id === item.inventoryId);
    const quantity = parseNumber(item.quantity);
    const unitPrice = parseNumber(item.unitPrice);
    return { ...item, inventory, quantity, unitPrice, lineTotal: quantity * unitPrice };
  });
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const eligibleOffers = offers.filter((offer) => {
    if (offer.customerType && offer.customerType !== resolvedCustomerType) return false;
    if (offer.minimumOrderValue !== null && subtotal < offer.minimumOrderValue) return false;
    return true;
  });
  const selectedOffers = eligibleOffers.filter((offer) => values.offerIds.includes(offer.id));
  let discount = 0;
  for (const offer of selectedOffers) {
    discount += calculateOfferDiscount(offer, Math.max(0, subtotal - discount));
  }
  discount = Math.min(discount, subtotal);
  const payable = Math.max(0, subtotal - discount);
  const initialPayment = parseNumber(values.initialPaymentAmount);
  const vendorCharge = parseNumber(values.vendorChargeAmount);
  const vendorPaid = parseNumber(values.vendorPaidAmount);
  const vendorBalance = Math.max(0, vendorCharge - vendorPaid);

  const updateValue = <K extends keyof CreateOrderFormValues>(
    key: K,
    value: CreateOrderFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (index: number, next: Partial<OrderItemDraft>) => {
    setValues((current) => {
      const items = current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...next } : item,
      );
      return { ...current, items };
    });
  };

  const applyInventoryPrice = (index: number, inventoryId: string) => {
    const inventory = inventoryItems.find((item) => item.id === inventoryId);
    const price =
      resolvedCustomerType && inventory
        ? inventory.prices[resolvedCustomerType as OfferCustomerType]
        : undefined;
    updateItem(index, { inventoryId, unitPrice: price === undefined ? "" : String(price) });
  };

  const navigateToBranch = (branchId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("branchId", branchId);
    startNavTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json().catch(() => null)) as CreateOrderApiResponse | null;

      if (!response.ok || !data?.success) {
        setServerError(data && !data.success ? data.message : "Unable to create order right now.");
        if (data && !data.success && data.fieldErrors) setFieldErrors(data.fieldErrors);
        return;
      }

      router.push(data.data.redirectTo);
      router.refresh();
    } catch {
      setServerError("Unable to create order right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError ? (
        <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {serverError}
        </div>
      ) : null}

      <SectionCard title="Customer">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="order-branch">Branch</FieldLabel>
            <Select
              id="order-branch"
              value={values.branchId}
              disabled={isSubmitting || !canSelectBranch}
              onChange={(event) => {
                updateValue("branchId", event.target.value);
                navigateToBranch(event.target.value);
              }}
            >
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <FieldError message={fieldErrors.branchId} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="customer-mode">Customer</FieldLabel>
            <Select
              id="customer-mode"
              value={values.customerMode}
              onChange={(event) =>
                updateValue(
                  "customerMode",
                  event.target.value as CreateOrderFormValues["customerMode"],
                )
              }
            >
              <option value="existing">Existing customer</option>
              <option value="new">Create customer</option>
            </Select>
          </div>
          {values.customerMode === "existing" ? (
            <div className="space-y-3 sm:col-span-2">
              <Input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search mobile, code, numeric ID, or name"
              />
              <Select
                value={values.customerId}
                onChange={(event) => updateValue("customerId", event.target.value)}
              >
                <option value="">Select customer</option>
                {filteredCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.phone}{" "}
                    {customer.customerCode ? `- ${customer.customerCode}` : ""}
                  </option>
                ))}
              </Select>
              {filteredCustomers.length === 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 rounded-2xl px-4 shadow-none"
                  onClick={() => updateValue("customerMode", "new")}
                >
                  Create this customer
                </Button>
              ) : null}
              <FieldError message={fieldErrors.customerId} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="new-customer-name">Name</FieldLabel>
                <Input
                  id="new-customer-name"
                  value={values.customerName}
                  onChange={(event) => updateValue("customerName", event.target.value)}
                />
                <FieldError message={fieldErrors.customerName} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="new-customer-phone">Phone</FieldLabel>
                <Input
                  id="new-customer-phone"
                  value={values.customerPhone}
                  onChange={(event) => updateValue("customerPhone", event.target.value)}
                />
                <FieldError message={fieldErrors.customerPhone} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="new-customer-type">Type</FieldLabel>
                <Select
                  id="new-customer-type"
                  value={values.customerType}
                  onChange={(event) =>
                    updateValue(
                      "customerType",
                      event.target.value as CreateOrderFormValues["customerType"],
                    )
                  }
                >
                  <option value="">Select type</option>
                  {customerTypeValues.map((type) => (
                    <option key={type} value={type}>
                      {customerTypeLabels[type]}
                    </option>
                  ))}
                </Select>
                <FieldError message={fieldErrors.customerType} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="new-customer-code" optional>
                  Code
                </FieldLabel>
                <Input
                  id="new-customer-code"
                  value={values.customerCode}
                  onChange={(event) => updateValue("customerCode", event.target.value)}
                />
                <FieldError message={fieldErrors.customerCode} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="new-customer-numeric" optional>
                  Numeric ID
                </FieldLabel>
                <Input
                  id="new-customer-numeric"
                  value={values.customerNumericId}
                  onChange={(event) => updateValue("customerNumericId", event.target.value)}
                />
                <FieldError message={fieldErrors.customerNumericId} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="new-customer-studio" optional>
                  Studio
                </FieldLabel>
                <Input
                  id="new-customer-studio"
                  value={values.studioName}
                  onChange={(event) => updateValue("studioName", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="new-customer-alt" optional>
                  Alternate phone
                </FieldLabel>
                <Input
                  id="new-customer-alt"
                  value={values.alternatePhone}
                  onChange={(event) => updateValue("alternatePhone", event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="new-customer-address" optional>
                  Address
                </FieldLabel>
                <Textarea
                  id="new-customer-address"
                  value={values.customerAddress}
                  onChange={(event) => updateValue("customerAddress", event.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Order items">
        <div className="space-y-3">
          {values.items.map((item, index) => {
            const inventory = inventoryItems.find((option) => option.id === item.inventoryId);
            return (
              <div
                key={index}
                className="grid gap-3 rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.28)] p-3 md:grid-cols-[1fr_8rem_8rem_2.5rem]"
              >
                <Select
                  value={item.inventoryId}
                  onChange={(event) => applyInventoryPrice(index, event.target.value)}
                >
                  <option value="">Select item</option>
                  {inventoryItems.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.quantity} {option.unit})
                    </option>
                  ))}
                </Select>
                <Input
                  value={item.quantity}
                  onChange={(event) => updateItem(index, { quantity: event.target.value })}
                  inputMode="decimal"
                  placeholder="Qty"
                />
                <Input
                  value={item.unitPrice}
                  readOnly
                  placeholder="Rate"
                  title={inventory ? "Auto-filled from pricing" : "Select item"}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-xl shadow-none"
                  disabled={values.items.length === 1}
                  onClick={() =>
                    updateValue(
                      "items",
                      values.items.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {inventory ? (
                  <p className="text-xs text-[rgb(var(--muted-foreground))] md:col-span-4">
                    Available: {inventory.quantity} {inventory.unit}
                  </p>
                ) : null}
              </div>
            );
          })}
          <FieldError message={fieldErrors.items} />
          <Button
            type="button"
            variant="secondary"
            className="h-10 rounded-2xl px-4 shadow-none"
            onClick={() =>
              updateValue("items", [
                ...values.items,
                { inventoryId: "", quantity: "1", unitPrice: "" },
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add item
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Offers">
        <div className="flex flex-wrap gap-2">
          {eligibleOffers.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              No eligible offers for the selected customer and subtotal.
            </p>
          ) : (
            eligibleOffers.map((offer) => {
              const checked = values.offerIds.includes(offer.id);
              return (
                <label key={offer.id} className="cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(event) =>
                      updateValue(
                        "offerIds",
                        event.target.checked
                          ? [...values.offerIds, offer.id]
                          : values.offerIds.filter((id) => id !== offer.id),
                      )
                    }
                  />
                  <DataPill tone={checked ? "emerald" : "neutral"} appearance="outline">
                    {offer.name} - {offerTypeLabels[offer.offerType]}
                  </DataPill>
                </label>
              );
            })
          )}
        </div>
        <FieldError message={fieldErrors.offerIds} />
      </SectionCard>

      <SectionCard title="Customer payment">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            value={values.initialPaymentAmount}
            onChange={(event) => updateValue("initialPaymentAmount", event.target.value)}
            inputMode="decimal"
            placeholder="Initial payment"
          />
          <Select
            value={values.paymentMode}
            onChange={(event) =>
              updateValue("paymentMode", event.target.value as CreateOrderFormValues["paymentMode"])
            }
          >
            <option value="">Payment mode</option>
            {paymentModeValues.map((mode) => (
              <option key={mode} value={mode}>
                {paymentModeLabels[mode]}
              </option>
            ))}
          </Select>
          <Input
            value={values.txnReference}
            onChange={(event) => updateValue("txnReference", event.target.value)}
            placeholder="Transaction reference"
          />
        </div>
        <FieldError message={fieldErrors.initialPaymentAmount || fieldErrors.paymentMode} />
      </SectionCard>

      <SectionCard title="Vendor / outsource details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            value={values.vendorId}
            onChange={(event) => updateValue("vendorId", event.target.value)}
          >
            <option value="">No vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </Select>
          <Input
            value={values.vendorChargeAmount}
            onChange={(event) => updateValue("vendorChargeAmount", event.target.value)}
            inputMode="decimal"
            placeholder="Vendor charge"
          />
          <Input
            value={values.vendorPaidAmount}
            onChange={(event) => updateValue("vendorPaidAmount", event.target.value)}
            inputMode="decimal"
            placeholder="Initial vendor payment"
          />
          <Input
            type="date"
            value={values.vendorExpectedDeliveryDate}
            onChange={(event) => updateValue("vendorExpectedDeliveryDate", event.target.value)}
          />
          <Textarea
            className="sm:col-span-2"
            value={values.vendorNotes}
            onChange={(event) => updateValue("vendorNotes", event.target.value)}
            placeholder="Vendor notes"
          />
        </div>
        <FieldError
          message={
            fieldErrors.vendorId || fieldErrors.vendorChargeAmount || fieldErrors.vendorPaidAmount
          }
        />
      </SectionCard>

      <SectionCard title="Order summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Subtotal" value={formatCurrency(subtotal)} />
          <SummaryItem label="Discount" value={formatCurrency(discount)} />
          <SummaryItem label="Payable" value={formatCurrency(payable)} />
          <SummaryItem label="Initial payment" value={formatCurrency(initialPayment)} />
          <SummaryItem
            label="Customer balance"
            value={formatCurrency(Math.max(0, payable - initialPayment))}
          />
          <SummaryItem label="Vendor balance" value={formatCurrency(vendorBalance)} />
        </div>
      </SectionCard>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-2xl px-4 shadow-none"
          disabled={isSubmitting}
          onClick={() => router.push("/dashboard/orders")}
        >
          Cancel
        </Button>
        <Button type="submit" className="h-10 min-w-32 rounded-2xl px-5" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="xs" ariaHidden className="mr-2" />
              Creating...
            </>
          ) : (
            "Create order"
          )}
        </Button>
      </div>
    </form>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.32)] px-4 py-3">
      <p className="text-xs font-medium text-[rgb(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[rgb(var(--foreground))]">{value}</p>
    </div>
  );
}
