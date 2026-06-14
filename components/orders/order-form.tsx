"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronRight,
  IndianRupee,
  Info,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useDashboardChrome } from "@/components/dashboard/dashboard-chrome-context";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { resolveAvatarUrl } from "@/lib/utils/resolve-avatar-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { paymentModeLabels, paymentModeValues } from "@/lib/expenses/types";
import { customerTypeLabels, customerTypeValues, type OfferCustomerType } from "@/lib/offers/types";
import type {
  AddOrderPageData,
  CreateOrderApiResponse,
  CreateOrderFieldName,
  CreateOrderFormValues,
  OrderCustomerOption,
  OrderOfferOption,
} from "@/lib/orders/types";
import { ORDER_HIGH_DISCOUNT_PERCENT } from "@/lib/orders/types";
import { formatCurrency } from "@/lib/utils/format";

type BalanceCardProps = {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "muted";
};

type OrderItemDraft = CreateOrderFormValues["items"][number];

function BalanceCard({ label, value, tone }: BalanceCardProps) {
  const toneClasses = {
    emerald: {
      card: "border-[rgb(var(--metric-emerald)/0.25)] bg-[rgb(var(--metric-emerald-soft))]",
      text: "text-[rgb(var(--metric-emerald-ink))]",
      value: "text-[rgb(var(--metric-emerald-ink))]",
    },
    amber: {
      card: "border-[rgb(var(--metric-amber)/0.25)] bg-[rgb(var(--metric-amber-soft))]",
      text: "text-[rgb(var(--metric-amber-ink))]",
      value: "text-[rgb(var(--metric-amber-ink))]",
    },
    muted: {
      card: "border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.45)]",
      text: "text-[rgb(var(--muted-foreground))]",
      value: "text-[rgb(var(--muted-foreground))]",
    },
  } satisfies Record<
    BalanceCardProps["tone"],
    {
      card: string;
      text: string;
      value: string;
    }
  >;

  const classes = toneClasses[tone];

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${classes.card}`}>
      <p
        className={`flex items-center justify-between gap-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase ${classes.text}`}
      >
        <span>{label}</span>
        <span className={`ml-1 font-mono text-[16px] font-bold ${classes.value}`}>{value}</span>
      </p>
    </div>
  );
}

function buildInitialValues(branchId: string, prefillCustomerId?: string): CreateOrderFormValues {
  return {
    branchId,
    customerMode: "existing",
    customerId: prefillCustomerId ?? "",
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
    manualDiscount: "",
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
  htmlFor?: string;
  children: string;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11.5px] font-semibold tracking-[0.04em] text-[rgb(var(--muted-foreground))] uppercase"
    >
      {children}
      {optional ? (
        <span className="ml-1.5 text-[11px] font-medium tracking-normal text-[rgb(var(--muted-foreground)/0.8)] normal-case">
          — optional
        </span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs text-[rgb(var(--danger))]">{message}</p> : null;
}

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

function CustomerTypeBadge({ type }: { type: OfferCustomerType }) {
  const toneClasses: Record<OfferCustomerType, string> = {
    studio: "bg-[rgb(var(--metric-violet-soft))] text-[rgb(var(--metric-violet-ink))]",
    amateur: "bg-[rgb(var(--metric-emerald-soft))] text-[rgb(var(--metric-emerald-ink))]",
    employee: "bg-[rgb(var(--metric-amber-soft))] text-[rgb(var(--metric-amber-ink))]",
    other: "bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]",
    lab: "bg-[rgb(var(--metric-orange-soft))] text-[rgb(var(--metric-orange-ink))]",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${toneClasses[type]}`}
    >
      {customerTypeLabels[type]}
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

