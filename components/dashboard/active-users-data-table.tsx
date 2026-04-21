"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataPill, getActiveUserRoleTone } from "@/components/dashboard/data-pill";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  buildActiveUsersPageHref,
  buildActiveUsersPaginationHref,
  type ActiveUserPageFilterState,
  type ActiveUserSortValue,
} from "@/lib/dashboard/active-users-page-filters";
import { DASHBOARD_PAGE_SIZE_OPTIONS } from "@/lib/dashboard/page-filters";
import type { ActiveUserRow, DashboardPaginationState } from "@/lib/dashboard/types";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

type ActiveUsersDataTableProps = {
  items: ActiveUserRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: ActiveUserPageFilterState;
  pagination: DashboardPaginationState;
  showBranch?: boolean;
};

type SortDirection = "asc" | "desc";

type HeaderSortConfig = {
  asc: ActiveUserSortValue;
  desc: ActiveUserSortValue;
  defaultDirection: SortDirection;
};

type HeaderConfig = {
  key: string;
  label: string;
  sort?: HeaderSortConfig;
};

const tableHeaderCellClassName = suggestCanonicalClasses(
  "whitespace-nowrap border-b border-[rgb(var(--border)/0.65)] bg-[rgb(var(--muted)/0.72)] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground)/0.9)] first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
);

const tableBodyCellClassName = suggestCanonicalClasses(
  "px-4 py-4 align-top first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
);

