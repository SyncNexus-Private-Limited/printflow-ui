"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/section-card";
import { DataPill } from "@/components/dashboard/data-pill";
import { paymentModeLabels, paymentModeValues, type PaymentMode } from "@/lib/expenses/types";
import { offerTypeLabels, type OfferCustomerType } from "@/lib/offers/types";
import {
  orderStatusValues,
  type EditOrderPageData,
  type OrderStatusValue,
} from "@/lib/orders/types";
import { formatCurrency } from "@/lib/utils/format";

type ItemDraft = {
  inventoryId: string;
  quantity: string;
  unitPrice: string;
};

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function OrderEditForm({ detail, customers, inventoryItems, offers, vendors }: EditOrderPageData) {
  const router = useRouter();
  const existingVendor = detail.vendors[0] ?? null;
  const [customerId, setCustomerId] = useState(detail.order.customerId);
  const [status, setStatus] = useState<OrderStatusValue>(detail.order.status);
  const [items, setItems] = useState<ItemDraft[]>(
    detail.items.map((item) => ({
      inventoryId: item.inventoryId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  );
  const [offerIds, setOfferIds] = useState(detail.offers.map((offer) => offer.id));
  const [vendorId, setVendorId] = useState(existingVendor?.vendorId ?? "");
  const [vendorChargeAmount, setVendorChargeAmount] = useState(
    existingVendor ? String(existingVendor.chargeAmount) : "",
  );
  const [vendorPaidAmount, setVendorPaidAmount] = useState(
    existingVendor ? String(existingVendor.paidAmount) : "",
  );
  const [vendorExpectedDeliveryDate, setVendorExpectedDeliveryDate] = useState(
    existingVendor?.expectedDeliveryDate ?? "",
  );
  const [vendorNotes, setVendorNotes] = useState(existingVendor?.notes ?? "");
  const [paymentMode, setPaymentMode] = useState<PaymentMode | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const customerType = selectedCustomer?.type ?? detail.order.customerType;
  const lineItems = items.map((item) => {
    const inventory = inventoryItems.find((option) => option.id === item.inventoryId);
    const quantity = parseNumber(item.quantity);
    const unitPrice = parseNumber(item.unitPrice);
    return { ...item, inventory, quantity, unitPrice, lineTotal: quantity * unitPrice };
  });
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const eligibleOffers = offers.filter((offer) => {
    if (offer.customerType && offer.customerType !== customerType) return false;
    if (offer.minimumOrderValue !== null && subtotal < offer.minimumOrderValue) return false;
    return true;
  });
  const selectedOffers = eligibleOffers.filter((offer) => offerIds.includes(offer.id));
  const discount = selectedOffers.reduce((sum, offer) => {
    if (offer.offerType === "percentage") return sum + subtotal * ((offer.discountValue ?? 0) / 100);
    if (offer.offerType === "flat") return sum + (offer.discountValue ?? 0);
    return sum;
  }, 0);
  const payable = Math.max(0, subtotal - Math.min(discount, subtotal));

  const customerOptions = useMemo(() => customers.slice(0, 500), [customers]);

  function updateItem(index: number, next: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)),
    );
  }

  function selectInventory(index: number, inventoryId: string) {
    const inventory = inventoryItems.find((option) => option.id === inventoryId);
    const price = inventory?.prices[customerType as OfferCustomerType];
    updateItem(index, { inventoryId, unitPrice: price === undefined ? "" : String(price) });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${detail.order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          status,
          items,
          offerIds,
          vendorId,
          vendorChargeAmount,
          vendorPaidAmount,
          vendorExpectedDeliveryDate,
          vendorNotes,
          paymentMode,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; message: string }
        | null;
      if (!response.ok || !data?.success) {
        setError(data && !data.success ? data.message : "Unable to update order.");
        return;
      }
      router.push(`/dashboard/orders/${detail.order.id}`);
      router.refresh();
    } catch {
      setError("Unable to update order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {error}
        </div>
      ) : null}

      <SectionCard title="Customer">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            {customerOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} - {customer.phone}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value as OrderStatusValue)}>
            {orderStatusValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
      </SectionCard>

      <SectionCard title="Order items">
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.28)] p-3 md:grid-cols-[1fr_8rem_8rem_2.5rem]"
            >
              <Select value={item.inventoryId} onChange={(event) => selectInventory(index, event.target.value)}>
                <option value="">Select item</option>
                {inventoryItems.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.quantity} {option.unit})
                  </option>
                ))}
              </Select>
              <Input value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} />
              <Input value={item.unitPrice} readOnly />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="rounded-xl shadow-none"
                disabled={items.length === 1}
                onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="h-10 rounded-2xl px-4 shadow-none"
            onClick={() => setItems((current) => [...current, { inventoryId: "", quantity: "1", unitPrice: "" }])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Offers">
        <div className="flex flex-wrap gap-2">
          {eligibleOffers.map((offer) => {
            const checked = offerIds.includes(offer.id);
            return (
              <label key={offer.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(event) =>
                    setOfferIds((current) =>
                      event.target.checked
                        ? [...current, offer.id]
                        : current.filter((id) => id !== offer.id),
                    )
                  }
                />
                <DataPill tone={checked ? "emerald" : "neutral"} appearance="outline">
                  {offer.name} - {offerTypeLabels[offer.offerType]}
                </DataPill>
              </label>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Vendor / outsource details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
            <option value="">No vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </Select>
          <Input value={vendorChargeAmount} onChange={(event) => setVendorChargeAmount(event.target.value)} placeholder="Vendor charge" />
          <Input value={vendorPaidAmount} onChange={(event) => setVendorPaidAmount(event.target.value)} placeholder="Paid to vendor" />
          <Select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}>
            <option value="">Vendor payment mode</option>
            {paymentModeValues.map((mode) => (
              <option key={mode} value={mode}>
                {paymentModeLabels[mode]}
              </option>
            ))}
          </Select>
          <Input type="date" value={vendorExpectedDeliveryDate} onChange={(event) => setVendorExpectedDeliveryDate(event.target.value)} />
          <Textarea value={vendorNotes} onChange={(event) => setVendorNotes(event.target.value)} placeholder="Vendor notes" />
        </div>
      </SectionCard>

      <SectionCard title="Order summary">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryItem label="Subtotal" value={formatCurrency(subtotal)} />
          <SummaryItem label="Discount" value={formatCurrency(Math.min(discount, subtotal))} />
          <SummaryItem label="Payable" value={formatCurrency(payable)} />
        </div>
      </SectionCard>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => router.push(`/dashboard/orders/${detail.order.id}`)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="xs" ariaHidden className="mr-2" /> : null}
          Save order
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
