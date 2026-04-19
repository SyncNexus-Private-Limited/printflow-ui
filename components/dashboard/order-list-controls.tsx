"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { flushSync } from "react-dom";
import {
  ChevronDown,
  Filter,
  Undo2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataPill, type DataPillTone } from "@/components/dashboard/data-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  buildOrderPageHref,
  getLastMonthOrderDateRange,
  getOrderQuickDatePreset,
  orderQuickDatePresetValues,
  orderStatusValues,
  orderPaymentStatusValues,
  type OrderPageFilterState,
  type OrderQuickDatePreset,
} from "@/lib/dashboard/order-page-filters";
import { getCurrentMonthDashboardDateRange } from "@/lib/dashboard/page-filters";
import type { OrderFilterOptions } from "@/lib/dashboard/types";
import { getPaymentModeLabel, paymentModeValues } from "@/lib/expenses/types";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";

type OrderListControlsProps = {
  currentPath: string;
  currentFilters: OrderPageFilterState;
  filterOptions: OrderFilterOptions;
};

type OrderControlPanel = "filter" | null;

type AppliedFilterSummaryItem = {
  key: string;
  label: string;
  tone?: DataPillTone;
};

const summaryCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function normalizeHref(href: string) {
  const url = new URL(href, "https://printflow.local");
  const normalizedSearchParams = Array.from(url.searchParams.entries()).sort(
    ([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }

      return leftKey.localeCompare(rightKey);
    },
  );
  const normalizedQuery = new URLSearchParams(normalizedSearchParams).toString();

  return normalizedQuery ? `${url.pathname}?${normalizedQuery}` : url.pathname;
}

function isSameHref(leftHref: string, rightHref: string) {
  return normalizeHref(leftHref) === normalizeHref(rightHref);
}

function getOrderStatusLabel(status: string): string {
  switch (status) {
    case "pending":    return "Pending";
    case "processing": return "Processing";
    case "completed":  return "Completed";
    case "delivered":  return "Delivered";
    case "cancelled":  return "Cancelled";
    default:           return status;
  }
}

function getOrderPaymentStatusLabel(status: string): string {
  switch (status) {
    case "paid":    return "Paid";
    case "partial": return "Partial";
    case "pending": return "Unpaid";
    default:        return status;
  }
}

function getOrderStatusTone(status: string): DataPillTone {
  switch (status) {
    case "pending":    return "amber";
    case "processing": return "blue";
    case "completed":  return "emerald";
    case "delivered":  return "violet";
    case "cancelled":  return "rose";
    default:           return "neutral";
  }
}

function getOrderPaymentStatusTone(status: string): DataPillTone {
  switch (status) {
    case "paid":    return "emerald";
    case "partial": return "amber";
    case "pending": return "rose";
    default:        return "neutral";
  }
}

function formatSummaryCurrency(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return summaryCurrencyFormatter.format(parsedValue);
}

function getActiveFilterCount(filters: OrderPageFilterState): number {
  let count = 0;

  if (getOrderQuickDatePreset({ from: filters.from, to: filters.to }) !== "this-month") {
    count += 1;
  }

  if (filters.dateField !== "order") {
    count += 1;
  }

  if (filters.status) count += 1;
  if (filters.paymentStatus) count += 1;
  if (filters.orderCode) count += 1;
  if (filters.txnReference) count += 1;
  if (filters.customerId) count += 1;
  if (filters.createdBy) count += 1;
  if (filters.vendorId) count += 1;
  if (filters.paymentMode) count += 1;
  if (filters.inventoryId) count += 1;
  if (filters.offerItemId) count += 1;
  if (filters.payableMin || filters.payableMax) count += 1;
  if (filters.paidMin || filters.paidMax) count += 1;
  if (filters.outstandingMin || filters.outstandingMax) count += 1;

  return count;
}

function getAdvancedFilterCount(filters: OrderPageFilterState): number {
  let count = 0;

  if (filters.inventoryId) count += 1;
  if (filters.offerItemId) count += 1;
  if (filters.payableMin || filters.payableMax) count += 1;
  if (filters.paidMin || filters.paidMax) count += 1;
  if (filters.outstandingMin || filters.outstandingMax) count += 1;

  return count;
}

