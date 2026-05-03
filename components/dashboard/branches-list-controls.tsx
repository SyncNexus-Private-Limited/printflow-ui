"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import {
  DataPill,
  getExpenseCategoryStatusTone,
  type DataPillTone,
} from "@/components/dashboard/data-pill";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildBranchesPageHref,
  type BranchStatusFilter,
  type BranchesPageFilterState,
} from "@/lib/dashboard/branches-page-filters";
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import { cn } from "@/lib/utils/cn";
import { formatDateRangeLabel, formatEnumLabel } from "@/lib/utils/format";

type BranchesListControlsProps = {
  currentPath: string;
  currentFilters: BranchesPageFilterState;
  canCreate: boolean;
};

type AppliedItem = {
  key: string;
  label: string;
  tone?: DataPillTone;
  href: string;
};

function toDraftFilters(filters: BranchesPageFilterState): BranchesPageFilterState {
  return filters;
}

function getActiveFilterCount(filters: BranchesPageFilterState) {
  let count = 0;
  if (filters.search) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.createdFrom || filters.createdTo) count += 1;
  if (filters.updatedFrom || filters.updatedTo) count += 1;
  return count;
}

function buildAppliedItems(path: string, filters: BranchesPageFilterState): AppliedItem[] {
  const base = { page: 1 };
  const items: AppliedItem[] = [];

  if (filters.search) {
    items.push({
      key: "search",
      label: `Search: ${filters.search}`,
      href: buildBranchesPageHref(path, filters, { ...base, search: null }),
    });
  }
  if (filters.status !== "all") {
    items.push({
      key: "status",
      label: `Status: ${formatEnumLabel(filters.status)}`,
      tone: getExpenseCategoryStatusTone(filters.status),
      href: buildBranchesPageHref(path, filters, { ...base, status: "all" }),
    });
  }
  if (filters.createdFrom || filters.createdTo) {
    items.push({
      key: "created",
      label: `Created: ${formatDateRangeLabel(filters.createdFrom, filters.createdTo)}`,
      href: buildBranchesPageHref(path, filters, { ...base, createdFrom: null, createdTo: null }),
    });
  }
  if (filters.updatedFrom || filters.updatedTo) {
    items.push({
      key: "updated",
      label: `Updated: ${formatDateRangeLabel(filters.updatedFrom, filters.updatedTo)}`,
      href: buildBranchesPageHref(path, filters, { ...base, updatedFrom: null, updatedTo: null }),
    });
  }

  return items;
}

function RemovablePills({ items }: { items: AppliedItem[] }) {
  if (items.length === 0) return null;
  const visible = items.slice(0, 3);
  const remaining = items.length - visible.length;

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
      {visible.map((item) => (
        <Link key={item.key} href={item.href} className="group rounded-full">
          <DataPill tone={item.tone ?? "neutral"} appearance="outline">
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              <X className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
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

export function BranchesListControls({
  currentPath,
  currentFilters,
  canCreate,
}: BranchesListControlsProps) {
  const currentHref = useMemo(
    () => buildBranchesPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const appliedItems = useMemo(
    () => buildAppliedItems(currentPath, currentFilters),
    [currentFilters, currentPath],
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

  const updateDraft = (updater: (current: BranchesPageFilterState) => BranchesPageFilterState) =>
    setDraftFilters((current) => updater(current));

  const handleApplyFilters = () => {
    const nextHref = buildBranchesPageHref(currentPath, currentFilters, {
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
      buildBranchesPageHref(currentPath, currentFilters, {
        search: null,
        status: "all",
        createdFrom: null,
        createdTo: null,
        updatedFrom: null,
        updatedTo: null,
        page: 1,
      }),
    );
  };

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
            Branch reference data
          </p>
          <RemovablePills items={appliedItems} />
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          {canCreate ? (
            <Link
              href="/dashboard/branches/new"
              aria-label="Add Branch"
              title="Add Branch"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[rgb(var(--primary))] text-sm font-semibold text-[rgb(var(--primary-foreground))] shadow-[0_20px_44px_-28px_rgb(var(--shadow)/0.65)] transition-all hover:bg-[rgb(var(--primary-strong))] lg:w-auto lg:px-4",
                "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
              )}
            >
              <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
              <span className="hidden lg:inline">Add Branch</span>
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
        title="Filter branches"
        subtitle={
          activeFilterCount > 0 ? `${activeFilterCount} active filters` : "Narrow down branches"
        }
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
              placeholder="Code, name, phone, email, or address"
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
            />
          </label>

          <label className="block space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>Status</span>
            <Select
              value={draftFilters.status}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  status: event.target.value as BranchStatusFilter,
                }))
              }
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Created from</span>
              <Input
                type="date"
                value={draftFilters.createdFrom ?? ""}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    createdFrom: event.target.value || null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              />
            </label>
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Created to</span>
              <Input
                type="date"
                value={draftFilters.createdTo ?? ""}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, createdTo: event.target.value || null }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              />
            </label>
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Updated from</span>
              <Input
                type="date"
                value={draftFilters.updatedFrom ?? ""}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    updatedFrom: event.target.value || null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              />
            </label>
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Updated to</span>
              <Input
                type="date"
                value={draftFilters.updatedTo ?? ""}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, updatedTo: event.target.value || null }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              />
            </label>
          </div>
        </div>
      </FilterDrawerShell>
    </div>
  );
}
