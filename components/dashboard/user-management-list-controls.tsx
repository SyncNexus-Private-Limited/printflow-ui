"use client";

import { useMemo } from "react";
import { AppliedFilterPills, type AppliedFilterSummaryItem } from "@/components/dashboard/applied-filter-pills";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildUsersPageHref,
  type UserManagementLockedFilter,
  type UserManagementPageFilterState,
  type UserManagementStatusFilter,
} from "@/lib/dashboard/users-page-filters";
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import type { ActiveUserRoleOption } from "@/lib/dashboard/types";
import { userRoleLabels } from "@/lib/users/types";

type BranchOption = { label: string; value: string };

type UserManagementListControlsProps = {
  currentPath: string;
  currentFilters: UserManagementPageFilterState;
  roleOptions: ActiveUserRoleOption[];
  branchOptions: BranchOption[];
  canSelectBranch: boolean;
  selectedBranchName: string;
};

type DraftFilterState = {
  role: string | null;
  branchId: string | null;
  status: UserManagementStatusFilter;
  locked: UserManagementLockedFilter;
  name: string | null;
  username: string | null;
};

function toDraftFilters(filters: UserManagementPageFilterState): DraftFilterState {
  return {
    role: filters.role,
    branchId: filters.branchId,
    status: filters.status,
    locked: filters.locked,
    name: filters.name,
    username: filters.username,
  };
}

function getActiveFilterCount(filters: UserManagementPageFilterState): number {
  let count = 0;
  if (filters.role) count++;
  if (filters.status !== "all") count++;
  if (filters.locked !== "all") count++;
  if (filters.name) count++;
  if (filters.username) count++;
  return count;
}

function buildAppliedFilterSummaryItems(
  filters: UserManagementPageFilterState,
  branchName: string,
): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [{ key: "branch", label: `Branch: ${branchName}` }];

  if (filters.name) {
    items.push({ key: "name", label: `Name: ${filters.name}` });
  }

  if (filters.username) {
    items.push({ key: "username", label: `Username: ${filters.username}` });
  }

  if (filters.role) {
    const label =
      (userRoleLabels as Record<string, string>)[filters.role] ??
      filters.role.charAt(0).toUpperCase() + filters.role.slice(1);
    items.push({ key: "role", label: `Role: ${label}` });
  }

  if (filters.status !== "all") {
    items.push({
      key: "status",
      label: `Status: ${filters.status === "active" ? "Active" : "Inactive"}`,
    });
  }

  if (filters.locked !== "all") {
    items.push({
      key: "locked",
      label: `Lock: ${filters.locked === "locked" ? "Locked" : "Unlocked"}`,
    });
  }

  return items;
}

export function UserManagementListControls({
  currentPath,
  currentFilters,
  roleOptions,
  branchOptions,
  canSelectBranch,
  selectedBranchName,
}: UserManagementListControlsProps) {
  const currentHref = useMemo(
    () => buildUsersPageHref(currentPath, currentFilters),
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
      : "Narrow down the users list";

  const handleApplyFilters = () => {
    const nextHref = buildUsersPageHref(currentPath, currentFilters, {
      role: draftFilters.role,
      branchId: draftFilters.branchId,
      status: draftFilters.status,
      locked: draftFilters.locked,
      name: draftFilters.name,
      username: draftFilters.username,
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
    const nextHref = buildUsersPageHref(currentPath, currentFilters, {
      role: null,
      branchId: null,
      status: "all",
      locked: "all",
      name: null,
      username: null,
      page: 1,
    });

    setDraftFilters({ role: null, branchId: null, status: "all", locked: "all", name: null, username: null });
    navigateToHref(nextHref);
  };

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">All users</p>
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
        title="Filter users"
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
            <span className={FILTER_FIELD_LABEL_CLASS}>Name</span>
            <Input
              value={draftFilters.name ?? ""}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  name: event.target.value.trim().length > 0 ? event.target.value : null,
                }))
              }
              placeholder="Search by full name"
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
            />
          </label>

          <label className="block space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>Username</span>
            <Input
              value={draftFilters.username ?? ""}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  username: event.target.value.trim().length > 0 ? event.target.value : null,
                }))
              }
              placeholder="Search by username"
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
            />
          </label>

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
                  {(userRoleLabels as Record<string, string>)[option.role] ??
                    option.role.charAt(0).toUpperCase() + option.role.slice(1)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>Status</span>
            <Select
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  status: event.target.value as UserManagementStatusFilter,
                }))
              }
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </Select>
          </label>

          <label className="block space-y-2">
            <span className={FILTER_FIELD_LABEL_CLASS}>Lock status</span>
            <Select
              value={draftFilters.locked}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  locked: event.target.value as UserManagementLockedFilter,
                }))
              }
              className="h-11 rounded-2xl bg-[rgb(var(--background))]"
            >
              <option value="all">All</option>
              <option value="locked">Locked only</option>
              <option value="unlocked">Unlocked only</option>
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
