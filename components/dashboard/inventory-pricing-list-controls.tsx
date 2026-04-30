"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AppliedFilterPills,
  type AppliedFilterSummaryItem,
} from "@/components/dashboard/applied-filter-pills";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import { getCustomerTypeTone, type DataPillTone } from "@/components/dashboard/data-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus } from "lucide-react";
import {
  buildInventoryPricingPageHref,
  type InventoryPricingPageFilterState,
  type InventoryPricingStatus,
} from "@/lib/dashboard/inventory-pricing-page-filters";
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import { cn } from "@/lib/utils/cn";
import { formatDateRangeLabel, formatEnumLabel } from "@/lib/utils/format";

type InventoryPricingListControlsProps = {
  currentPath: string;
  currentFilters: InventoryPricingPageFilterState;
  selectedBranchName: string;
  canCreate: boolean;
  addPricingDisabled: boolean;
  addPricingHref: string;
};

function getPricingStatusTone(status: InventoryPricingStatus): DataPillTone {
  switch (status) {
    case "current":
      return "emerald";
    case "upcoming":
      return "blue";
    case "expired":
      return "neutral";
  }
}

function toDraftFilters(filters: InventoryPricingPageFilterState): InventoryPricingPageFilterState {
  return filters;
}

function getActiveFilterCount(filters: InventoryPricingPageFilterState): number {
  let count = 0;
  if (filters.from || filters.to) count += 1;
  if (filters.itemName) count += 1;
  if (filters.sku) count += 1;
  if (filters.customerType) count += 1;
  if (filters.status !== "all") count += 1;
  return count;
}

function buildPrimaryFilterSummary(filters: InventoryPricingPageFilterState): string {
  if (!filters.from && !filters.to) return "Effective dates - All pricing";
  return `Effective dates - ${formatDateRangeLabel(filters.from, filters.to)}`;
}

function buildAppliedFilterSummaryItems({
  filters,
  branchName,
}: {
  filters: InventoryPricingPageFilterState;
  branchName: string;
}): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [{ key: "branch", label: `Branch: ${branchName}` }];

  if (filters.itemName) items.push({ key: "itemName", label: `Item: ${filters.itemName}` });
  if (filters.sku) items.push({ key: "sku", label: `SKU: ${filters.sku}` });
  if (filters.customerType) {
    items.push({
      key: "customerType",
      label: `Customer: ${formatEnumLabel(filters.customerType)}`,
      tone: getCustomerTypeTone(filters.customerType),
    });
  }
  if (filters.status !== "all") {
    items.push({
      key: "status",
      label: `Status: ${formatEnumLabel(filters.status)}`,
      tone: getPricingStatusTone(filters.status),
    });
  }
  if (filters.from || filters.to) {
    items.push({
      key: "dateRange",
      label: `Effective: ${formatDateRangeLabel(filters.from, filters.to)}`,
    });
  }

  return items;
}

export function InventoryPricingListControls({
  currentPath,
  currentFilters,
  selectedBranchName,
  canCreate,
  addPricingDisabled,
  addPricingHref,
}: InventoryPricingListControlsProps) {
  const currentHref = useMemo(
    () => buildInventoryPricingPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const primaryFilterSummary = useMemo(
    () => buildPrimaryFilterSummary(currentFilters),
    [currentFilters],
  );
  const appliedFilterItems = useMemo(
    () =>
      buildAppliedFilterSummaryItems({
        filters: currentFilters,
        branchName: selectedBranchName,
      }),
    [currentFilters, selectedBranchName],
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
    handleFilterToggle,
    closeDrawer,
    navigateToHref,
    startTransition,
    setPendingAction,
  } = useFilterDrawer({ currentHref, currentFilters, toDraftFilters });

  const drawerSubtitle =
    activeFilterCount > 0
      ? `${activeFilterCount} active filters`
      : "Filter by item, customer type, status, and effective dates";

  const updateDraftFilters = (
    updater: (current: InventoryPricingPageFilterState) => InventoryPricingPageFilterState,
  ) => {
    setDraftFilters((current) => updater(current));
  };

  const handleClearDates = () => {
    updateDraftFilters((current) => ({ ...current, from: null, to: null }));
  };

  const handleApplyFilters = () => {
    const nextHref = buildInventoryPricingPageHref(currentPath, currentFilters, {
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
    const nextHref = buildInventoryPricingPageHref(currentPath, currentFilters, {
      from: null,
      to: null,
      page: 1,
      itemName: null,
      sku: null,
      customerType: null,
      status: "all",
      sort: "updated-at-desc",
    });

    setDraftFilters((current) => ({
      ...current,
      from: null,
      to: null,
      page: 1,
      itemName: null,
      sku: null,
      customerType: null,
      status: "all",
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
            {canCreate ? (
              addPricingDisabled ? (
                <Button
                  type="button"
                  className="h-11 w-11 rounded-2xl px-0"
                  disabled
                  aria-label="Add pricing"
                  title="No active inventory items available"
                >
                  <Plus className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={2} />
                </Button>
              ) : (
                <Link
                  href={addPricingHref}
                  className={cn(
                    "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-transparent bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] shadow-[0_20px_44px_-28px_rgb(var(--shadow)/0.65)] transition-all hover:bg-[rgb(var(--primary-strong))]",
                    "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
                  )}
                  aria-label="Add pricing"
                  title="Add pricing"
                >
                  <Plus className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={2} />
                </Link>
              )
            ) : null}
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
        title="Filter inventory pricing"
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
              <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                Effective date range
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
                <span className={FILTER_FIELD_LABEL_CLASS}>Item name</span>
                <Input
                  type="text"
                  placeholder="Item name"
                  value={draftFilters.itemName ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((current) => ({
                      ...current,
                      itemName: event.target.value.length > 0 ? event.target.value : null,
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
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Pricing</p>

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Customer type</span>
              <Select
                value={draftFilters.customerType ?? ""}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    customerType:
                      event.target.value === "studio" ||
                      event.target.value === "amateur" ||
                      event.target.value === "other" ||
                      event.target.value === "employee"
                        ? event.target.value
                        : null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              >
                <option value="">All customer types</option>
                <option value="studio">Studio</option>
                <option value="amateur">Amateur</option>
                <option value="other">Other</option>
                <option value="employee">Employee</option>
              </Select>
            </label>

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Pricing status</span>
              <Select
                value={draftFilters.status}
                onChange={(event) =>
                  updateDraftFilters((current) => ({
                    ...current,
                    status:
                      event.target.value === "current" ||
                      event.target.value === "upcoming" ||
                      event.target.value === "expired"
                        ? event.target.value
                        : "all",
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              >
                <option value="all">All statuses</option>
                <option value="current">Current</option>
                <option value="upcoming">Upcoming</option>
                <option value="expired">Expired</option>
              </Select>
            </label>
          </section>
        </div>
      </FilterDrawerShell>
    </div>
  );
}
