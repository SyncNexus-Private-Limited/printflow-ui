"use client";

import { useDashboardChrome } from "@/components/dashboard/dashboard-chrome-context";
import { getCustomerTypeBadgeClasses } from "@/components/dashboard/data-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerTypeOption } from "@/lib/customers/types";
import { validateOrderItems } from "@/lib/orders/form-validation";
import type { EditOrderPageData, OrderOfferOption } from "@/lib/orders/types";
import { ORDER_HIGH_DISCOUNT_PERCENT } from "@/lib/orders/types";
import { formatCurrency, formatEnumLabel } from "@/lib/utils/format";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  IndianRupee,
  Info,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useLayoutEffect, useMemo, useState } from "react";

type ItemDraft = {
  inventoryId: string;
  quantity: string;
  unitPrice: string;
};

// ─── pure helpers ────────────────────────────────────────────────────────────

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── local UI primitives (mirrors order-form.tsx) ────────────────────────────

function CustomerTypeBadge({
  type,
  customerTypeOptions,
}: {
  type: string;
  customerTypeOptions: CustomerTypeOption[];
}) {
  const label =
    customerTypeOptions.find((option) => option.value === type)?.label ?? formatEnumLabel(type);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${getCustomerTypeBadgeClasses(type)}`}
    >
      {label}
    </span>
  );
}

function OrderSection({
  step,
  title,
  description,
  right,
  children,
}: {
  step: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-[0_1px_0_rgb(var(--shadow)/0.025),0_8px_24px_-16px_rgb(var(--shadow)/0.18)]">
      <div
        className="grid items-center gap-3 px-5 pt-4"
        style={{ gridTemplateColumns: right ? "auto minmax(0,1fr) auto" : "auto minmax(0,1fr)" }}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--primary-soft))] font-mono text-[11px] font-bold text-[rgb(var(--primary-soft-foreground))]">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] leading-[1.2] font-bold tracking-[-0.005em] text-[rgb(var(--card-foreground))]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[12.5px] leading-[1.35] text-[rgb(var(--muted-foreground))]">
              {description}
            </p>
          )}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
      <div className="px-5 pt-4 pb-5">{children}</div>
    </section>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function OrderEditForm({
  detail,
  customers,
  inventoryItems,
  offers,
  branchOptions,
  selectedBranchId,
  canApplyDiscount,
  canApplyHighDiscount,
  customerTypeOptions,
}: EditOrderPageData) {
  const router = useRouter();
  const { setBranchControl } = useDashboardChrome();

  const [items, setItems] = useState<ItemDraft[]>(
    detail.items.map((item) => ({
      inventoryId: item.inventoryId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  );
  const [offerIds, setOfferIds] = useState(
    // Use master offer IDs (offer_id FK), not order_applied_offers row IDs.
    // Filter out any previously-applied offers that are no longer active/available.
    detail.offers.map((o) => o.offerId).filter((id) => offers.some((o) => o.id === id)),
  );
  const [manualDiscount, setManualDiscount] = useState(
    detail.order.manualDiscountAmount > 0 ? String(detail.order.manualDiscountAmount) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register branch control — disabled on edit (branch is immutable)
  useLayoutEffect(() => {
    setBranchControl({
      options: branchOptions.map((b) => ({ label: b.name, value: b.id })),
      value: selectedBranchId,
      disabled: true,
    });
  }, [branchOptions, selectedBranchId, setBranchControl]);

  // Cmd/Ctrl+Enter submits
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isSubmitting) {
          (document.getElementById("edit-order-form") as HTMLFormElement | null)?.requestSubmit();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting]);

  // ── derived state ──────────────────────────────────────────────────────────

  const selectedCustomer = customers.find((c) => c.id === detail.order.customerId) ?? null;
  const resolvedCustomerType: string = selectedCustomer?.type ?? detail.order.customerType;

  const lineItems = items.map((item) => {
    const inventory = inventoryItems.find((opt) => opt.id === item.inventoryId);
    const quantity = parseNumber(item.quantity);
    const unitPrice = parseNumber(item.unitPrice);
    return { ...item, inventory, quantity, unitPrice, lineTotal: quantity * unitPrice };
  });
  const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const eligibleOffers = offers.filter((offer) => {
    if (
      offer.customerTypes &&
      offer.customerTypes.length > 0 &&
      (!resolvedCustomerType || !offer.customerTypes.includes(resolvedCustomerType))
    )
      return false;
    if (offer.minimumOrderValue !== null && subtotal < offer.minimumOrderValue) return false;
    return true;
  });
  const selectedOffers = eligibleOffers.filter((offer) => offerIds.includes(offer.id));

  // Offers that are checked by the user but have become ineligible (due to item or customer changes).
  const invalidSelectedOffers = offers.filter(
    (offer) => offerIds.includes(offer.id) && !eligibleOffers.some((e) => e.id === offer.id),
  );

  let offerDiscount = 0;
  for (const offer of selectedOffers) {
    offerDiscount += calculateOfferDiscount(offer, Math.max(0, subtotal - offerDiscount));
  }
  offerDiscount = Math.min(offerDiscount, subtotal);
  const manualDiscountAmount = parseNumber(manualDiscount);
  const totalDiscount = Math.min(offerDiscount + manualDiscountAmount, subtotal);
  const payable = Math.max(0, subtotal - totalDiscount);

  const perOfferDiscount = useMemo(() => {
    const map = new Map<string, number>();
    let remaining = subtotal;
    for (const offer of selectedOffers) {
      const d = calculateOfferDiscount(offer, Math.max(0, remaining));
      map.set(offer.id, d);
      remaining = Math.max(0, remaining - d);
    }
    return map;
  }, [selectedOffers, subtotal]);

  const activeItemCount = lineItems.filter((i) => i.inventory).length;
  const paidAmount = detail.order.paidAmount;
  const estimatedBalance = Math.max(0, payable - paidAmount);

  let manualDiscountError: string | null = null;
  if (manualDiscountAmount > 0 && !canApplyDiscount) {
    manualDiscountError = "You don't have permission to apply manual discounts.";
  } else if (manualDiscountAmount > 0 && canApplyDiscount) {
    const threshold = Math.round(((subtotal * ORDER_HIGH_DISCOUNT_PERCENT) / 100) * 100) / 100;
    if (manualDiscountAmount > threshold && !canApplyHighDiscount) {
      manualDiscountError = `Exceeds limit — max ${formatCurrency(threshold)} for this subtotal.`;
    } else if (totalDiscount > subtotal) {
      manualDiscountError = "Total discount cannot exceed the subtotal.";
    }
  } else if (totalDiscount > subtotal) {
    manualDiscountError = "Total discount cannot exceed the subtotal.";
  }

  const itemErrors = hasAttemptedSubmit ? validateOrderItems(items) : [];

  const summaryName = selectedCustomer?.name ?? detail.order.customerName;
  const summaryPhone = selectedCustomer?.phone ?? detail.order.customerPhone;
  const rawSummaryNumericId = selectedCustomer?.customerNumericId ?? detail.order.customerNumericId;
  const summaryNumericId = rawSummaryNumericId != null ? `#${rawSummaryNumericId}` : "";

  // ── helpers (close over derived state) ────────────────────────────────────

  function getIneligibilityReason(offer: OrderOfferOption): string | null {
    const reasons: string[] = [];
    if (
      offer.customerTypes &&
      offer.customerTypes.length > 0 &&
      (!resolvedCustomerType || !offer.customerTypes.includes(resolvedCustomerType))
    ) {
      reasons.push(
        `for ${offer.customerTypes
          .map((t) => customerTypeOptions.find((option) => option.value === t)?.label ?? t)
          .join(", ")} only`,
      );
    }
    if (offer.minimumOrderValue !== null && subtotal < offer.minimumOrderValue) {
      reasons.push(`min ${formatCurrency(offer.minimumOrderValue)}`);
    }
    return reasons.length > 0 ? reasons.join(" · ") + " · n/a" : null;
  }

  // Cleaner reason string shown on invalid-selected chips (no trailing "· n/a").
  function getInvalidReason(offer: OrderOfferOption): string {
    const reasons: string[] = [];
    if (
      offer.customerTypes &&
      offer.customerTypes.length > 0 &&
      (!resolvedCustomerType || !offer.customerTypes.includes(resolvedCustomerType))
    ) {
      reasons.push(
        `${offer.customerTypes
          .map((t) => customerTypeOptions.find((option) => option.value === t)?.label ?? t)
          .join(", ")} only`,
      );
    }
    if (offer.minimumOrderValue !== null && subtotal < offer.minimumOrderValue) {
      reasons.push(`min ${formatCurrency(offer.minimumOrderValue)}`);
    }
    return reasons.join(" · ");
  }

  function getOfferMeta(
    offer: OrderOfferOption,
    checked: boolean,
    ineligibleReason: string | null,
  ): string {
    if (ineligibleReason) return ineligibleReason;
    if (offer.offerType === "percentage" && offer.discountValue !== null) {
      if (checked) {
        const d = perOfferDiscount.get(offer.id) ?? 0;
        return d > 0 ? `−${formatCurrency(d)}` : `${offer.discountValue}% off`;
      }
      return `${offer.discountValue}% off`;
    }
    if (offer.offerType === "flat" && offer.discountValue !== null) {
      return `flat ${formatCurrency(offer.discountValue)} off`;
    }
    return "";
  }

  // ── mutations ──────────────────────────────────────────────────────────────

  function selectInventory(index: number, inventoryId: string) {
    const inventory = inventoryItems.find((opt) => opt.id === inventoryId);
    const price = inventory?.prices[resolvedCustomerType];
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, inventoryId, unitPrice: price === undefined ? "" : String(price) }
          : item,
      ),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    const currentItemErrors = validateOrderItems(items);
    if (invalidSelectedOffers.length > 0 || currentItemErrors.length > 0) return;
    setError(null);
    setOffersError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/orders/${detail.order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: detail.order.customerId,
          items,
          offerIds,
          manualDiscount,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; message: string }
        | null;
      if (!response.ok || !data?.success) {
        const message = data && !data.success ? data.message : "Unable to update order.";
        if (message.toLowerCase().includes("offer")) {
          setOffersError(message);
        } else {
          setError(message);
        }
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

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page head */}
      <div className="mb-6">
        <nav
          className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-[rgb(var(--muted-foreground))]"
          aria-label="Breadcrumb"
        >
          <Link href="/dashboard" className="transition-colors hover:text-[rgb(var(--foreground))]">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-55" aria-hidden />
          <span>Sales</span>
          <ChevronRight className="h-3.5 w-3.5 opacity-55" aria-hidden />
          <Link
            href="/dashboard/orders"
            className="transition-colors hover:text-[rgb(var(--foreground))]"
          >
            Orders
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-55" aria-hidden />
          <span className="font-semibold text-[rgb(var(--foreground))]">Edit Order</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))] sm:text-3xl">
          {detail.order.orderCode}
        </h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5.5 max-[1200px]:grid-cols-[1fr]">
        {/* Left: form */}
        <form id="edit-order-form" onSubmit={handleSubmit} className="space-y-4.5">
          {/* Error banner */}
          {error ? (
            <div className="rounded-xl border border-[rgb(var(--danger)/0.3)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-[13.5px] text-[rgb(var(--danger))]">
              {error}
            </div>
          ) : null}

          {/* 01 — Customer */}
          <OrderSection
            step="01"
            title="Customer"
            description="Customer and branch are locked after order creation."
            right={
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.45)] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--muted-foreground))]">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            }
          >
            <div className="grid gap-3 rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.28)] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--primary))] text-sm font-bold text-white">
                {getInitials(summaryName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[14px] font-bold text-[rgb(var(--card-foreground))]">
                    {summaryName}
                  </p>
                  <CustomerTypeBadge
                    type={resolvedCustomerType}
                    customerTypeOptions={customerTypeOptions}
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11.5px] text-[rgb(var(--muted-foreground))]">
                  <span>{summaryPhone || "No phone"}</span>
                  {summaryNumericId ? <span>{summaryNumericId}</span> : null}
                  <span>{detail.order.branchName}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[rgb(var(--border)/0.7)] bg-[rgb(var(--card)/0.78)] px-3 py-2 text-[12px] font-medium text-[rgb(var(--muted-foreground))]">
                Branch readonly
              </div>
            </div>
          </OrderSection>

          {/* 02 — Order items */}
          <OrderSection
            step="02"
            title="Order items"
            description="Pick from inventory · rate auto-fills from customer pricing."
            right={
              <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-[rgb(var(--muted-foreground))] uppercase">
                {items.length} {items.length === 1 ? "ITEM" : "ITEMS"}
              </span>
            }
          >
            <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 44 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {(
                        [
                          { label: "Item", align: "left" },
                          { label: "Qty", align: "right" },
                          { label: "Rate (₹)", align: "right" },
                          { label: "Total", align: "right" },
                          { label: "", align: "left" },
                        ] as const
                      ).map(({ label, align }) => (
                        <th
                          key={label}
                          className="border-b border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.55)] px-3 py-2.5 font-mono text-[10.5px] font-bold tracking-[0.06em] text-[rgb(var(--muted-foreground))] uppercase"
                          style={{ textAlign: align }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const li = lineItems[index];
                      const inventoryError = itemErrors.find(
                        (e) => e.rowIndex === index && e.field === "inventoryId",
                      );
                      const quantityError = itemErrors.find(
                        (e) => e.rowIndex === index && e.field === "quantity",
                      );
                      return (
                        <Fragment key={index}>
                          <tr>
                            <td className="px-2.5 pt-3 pb-2 align-middle">
                              <Select
                                value={item.inventoryId}
                                onChange={(e) => selectInventory(index, e.target.value)}
                                className={`text-sm${inventoryError ? "border-[rgb(var(--danger))]" : ""}`}
                              >
                                <option value="">Select item</option>
                                {inventoryItems.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.name} ({opt.quantity} {opt.unit})
                                  </option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-2.5 pt-3 pb-2 align-middle">
                              <Input
                                value={item.quantity}
                                onChange={(e) =>
                                  setItems((current) =>
                                    current.map((it, i) =>
                                      i === index ? { ...it, quantity: e.target.value } : it,
                                    ),
                                  )
                                }
                                inputMode="decimal"
                                className={`text-right font-mono text-[13px]${quantityError ? "border-[rgb(var(--danger))]" : ""}`}
                              />
                            </td>
                            <td className="px-2.5 pt-3 pb-2 align-middle">
                              <Input
                                value={item.unitPrice}
                                readOnly
                                title={
                                  li.inventory ? "Auto-filled from pricing" : "Select item first"
                                }
                                className="bg-[rgb(var(--muted)/0.5)] text-right font-mono text-[13px] text-[rgb(var(--muted-foreground))]"
                              />
                            </td>
                            <td className="px-3.5 pt-3 pb-2 text-right align-middle font-mono text-[13.5px] font-semibold whitespace-nowrap text-[rgb(var(--card-foreground))]">
                              {li.inventory ? formatCurrency(li.lineTotal) : "—"}
                            </td>
                            <td className="px-2 pt-3 pb-2 text-center align-middle">
                              <button
                                type="button"
                                disabled={items.length === 1}
                                onClick={() =>
                                  setItems((current) => current.filter((_, i) => i !== index))
                                }
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[rgb(var(--danger))] transition-colors hover:bg-[rgb(var(--danger)/0.1)] disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                          {li.inventory ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="border-b border-dashed border-[rgb(var(--foreground)/0.25)] px-3 pt-0.5 pb-2"
                              >
                                {quantityError ? (
                                  <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-[rgb(var(--danger))]">
                                    <AlertCircle className="h-2.75 w-2.75 shrink-0" />
                                    {quantityError.message}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 font-mono text-[11.5px] text-[rgb(var(--muted-foreground))]">
                                    <Check className="h-2.75 w-2.75 shrink-0" strokeWidth={2.5} />
                                    Available: {li.inventory.quantity} {li.inventory.unit} ·
                                    auto-priced for{" "}
                                    {customerTypeOptions.find(
                                      (option) => option.value === resolvedCustomerType,
                                    )?.label ?? formatEnumLabel(resolvedCustomerType)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="border-b border-dashed border-[rgb(var(--foreground)/0.25)] px-3 pt-0.5 pb-2"
                              >
                                {inventoryError ? (
                                  <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-[rgb(var(--danger))]">
                                    <AlertCircle className="h-2.75 w-2.75 shrink-0" />
                                    {inventoryError.message}
                                  </div>
                                ) : (
                                  <div className="font-mono text-[11.5px] text-[rgb(var(--muted-foreground))]">
                                    Select an inventory item to see availability and pricing.
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Table footer */}
              <div className="flex items-center justify-between border-t border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.4)] px-3.5 py-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 gap-1.5 rounded-lg px-3 text-[12.5px] shadow-none"
                  onClick={() =>
                    setItems((current) => [
                      ...current,
                      { inventoryId: "", quantity: "1", unitPrice: "" },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add item
                </Button>
                <div className="text-[12.5px] text-[rgb(var(--muted-foreground))]">
                  Subtotal:{" "}
                  <b className="font-mono font-semibold text-[rgb(var(--card-foreground))]">
                    {formatCurrency(subtotal)}
                  </b>
                </div>
              </div>
            </div>
          </OrderSection>

          {/* 03 — Offers */}
          <OrderSection
            step="03"
            title="Offers"
            description="Eligible offers based on customer type and subtotal."
            right={
              <div className="flex items-center gap-3">
                {invalidSelectedOffers.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOfferIds((ids) =>
                        ids.filter((id) => !invalidSelectedOffers.some((o) => o.id === id)),
                      )
                    }
                    className="text-[12px] font-semibold text-[rgb(var(--danger))] hover:underline"
                  >
                    Remove invalid
                  </button>
                ) : null}
                <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-[rgb(var(--muted-foreground))] uppercase">
                  {selectedOffers.length} OF {eligibleOffers.length} APPLIED
                </span>
              </div>
            }
          >
            {invalidSelectedOffers.length > 0 || offersError ? (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-[rgb(var(--danger)/0.3)] bg-[rgb(var(--danger)/0.07)] px-3.5 py-3 text-[13px] text-[rgb(var(--danger))]">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {offersError ??
                    (invalidSelectedOffers.length === 1
                      ? `"${invalidSelectedOffers[0]!.name}" is no longer eligible. Remove it before updating.`
                      : `${invalidSelectedOffers.length} selected offers are no longer eligible. Remove them before updating.`)}
                </span>
              </div>
            ) : null}
            {offers.length === 0 ? (
              <p className="text-[13px] text-[rgb(var(--muted-foreground))]">
                No offers available for this branch.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {offers.map((offer) => {
                  const reason = getIneligibilityReason(offer);
                  const isIneligible = reason !== null;
                  const checked = offerIds.includes(offer.id);
                  // Selected but no longer eligible — must be removed before submit.
                  const isInvalidSelected = isIneligible && checked;
                  const meta = getOfferMeta(offer, checked, reason);

                  return (
                    <label
                      key={offer.id}
                      className={`inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition-all duration-120 select-none ${
                        isInvalidSelected
                          ? "cursor-pointer border-[rgb(var(--danger)/0.45)] bg-[rgb(var(--danger)/0.07)] text-[rgb(var(--danger))]"
                          : isIneligible
                            ? "cursor-not-allowed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.5)] text-[rgb(var(--muted-foreground))] opacity-55"
                            : checked
                              ? "cursor-pointer border-[rgb(var(--metric-emerald)/0.5)] bg-[rgb(var(--metric-emerald-soft))] text-[rgb(var(--metric-emerald-ink))]"
                              : "cursor-pointer border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.5)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={isIneligible && !isInvalidSelected}
                        onChange={(e) => {
                          if (isIneligible && !isInvalidSelected) return;
                          setOfferIds((current) =>
                            e.target.checked
                              ? [...current, offer.id]
                              : current.filter((id) => id !== offer.id),
                          );
                        }}
                      />
                      {/* Checkbox tile */}
                      <span
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-120 ${
                          isInvalidSelected
                            ? "border-[rgb(var(--danger)/0.5)] bg-[rgb(var(--danger)/0.12)]"
                            : checked
                              ? "border-[rgb(var(--metric-emerald))] bg-[rgb(var(--metric-emerald))]"
                              : "border-[rgb(var(--border))] bg-[rgb(var(--card))]"
                        }`}
                      >
                        {isInvalidSelected ? (
                          <X
                            className="h-2.75 w-2.75 text-[rgb(var(--danger))]"
                            strokeWidth={3.4}
                          />
                        ) : checked ? (
                          <Check className="h-2.75 w-2.75 stroke-white" strokeWidth={3.4} />
                        ) : null}
                      </span>
                      <span>{offer.name}</span>
                      {isInvalidSelected || meta ? (
                        <span
                          className={`font-mono text-[11px] font-medium ${
                            isInvalidSelected
                              ? "text-[rgb(var(--danger)/0.85)]"
                              : checked
                                ? "text-[rgb(var(--metric-emerald-ink)/0.8)]"
                                : "text-[rgb(var(--muted-foreground))]"
                          }`}
                        >
                          {isInvalidSelected ? getInvalidReason(offer) : meta}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            )}
          </OrderSection>
        </form>

        {/* Right: sticky summary */}
        <div className="sticky top-20 max-[1200px]:static">
          <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-[0_1px_0_rgb(var(--shadow)/0.04),0_12px_36px_-18px_rgb(var(--shadow)/0.22)]">
            {/* Summary header */}
            <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-5 py-4">
              <h2 className="text-[15px] font-bold text-[rgb(var(--card-foreground))]">
                Order summary
              </h2>
              <span className="rounded-full bg-[rgb(var(--primary-soft))] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[rgb(var(--primary-soft-foreground))]">
                {detail.order.orderCode}
              </span>
            </div>

            {/* Summary body */}
            <div className="px-5 py-4">
              {/* Customer chip */}
              <div className="mb-3.5 flex items-center gap-2.5 rounded-xl bg-[rgb(var(--primary-soft))] px-3.5 py-3">
                <div className="inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--primary))] text-[13px] font-bold text-white">
                  {getInitials(summaryName)}
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-[rgb(var(--primary-soft-foreground))]">
                    {summaryName}
                    <span className="ml-1 font-medium opacity-70">
                      ·{" "}
                      {customerTypeOptions.find((option) => option.value === resolvedCustomerType)
                        ?.label ?? formatEnumLabel(resolvedCustomerType)}
                    </span>
                  </div>
                  {summaryPhone || summaryNumericId ? (
                    <div className="mt-0.5 truncate font-mono text-[11px] text-[rgb(var(--primary-soft-foreground)/0.85)]">
                      {[summaryPhone, summaryNumericId].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Receipt lines */}
              <div>
                <div className="flex items-baseline justify-between py-1.75 text-[13.5px] text-[rgb(var(--muted-foreground))]">
                  <span>
                    Subtotal
                    <span className="ml-1 font-mono text-[11px] opacity-70">
                      · {activeItemCount} {activeItemCount === 1 ? "item" : "items"}
                    </span>
                  </span>
                  <span className="font-mono font-semibold text-[rgb(var(--foreground))]">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                {offerDiscount > 0 ? (
                  <div className="flex items-baseline justify-between py-1.75 text-[13.5px] text-[rgb(var(--muted-foreground))]">
                    <span className="flex flex-wrap items-center gap-1.5">
                      Offer discount
                      {selectedOffers.length > 0 ? (
                        <span className="rounded-[5px] bg-[rgb(var(--metric-emerald-soft))] px-1.5 py-0.5 font-mono text-[11px] text-[rgb(var(--metric-emerald-ink))]">
                          {selectedOffers.map((o) => o.name).join(", ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono font-semibold text-[rgb(var(--metric-emerald-ink))]">
                      −{formatCurrency(offerDiscount)}
                    </span>
                  </div>
                ) : null}

                {canApplyDiscount ? (
                  <div className="py-1.75 text-[13.5px] text-[rgb(var(--muted-foreground))]">
                    <div className="flex items-center justify-between gap-2">
                      <span>Manual discount</span>
                      <div className="relative w-28 shrink-0">
                        <IndianRupee className="pointer-events-none absolute top-1/2 left-2.5 h-3 w-3 -translate-y-1/2 text-[rgb(var(--muted-foreground))]" />
                        <Input
                          value={manualDiscount}
                          onChange={(e) => setManualDiscount(e.target.value)}
                          inputMode="decimal"
                          placeholder="0"
                          className={`pl-7 text-right font-mono text-[13px] ${manualDiscountError ? "border-[rgb(var(--danger))]" : ""}`}
                        />
                      </div>
                    </div>
                    {manualDiscountError ? (
                      <p className="mt-1 text-right text-[11.5px] text-[rgb(var(--danger))]">
                        {manualDiscountError}
                      </p>
                    ) : manualDiscountAmount > 0 ? (
                      <p className="mt-1 text-right font-mono text-[11.5px] text-[rgb(var(--metric-emerald-ink))]">
                        −{formatCurrency(manualDiscountAmount)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {offerDiscount > 0 && manualDiscountAmount > 0 ? (
                  <div className="flex items-baseline justify-between border-t border-dashed border-[rgb(var(--border))] py-1.75 text-[13.5px] text-[rgb(var(--muted-foreground))]">
                    <span>Total discount</span>
                    <span className="font-mono font-semibold text-[rgb(var(--metric-emerald-ink))]">
                      −{formatCurrency(totalDiscount)}
                    </span>
                  </div>
                ) : null}

                {/* Estimated payable */}
                <div className="mt-1.5 flex items-end justify-between border-t border-[rgb(var(--border))] pt-3.5">
                  <span className="text-[13px] font-bold tracking-[0.06em] text-[rgb(var(--foreground))] uppercase">
                    Payable
                  </span>
                  <span className="font-mono text-[24px] leading-none font-extrabold tracking-[-0.02em] text-[rgb(var(--card-foreground))]">
                    {formatCurrency(payable)}
                  </span>
                </div>

                {/* Already paid */}
                <div className="flex items-baseline justify-between pt-3.5 pb-1.75 text-[13.5px] text-[rgb(var(--muted-foreground))]">
                  <span>Already paid</span>
                  <span className="font-mono font-semibold text-[rgb(var(--foreground))]">
                    {formatCurrency(paidAmount)}
                  </span>
                </div>
              </div>

              {/* Balance pill */}
              <div className="mt-3">
                <div
                  className={`rounded-xl border px-3 py-2.5 ${
                    estimatedBalance === 0
                      ? "border-[rgb(var(--metric-emerald)/0.25)] bg-[rgb(var(--metric-emerald-soft))]"
                      : "border-[rgb(var(--metric-amber)/0.25)] bg-[rgb(var(--metric-amber-soft))]"
                  }`}
                >
                  <div
                    className={`text-[10.5px] font-semibold tracking-[0.06em] uppercase ${
                      estimatedBalance === 0
                        ? "text-[rgb(var(--metric-emerald-ink))]"
                        : "text-[rgb(var(--metric-amber-ink))]"
                    }`}
                  >
                    {estimatedBalance === 0 ? "Fully paid" : "Est. customer balance"}
                  </div>
                  <div
                    className={`mt-1 font-mono text-[16px] font-bold ${
                      estimatedBalance === 0
                        ? "text-[rgb(var(--metric-emerald-ink))]"
                        : "text-[rgb(var(--metric-amber-ink))]"
                    }`}
                  >
                    {formatCurrency(estimatedBalance)}
                  </div>
                </div>
              </div>

              {/* Helper text */}
              <div className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-[rgb(var(--muted-foreground))]">
                <Info className="mt-0.5 h-3.25 w-3.25 shrink-0" />
                <span>
                  Estimated totals — DB recalculates on save. Payment records are not affected.
                </span>
              </div>
            </div>

            {/* Action footer — side-by-side buttons */}
            <div className="grid grid-cols-2 gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.3)] px-5 pt-3.5 pb-4.5 max-[460px]:grid-cols-1">
              <Button
                type="submit"
                form="edit-order-form"
                disabled={
                  isSubmitting ||
                  invalidSelectedOffers.length > 0 ||
                  (hasAttemptedSubmit && itemErrors.length > 0)
                }
                className="gap-2 shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_6px_16px_-8px_rgb(var(--primary)/0.6)]"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="xs" ariaHidden className="mr-1" />
                    Updating…
                  </>
                ) : (
                  <>
                    Update
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => router.push(`/dashboard/orders/${detail.order.id}`)}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Keyboard hint */}
          <p className="mt-3.5 text-center font-mono text-[11.5px] tracking-[0.04em] text-[rgb(var(--muted-foreground))]">
            Press{" "}
            <kbd className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-1.5 py-px font-mono text-[10.5px]">
              ⌘ ↵
            </kbd>{" "}
            to update
          </p>
        </div>
      </div>
    </div>
  );
}
