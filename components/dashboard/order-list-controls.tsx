"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  AppliedFilterPills,
  type AppliedFilterSummaryItem,
} from "@/components/dashboard/applied-filter-pills";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import { type DataPillTone } from "@/components/dashboard/data-pill";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import { getCurrentMonthDashboardDateRange } from "@/lib/dashboard/page-filters";
import type { OrderFilterOptions } from "@/lib/dashboard/types";
import { getPaymentModeLabel, paymentModeValues } from "@/lib/expenses/types";
import { cn } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";

type OrderListControlsProps = {
  currentPath: string;
  currentFilters: OrderPageFilterState;
  filterOptions: OrderFilterOptions;
  selectedBranchName: string;
};

const summaryCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function toDraftFilters(filters: OrderPageFilterState): OrderPageFilterState {
  return filters;
}

function getOrderStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function getOrderPaymentStatusLabel(status: string): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "pending":
      return "Unpaid";
    default:
      return status;
  }
}

function getOrderStatusTone(status: string): DataPillTone {
  switch (status) {
    case "pending":
      return "amber";
    case "processing":
      return "blue";
    case "completed":
      return "emerald";
    case "delivered":
      return "violet";
    case "cancelled":
      return "rose";
    default:
      return "neutral";
  }
}

function getOrderPaymentStatusTone(status: string): DataPillTone {
  switch (status) {
    case "paid":
      return "emerald";
    case "partial":
      return "amber";
    case "pending":
      return "rose";
    default:
      return "neutral";
  }
}

function formatSummaryCurrency(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return summaryCurrencyFormatter.format(parsed);
}