function buildPrimaryFilterSummary(filters: OrderPageFilterState): string {
  const preset = getOrderQuickDatePreset({ from: filters.from, to: filters.to });
  const rangeLabel =
    preset === "this-month"
      ? "This month"
      : preset === "last-month"
        ? "Last month"
        : formatDateRangeLabel(filters.from, filters.to);

  return `${filters.dateField === "created" ? "Created date" : "Order date"} · ${rangeLabel}`;
}

function buildAppliedFilterSummaryItems(
  filters: OrderPageFilterState,
  filterOptions: OrderFilterOptions,
): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [];

  if (filters.status) {
    items.push({
      key: "status",
      label: `Status: ${getOrderStatusLabel(filters.status)}`,
      tone: getOrderStatusTone(filters.status),
    });
  }

  if (filters.paymentStatus) {
    items.push({
      key: "paymentStatus",
      label: `Payment: ${getOrderPaymentStatusLabel(filters.paymentStatus)}`,
      tone: getOrderPaymentStatusTone(filters.paymentStatus),
    });
  }

  if (filters.customerId) {
    const customer = filterOptions.customers.find((c) => c.id === filters.customerId);

    if (customer) {
      items.push({ key: "customer", label: `Customer: ${customer.name}` });
    }
  }

  if (filters.createdBy) {
    const creator = filterOptions.creators.find((c) => c.id === filters.createdBy);

    if (creator) {
      items.push({ key: "createdBy", label: `Created by: ${creator.fullName}` });
    }
  }

  if (filters.vendorId) {
    const vendor = filterOptions.vendors.find((v) => v.id === filters.vendorId);

    if (vendor) {
      items.push({ key: "vendor", label: `Vendor: ${vendor.name}` });
    }
  }

  if (filters.paymentMode) {
    items.push({
      key: "paymentMode",
      label: `Mode: ${getPaymentModeLabel(filters.paymentMode)}`,
    });
  }

  if (filters.orderCode) {
    items.push({ key: "orderCode", label: `Code: ${filters.orderCode}` });
  }

  if (filters.txnReference) {
    items.push({ key: "txnReference", label: `Txn: ${filters.txnReference}` });
  }

  if (filters.inventoryId) {
    const item = filterOptions.inventoryItems.find((i) => i.id === filters.inventoryId);

    if (item) {
      items.push({ key: "inventory", label: `Item: ${item.name}` });
    }
  }

  if (filters.offerItemId) {
    const item = filterOptions.offerItems.find((i) => i.id === filters.offerItemId);

    if (item) {
      items.push({ key: "offerItem", label: `Offer: ${item.itemName}` });
    }
  }

  const payableMinLabel = formatSummaryCurrency(filters.payableMin);
  const payableMaxLabel = formatSummaryCurrency(filters.payableMax);

  if (payableMinLabel || payableMaxLabel) {
    const label =
      payableMinLabel && payableMaxLabel
        ? `Payable: ${payableMinLabel}–${payableMaxLabel}`
        : payableMinLabel
          ? `Payable min: ${payableMinLabel}`
          : `Payable max: ${payableMaxLabel}`;
    items.push({ key: "payable", label });
  }

  const paidMinLabel = formatSummaryCurrency(filters.paidMin);
  const paidMaxLabel = formatSummaryCurrency(filters.paidMax);

  if (paidMinLabel || paidMaxLabel) {
    const label =
      paidMinLabel && paidMaxLabel
        ? `Paid: ${paidMinLabel}–${paidMaxLabel}`
        : paidMinLabel
          ? `Paid min: ${paidMinLabel}`
          : `Paid max: ${paidMaxLabel}`;
    items.push({ key: "paid", label });
  }

  const outMinLabel = formatSummaryCurrency(filters.outstandingMin);
  const outMaxLabel = formatSummaryCurrency(filters.outstandingMax);

  if (outMinLabel || outMaxLabel) {
    const label =
      outMinLabel && outMaxLabel
        ? `Outstanding: ${outMinLabel}–${outMaxLabel}`
        : outMinLabel
          ? `Outstanding min: ${outMinLabel}`
          : `Outstanding max: ${outMaxLabel}`;
    items.push({ key: "outstanding", label });
  }

  return items;
}

