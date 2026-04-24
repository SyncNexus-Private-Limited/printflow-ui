"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppliedFilterPills, type AppliedFilterSummaryItem } from "@/components/dashboard/applied-filter-pills";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import { getInventoryStockStateTone } from "@/components/dashboard/data-pill";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildInventoryPageHref,
  getInventoryQuickDatePreset,
  getLastMonthInventoryDateRange,
  inventoryQuickDatePresetValues,
  type InventoryPageFilterState,
  type InventoryQuickDatePreset,
} from "@/lib/dashboard/inventory-page-filters";
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import { getCurrentMonthDashboardDateRange } from "@/lib/dashboard/page-filters";
import type { InventoryVendorOption } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";

type InventoryListControlsProps = {
  currentPath: string;
  currentFilters: InventoryPageFilterState;
  vendorOptions: InventoryVendorOption[];
  selectedBranchName: string;
};

const summaryCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function toDraftFilters(filters: InventoryPageFilterState): InventoryPageFilterState {
  return filters;
}

function getActiveFilterCount(filters: InventoryPageFilterState): number {
  let count = 0;

  if (filters.dateField !== "updated") count += 1;

  const preset = getInventoryQuickDatePreset({ from: filters.from, to: filters.to });
  if (preset !== null && preset !== "this-month") {
    count += 1;
  } else if (filters.from || filters.to) {
    count += 1;
  }

  if (filters.name) count += 1;
  if (filters.sku) count += 1;
  if (filters.unit) count += 1;
  if (filters.isActive !== "all") count += 1;
  if (filters.stockState) count += 1;
  if (filters.quantityMin || filters.quantityMax) count += 1;
  if (filters.lastVendorId) count += 1;
  if (filters.purchaseRateMin || filters.purchaseRateMax) count += 1;
  if (filters.hasLastPurchaseRate !== "all") count += 1;
  if (filters.hasImage !== "all") count += 1;

  return count;
}

function getAdvancedFilterCount(filters: InventoryPageFilterState): number {
  let count = 0;
  if (filters.dateField !== "updated") count += 1;
  if (filters.hasImage !== "all") count += 1;
  if (filters.hasLastPurchaseRate !== "all") count += 1;
  return count;
}

function formatSummaryNumeric(value: string | null): string | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return summaryCurrencyFormatter.format(parsed);
}

function buildPrimaryFilterSummary(filters: InventoryPageFilterState): string {
  const dateFieldLabel = filters.dateField === "created" ? "Created date" : "Updated date";

  if (!filters.from && !filters.to) {
    return `${dateFieldLabel} · All inventory`;
  }

  const preset = getInventoryQuickDatePreset({ from: filters.from, to: filters.to });
  const rangeLabel =
    preset === "this-month"
      ? "This month"
      : preset === "last-month"
        ? "Last month"
        : formatDateRangeLabel(filters.from, filters.to);

  return `${dateFieldLabel} · ${rangeLabel}`;
}

function formatStockStateLabel(stockState: string): string {
  switch (stockState) {
    case "in-stock": return "In stock";
    case "low-stock": return "Low stock";
    case "out-of-stock": return "Out of stock";
    default: return stockState;
  }
}

