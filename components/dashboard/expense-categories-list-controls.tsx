"use client";

import Link from "next/link";
import { useMemo } from "react";
import { X } from "lucide-react";
import {
  DataPill,
  type DataPillTone,
  getExpenseCategoryScopeTone,
  getExpenseCategoryStatusTone,
} from "@/components/dashboard/data-pill";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildExpenseCategoriesPageHref,
  type ExpenseCategoriesPageFilterState,
  type ExpenseCategoryStatusFilter,
} from "@/lib/dashboard/expense-categories-page-filters";
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import { formatDateRangeLabel, formatEnumLabel } from "@/lib/utils/format";

type ExpenseCategoriesListControlsProps = {
  currentPath: string;
  currentFilters: ExpenseCategoriesPageFilterState;
};

type AppliedItem = {
  key: string;
  label: string;
  tone?: DataPillTone;
  href: string;
};

function toDraftFilters(
  filters: ExpenseCategoriesPageFilterState,
): ExpenseCategoriesPageFilterState {
  return filters;
}

function getActiveFilterCount(filters: ExpenseCategoriesPageFilterState) {
  let count = 0;
  if (filters.search) count += 1;
  if (filters.scope) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.createdFrom || filters.createdTo) count += 1;
  if (filters.updatedFrom || filters.updatedTo) count += 1;
  return count;
}

function buildAppliedItems(path: string, filters: ExpenseCategoriesPageFilterState): AppliedItem[] {
  const base = { page: 1 };
  const items: AppliedItem[] = [];

  if (filters.search) {
    items.push({
      key: "search",
      label: `Search: ${filters.search}`,
      href: buildExpenseCategoriesPageHref(path, filters, { ...base, search: null }),
    });
  }
  if (filters.scope) {
    items.push({
      key: "scope",
      label: `Scope: ${formatEnumLabel(filters.scope)}`,
      tone: getExpenseCategoryScopeTone(filters.scope),
      href: buildExpenseCategoriesPageHref(path, filters, { ...base, scope: null }),
    });
  }
  if (filters.status !== "all") {
    items.push({
      key: "status",
      label: `Status: ${formatEnumLabel(filters.status)}`,
      tone: getExpenseCategoryStatusTone(filters.status),
      href: buildExpenseCategoriesPageHref(path, filters, { ...base, status: "all" }),
    });
  }
  if (filters.createdFrom || filters.createdTo) {
    items.push({
      key: "created",
      label: `Created: ${formatDateRangeLabel(filters.createdFrom, filters.createdTo)}`,
      href: buildExpenseCategoriesPageHref(path, filters, {
        ...base,
        createdFrom: null,
        createdTo: null,
      }),
    });
  }
  if (filters.updatedFrom || filters.updatedTo) {
    items.push({
      key: "updated",
      label: `Updated: ${formatDateRangeLabel(filters.updatedFrom, filters.updatedTo)}`,
      href: buildExpenseCategoriesPageHref(path, filters, {
        ...base,
        updatedFrom: null,
        updatedTo: null,
      }),
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

export function ExpenseCategoriesListControls({
  currentPath,
  currentFilters,
}: ExpenseCategoriesListControlsProps) {
  const currentHref = useMemo(
    () => buildExpenseCategoriesPageHref(currentPath, currentFilters),
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

  const updateDraft = (
    updater: (current: ExpenseCategoriesPageFilterState) => ExpenseCategoriesPageFilterState,
  ) => setDraftFilters((current) => updater(current));

  const handleApplyFilters = () => {
    const nextHref = buildExpenseCategoriesPageHref(currentPath, currentFilters, {
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
    const nextHref = buildExpenseCategoriesPageHref(currentPath, currentFilters, {
      search: null,
      scope: null,
      status: "all",
      createdFrom: null,
      createdTo: null,
      updatedFrom: null,
      updatedTo: null,
      page: 1,
    });
    navigateToHref(nextHref);
  };

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
            Category reference data
          </p>
          <RemovablePills items={appliedItems} />
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

      <FilterDrawerShell
        panelId={filterPanelId}
        titleId={filterTitleId}
        title="Filter categories"
        subtitle={
          activeFilterCount > 0 ? `${activeFilterCount} active filters` : "Narrow down categories"
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
              placeholder="Code, name, or description"
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Scope</span>
              <Select
                value={draftFilters.scope ?? ""}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    scope:
                      event.target.value === "branch" ||
                      event.target.value === "employee" ||
                      event.target.value === "both"
                        ? event.target.value
                        : null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              >
                <option value="">All scopes</option>
                <option value="branch">Branch</option>
                <option value="employee">Employee</option>
                <option value="both">Both</option>
              </Select>
            </label>
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Status</span>
              <Select
                value={draftFilters.status}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    status: event.target.value as ExpenseCategoryStatusFilter,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
          </div>

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