const baseHeaderConfigs: HeaderConfig[] = [
  {
    key: "name",
    label: "Full name",
    sort: {
      asc: "name-asc",
      desc: "name-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "username",
    label: "Username",
  },
  {
    key: "role",
    label: "Role",
    sort: {
      asc: "role-asc",
      desc: "role-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "branch",
    label: "Branch",
  },
  {
    key: "last-seen",
    label: "Last seen",
    sort: {
      asc: "last-seen-asc",
      desc: "last-seen-desc",
      defaultDirection: "desc",
    },
  },
  {
    key: "session-created",
    label: "Session started",
    sort: {
      asc: "session-created-asc",
      desc: "session-created-desc",
      defaultDirection: "desc",
    },
  },
];

function getHeaderConfigs(showBranch: boolean): HeaderConfig[] {
  return showBranch ? baseHeaderConfigs : baseHeaderConfigs.filter((h) => h.key !== "branch");
}

function getSortDirection(
  currentSort: ActiveUserSortValue,
  sortConfig: HeaderSortConfig,
): SortDirection | null {
  if (currentSort === sortConfig.asc) {
    return "asc";
  }

  if (currentSort === sortConfig.desc) {
    return "desc";
  }

  return null;
}

function getNextSortValue(currentSort: ActiveUserSortValue, sortConfig: HeaderSortConfig): ActiveUserSortValue {
  const activeDirection = getSortDirection(currentSort, sortConfig);

  if (activeDirection === "asc") {
    return sortConfig.desc;
  }

  if (activeDirection === "desc") {
    return sortConfig.asc;
  }

  return sortConfig.defaultDirection === "desc" ? sortConfig.desc : sortConfig.asc;
}

function getNextSortDirectionLabel(currentSort: ActiveUserSortValue, sortConfig: HeaderSortConfig): string {
  const nextSortValue = getNextSortValue(currentSort, sortConfig);

  return nextSortValue === sortConfig.asc ? "ascending" : "descending";
}

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

function renderRolePill(role: string) {
  const label = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <DataPill tone={getActiveUserRoleTone(role)} appearance="outline" className="max-w-full">
      {label}
    </DataPill>
  );
}

export function ActiveUsersDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  showBranch = false,
}: ActiveUsersDataTableProps) {
  const router = useRouter();
  const headerConfigs = getHeaderConfigs(showBranch);

  const handleSortChange = (sortValue: ActiveUserSortValue) => {
    const nextHref = buildActiveUsersPageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });

    router.push(nextHref);
  };

  const navigateToPagination = (href: string) => {
    const currentHref = buildActiveUsersPageHref(currentPath, currentFilters);

    if (isSameHref(href, currentHref)) {
      return;
    }

    router.push(href);
  };

  if (items.length === 0) {
    return (
      <div className="overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.98)]">
        <div className="px-6 py-12 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const startItem = (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  return (
    <div className="overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.98)]">
      <TableScrollArea className="bg-[rgb(var(--card)/0.98)]" viewportClassName="pb-0">
        <table
          className={cn(
            "w-max min-w-full border-collapse text-left text-sm",
            showBranch ? "min-w-288" : "min-w-248",
          )}
        >
          <colgroup>
            <col className="w-48" />
            <col className="w-36" />
            <col className="w-28" />
            {showBranch && <col className="w-40" />}
            <col className="w-44" />
            <col className="w-44" />
          </colgroup>

          <thead>
            <tr>
              {headerConfigs.map((headerConfig) => {
                const activeDirection = headerConfig.sort
                  ? getSortDirection(currentFilters.sort, headerConfig.sort)
                  : null;
                const ariaSortValue =
                  activeDirection === "asc"
                    ? "ascending"
                    : activeDirection === "desc"
                      ? "descending"
                      : "none";

                return (
                  <th
                    key={headerConfig.key}
                    scope="col"
                    aria-sort={headerConfig.sort ? ariaSortValue : undefined}
                    className={tableHeaderCellClassName}
                  >
                    {headerConfig.sort ? (
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-xl text-left transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                          activeDirection
                            ? "text-[rgb(var(--card-foreground))]"
                            : "hover:text-[rgb(var(--foreground))]",
                        )}
                        onClick={() =>
                          handleSortChange(getNextSortValue(currentFilters.sort, headerConfig.sort!))
                        }
                        aria-label={`Sort ${headerConfig.label} ${getNextSortDirectionLabel(currentFilters.sort, headerConfig.sort!)}`}
                        title={`Sort ${headerConfig.label} ${getNextSortDirectionLabel(currentFilters.sort, headerConfig.sort!)}`}
                      >
                        <span className="min-w-0 truncate">{headerConfig.label}</span>
                        <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
                          <ArrowUp
                            className={cn(
                              "h-3.5 w-3.5 transition-colors",
                              activeDirection === "asc"
                                ? "text-[rgb(var(--primary))]"
                                : "text-[rgb(var(--muted-foreground)/0.72)]",
                            )}
                            strokeWidth={2}
                          />
                          <ArrowDown
                            className={cn(
                              "h-3.5 w-3.5 transition-colors",
                              activeDirection === "desc"
                                ? "text-[rgb(var(--primary))]"
                                : "text-[rgb(var(--muted-foreground)/0.72)]",
                            )}
                            strokeWidth={2}
                          />
                        </span>
                      </button>
                    ) : (
                      <span>{headerConfig.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {items.map((activeUser) => (
              <tr
                key={activeUser.sessionId}
                className="border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
              >
                <td className={tableBodyCellClassName}>
                  <p className="wrap-break-word font-semibold leading-6 text-[rgb(var(--card-foreground))]">
                    {activeUser.fullName}
                  </p>
                </td>
                <td className={tableBodyCellClassName}>
                  <p className="whitespace-nowrap text-[rgb(var(--foreground)/0.76)]">
                    {activeUser.username}
                  </p>
                </td>
                <td className={tableBodyCellClassName}>{renderRolePill(activeUser.role)}</td>
                {showBranch && (
                  <td className={tableBodyCellClassName}>
                    <p className="max-w-40 wrap-break-word font-medium leading-6 text-[rgb(var(--foreground)/0.76)]">
                      {activeUser.branchName ?? "—"}
                    </p>
                  </td>
                )}
                <td className={tableBodyCellClassName}>
                  <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
                    {formatDateTime(activeUser.lastSeenAt)}
                  </p>
                </td>
                <td className={tableBodyCellClassName}>
                  <p className="whitespace-nowrap font-medium text-[rgb(var(--foreground)/0.68)]">
                    {formatDateTime(activeUser.sessionCreatedAt)}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScrollArea>

      {pagination.totalItems > 0 && (
        <div className="border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--muted)/0.42)] px-4 py-4 backdrop-blur-lg sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                Showing{" "}
                <span className="font-semibold text-[rgb(var(--foreground))]">{startItem}</span>–
                <span className="font-semibold text-[rgb(var(--foreground))]">{endItem}</span> of{" "}
                <span className="font-semibold text-[rgb(var(--foreground))]">
                  {pagination.totalItems}
                </span>
              </p>

              <label className="inline-flex items-center gap-3 text-sm text-[rgb(var(--muted-foreground))]">
                <span className="whitespace-nowrap">Rows per page</span>
                <div className="relative">
                  <Select
                    className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                    value={String(pagination.pageSize)}
                    aria-label={`Rows per page, currently ${pagination.pageSize}`}
                    title={`Rows per page: ${pagination.pageSize}`}
                    onChange={(event) => {
                      const nextPageSize = Number.parseInt(event.target.value, 10);
                      const nextHref = buildActiveUsersPaginationHref(currentPath, currentFilters, {
                        page: 1,
                        pageSize: nextPageSize,
                      });

                      navigateToPagination(nextHref);
                    }}
                  >
                    {DASHBOARD_PAGE_SIZE_OPTIONS.map((pageSize) => (
                      <option key={pageSize} value={pageSize}>
                        {pageSize}
                      </option>
                    ))}
                  </Select>
                  <div
                    aria-hidden="true"
                    className={suggestCanonicalClasses(
                      "flex h-10 min-w-18 items-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-4 pr-10 shadow-[0_16px_40px_-34px_rgb(var(--shadow)/0.18)] transition-colors",
                      "peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(var(--primary)/0.35)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-transparent",
                      "peer-hover:border-[rgb(var(--border)/1)] peer-hover:bg-[rgb(var(--card))]",
                    )}
                  >
                    <span className="w-full text-center text-base font-semibold text-[rgb(var(--foreground))]">
                      {pagination.pageSize}
                    </span>
                  </div>
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[rgb(var(--muted-foreground))]">
                    <ChevronsUpDown className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                  </span>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-3 shadow-none sm:px-4"
                disabled={pagination.page <= 1}
                onClick={() =>
                  navigateToPagination(
                    buildActiveUsersPaginationHref(currentPath, currentFilters, {
                      page: pagination.page - 1,
                    }),
                  )
                }
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                <span className="sr-only sm:ml-1.5 sm:not-sr-only">Previous</span>
              </Button>

              <div className="inline-flex items-center rounded-full border border-[rgb(var(--border)/0.74)] bg-[rgb(var(--card)/0.92)] px-3.5 py-2 text-sm font-medium text-[rgb(var(--foreground)/0.76)] shadow-[0_18px_36px_-30px_rgb(var(--shadow)/0.12)]">
                Page{" "}
                <span className="mx-1.5 font-semibold text-[rgb(var(--card-foreground))]">
                  {pagination.page}
                </span>{" "}
                of{" "}
                <span className="ml-1.5 font-semibold text-[rgb(var(--card-foreground))]">
                  {pagination.totalPages}
                </span>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-3 shadow-none sm:px-4"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  navigateToPagination(
                    buildActiveUsersPaginationHref(currentPath, currentFilters, {
                      page: pagination.page + 1,
                    }),
                  )
                }
                title="Next page"
              >
                <span className="sr-only sm:mr-1.5 sm:not-sr-only">Next</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