function getPanelCardClassName() {
  return suggestCanonicalClasses(
    "overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] shadow-[0_28px_64px_-42px_rgb(var(--shadow)/0.28)] backdrop-blur-xl",
  );
}

export function OrderListControls({
  currentPath,
  currentFilters,
  filterOptions,
}: OrderListControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseId = useId();
  const filterPanelId = `${baseId}-filter-panel`;
  const filterTitleId = `${baseId}-filter-title`;
  const advancedPanelId = `${baseId}-advanced-filters`;
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousOpenPanelRef = useRef<OrderControlPanel>(null);
  const [openPanel, setOpenPanel] = useState<OrderControlPanel>(null);
  const [draftFilters, setDraftFilters] = useState<OrderPageFilterState>(currentFilters);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"apply" | null>(null);
  const [isPending, startTransition] = useTransition();
  const currentHref = useMemo(
    () => buildOrderPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const primaryFilterSummary = useMemo(
    () => buildPrimaryFilterSummary(currentFilters),
    [currentFilters],
  );
  const currentDatePreset = getOrderQuickDatePreset({
    from: draftFilters.from,
    to: draftFilters.to,
  });
  const advancedFilterCount = useMemo(
    () => getAdvancedFilterCount(draftFilters),
    [draftFilters],
  );
  const appliedFilterSummaryItems = useMemo(
    () => buildAppliedFilterSummaryItems(currentFilters, filterOptions),
    [currentFilters, filterOptions],
  );
  const visibleAppliedFilterSummaryItems = appliedFilterSummaryItems.slice(0, 3);
  const remainingAppliedFilterCount = Math.max(
    appliedFilterSummaryItems.length - visibleAppliedFilterSummaryItems.length,
    0,
  );
  const fieldLabelClassName =
    "text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]";

  useEffect(() => {
    setDraftFilters(currentFilters);
  }, [currentFilters]);

  useEffect(() => {
    setOpenPanel(null);
  }, [routeSignature]);

  useEffect(() => {
    if (!isPending) {
      setPendingAction(null);
    }
  }, [isPending]);

  useEffect(() => {
    if (openPanel !== "filter") {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    const focusTimeout = window.setTimeout(() => {
      filterCloseButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimeout);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openPanel]);

  useEffect(() => {
    if (previousOpenPanelRef.current === "filter" && openPanel !== "filter") {
      filterButtonRef.current?.focus();
    }

    previousOpenPanelRef.current = openPanel;
  }, [openPanel]);

  const navigateToHref = (href: string) => {
    if (isSameHref(href, currentHref)) {
      setOpenPanel(null);
      return false;
    }

    if (openPanel === "filter") {
      flushSync(() => {
        setOpenPanel(null);
      });
    }

    router.push(href);
    return true;
  };

  const updateDraftFilters = (
    updater: (currentValue: OrderPageFilterState) => OrderPageFilterState,
  ) => {
    setDraftFilters((currentValue) => updater(currentValue));
  };

  const handleFilterToggle = () => {
    if (openPanel !== "filter") {
      setIsAdvancedOpen(getAdvancedFilterCount(draftFilters) > 0);
    }

    setOpenPanel((currentValue) => (currentValue === "filter" ? null : "filter"));
  };

  const handleDatePresetSelect = (preset: OrderQuickDatePreset) => {
    if (preset === "custom") {
      return;
    }

    const nextDateRange =
      preset === "last-month"
        ? getLastMonthOrderDateRange()
        : getCurrentMonthDashboardDateRange();

    updateDraftFilters((currentValue) => ({
      ...currentValue,
      from: nextDateRange.from,
      to: nextDateRange.to,
    }));
  };

  const handleApplyFilters = () => {
    const nextHref = buildOrderPageHref(currentPath, currentFilters, {
      ...draftFilters,
      page: 1,
    });

    setPendingAction("apply");
    startTransition(() => {
      const didNavigate = navigateToHref(nextHref);

      if (!didNavigate) {
        setPendingAction(null);
      }
    });
  };

  const handleResetFilters = () => {
    const currentMonthDateRange = getCurrentMonthDashboardDateRange();
    const nextHref = buildOrderPageHref(currentPath, currentFilters, {
      from: null,
      to: null,
      page: 1,
      dateField: "order",
      sort: "order-date-desc",
      status: null,
      paymentStatus: null,
      orderCode: null,
      txnReference: null,
      customerId: null,
      createdBy: null,
      vendorId: null,
      paymentMode: null,
      inventoryId: null,
      offerItemId: null,
      payableMin: null,
      payableMax: null,
      paidMin: null,
      paidMax: null,
      outstandingMin: null,
      outstandingMax: null,
    });

    setDraftFilters((currentValue) => ({
      ...currentValue,
      from: currentMonthDateRange.from,
      to: currentMonthDateRange.to,
      page: 1,
      dateField: "order",
      sort: "order-date-desc",
      status: null,
      paymentStatus: null,
      orderCode: null,
      txnReference: null,
      customerId: null,
      createdBy: null,
      vendorId: null,
      paymentMode: null,
      inventoryId: null,
      offerItemId: null,
      payableMin: null,
      payableMax: null,
      paidMin: null,
      paidMax: null,
      outstandingMin: null,
      outstandingMax: null,
    }));

    navigateToHref(nextHref);
  };

  const isApplyPending = isPending && pendingAction === "apply";

  const filterSheet =
    openPanel === "filter" ? (
      <div
        id={filterPanelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={filterTitleId}
        className="fixed inset-0 z-50"
      >
        <button
          type="button"
          className="absolute inset-0 bg-[rgb(var(--shadow)/0.28)] backdrop-blur-sm"
          aria-label="Close filters"
          onClick={() => setOpenPanel(null)}
        />

        <div className="absolute inset-y-0 right-0 w-full md:max-w-md">
          <div className={cn(getPanelCardClassName(), "flex h-full flex-col")}>
            <div className="flex items-center justify-between gap-4 border-b border-[rgb(var(--border)/0.62)] px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p
                  id={filterTitleId}
                  className="text-base font-semibold text-[rgb(var(--card-foreground))]"
                >
                  Filter orders
                </p>
                <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} active filters`
                    : "Filter by date, status, and order details"}
                </p>
              </div>

              <button
                ref={filterCloseButtonRef}
                type="button"
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                )}
                onClick={() => setOpenPanel(null)}
                aria-label="Close filters"
                title="Close filters"
              >
                <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="space-y-4">
                <section className="space-y-3">
                  <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                    Date range
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {orderQuickDatePresetValues.map((preset) => {
                      const isActive = preset === currentDatePreset;

                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleDatePresetSelect(preset)}
                          className={cn(
                            "rounded-full border px-3 py-2 text-xs font-semibold capitalize transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                            isActive
                              ? "border-[rgb(var(--primary)/0.38)] bg-[rgb(var(--primary-soft))] text-[rgb(var(--primary-soft-foreground))]"
                              : "border-[rgb(var(--border))] bg-[rgb(var(--background))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]",
                          )}
                        >
                          {preset.replace("-", " ")}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-2">
                      <span className={fieldLabelClassName}>From</span>
                      <Input
                        type="date"
                        value={draftFilters.from ?? ""}
                        onChange={(event) =>
                          updateDraftFilters((currentValue) => ({
                            ...currentValue,
                            from: event.target.value.length > 0 ? event.target.value : null,
                          }))
                        }
                        className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className={fieldLabelClassName}>To</span>
                      <Input
                        type="date"
                        value={draftFilters.to ?? ""}
                        onChange={(event) =>
                          updateDraftFilters((currentValue) => ({
                            ...currentValue,
                            to: event.target.value.length > 0 ? event.target.value : null,
                          }))
                        }
                        className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                      />
                    </label>
                  </div>
                </section>

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>View by</span>
                  <Select
                    value={draftFilters.dateField}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        dateField: event.target.value === "created" ? "created" : "order",
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  >
                    <option value="order">Order date</option>
                    <option value="created">Created date</option>
                  </Select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Order status</span>
                    <Select
                      value={draftFilters.status ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          status:
                            event.target.value.length > 0
                              ? (event.target.value as typeof draftFilters.status)
                              : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    >
                      <option value="">All statuses</option>
                      {orderStatusValues.map((s) => (
                        <option key={s} value={s}>
                          {getOrderStatusLabel(s)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Payment status</span>
                    <Select
                      value={draftFilters.paymentStatus ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          paymentStatus:
                            event.target.value.length > 0
                              ? (event.target.value as typeof draftFilters.paymentStatus)
                              : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    >
                      <option value="">All payment statuses</option>
                      {orderPaymentStatusValues.map((s) => (
                        <option key={s} value={s}>
                          {getOrderPaymentStatusLabel(s)}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Payment mode</span>
                  <Select
                    value={draftFilters.paymentMode ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        paymentMode: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  >
                    <option value="">All payment modes</option>
                    {paymentModeValues.map((mode) => (
                      <option key={mode} value={mode}>
                        {getPaymentModeLabel(mode)}
                      </option>
                    ))}
                  </Select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Order code</span>
                    <Input
                      type="text"
                      placeholder="Search code…"
                      value={draftFilters.orderCode ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          orderCode: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Txn reference</span>
                    <Input
                      type="text"
                      placeholder="Search ref…"
                      value={draftFilters.txnReference ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          txnReference:
                            event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>
                </div>

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Customer</span>
                  <Select
                    value={draftFilters.customerId ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        customerId: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    disabled={filterOptions.customers.length === 0}
                  >
                    <option value="">
                      {filterOptions.customers.length === 0
                        ? "No customers found"
                        : "All customers"}
                    </option>
                    {filterOptions.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Created by</span>
                  <Select
                    value={draftFilters.createdBy ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        createdBy: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    disabled={filterOptions.creators.length === 0}
                  >
                    <option value="">
                      {filterOptions.creators.length === 0 ? "No creators found" : "Anyone"}
                    </option>
                    {filterOptions.creators.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.branchName ? `${u.fullName} — ${u.branchName}` : u.fullName}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Vendor</span>
                  <Select
                    value={draftFilters.vendorId ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        vendorId: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    disabled={filterOptions.vendors.length === 0}
                  >
                    <option value="">
                      {filterOptions.vendors.length === 0 ? "No vendors found" : "All vendors"}
                    </option>
                    {filterOptions.vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <section className="overflow-hidden rounded-2xl border border-[rgb(var(--border)/0.62)] bg-[rgb(var(--background)/0.42)]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={isAdvancedOpen}
                    aria-controls={advancedPanelId}
                    onClick={() => setIsAdvancedOpen((currentValue) => !currentValue)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                        Advanced filters
                      </p>
                      <p className="text-xs text-[rgb(var(--muted-foreground))]">
                        {advancedFilterCount > 0
                          ? `${advancedFilterCount} selected`
                          : "Items, amounts, and more"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {advancedFilterCount > 0 ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgb(var(--primary-soft))] px-2 text-xs font-semibold text-[rgb(var(--primary-soft-foreground))]">
                          {advancedFilterCount}
                        </span>
                      ) : null}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-[rgb(var(--muted-foreground))] transition-transform",
                          isAdvancedOpen ? "rotate-180" : "",
                        )}
                        aria-hidden="true"
                        strokeWidth={1.9}
                      />
                    </div>
                  </button>

                  {isAdvancedOpen ? (
                    <div
                      id={advancedPanelId}
                      className="space-y-3 border-t border-[rgb(var(--border)/0.62)] px-4 py-4"
                    >
                      <label className="block space-y-2">
                        <span className={fieldLabelClassName}>Inventory item</span>
                        <Select
                          value={draftFilters.inventoryId ?? ""}
                          onChange={(event) =>
                            updateDraftFilters((currentValue) => ({
                              ...currentValue,
                              inventoryId:
                                event.target.value.length > 0 ? event.target.value : null,
                            }))
                          }
                          className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                          disabled={filterOptions.inventoryItems.length === 0}
                        >
                          <option value="">
                            {filterOptions.inventoryItems.length === 0
                              ? "No items found"
                              : "All inventory items"}
                          </option>
                          {filterOptions.inventoryItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.sku})
                            </option>
                          ))}
                        </Select>
                      </label>

                      <label className="block space-y-2">
                        <span className={fieldLabelClassName}>Offer item</span>
                        <Select
                          value={draftFilters.offerItemId ?? ""}
                          onChange={(event) =>
                            updateDraftFilters((currentValue) => ({
                              ...currentValue,
                              offerItemId:
                                event.target.value.length > 0 ? event.target.value : null,
                            }))
                          }
                          className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                          disabled={filterOptions.offerItems.length === 0}
                        >
                          <option value="">
                            {filterOptions.offerItems.length === 0
                              ? "No offer items found"
                              : "All offer items"}
                          </option>
                          {filterOptions.offerItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.itemName}
                            </option>
                          ))}
                        </Select>
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-2">
                          <span className={fieldLabelClassName}>Min payable</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={draftFilters.payableMin ?? ""}
                            onChange={(event) =>
                              updateDraftFilters((currentValue) => ({
                                ...currentValue,
                                payableMin:
                                  event.target.value.length > 0 ? event.target.value : null,
                              }))
                            }
                            className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className={fieldLabelClassName}>Max payable</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={draftFilters.payableMax ?? ""}
                            onChange={(event) =>
                              updateDraftFilters((currentValue) => ({
                                ...currentValue,
                                payableMax:
                                  event.target.value.length > 0 ? event.target.value : null,
                              }))
                            }
                            className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-2">
                          <span className={fieldLabelClassName}>Min paid</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={draftFilters.paidMin ?? ""}
                            onChange={(event) =>
                              updateDraftFilters((currentValue) => ({
                                ...currentValue,
                                paidMin:
                                  event.target.value.length > 0 ? event.target.value : null,
                              }))
                            }
                            className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className={fieldLabelClassName}>Max paid</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={draftFilters.paidMax ?? ""}
                            onChange={(event) =>
                              updateDraftFilters((currentValue) => ({
                                ...currentValue,
                                paidMax:
                                  event.target.value.length > 0 ? event.target.value : null,
                              }))
                            }
                            className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-2">
                          <span className={fieldLabelClassName}>Min outstanding</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={draftFilters.outstandingMin ?? ""}
                            onChange={(event) =>
                              updateDraftFilters((currentValue) => ({
                                ...currentValue,
                                outstandingMin:
                                  event.target.value.length > 0 ? event.target.value : null,
                              }))
                            }
                            className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className={fieldLabelClassName}>Max outstanding</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={draftFilters.outstandingMax ?? ""}
                            onChange={(event) =>
                              updateDraftFilters((currentValue) => ({
                                ...currentValue,
                                outstandingMax:
                                  event.target.value.length > 0 ? event.target.value : null,
                              }))
                            }
                            className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>

            <div className="border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-4 py-4 sm:px-5">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 rounded-2xl px-4 shadow-none"
                  onClick={handleResetFilters}
                  disabled={isApplyPending}
                >
                  <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                  Reset all
                </Button>
                <Button
                  type="button"
                  className="h-11 min-w-34 rounded-2xl px-5"
                  onClick={handleApplyFilters}
                  disabled={isApplyPending}
                  aria-busy={isApplyPending}
                >
                  {isApplyPending ? (
                    <>
                      <Spinner size="xs" ariaHidden className="mr-2" />
                      Applying...
                    </>
                  ) : (
                    "Apply filters"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
              {primaryFilterSummary}
            </p>

            {visibleAppliedFilterSummaryItems.length > 0 ? (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                {visibleAppliedFilterSummaryItems.map((item) => (
                  <DataPill key={item.key} tone={item.tone ?? "neutral"} appearance="outline">
                    {item.label}
                  </DataPill>
                ))}

                {remainingAppliedFilterCount > 0 ? (
                  <DataPill tone="neutral" appearance="outline">
                    +{remainingAppliedFilterCount} more
                  </DataPill>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start">
            <Button
              ref={filterButtonRef}
              type="button"
              variant="secondary"
              className="h-11 min-w-28 rounded-2xl px-4"
              aria-haspopup="dialog"
              aria-expanded={openPanel === "filter"}
              aria-controls={filterPanelId}
              onClick={handleFilterToggle}
              disabled={isApplyPending}
              aria-busy={isApplyPending}
            >
              {isApplyPending ? (
                <Spinner size="xs" ariaHidden className="mr-2" />
              ) : (
                <Filter className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              )}
              Filter
              {activeFilterCount > 0 ? (
                <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgb(var(--primary-soft))] px-2 text-xs font-semibold text-[rgb(var(--primary-soft-foreground))]">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </div>

      {filterSheet}
    </div>
  );
}