function buildAppliedFilterSummaryItems({
  filters,
  vendorOptions,
  branchName,
}: {
  filters: InventoryPageFilterState;
  vendorOptions: InventoryVendorOption[];
  branchName: string;
}): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [{ key: "branch", label: `Branch: ${branchName}` }];

  if (filters.name) items.push({ key: "name", label: `Name: ${filters.name}` });
  if (filters.sku) items.push({ key: "sku", label: `SKU: ${filters.sku}` });
  if (filters.unit) items.push({ key: "unit", label: `Unit: ${filters.unit}` });

  if (filters.stockState) {
    items.push({
      key: "stock",
      label: `Stock: ${formatStockStateLabel(filters.stockState)}`,
      tone: getInventoryStockStateTone(filters.stockState),
    });
  }

  if (filters.isActive !== "all") {
    items.push({
      key: "active",
      label: `Status: ${filters.isActive === "active" ? "Active" : "Inactive"}`,
      tone: filters.isActive === "active" ? "emerald" : "neutral",
    });
  }

  if (filters.lastVendorId) {
    const vendor = vendorOptions.find((v) => v.id === filters.lastVendorId);
    if (vendor) items.push({ key: "vendor", label: `Vendor: ${vendor.name}` });
  }

  const minRateLabel = formatSummaryNumeric(filters.purchaseRateMin);
  const maxRateLabel = formatSummaryNumeric(filters.purchaseRateMax);

  if (minRateLabel || maxRateLabel) {
    let label = "";
    if (minRateLabel && maxRateLabel) label = `Rate: ${minRateLabel}–${maxRateLabel}`;
    else if (minRateLabel) label = `Min rate: ${minRateLabel}`;
    else label = `Max rate: ${maxRateLabel}`;
    items.push({ key: "rate", label });
  }

  if (filters.quantityMin || filters.quantityMax) {
    const min = filters.quantityMin;
    const max = filters.quantityMax;
    let label = "";
    if (min && max) label = `Qty: ${min}–${max}`;
    else if (min) label = `Min qty: ${min}`;
    else label = `Max qty: ${max}`;
    items.push({ key: "qty", label });
  }

  if (filters.hasLastPurchaseRate === "with") items.push({ key: "has-rate", label: "Has purchase rate" });
  else if (filters.hasLastPurchaseRate === "without") items.push({ key: "no-rate", label: "No purchase rate" });

  if (filters.hasImage === "with") items.push({ key: "has-image", label: "Has image" });
  else if (filters.hasImage === "without") items.push({ key: "no-image", label: "No image" });

  return items;
}

