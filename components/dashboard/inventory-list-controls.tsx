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
import { ChevronDown, Filter, Undo2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataPill, getInventoryStockStateTone, type DataPillTone } from "@/components/dashboard/data-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  buildInventoryPageHref,
  getInventoryQuickDatePreset,
  getLastMonthInventoryDateRange,
  inventoryQuickDatePresetValues,
  type InventoryPageFilterState,
  type InventoryQuickDatePreset,
} from "@/lib/dashboard/inventory-page-filters";
import { getCurrentMonthDashboardDateRange } from "@/lib/dashboard/page-filters";
import type { InventoryVendorOption } from "@/lib/dashboard/types";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";

type InventoryListControlsProps = {
  currentPath: string;
  currentFilters: InventoryPageFilterState;
  vendorOptions: InventoryVendorOption[];
};

type InventoryControlPanel = "filter" | null;

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

function getActiveFilterCount(filters: InventoryPageFilterState): number {
  let count = 0;

  if (filters.dateField !== "updated") {
    count += 1;
  }

  const preset = getInventoryQuickDatePreset({ from: filters.from, to: filters.to });

  if (preset !== null && preset !== "this-month") {
    count += 1;
  } else if (filters.from || filters.to) {
    // date filter applied but doesn't match a named preset
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
  const dateFieldLabel =
    filters.dateField === "created" ? "Created date" : "Updated date";

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
    case "in-stock":
      return "In stock";
    case "low-stock":
      return "Low stock";
    case "out-of-stock":
      return "Out of stock";
    default:
      return stockState;
  }
}

function buildAppliedFilterSummaryItems({
  filters,
  vendorOptions,
}: {
  filters: InventoryPageFilterState;
  vendorOptions: InventoryVendorOption[];
}): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [];

  if (filters.name) {
    items.push({ key: "name", label: `Name: ${filters.name}` });
  }

  if (filters.sku) {
    items.push({ key: "sku", label: `SKU: ${filters.sku}` });
  }

  if (filters.unit) {
    items.push({ key: "unit", label: `Unit: ${filters.unit}` });
  }

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

    if (vendor) {
      items.push({ key: "vendor", label: `Vendor: ${vendor.name}` });
    }
  }

  const minRateLabel = formatSummaryNumeric(filters.purchaseRateMin);
  const maxRateLabel = formatSummaryNumeric(filters.purchaseRateMax);

  if (minRateLabel || maxRateLabel) {
    let label = "";

    if (minRateLabel && maxRateLabel) {
      label = `Rate: ${minRateLabel}–${maxRateLabel}`;
    } else if (minRateLabel) {
      label = `Min rate: ${minRateLabel}`;
    } else {
      label = `Max rate: ${maxRateLabel}`;
    }

    items.push({ key: "rate", label });
  }

  if (filters.quantityMin || filters.quantityMax) {
    const min = filters.quantityMin;
    const max = filters.quantityMax;
    let label = "";

    if (min && max) {
      label = `Qty: ${min}–${max}`;
    } else if (min) {
      label = `Min qty: ${min}`;
    } else {
      label = `Max qty: ${max}`;
    }

    items.push({ key: "qty", label });
  }

  if (filters.hasLastPurchaseRate === "with") {
    items.push({ key: "has-rate", label: "Has purchase rate" });
  } else if (filters.hasLastPurchaseRate === "without") {
    items.push({ key: "no-rate", label: "No purchase rate" });
  }

  if (filters.hasImage === "with") {
    items.push({ key: "has-image", label: "Has image" });
  } else if (filters.hasImage === "without") {
    items.push({ key: "no-image", label: "No image" });
  }

  return items;
}

function getPanelCardClassName() {
  return suggestCanonicalClasses(
    "overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] shadow-[0_28px_64px_-42px_rgb(var(--shadow)/0.28)] backdrop-blur-xl",
  );
}

