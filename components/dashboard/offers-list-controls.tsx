"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import { DataPill, type DataPillTone, getExpenseCategoryStatusTone } from "@/components/dashboard/data-pill";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildOffersPageHref,
  type OfferStatusFilter,
  type OfferTimingFilter,
  type OfferTypeFilter,
  type OffersPageFilterState,
} from "@/lib/dashboard/offers-page-filters";
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import { cn } from "@/lib/utils/cn";
import { formatDateRangeLabel, formatEnumLabel } from "@/lib/utils/format";

type OffersListControlsProps = {
  currentPath: string;
  currentFilters: OffersPageFilterState;
  selectedBranchName: string;
  canCreate: boolean;
};

type AppliedItem = {
  key: string;
  label: string;
  tone?: DataPillTone;
  href: string;
};

function toDraftFilters(filters: OffersPageFilterState): OffersPageFilterState {
  return filters;
}

function getActiveFilterCount(filters: OffersPageFilterState) {
  let count = 0;
  if (filters.search) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.offerType !== "all") count += 1;
  if (filters.timing !== "all") count += 1;
  if (filters.startsFrom || filters.startsTo) count += 1;
  return count;
}

function buildAppliedItems(
  path: string,
  filters: OffersPageFilterState,
  selectedBranchName: string,
): AppliedItem[] {
  const base = { page: 1 };
  const items: AppliedItem[] = [
    {
      key: "branch",
      label: `Branch: ${selectedBranchName}`,
      href: buildOffersPageHref(path, filters, base),
    },
  ];

  if (filters.search) {
    items.push({
      key: "search",
      label: `Search: ${filters.search}`,
      href: buildOffersPageHref(path, filters, { ...base, search: null }),
    });
  }
  if (filters.status !== "all") {
    items.push({
      key: "status",
      label: `Status: ${formatEnumLabel(filters.status)}`,
      tone: getExpenseCategoryStatusTone(filters.status),
      href: buildOffersPageHref(path, filters, { ...base, status: "all" }),
    });
  }
  if (filters.offerType !== "all") {
    items.push({
      key: "type",
      label: `Type: ${formatEnumLabel(filters.offerType)}`,
      tone: "blue",
      href: buildOffersPageHref(path, filters, { ...base, offerType: "all" }),
    });
  }
  if (filters.timing !== "all") {
    items.push({
      key: "timing",
      label: `Timing: ${formatEnumLabel(filters.timing)}`,
      tone: filters.timing === "current" ? "emerald" : filters.timing === "upcoming" ? "amber" : "rose",
      href: buildOffersPageHref(path, filters, { ...base, timing: "all" }),
    });
  }
  if (filters.startsFrom || filters.startsTo) {
    items.push({
      key: "starts",
      label: `Starts: ${formatDateRangeLabel(filters.startsFrom, filters.startsTo)}`,
      href: buildOffersPageHref(path, filters, { ...base, startsFrom: null, startsTo: null }),
    });
  }

  return items;
}

function RemovablePills({ items }: { items: AppliedItem[] }) {
  if (items.length === 0) return null;
  const visible = items.slice(0, 4);
  const remaining = items.length - visible.length;

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
      {visible.map((item) => (
        <Link key={item.key} href={item.href} className="group rounded-full">
          <DataPill tone={item.tone ?? "neutral"} appearance="outline">
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.key !== "branch" ? <X className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" /> : null}
            </span>
          </DataPill>
        </Link>
      ))}
      {remaining > 0 ? (
        <DataPill tone="neutral" appearance="outline">
          +{remaining} more
        </DataPill>
      ) : null}
    </div>
  );
}

export function OffersListControls({
  currentPath,
  currentFilters,
  selectedBranchName,
  canCreate,
}: OffersListControlsProps) {
  const currentHref = useMemo(
    () => buildOffersPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const appliedItems = useMemo(
    () => buildAppliedItems(currentPath, currentFilters, selectedBranchName),
    [currentFilters, currentPath, selectedBranchName],
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

  const updateDraft = (updater: (current: OffersPageFilterState) => OffersPageFilterState) =>
    setDraftFilters((current) => updater(current));

  const handleApplyFilters = () => {
    const nextHref = buildOffersPageHref(currentPath, currentFilters, {
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
    navigateToHref(
      buildOffersPageHref(currentPath, currentFilters, {
        search: null,
        status: "all",
        offerType: "all",
        timing: "all",
        startsFrom: null,
        startsTo: null,
        page: 1,
      }),
    );
  };

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
            Promotion rules
          </p>
          <RemovablePills items={appliedItems} />
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          {canCreate ? (
            <Link
              href="/dashboard/offers/new"
              aria-label="Add Offer"
              title="Add Offer"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[rgb(var(--primary))] text-sm font-semibold text-[rgb(var(--primary-foreground))] shadow-[0_20px_44px_-28px_rgb(var(--shadow)/0.65)] transition-all hover:bg-[rgb(var(--primary-strong))] lg:w-auto lg:px-4",
                "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
              )}
            >
              <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
              <span className="hidden lg:inline">Add Offer</span>
            </Link>
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

      <FilterDrawerShell
        panelId={filterPanelId}
        titleId={filterTitleId}
        title="Filter offers"
        subtitle={activeFilterCount > 0 ? `${activeFilterCount} active filters` : "Narrow down offers"}
        isOpen={isOpen}
        onClose={closeDrawer}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isPending={isApplyPending}
        closeButtonRef={filterCloseButtonRef}
      >
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>Search</span>
            <Input
              value={draftFilters.search ?? ""}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  search: event.target.value.trim().length > 0 ? event.target.value : null,
                }))
              }
              placeholder="Code, name, or description"
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Status</span>
              <Select value={draftFilters.status} onChange={(event) => updateDraft((current) => ({ ...current, status: event.target.value as OfferStatusFilter }))} className="h-11 rounded-2xl bg-[rgb(var(--background))]">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Type</span>
              <Select value={draftFilters.offerType} onChange={(event) => updateDraft((current) => ({ ...current, offerType: event.target.value as OfferTypeFilter }))} className="h-11 rounded-2xl bg-[rgb(var(--background))]">
                <option value="all">All</option>
                <option value="percentage">Percentage</option>
                <option value="flat">Flat</option>
                <option value="buy_x_get_y">Buy X Get Y</option>
              </Select>
            </label>
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Timing</span>
              <Select value={draftFilters.timing} onChange={(event) => updateDraft((current) => ({ ...current, timing: event.target.value as OfferTimingFilter }))} className="h-11 rounded-2xl bg-[rgb(var(--background))]">
                <option value="all">All</option>
                <option value="current">Current</option>
                <option value="upcoming">Upcoming</option>
                <option value="expired">Expired</option>
              </Select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Starts from</span>
              <Input type="date" value={draftFilters.startsFrom ?? ""} onChange={(event) => updateDraft((current) => ({ ...current, startsFrom: event.target.value || null }))} className="h-11 rounded-2xl bg-[rgb(var(--background))]" />
            </label>
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Starts to</span>
              <Input type="date" value={draftFilters.startsTo ?? ""} onChange={(event) => updateDraft((current) => ({ ...current, startsTo: event.target.value || null }))} className="h-11 rounded-2xl bg-[rgb(var(--background))]" />
            </label>
          </div>
        </div>
      </FilterDrawerShell>
    </div>
  );
}