export function OrderForm(props: AddOrderPageData) {
  const {
    branchOptions,
    selectedBranchId,
    canSelectBranch,
    canApplyDiscount,
    canApplyHighDiscount,
    customers,
    inventoryItems,
    offers,
    vendors,
    prefillCustomer,
    prefillError,
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startNavTransition] = useTransition();
  const { setBranchControl } = useDashboardChrome();

  const [customerLocked, setCustomerLocked] = useState(prefillCustomer !== null);
  const [values, setValues] = useState<CreateOrderFormValues>(() =>
    buildInitialValues(selectedBranchId, prefillCustomer?.id),
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<OrderCustomerOption[]>(customers);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFromSearch, setSelectedFromSearch] = useState<OrderCustomerOption | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CreateOrderFieldName, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendorOpen, setVendorOpenState] = useState(false);

  // Track previous customer type so we can detect changes after items are added
  const prevCustomerTypeRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register branch control in top navbar
  useLayoutEffect(() => {
    setBranchControl({
      options: branchOptions.map((b) => ({ label: b.name, value: b.id })),
      value: selectedBranchId,
      disabled: !canSelectBranch || branchOptions.length <= 1,
    });
  }, [branchOptions, selectedBranchId, canSelectBranch, setBranchControl]);

  // Cmd/Ctrl+Enter submits the form
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isSubmitting) {
          (document.getElementById("order-form") as HTMLFormElement | null)?.requestSubmit();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = customerSearch.trim();
    if (!q) {
      setSearchResults(customers);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data: { success: boolean; data: OrderCustomerOption[] }) => {
          if (data.success) setSearchResults(data.data);
        })
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [customerSearch, customers]);

  function setVendorOpen(open: boolean) {
    setVendorOpenState(open);
    if (!open) {
      setValues((v) => ({
        ...v,
        vendorId: "",
        vendorChargeAmount: "",
        vendorPaidAmount: "",
        vendorExpectedDeliveryDate: "",
        vendorNotes: "",
      }));
    }
  }

  const selectedCustomer =
    customers.find((c) => c.id === values.customerId) ??
    (selectedFromSearch?.id === values.customerId ? selectedFromSearch : null) ??
    (prefillCustomer?.id === values.customerId ? prefillCustomer : null);
  const resolvedCustomerType =
    values.customerMode === "existing"
      ? (selectedCustomer?.type ?? null)
      : values.customerType || null;

  // Refresh unit prices for all existing line items when customer type changes
  useEffect(() => {
    const prevType = prevCustomerTypeRef.current;
    prevCustomerTypeRef.current = resolvedCustomerType;

    // Nothing to do when type is absent or unchanged
    if (!resolvedCustomerType || prevType === resolvedCustomerType) return;

    setValues((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (!item.inventoryId) return item;
        const inventory = inventoryItems.find((opt) => opt.id === item.inventoryId);
        const price = inventory?.prices[resolvedCustomerType as OfferCustomerType];
        return { ...item, unitPrice: price === undefined ? "" : String(price) };
      }),
    }));
  }, [resolvedCustomerType, inventoryItems]);

  const lineItems = values.items.map((item) => {
    const inventory = inventoryItems.find((opt) => opt.id === item.inventoryId);
    const quantity = parseNumber(item.quantity);
    const unitPrice = parseNumber(item.unitPrice);
    return { ...item, inventory, quantity, unitPrice, lineTotal: quantity * unitPrice };
  });
  const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const eligibleOffers = offers.filter((offer) => {
    if (offer.customerType && offer.customerType !== resolvedCustomerType) return false;
    if (offer.minimumOrderValue !== null && subtotal < offer.minimumOrderValue) return false;
    return true;
  });
  const selectedOffers = eligibleOffers.filter((offer) => values.offerIds.includes(offer.id));
  let offerDiscount = 0;
  for (const offer of selectedOffers) {
    offerDiscount += calculateOfferDiscount(offer, Math.max(0, subtotal - offerDiscount));
  }
  offerDiscount = Math.min(offerDiscount, subtotal);
  const manualDiscountAmount = parseNumber(values.manualDiscount);
  const totalDiscount = Math.min(offerDiscount + manualDiscountAmount, subtotal);
  const payable = Math.max(0, subtotal - totalDiscount);
  const initialPayment = parseNumber(values.initialPaymentAmount);
  const customerBalance = Math.max(0, payable - initialPayment);
  const vendorCharge = parseNumber(values.vendorChargeAmount);
  const vendorPaid = parseNumber(values.vendorPaidAmount);
  const vendorBalance = Math.max(0, vendorCharge - vendorPaid);

  // Per-offer discount amounts for display
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

  function getIneligibilityReason(offer: OrderOfferOption): string | null {
    const reasons: string[] = [];
    if (offer.customerType && offer.customerType !== resolvedCustomerType) {
      reasons.push(`for ${customerTypeLabels[offer.customerType]} only`);
    }
    if (offer.minimumOrderValue !== null && subtotal < offer.minimumOrderValue) {
      reasons.push(`min ${formatCurrency(offer.minimumOrderValue)}`);
    }
    return reasons.length > 0 ? reasons.join(" · ") + " · n/a" : null;
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

  // True when the customer type changed and left some items without a matching price
  const hasMissingPrices = values.items.some((item) => item.inventoryId && !item.unitPrice);

  // Client-side validation for manual discount
  let manualDiscountError: string | null = fieldErrors.manualDiscount ?? null;
  if (!manualDiscountError && manualDiscountAmount > 0 && !canApplyDiscount) {
    manualDiscountError = "You don't have permission to apply manual discounts.";
  } else if (!manualDiscountError && manualDiscountAmount > 0 && canApplyDiscount) {
    const threshold = Math.round(((subtotal * ORDER_HIGH_DISCOUNT_PERCENT) / 100) * 100) / 100;
    if (manualDiscountAmount > threshold && !canApplyHighDiscount) {
      manualDiscountError = `Exceeds limit — max ${formatCurrency(threshold)} for this subtotal.`;
    } else if (totalDiscount > subtotal) {
      manualDiscountError = "Total discount cannot exceed the subtotal.";
    }
  } else if (!manualDiscountError && totalDiscount > subtotal) {
    manualDiscountError = "Total discount cannot exceed the subtotal.";
  }

  // Live field count for summary
  const liveFieldCount = [
    values.customerMode === "existing" ? values.customerId : values.customerName,
    ...lineItems.filter((i) => i.inventory).map(() => "item" as const),
    values.manualDiscount || null,
    values.initialPaymentAmount || null,
    values.paymentMode || null,
    vendorOpen && values.vendorId ? values.vendorId : null,
  ].filter(Boolean).length;

  // Summary customer display
  const summaryName =
    values.customerMode === "existing" ? (selectedCustomer?.name ?? "") : values.customerName;
  const summaryType = resolvedCustomerType
    ? customerTypeLabels[resolvedCustomerType as OfferCustomerType]
    : "";
  const summaryPhone =
    values.customerMode === "existing" ? (selectedCustomer?.phone ?? "") : values.customerPhone;
  const summaryCode =
    values.customerMode === "existing"
      ? (selectedCustomer?.customerCode ?? "")
      : values.customerCode;

  // Helper text for summary card
  const activeItemCount = lineItems.filter((i) => i.inventory).length;
  let helperText = "";
  if (activeItemCount === 0) {
    helperText = "Add at least one item to continue.";
  } else if (initialPayment >= payable && payable > 0) {
    helperText = "Order will be paid in full at creation.";
  } else if (customerBalance > 0) {
    helperText = `Customer keeps a balance of ${formatCurrency(customerBalance)} to be settled before delivery.`;
  }

  const updateValue = <K extends keyof CreateOrderFormValues>(
    key: K,
    value: CreateOrderFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (index: number, next: Partial<OrderItemDraft>) => {
    setValues((current) => {
      const items = current.items.map((item, i) => (i === index ? { ...item, ...next } : item));
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
          <span className="font-semibold text-[rgb(var(--foreground))]">Add Order</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))] sm:text-3xl">
          Add Order
        </h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5.5 max-[1200px]:grid-cols-[1fr]">
        {/* Left: form */}
        <form id="order-form" onSubmit={handleSubmit} className="space-y-4.5">
          {/* Server error banner */}
          {serverError ? (
            <div className="rounded-xl border border-[rgb(var(--danger)/0.3)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-[13.5px] text-[rgb(var(--danger))]">
              {serverError}
            </div>
          ) : null}

          {/* 01 — Customer */}
          <OrderSection
            step="01"
            title="Customer"
            description="Branch & who is placing this order."
            right={
              customerLocked ? undefined : (
                <div className="inline-flex h-10 items-center rounded-[10px] border border-[rgb(var(--border))] bg-[rgb(var(--muted))] p-0.75">
                  {(["existing", "new"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateValue("customerMode", mode)}
                      className={`h-full rounded-lg px-3.5 text-[13px] font-semibold transition-all duration-120 ${
                        values.customerMode === mode
                          ? "bg-[rgb(var(--card))] text-[rgb(var(--foreground))] shadow-[0_1px_0_rgb(var(--shadow)/0.05),0_1px_3px_rgb(var(--shadow)/0.06)]"
                          : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                      }`}
                    >
                      {mode === "existing" ? "Existing" : "Create new"}
                    </button>
                  ))}
                </div>
              )
            }
          >
            {prefillError ? (
              <div className="mb-3.5 flex items-start gap-2 rounded-xl border border-[rgb(var(--metric-amber)/0.3)] bg-[rgb(var(--metric-amber-soft))] px-4 py-3 text-[13px] text-[rgb(var(--metric-amber-ink))]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{prefillError}</span>
              </div>
            ) : null}

            {/* Branch + customer type row */}
            <div className="mb-3.5 grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="order-branch">Branch</FieldLabel>
                <Select
                  id="order-branch"
                  value={values.branchId}
                  disabled={isSubmitting || !canSelectBranch}
                  onChange={(e) => {
                    updateValue("branchId", e.target.value);
                    navigateToBranch(e.target.value);
                  }}
                >
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <FieldError message={fieldErrors.branchId} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Customer type</FieldLabel>
                {values.customerMode === "new" ? (
                  <>
                    <Select
                      value={values.customerType}
                      onChange={(e) =>
                        updateValue(
                          "customerType",
                          e.target.value as CreateOrderFormValues["customerType"],
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
                  </>
                ) : (
                  <div className="flex h-11 items-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.5)] px-3 text-sm font-medium text-[rgb(var(--muted-foreground))]">
                    {resolvedCustomerType ? (
                      customerTypeLabels[resolvedCustomerType as OfferCustomerType]
                    ) : (
                      <span className="opacity-60">— from selection</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Customer selection: locked pre-fill | existing search | create new */}
            {customerLocked && prefillCustomer ? (
              <div>
                <div className="overflow-hidden rounded-xl border border-[rgb(var(--primary)/0.25)] bg-[rgb(var(--primary-soft))]">
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <CustomerAvatar
                      name={prefillCustomer.name}
                      avatarUrl={resolveAvatarUrl(prefillCustomer.avatar, prefillCustomer.avatarSource)}
                      sizeClass="h-9 w-9 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-[rgb(var(--primary-soft-foreground))]">
                          {prefillCustomer.name}
                        </span>
                        <CustomerTypeBadge type={prefillCustomer.type} />
                      </div>
                      <div className="mt-0.5 font-mono text-[11.5px] text-[rgb(var(--primary-soft-foreground)/0.8)]">
                        {[
                          prefillCustomer.phone,
                          prefillCustomer.customerCode,
                          prefillCustomer.customerNumericId != null
                            ? `#${prefillCustomer.customerNumericId}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerLocked(false);
                        updateValue("customerId", "");
                      }}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-[rgb(var(--primary-soft-foreground)/0.8)] transition-colors hover:bg-[rgb(var(--primary)/0.12)] hover:text-[rgb(var(--primary-soft-foreground))]"
                    >
                      Change
                    </button>
                  </div>
                </div>
                <FieldError message={fieldErrors.customerId} />
              </div>
            ) : values.customerMode === "existing" ? (
              <div>
                <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
                  {/* Search header */}
                  <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.4)] p-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted-foreground))]" />
                      <Input
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search by mobile, code, numeric ID, or name…"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {/* Result list */}
                  <div className="max-h-45 overflow-y-auto">
                    {isSearching ? (
                      <div className="px-4 py-6 text-center text-[13px] text-[rgb(var(--muted-foreground))]">
                        Searching…
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((customer) => {
                        const isSelected = values.customerId === customer.id;
                        const metaParts = [
                          customer.phone,
                          customer.customerCode,
                          customer.customerNumericId != null
                            ? `#${customer.customerNumericId}`
                            : null,
                        ].filter(Boolean) as string[];
                        return (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setSelectedFromSearch(customer);
                              updateValue("customerId", customer.id);
                            }}
                            className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors duration-75 last:border-b-0 ${
                              isSelected
                                ? "bg-[rgb(var(--primary-soft))]"
                                : "hover:bg-[rgb(var(--muted)/0.4)]"
                            }`}
                          >
                            <CustomerAvatar
                              name={customer.name}
                              avatarUrl={resolveAvatarUrl(customer.avatar, customer.avatarSource)}
                              sizeClass="h-7 w-7"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[13.5px] font-semibold text-[rgb(var(--card-foreground))]">
                                {customer.name}
                              </div>
                              {metaParts.length > 0 && (
                                <div className="mt-0.5 flex gap-2 font-mono text-[11.5px] text-[rgb(var(--muted-foreground))]">
                                  {metaParts.map((part, i) => (
                                    <span key={i}>
                                      {i > 0 ? "· " : ""}
                                      {part}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <CustomerTypeBadge type={customer.type} />
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-6 text-center text-[13px] text-[rgb(var(--muted-foreground))]">
                        No customers found
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-start gap-1.5 text-[13px] text-[rgb(var(--muted-foreground))]">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    No match?{" "}
                    <button
                      type="button"
                      onClick={() => updateValue("customerMode", "new")}
                      className="font-semibold text-[rgb(var(--primary-soft-foreground))] hover:underline"
                    >
                      Create this customer →
                    </button>
                  </span>
                </div>
                <FieldError message={fieldErrors.customerId} />
              </div>
            ) : (
              /* Create-new customer mode */
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 max-[720px]:grid-cols-1">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="new-cust-name">Name</FieldLabel>
                  <Input
                    id="new-cust-name"
                    value={values.customerName}
                    onChange={(e) => updateValue("customerName", e.target.value)}
                  />
                  <FieldError message={fieldErrors.customerName} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="new-cust-phone">Phone</FieldLabel>
                  <Input
                    id="new-cust-phone"
                    value={values.customerPhone}
                    onChange={(e) => updateValue("customerPhone", e.target.value)}
                  />
                  <FieldError message={fieldErrors.customerPhone} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="new-cust-code" optional>
                    Code
                  </FieldLabel>
                  <Input
                    id="new-cust-code"
                    value={values.customerCode}
                    onChange={(e) => updateValue("customerCode", e.target.value)}
                  />
                  <FieldError message={fieldErrors.customerCode} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="new-cust-numeric" optional>
                    Numeric ID
                  </FieldLabel>
                  <Input
                    id="new-cust-numeric"
                    value={values.customerNumericId}
                    onChange={(e) => updateValue("customerNumericId", e.target.value)}
                  />
                  <FieldError message={fieldErrors.customerNumericId} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="new-cust-studio" optional>
                    Studio name
                  </FieldLabel>
                  <Input
                    id="new-cust-studio"
                    value={values.studioName}
                    onChange={(e) => updateValue("studioName", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="new-cust-alt" optional>
                    Alternate phone
                  </FieldLabel>
                  <Input
                    id="new-cust-alt"
                    value={values.alternatePhone}
                    onChange={(e) => updateValue("alternatePhone", e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 max-[720px]:col-span-1">
                  <FieldLabel htmlFor="new-cust-address" optional>
                    Address
                  </FieldLabel>
                  <Textarea
                    id="new-cust-address"
                    value={values.customerAddress}
                    onChange={(e) => updateValue("customerAddress", e.target.value)}
                  />
                </div>
              </div>
            )}
          </OrderSection>

          {/* 02 — Order items */}
          <OrderSection
            step="02"
            title="Order items"
            description="Pick from inventory · rate auto-fills from customer pricing."
            right={
              <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-[rgb(var(--muted-foreground))] uppercase">
                {values.items.length} {values.items.length === 1 ? "ITEM" : "ITEMS"}
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
                    {values.items.map((item, index) => {
                      const li = lineItems[index];
                      return (
                        <Fragment key={index}>
                          <tr>
                            <td className="px-2.5 py-2 align-middle">
                              <Select
                                value={item.inventoryId}
                                onChange={(e) => applyInventoryPrice(index, e.target.value)}
                                className="text-sm"
                              >
                                <option value="">Select item</option>
                                {inventoryItems.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.name} ({opt.quantity} {opt.unit})
                                  </option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-2.5 py-2 align-middle">
                              <Input
                                value={item.quantity}
                                onChange={(e) => updateItem(index, { quantity: e.target.value })}
                                inputMode="decimal"
                                className="text-right font-mono text-[13px]"
                              />
                            </td>
                            <td className="px-2.5 py-2 align-middle">
                              <Input
                                value={item.unitPrice}
                                readOnly
                                title={
                                  li.inventory ? "Auto-filled from pricing" : "Select item first"
                                }
                                className="bg-[rgb(var(--muted)/0.5)] text-right font-mono text-[13px] text-[rgb(var(--muted-foreground))]"
                              />
                            </td>
                            <td className="px-3.5 py-2 text-right align-middle font-mono text-[13.5px] font-semibold whitespace-nowrap text-[rgb(var(--card-foreground))]">
                              {li.inventory ? formatCurrency(li.lineTotal) : "—"}
                            </td>
                            <td className="px-2 py-2 text-center align-middle">
                              <button
                                type="button"
                                disabled={values.items.length === 1}
                                onClick={() =>
                                  updateValue(
                                    "items",
                                    values.items.filter((_, i) => i !== index),
                                  )
                                }
                                className="inline-flex h-7.5 w-7.5 items-center justify-center rounded-lg text-[rgb(var(--danger))] transition-colors hover:bg-[rgb(var(--danger)/0.1)] disabled:cursor-not-allowed disabled:opacity-40"
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
                                <div className="flex items-center gap-2 font-mono text-[11.5px] text-[rgb(var(--muted-foreground))]">
                                  <Check className="h-2.75 w-2.75 shrink-0" strokeWidth={2.5} />
                                  Available: {li.inventory.quantity} {li.inventory.unit}
                                  {resolvedCustomerType ? (
                                    <>
                                      {" "}
                                      · auto-priced for{" "}
                                      {
                                        customerTypeLabels[
                                          resolvedCustomerType as OfferCustomerType
                                        ]
                                      }
                                    </>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ) : null}
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
                    updateValue("items", [
                      ...values.items,
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
            <FieldError message={fieldErrors.items} />
            {hasMissingPrices ? (
              <p className="mt-1.5 text-xs text-[rgb(var(--danger))]">
                Some items have no pricing for the selected customer type — review rates before
                submitting.
              </p>
            ) : null}
          </OrderSection>

          {/* 03 — Offers */}
          <OrderSection
            step="03"
            title="Offers"
            description="Eligible offers based on customer type and subtotal."
            right={
              <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-[rgb(var(--muted-foreground))] uppercase">
                {selectedOffers.length} OF {eligibleOffers.length} APPLIED
              </span>
            }
          >
            {offers.length === 0 ? (
              <p className="text-[13px] text-[rgb(var(--muted-foreground))]">
                No eligible offers for the selected customer and subtotal.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {offers.map((offer) => {
                  const reason = getIneligibilityReason(offer);
                  const isIneligible = reason !== null;
                  const checked = values.offerIds.includes(offer.id);
                  const meta = getOfferMeta(offer, checked, reason);

                  return (
                    <label
                      key={offer.id}
                      className={`inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition-all duration-120 select-none ${
                        isIneligible
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
                        disabled={isIneligible}
                        onChange={(e) => {
                          if (isIneligible) return;
                          updateValue(
                            "offerIds",
                            e.target.checked
                              ? [...values.offerIds, offer.id]
                              : values.offerIds.filter((id) => id !== offer.id),
                          );
                        }}
                      />
                      {/* Checkbox tile */}
                      <span
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-120 ${
                          checked
                            ? "border-[rgb(var(--metric-emerald))] bg-[rgb(var(--metric-emerald))]"
                            : "border-[rgb(var(--border))] bg-[rgb(var(--card))]"
                        }`}
                      >
                        {checked ? (
                          <Check className="h-2.75 w-2.75 stroke-white" strokeWidth={3.4} />
                        ) : null}
                      </span>
                      <span>{offer.name}</span>
                      {meta ? (
                        <span
                          className={`font-mono text-[11px] font-medium ${
                            checked
                              ? "text-[rgb(var(--metric-emerald-ink)/0.8)]"
                              : "text-[rgb(var(--muted-foreground))]"
                          }`}
                        >
                          {meta}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            )}
            <FieldError message={fieldErrors.offerIds} />
          </OrderSection>

          {/* 04 — Customer payment */}
          <OrderSection
            step="04"
            title="Customer payment"
            description="Capture initial payment now — balance can be settled later."
          >
            <div className="grid grid-cols-3 gap-4 max-[720px]:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="order-init-pay">Initial payment</FieldLabel>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[rgb(var(--muted-foreground))]" />
                  <Input
                    id="order-init-pay"
                    value={values.initialPaymentAmount}
                    onChange={(e) => updateValue("initialPaymentAmount", e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="order-pay-mode">Payment mode</FieldLabel>
                <Select
                  id="order-pay-mode"
                  value={values.paymentMode}
                  onChange={(e) =>
                    updateValue(
                      "paymentMode",
                      e.target.value as CreateOrderFormValues["paymentMode"],
                    )
                  }
                >
                  <option value="">Select mode</option>
                  {paymentModeValues.map((mode) => (
                    <option key={mode} value={mode}>
                      {paymentModeLabels[mode]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="order-txn-ref" optional>
                  Txn reference
                </FieldLabel>
                <Input
                  id="order-txn-ref"
                  value={values.txnReference}
                  onChange={(e) => updateValue("txnReference", e.target.value)}
                  placeholder="UPI / cheque no."
                />
              </div>
            </div>
            <FieldError message={fieldErrors.initialPaymentAmount || fieldErrors.paymentMode} />
          </OrderSection>

          {/* 05 — Vendor / outsource (toggle) */}
          <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-[0_1px_0_rgb(var(--shadow)/0.025),0_8px_24px_-16px_rgb(var(--shadow)/0.18)]">
            <div
              role="button"
              tabIndex={0}
              aria-expanded={vendorOpen}
              onClick={() => setVendorOpen(!vendorOpen)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setVendorOpen(!vendorOpen);
                }
              }}
              className="flex cursor-pointer items-center justify-between px-5 py-3.5 select-none"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[9px] bg-[rgb(var(--metric-amber-soft))] text-[rgb(var(--metric-amber-ink))]">
                  <Briefcase className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[14.5px] font-bold text-[rgb(var(--card-foreground))]">
                    Vendor / outsource details
                  </div>
                  <div className="text-[12.5px] text-[rgb(var(--muted-foreground))]">
                    Toggle on if any items are outsourced to a vendor.
                  </div>
                </div>
              </div>
              {/* Toggle switch */}
              <div
                className={`relative h-5.5 w-9.5 shrink-0 rounded-full transition-colors duration-160 ${
                  vendorOpen ? "bg-[rgb(var(--primary))]" : "bg-[rgb(var(--border))]"
                }`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-160 ${
                    vendorOpen ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </div>
            {vendorOpen ? (
              <div className="border-t border-[rgb(var(--border))] px-5 pt-4 pb-5">
                <div className="grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="order-vendor">Vendor</FieldLabel>
                    <Select
                      id="order-vendor"
                      value={values.vendorId}
                      onChange={(e) => updateValue("vendorId", e.target.value)}
                    >
                      <option value="">No vendor</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="order-vendor-charge">Vendor charge</FieldLabel>
                    <Input
                      id="order-vendor-charge"
                      value={values.vendorChargeAmount}
                      onChange={(e) => updateValue("vendorChargeAmount", e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="order-vendor-paid">Initial vendor payment</FieldLabel>
                    <Input
                      id="order-vendor-paid"
                      value={values.vendorPaidAmount}
                      onChange={(e) => updateValue("vendorPaidAmount", e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="order-vendor-delivery">Expected delivery</FieldLabel>
                    <Input
                      id="order-vendor-delivery"
                      type="date"
                      value={values.vendorExpectedDeliveryDate}
                      onChange={(e) => updateValue("vendorExpectedDeliveryDate", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5 max-[720px]:col-span-1">
                    <FieldLabel htmlFor="order-vendor-notes" optional>
                      Notes
                    </FieldLabel>
                    <Textarea
                      id="order-vendor-notes"
                      value={values.vendorNotes}
                      onChange={(e) => updateValue("vendorNotes", e.target.value)}
                      placeholder="Anything the vendor needs to know…"
                    />
                  </div>
                </div>
                <FieldError
                  message={
                    fieldErrors.vendorId ||
                    fieldErrors.vendorChargeAmount ||
                    fieldErrors.vendorPaidAmount
                  }
                />
              </div>
            ) : null}
          </section>
        </form>

        {/* Right: sticky summary */}
        <div className="sticky top-20 max-[1200px]:static">
          <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-[0_1px_0_rgb(var(--shadow)/0.04),0_12px_36px_-18px_rgb(var(--shadow)/0.22)]">
            {/* Summary header */}
            <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-5 py-4">
              <h2 className="text-[15px] font-bold text-[rgb(var(--card-foreground))]">
                Order summary
              </h2>
              <span className="font-mono text-[11.5px] text-[rgb(var(--muted-foreground))]">
                LIVE · {liveFieldCount} {liveFieldCount === 1 ? "field" : "fields"}
              </span>
            </div>

            {/* Summary body */}
            <div className="px-5 py-4">
              {/* Customer chip */}
              {summaryName ? (
                <div className="mb-3.5 flex items-center gap-2.5 rounded-xl bg-[rgb(var(--primary-soft))] px-3.5 py-3">
                  <div className="inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--primary))] text-[13px] font-bold text-white">
                    {getInitials(summaryName)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold text-[rgb(var(--primary-soft-foreground))]">
                      {summaryName}
                      {summaryType ? (
                        <span className="ml-1 font-medium opacity-70"> · {summaryType}</span>
                      ) : null}
                    </div>
                    {summaryPhone || summaryCode ? (
                      <div className="mt-0.5 truncate font-mono text-[11px] text-[rgb(var(--primary-soft-foreground)/0.85)]">
                        {[summaryPhone, summaryCode].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mb-3.5 flex items-center gap-2.5 rounded-xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.5)] px-3.5 py-3">
                  <div className="inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--border))] text-[rgb(var(--muted-foreground))]">
                    <span className="text-[13px] font-bold">?</span>
                  </div>
                  <span className="text-[13px] text-[rgb(var(--muted-foreground))]">
                    — no customer selected —
                  </span>
                </div>
              )}

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

                {/* Manual discount input */}
                {canApplyDiscount ? (
                  <div className="py-1.75">
                    <div className="flex items-center justify-between gap-2">
                      <span className="shrink-0 text-[13.5px] text-[rgb(var(--muted-foreground))]">
                        Manual discount
                      </span>
                      <div className="relative w-28 shrink-0">
                        <IndianRupee className="pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-[rgb(var(--muted-foreground))]" />
                        <Input
                          value={values.manualDiscount}
                          onChange={(e) => updateValue("manualDiscount", e.target.value)}
                          inputMode="decimal"
                          placeholder="0.00"
                          className={`h-8 pr-2 pl-5 text-right font-mono text-[13px] ${manualDiscountError ? "border-[rgb(var(--danger))]" : ""}`}
                        />
                      </div>
                    </div>
                    {manualDiscountError ? (
                      <p className="mt-1 text-right text-[11.5px] text-[rgb(var(--danger))]">
                        {manualDiscountError}
                      </p>
                    ) : manualDiscountAmount > 0 ? (
                      <p className="mt-1 text-right font-mono text-[13px] font-semibold text-[rgb(var(--metric-emerald-ink))]">
                        −{formatCurrency(manualDiscountAmount)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Total discount separator — only shown when both types exist */}
                {offerDiscount > 0 && manualDiscountAmount > 0 ? (
                  <div className="flex items-baseline justify-between border-t border-dashed border-[rgb(var(--border))] py-1.75 text-[13px] text-[rgb(var(--muted-foreground))]">
                    <span>Total discount</span>
                    <span className="font-mono font-semibold text-[rgb(var(--metric-emerald-ink))]">
                      −{formatCurrency(totalDiscount)}
                    </span>
                  </div>
                ) : null}

                {/* Payable total */}
                <div className="mt-1.5 flex items-end justify-between border-t border-[rgb(var(--border))] pt-3.5">
                  <span className="text-[13px] font-bold tracking-[0.06em] text-[rgb(var(--foreground))] uppercase">
                    Payable
                  </span>
                  <span className="font-mono text-[24px] leading-none font-extrabold tracking-[-0.02em] text-[rgb(var(--card-foreground))]">
                    {formatCurrency(payable)}
                  </span>
                </div>

                {/* Initial payment */}
                <div className="flex items-baseline justify-between pt-3.5 pb-1.75 text-[13.5px] text-[rgb(var(--muted-foreground))]">
                  <span>Initial payment</span>
                  <span className="font-mono font-semibold text-[rgb(var(--foreground))]">
                    −{formatCurrency(initialPayment)}
                  </span>
                </div>
              </div>

              {/* Balance pills */}
              <div className="my-3 space-y-3">
                <BalanceCard
                  label="Customer balance"
                  value={formatCurrency(customerBalance)}
                  tone="emerald"
                />

                {vendorOpen ? (
                  <BalanceCard
                    label="Vendor balance"
                    value={formatCurrency(vendorBalance)}
                    tone="amber"
                  />
                ) : (
                  <BalanceCard label="Vendor" value="N/A" tone="muted" />
                )}
              </div>

              {/* Helper text */}
              {helperText ? (
                <div className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-[rgb(var(--muted-foreground))]">
                  <Info className="mt-0.5 h-3.25 w-3.25 shrink-0" />
                  <span>{helperText}</span>
                </div>
              ) : null}
            </div>

            {/* Action footer */}
            <div className="grid grid-cols-2 gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.3)] px-5 pt-3.5 pb-4.5 max-[460px]:grid-cols-1">
              <Button
                type="submit"
                form="order-form"
                disabled={isSubmitting}
                className="w-full gap-2 shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_6px_16px_-8px_rgb(var(--primary)/0.6)]"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="xs" ariaHidden className="mr-1" />
                    Creating…
                  </>
                ) : (
                  <>
                    Create
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => router.push("/dashboard/orders")}
                className="w-full"
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
            to create
          </p>
        </div>
      </div>
    </div>
  );
}
