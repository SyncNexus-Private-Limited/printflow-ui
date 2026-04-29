"use client";

import { useRouter } from "next/navigation";
import { DataPill, getActiveUserRoleTone } from "@/components/dashboard/data-pill";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import {
  buildActiveUsersPageHref,
  type ActiveUserPageFilterState,
  type ActiveUserSortValue,
} from "@/lib/dashboard/active-users-page-filters";
import { TABLE_BODY_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "@/lib/dashboard/list-page-classes";
import { type HeaderSortConfig } from "@/lib/dashboard/sortable-header-utils";
import {
  type ColumnStickyDef,
  computeStickySpecs,
  getStickyBodyCellClass,
  getStickyBodyCellStyle,
  getStickyEdgeTotalWidth,
  getStickyHeaderCellClass,
  getStickyHeaderCellStyle,
} from "@/lib/dashboard/sticky-column-utils";
import type { ActiveUserRow, DashboardPaginationState } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

type ActiveUsersDataTableProps = {
  items: ActiveUserRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: ActiveUserPageFilterState;
  pagination: DashboardPaginationState;
  showBranch?: boolean;
};

type HeaderConfig = {
  key: string;
  label: string;
  sort?: HeaderSortConfig<ActiveUserSortValue>;
} & ColumnStickyDef;

const baseHeaderConfigs: HeaderConfig[] = [
  {
    key: "name",
    label: "Full name",
    sticky: "left",
    width: 192, // matches <col className="w-48">
    sort: { asc: "name-asc", desc: "name-desc", defaultDirection: "asc" },
  },
  {
    key: "username",
    label: "Username",
  },
  {
    key: "role",
    label: "Role",
    sort: { asc: "role-asc", desc: "role-desc", defaultDirection: "asc" },
  },
  {
    key: "branch",
    label: "Branch",
  },
  {
    key: "last-seen",
    label: "Last seen",
    sort: { asc: "last-seen-asc", desc: "last-seen-desc", defaultDirection: "desc" },
  },
  {
    key: "session-created",
    label: "Session started",
    sort: { asc: "session-created-asc", desc: "session-created-desc", defaultDirection: "desc" },
  },
];

function getHeaderConfigs(showBranch: boolean): HeaderConfig[] {
  return showBranch ? baseHeaderConfigs : baseHeaderConfigs.filter((h) => h.key !== "branch");
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

  if (items.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const stickySpecs = computeStickySpecs(headerConfigs);
  const stickyLeftWidth = getStickyEdgeTotalWidth(headerConfigs, "left") || undefined;

  const handleSortChange = (sortValue: ActiveUserSortValue) => {
    const nextHref = buildActiveUsersPageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });

    router.replace(nextHref, { scroll: false });
  };

  return (
    <DataTableContainer>
      <TableScrollArea
        className="bg-[rgb(var(--card)/0.98)]"
        viewportClassName="pb-0"
        stickyLeftWidth={stickyLeftWidth}
      >
        <table
          className={cn(
            "w-max min-w-full border-collapse text-left text-sm",
            showBranch ? "min-w-6xl" : "min-w-248",
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
              {headerConfigs.map((headerConfig, index) =>
                headerConfig.sort ? (
                  <SortableHeaderCell
                    key={headerConfig.key}
                    label={headerConfig.label}
                    sortConfig={headerConfig.sort}
                    currentSort={currentFilters.sort}
                    onSort={handleSortChange}
                    stickySpec={stickySpecs[index] ?? undefined}
                  />
                ) : (
                  <th
                    key={headerConfig.key}
                    scope="col"
                    className={cn(
                      TABLE_HEADER_CELL_CLASS,
                      getStickyHeaderCellClass(stickySpecs[index]),
                    )}
                    style={getStickyHeaderCellStyle(stickySpecs[index])}
                  >
                    {headerConfig.label}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {items.map((activeUser) => (
              <tr
                key={activeUser.sessionId}
                className="group border-b border-[rgb(var(--border)/0.58)] transition-colors last:border-b-0 hover:bg-[rgb(var(--muted)/0.28)]"
              >
                <td
                  className={cn(TABLE_BODY_CELL_CLASS, getStickyBodyCellClass(stickySpecs[0]))}
                  style={getStickyBodyCellStyle(stickySpecs[0])}
                >
                  <p className="leading-6 font-semibold wrap-break-word text-[rgb(var(--card-foreground))]">
                    {activeUser.fullName}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="whitespace-nowrap text-[rgb(var(--foreground)/0.76)]">
                    {activeUser.username}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>{renderRolePill(activeUser.role)}</td>
                {showBranch && (
                  <td className={TABLE_BODY_CELL_CLASS}>
                    <p className="max-w-40 leading-6 font-medium wrap-break-word text-[rgb(var(--foreground)/0.76)]">
                      {activeUser.branchName ?? "—"}
                    </p>
                  </td>
                )}
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))]">
                    {formatDateTime(activeUser.lastSeenAt)}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--foreground)/0.68)]">
                    {formatDateTime(activeUser.sessionCreatedAt)}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScrollArea>

      <DashboardPagination
        currentPath={currentPath}
        currentFilters={currentFilters}
        pagination={pagination}
        variant="active-users"
      />
    </DataTableContainer>
  );
}