export function InventoryListControls({
  currentPath,
  currentFilters,
  vendorOptions,
}: InventoryListControlsProps) {
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
  const previousOpenPanelRef = useRef<InventoryControlPanel>(null);
  const [openPanel, setOpenPanel] = useState<InventoryControlPanel>(null);
  const [draftFilters, setDraftFilters] = useState<InventoryPageFilterState>(currentFilters);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"apply" | null>(null);
  const [isPending, startTransition] = useTransition();
  const currentHref = useMemo(
    () => buildInventoryPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(
    () => getActiveFilterCount(currentFilters),
    [currentFilters],
  );
  const primaryFilterSummary = useMemo(
    () => buildPrimaryFilterSummary(currentFilters),
    [currentFilters],
  );
  const currentDatePreset = getInventoryQuickDatePreset({
    from: draftFilters.from,
    to: draftFilters.to,
  });
  const advancedFilterCount = useMemo(
    () => getAdvancedFilterCount(draftFilters),
    [draftFilters],
  );
  const appliedFilterSummaryItems = useMemo(
    () =>
      buildAppliedFilterSummaryItems({
        filters: currentFilters,
        vendorOptions,
      }),
    [currentFilters, vendorOptions],
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
    updater: (current: InventoryPageFilterState) => InventoryPageFilterState,
  ) => {
    setDraftFilters((current) => updater(current));
  };

  const handleFilterToggle = () => {
    if (openPanel !== "filter") {
      setIsAdvancedOpen(getAdvancedFilterCount(draftFilters) > 0);
    }

    setOpenPanel((current) => (current === "filter" ? null : "filter"));
  };

  const handleDatePresetSelect = (preset: InventoryQuickDatePreset) => {
    if (preset === "custom") {
      return;
    }

    const nextDateRange =
      preset === "last-month"
        ? getLastMonthInventoryDateRange()
        : getCurrentMonthDashboardDateRange();

    updateDraftFilters((current) => ({
      ...current,
      from: nextDateRange.from,
      to: nextDateRange.to,
    }));
  };

  const handleClearDates = () => {
    updateDraftFilters((current) => ({
      ...current,
      from: null,
      to: null,
    }));
  };

  const handleApplyFilters = () => {
    const nextHref = buildInventoryPageHref(currentPath, currentFilters, {
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
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-[rgb(var(--border)/0.62)] px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p
                  id={filterTitleId}
                  className="text-base font-semibold text-[rgb(var(--card-foreground))]"
                >
                  Filter inventory
                </p>
                <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} active filters`
                    : "Filter by date, stock status, and item details"}
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

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="space-y-4">
                {/* Date range */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                      Date range
                    </p>
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
                      <span className={fieldLabelClassName}>From</span>
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
                      <span className={fieldLabelClassName}>To</span>
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

                {/* Search */}
                <section className="space-y-3">
                  <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Search</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className={fieldLabelClassName}>Name</span>
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
                      <span className={fieldLabelClassName}>SKU</span>
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

                {/* Stock */}
                <section className="space-y-3">
                  <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Stock</p>

                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Stock status</span>
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
                      <span className={fieldLabelClassName}>Min quantity</span>
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
                            quantityMin:
                              event.target.value.length > 0 ? event.target.value : null,
                          }))
                        }
                        className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className={fieldLabelClassName}>Max quantity</span>
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
                            quantityMax:
                              event.target.value.length > 0 ? event.target.value : null,
                          }))
                        }
                        className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                      />
                    </label>
                  </div>

                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Unit</span>
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

                {/* Status */}
                <section className="space-y-3">
                  <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Status</p>

                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Active status</span>
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

                {/* Commercial */}
                <section className="space-y-3">
                  <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                    Commercial
                  </p>

                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Last vendor</span>
                    <Select
                      value={draftFilters.lastVendorId ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((current) => ({
                          ...current,
                          lastVendorId:
                            event.target.value.length > 0 ? event.target.value : null,
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
                      <span className={fieldLabelClassName}>Min rate</span>
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
                            purchaseRateMin:
                              event.target.value.length > 0 ? event.target.value : null,
                          }))
                        }
                        className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className={fieldLabelClassName}>Max rate</span>
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
                            purchaseRateMax:
                              event.target.value.length > 0 ? event.target.value : null,
                          }))
                        }
                        className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                      />
                    </label>
                  </div>
                </section>

                {/* Advanced filters */}
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
                          : "View by, image, and rate presence"}
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
                        <span className={fieldLabelClassName}>View by</span>
                        <Select
                          value={draftFilters.dateField}
                          onChange={(event) =>
                            updateDraftFilters((current) => ({
                              ...current,
                              dateField:
                                event.target.value === "created" ? "created" : "updated",
                            }))
                          }
                          className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                        >
                          <option value="updated">Updated date</option>
                          <option value="created">Created date</option>
                        </Select>
                      </label>

                      <label className="space-y-2">
                        <span className={fieldLabelClassName}>Has image</span>
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
                        <span className={fieldLabelClassName}>Purchase rate</span>
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
            </div>

            {/* Footer */}
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