function getActiveFilterCount(filters: OrderPageFilterState): number {
  let count = 0;

  if (getOrderQuickDatePreset({ from: filters.from, to: filters.to }) !== "this-month") count += 1;
  if (filters.dateField !== "order") count += 1;
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
  branchName: string,
): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [{ key: "branch", label: `Branch: ${branchName}` }];

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
    if (customer) items.push({ key: "customer", label: `Customer: ${customer.name}` });
  }

  if (filters.createdBy) {
    const creator = filterOptions.creators.find((c) => c.id === filters.createdBy);
    if (creator) items.push({ key: "createdBy", label: `Created by: ${creator.fullName}` });
  }

  if (filters.vendorId) {
    const vendor = filterOptions.vendors.find((v) => v.id === filters.vendorId);
    if (vendor) items.push({ key: "vendor", label: `Vendor: ${vendor.name}` });
  }

  if (filters.paymentMode) {
    items.push({ key: "paymentMode", label: `Mode: ${getPaymentModeLabel(filters.paymentMode)}` });
  }

  if (filters.orderCode) items.push({ key: "orderCode", label: `Code: ${filters.orderCode}` });
  if (filters.txnReference)
    items.push({ key: "txnReference", label: `Txn: ${filters.txnReference}` });

  if (filters.inventoryId) {
    const item = filterOptions.inventoryItems.find((i) => i.id === filters.inventoryId);
    if (item) items.push({ key: "inventory", label: `Item: ${item.name}` });
  }

  if (filters.offerItemId) {
    const item = filterOptions.offerItems.find((i) => i.id === filters.offerItemId);
    if (item) items.push({ key: "offerItem", label: `Offer: ${item.itemName}` });
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

export function OrderListControls({
  currentPath,
  currentFilters,
  filterOptions,
  selectedBranchName,
}: OrderListControlsProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const currentHref = useMemo(
    () => buildOrderPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const primaryFilterSummary = useMemo(
    () => buildPrimaryFilterSummary(currentFilters),
    [currentFilters],
  );
  const appliedFilterItems = useMemo(
    () => buildAppliedFilterSummaryItems(currentFilters, filterOptions, selectedBranchName),
    [currentFilters, filterOptions, selectedBranchName],
  );

  const {
    filterPanelId,
    filterTitleId,
    filterButtonRef,
    filterCloseButtonRef,
    isOpen,
    draftFilters,
    setDraftFilters,
    isApplyPending,
    handleFilterToggle: toggleFilterDrawer,
    closeDrawer,
    navigateToHref,
    startTransition,
    setPendingAction,
  } = useFilterDrawer({ currentHref, currentFilters, toDraftFilters });

  const advancedPanelId = `${filterPanelId.split("-filter-panel")[0]}-advanced-filters`;
  const currentDatePreset = getOrderQuickDatePreset({
    from: draftFilters.from,
    to: draftFilters.to,
  });
  const advancedFilterCount = useMemo(() => getAdvancedFilterCount(draftFilters), [draftFilters]);

  const drawerSubtitle =
    activeFilterCount > 0
      ? `${activeFilterCount} active filters`
      : "Filter by date, status, and order details";

  const handleFilterToggle = () => {
    if (!isOpen) {
      setIsAdvancedOpen(getAdvancedFilterCount(draftFilters) > 0);
    }
    toggleFilterDrawer();
  };

  const updateDraftFilters = (updater: (current: OrderPageFilterState) => OrderPageFilterState) => {
    setDraftFilters((current) => updater(current));
  };

  const handleDatePresetSelect = (preset: OrderQuickDatePreset) => {
    if (preset === "custom") return;

    const nextDateRange =
      preset === "last-month" ? getLastMonthOrderDateRange() : getCurrentMonthDashboardDateRange();

    updateDraftFilters((current) => ({
      ...current,
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
      if (!didNavigate) setPendingAction(null);
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

    setDraftFilters((current) => ({
      ...current,
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

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
              {primaryFilterSummary}
            </p>

            <AppliedFilterPills items={appliedFilterItems} />
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start">
            <FilterTriggerButton
              ref={filterButtonRef}
              activeCount={activeFilterCount}
              isOpen={isOpen}
              isPending={isApplyPending}
              panelId={filterPanelId}
              onClick={handleFilterToggle}
            />
          </div>
        </div>
      </div>

      <FilterDrawerShell
        panelId={filterPanelId}
        titleId={filterTitleId}
        title="Filter orders"
        subtitle={drawerSubtitle}
        isOpen={isOpen}
        onClose={closeDrawer}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isPending={isApplyPending}
        closeButtonRef={filterCloseButtonRef}
      >
        <div className="space-y-4">
          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Date range</p>

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
                      "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
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
                <span className={FILTER_FIELD_LABEL_CLASS}>From</span>
                <Input
                  type="date"
                  value={draftFilters.from ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      from: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>To</span>
                <Input
                  type="date"
                  value={draftFilters.to ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      to: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>
            </div>
          </section>

          <label className="space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>View by</span>
            <Select
              value={draftFilters.dateField}
              onChange={(event) =>
                updateDraftFilters((current) => ({
                  ...current,
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
              <span className={FILTER_FIELD_LABEL_CLASS}>Order status</span>
              <Select
                value={draftFilters.status ?? ""}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
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
              <span className={FILTER_FIELD_LABEL_CLASS}>Payment status</span>
              <Select
                value={draftFilters.paymentStatus ?? ""}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
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
            <span className={FILTER_FIELD_LABEL_CLASS}>Payment mode</span>
            <Select
              value={draftFilters.paymentMode ?? ""}
              onChange={(event) =>
                updateDraftFilters((current) => ({
                  ...current,
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
              <span className={FILTER_FIELD_LABEL_CLASS}>Order code</span>
              <Input
                type="text"
                placeholder="Search code…"
                value={draftFilters.orderCode ?? ""}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    orderCode: event.target.value.length > 0 ? event.target.value : null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              />
            </label>

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Txn reference</span>
              <Input
                type="text"
                placeholder="Search ref…"
                value={draftFilters.txnReference ?? ""}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    txnReference: event.target.value.length > 0 ? event.target.value : null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>Customer</span>
            <Select
              value={draftFilters.customerId ?? ""}
              onChange={(event) =>
                updateDraftFilters((current) => ({
                  ...current,
                  customerId: event.target.value.length > 0 ? event.target.value : null,
                }))
              }
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              disabled={filterOptions.customers.length === 0}
            >
              <option value="">
                {filterOptions.customers.length === 0 ? "No customers found" : "All customers"}
              </option>
              {filterOptions.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>Created by</span>
            <Select
              value={draftFilters.createdBy ?? ""}
              onChange={(event) =>
                updateDraftFilters((current) => ({
                  ...current,
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
            <span className={FILTER_FIELD_LABEL_CLASS}>Vendor</span>
            <Select
              value={draftFilters.vendorId ?? ""}
              onChange={(event) =>
                updateDraftFilters((current) => ({
                  ...current,
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
              onClick={() => setIsAdvancedOpen((current) => !current)}
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
                  <span className={FILTER_FIELD_LABEL_CLASS}>Inventory item</span>
                  <Select
                    value={draftFilters.inventoryId ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        inventoryId: event.target.value.length > 0 ? event.target.value : null,
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
                  <span className={FILTER_FIELD_LABEL_CLASS}>Offer item</span>
                  <Select
                    value={draftFilters.offerItemId ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        offerItemId: event.target.value.length > 0 ? event.target.value : null,
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
                    <span className={FILTER_FIELD_LABEL_CLASS}>Min payable</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftFilters.payableMin ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          payableMin: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Max payable</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftFilters.payableMax ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          payableMax: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Min paid</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftFilters.paidMin ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          paidMin: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Max paid</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftFilters.paidMax ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          paidMax: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Min outstanding</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftFilters.outstandingMin ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          outstandingMin: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Max outstanding</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftFilters.outstandingMax ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          outstandingMax: event.target.value.length > 0 ? event.target.value : null,
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
      </FilterDrawerShell>
    </div>
  );
}
