"use client";

import { useMemo } from "react";
import {
  AppliedFilterPills,
  type AppliedFilterSummaryItem,
} from "@/components/dashboard/applied-filter-pills";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import { getActiveUserRoleTone } from "@/components/dashboard/data-pill";
import { Select } from "@/components/ui/select";
import {
  buildActiveUsersPageHref,
  type ActiveUserPageFilterState,
} from "@/lib/dashboard/active-users-page-filters";
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import type { ActiveUserRoleOption } from "@/lib/dashboard/types";

type BranchOption = { label: string; value: string };

type ActiveUsersListControlsProps = {
  currentPath: string;
  currentFilters: ActiveUserPageFilterState;
  roleOptions: ActiveUserRoleOption[];
  branchOptions: BranchOption[];
  canSelectBranch: boolean;
  selectedBranchName: string;
};

type DraftFilterState = {
  role: string | null;
  branchId: string | null;
};

function toDraftFilters(filters: ActiveUserPageFilterState): DraftFilterState {
  return { role: filters.role, branchId: filters.branchId };
}

function getActiveFilterCount(filters: ActiveUserPageFilterState): number {
  return filters.role ? 1 : 0;
}

function buildAppliedFilterSummaryItems(
  filters: ActiveUserPageFilterState,
  branchName: string,
): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [{ key: "branch", label: `Branch: ${branchName}` }];

  if (filters.role) {
    items.push({
      key: "role",
      label: `Role: ${filters.role.charAt(0).toUpperCase() + filters.role.slice(1)}`,
      tone: getActiveUserRoleTone(filters.role),
    });
  }

  return items;
}

export function ActiveUsersListControls({
  currentPath,
  currentFilters,
  roleOptions,
  branchOptions,
  canSelectBranch,
  selectedBranchName,
}: ActiveUsersListControlsProps) {
  const currentHref = useMemo(
    () => buildActiveUsersPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const appliedFilterItems = useMemo(
    () => buildAppliedFilterSummaryItems(currentFilters, selectedBranchName),
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

  const showBranchSelect = canSelectBranch && branchOptions.length > 1;

  const drawerSubtitle =
    activeFilterCount > 0
      ? `${activeFilterCount} active ${activeFilterCount === 1 ? "filter" : "filters"}`
      : "Narrow down active sessions";

  const handleApplyFilters = () => {
    const nextHref = buildActiveUsersPageHref(currentPath, currentFilters, {
      role: draftFilters.role,
      branchId: draftFilters.branchId,
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
    const nextHref = buildActiveUsersPageHref(currentPath, currentFilters, {
      role: null,
      branchId: null,
      page: 1,
    });

    setDraftFilters({ role: null, branchId: null });
    navigateToHref(nextHref);
  };

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
              Active sessions
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
        title="Filter sessions"
        subtitle={drawerSubtitle}
        isOpen={isOpen}
        onClose={closeDrawer}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isPending={isApplyPending}
        closeButtonRef={filterCloseButtonRef}
      >
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>Role</span>
            <Select
              value={draftFilters.role ?? ""}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  role: event.target.value.length > 0 ? event.target.value : null,
                }))
              }
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              disabled={roleOptions.length === 0}
            >
              <option value="">All roles</option>
              {roleOptions.map((option) => (
                <option key={option.role} value={option.role}>
                  {option.role.charAt(0).toUpperCase() + option.role.slice(1)}
                </option>
              ))}
            </Select>
          </label>

          {showBranchSelect ? (
            <label className="block space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Branch</span>
              <Select
                value={draftFilters.branchId ?? "all"}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    branchId: event.target.value === "all" ? null : event.target.value,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              >
                {branchOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>
      </FilterDrawerShell>
    </div>
  );
}