export function InventoryListControls({
  currentPath,
  currentFilters,
  vendorOptions,
  selectedBranchName,
}: InventoryListControlsProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const currentHref = useMemo(
    () => buildInventoryPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const primaryFilterSummary = useMemo(() => buildPrimaryFilterSummary(currentFilters), [currentFilters]);
  const appliedFilterItems = useMemo(
    () => buildAppliedFilterSummaryItems({ filters: currentFilters, vendorOptions, branchName: selectedBranchName }),
    [currentFilters, vendorOptions, selectedBranchName],
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

  const baseId = filterPanelId.split("-filter-panel")[0];
  const advancedPanelId = `${baseId}-advanced-filters`;

  const currentDatePreset = getInventoryQuickDatePreset({ from: draftFilters.from, to: draftFilters.to });
  const advancedFilterCount = useMemo(() => getAdvancedFilterCount(draftFilters), [draftFilters]);

  const drawerSubtitle =
    activeFilterCount > 0
      ? `${activeFilterCount} active filters`
      : "Filter by date, stock status, and item details";

  const handleFilterToggle = () => {
    if (!isOpen) {
      setIsAdvancedOpen(getAdvancedFilterCount(draftFilters) > 0);
    }
    toggleFilterDrawer();
  };

  const updateDraftFilters = (updater: (current: InventoryPageFilterState) => InventoryPageFilterState) => {
    setDraftFilters((current) => updater(current));
  };

  const handleDatePresetSelect = (preset: InventoryQuickDatePreset) => {
    if (preset === "custom") return;

    const nextDateRange =
      preset === "last-month" ? getLastMonthInventoryDateRange() : getCurrentMonthDashboardDateRange();

    updateDraftFilters((current) => ({ ...current, from: nextDateRange.from, to: nextDateRange.to }));
  };

  const handleClearDates = () => {
    updateDraftFilters((current) => ({ ...current, from: null, to: null }));
  };

  const handleApplyFilters = () => {
    const nextHref = buildInventoryPageHref(currentPath, currentFilters, { ...draftFilters, page: 1 });

    setPendingAction("apply");
    startTransition(() => {
      const didNavigate = navigateToHref(nextHref);
      if (!didNavigate) setPendingAction(null);
    });
  };

  const handleResetFilters = () => {
    const nextHref = buildInventoryPageHref(currentPath, currentFilters, {
      from: null,
      to: null,
      page: 1,
      dateField: "updated",
      name: null,
      sku: null,
      unit: null,
      isActive: "all",
      stockState: null,
      quantityMin: null,
      quantityMax: null,
      lastVendorId: null,
      purchaseRateMin: null,
      purchaseRateMax: null,
      hasLastPurchaseRate: "all",
      hasImage: "all",
      sort: "updated-at-desc",
    });

    setDraftFilters((current) => ({
      ...current,
      from: null,
      to: null,
      page: 1,
      dateField: "updated",
      name: null,
      sku: null,
      unit: null,
      isActive: "all",
      stockState: null,
      quantityMin: null,
      quantityMax: null,
      lastVendorId: null,
      purchaseRateMin: null,
      purchaseRateMax: null,
      hasLastPurchaseRate: "all",
      hasImage: "all",
      sort: "updated-at-desc",
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
        title="Filter inventory"
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Date range</p>
              {(draftFilters.from || draftFilters.to) && (
                <button
                  type="button"
                  onClick={handleClearDates}
                  className="text-xs text-[rgb(var(--muted-foreground))] underline-offset-2 hover:underline"
                >
                  Clear dates
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {inventoryQuickDatePresetValues.map((preset) => {
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

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Search</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Name</span>
                <Input
                  type="text"
                  placeholder="Item name"
                  value={draftFilters.name ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      name: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>SKU</span>
                <Input
                  type="text"
                  placeholder="SKU code"
                  value={draftFilters.sku ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      sku: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Stock</p>

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Stock status</span>
              <Select
                value={draftFilters.stockState ?? ""}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    stockState:
                      event.target.value === "in-stock" ||
                      event.target.value === "low-stock" ||
                      event.target.value === "out-of-stock"
                        ? event.target.value
                        : null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              >
                <option value="">All stock states</option>
                <option value="in-stock">In stock</option>
                <option value="low-stock">Low stock</option>
                <option value="out-of-stock">Out of stock</option>
              </Select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Min quantity</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={draftFilters.quantityMin ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      quantityMin: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Max quantity</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={draftFilters.quantityMax ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      quantityMax: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Unit</span>
              <Input
                type="text"
                placeholder="e.g. pcs, kg, roll"
                value={draftFilters.unit ?? ""}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    unit: event.target.value.length > 0 ? event.target.value : null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              />
            </label>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Status</p>

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Active status</span>
              <Select
                value={draftFilters.isActive}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    isActive:
                      event.target.value === "active" || event.target.value === "inactive"
                        ? event.target.value
                        : "all",
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              >
                <option value="all">All items</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </Select>
            </label>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Commercial</p>

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Last vendor</span>
              <Select
                value={draftFilters.lastVendorId ?? ""}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    lastVendorId: event.target.value.length > 0 ? event.target.value : null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                disabled={vendorOptions.length === 0}
              >
                <option value="">
                  {vendorOptions.length === 0 ? "No vendors found" : "All vendors"}
                </option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </Select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Min rate</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={draftFilters.purchaseRateMin ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      purchaseRateMin: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Max rate</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={draftFilters.purchaseRateMax ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      purchaseRateMax: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[rgb(var(--border)/0.62)] bg-[rgb(var(--background)/0.42)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={isAdvancedOpen}
              aria-controls={advancedPanelId}
              onClick={() => setIsAdvancedOpen((current) => !current)}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Advanced filters</p>
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  {advancedFilterCount > 0 ? `${advancedFilterCount} selected` : "View by, image, and rate presence"}
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
                className="grid gap-3 border-t border-[rgb(var(--border)/0.62)] px-4 py-4 sm:grid-cols-2"
              >
                <label className="space-y-2">
                  <span className={FILTER_FIELD_LABEL_CLASS}>View by</span>
                  <Select
                    value={draftFilters.dateField}
                    onChange={(event) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        dateField: event.target.value === "created" ? "created" : "updated",
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  >
                    <option value="updated">Updated date</option>
                    <option value="created">Created date</option>
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className={FILTER_FIELD_LABEL_CLASS}>Has image</span>
                  <Select
                    value={draftFilters.hasImage}
                    onChange={(event) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        hasImage:
                          event.target.value === "with" || event.target.value === "without"
                            ? event.target.value
                            : "all",
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  >
                    <option value="all">All items</option>
                    <option value="with">Has image</option>
                    <option value="without">No image</option>
                  </Select>
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className={FILTER_FIELD_LABEL_CLASS}>Purchase rate</span>
                  <Select
                    value={draftFilters.hasLastPurchaseRate}
                    onChange={(event) =>
                      updateDraftFilters((current) => ({
                        ...current,
                        hasLastPurchaseRate:
                          event.target.value === "with" || event.target.value === "without"
                            ? event.target.value
                            : "all",
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  >
                    <option value="all">All items</option>
                    <option value="with">Has purchase rate</option>
                    <option value="without">No purchase rate</option>
                  </Select>
                </label>
              </div>
            ) : null}
          </section>
        </div>
      </FilterDrawerShell>
    </div>
  );
}
