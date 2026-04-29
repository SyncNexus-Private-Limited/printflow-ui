"use client";

import { useRouter } from "next/navigation";
import { DataPill, getCustomerTypeTone } from "@/components/dashboard/data-pill";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import {
  buildCustomerPageHref,
  type CustomerPageFilterState,
  type CustomerSortValue,
} from "@/lib/dashboard/customer-page-filters";
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
import type { CustomerDetailRow, DashboardPaginationState } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatEnumLabel,
} from "@/lib/utils/format";

type CustomerDataTableProps = {
  items: CustomerDetailRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: CustomerPageFilterState;
  pagination: DashboardPaginationState;
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig<CustomerSortValue>;
} & ColumnStickyDef;

const headerConfigs: HeaderConfig[] = [
  {
    key: "customer",
    label: "Customer",
    sticky: "left",
    width: 224, // matches <col className="w-56">
    sort: { asc: "name-asc", desc: "name-desc", defaultDirection: "asc" },
  },
  {
    key: "type",
    label: "Type",
    sort: { asc: "type-asc", desc: "type-desc", defaultDirection: "asc" },
  },
  {
    key: "phone",
    label: "Phone",
  },
  {
    key: "studio-name",
    label: "Studio",
    sort: { asc: "studio-name-asc", desc: "studio-name-desc", defaultDirection: "asc" },
  },
  {
    key: "orders",
    label: "Orders",
    align: "right",
    sort: { asc: "order-count-asc", desc: "order-count-desc", defaultDirection: "desc" },
  },
  {
    key: "payable",
    label: "Payable",
    align: "right",
    sort: { asc: "total-payable-asc", desc: "total-payable-desc", defaultDirection: "desc" },
  },
  {
    key: "outstanding",
    label: "Outstanding",
    align: "right",
    sort: { asc: "outstanding-asc", desc: "outstanding-desc", defaultDirection: "desc" },
  },
  {
    key: "last-order",
    label: "Last order",
    sort: { asc: "last-order-date-asc", desc: "last-order-date-desc", defaultDirection: "desc" },
  },
  {
    key: "created",
    label: "Created",
    sort: { asc: "created-asc", desc: "created-desc", defaultDirection: "desc" },
  },
];

export function CustomerDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
}: CustomerDataTableProps) {
  const router = useRouter();

  if (items.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const stickySpecs = computeStickySpecs(headerConfigs);
  const stickyLeftWidth = getStickyEdgeTotalWidth(headerConfigs, "left") || undefined;

  const handleSortChange = (sortValue: CustomerSortValue) => {
    const nextHref = buildCustomerPageHref(currentPath, currentFilters, {
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
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <colgroup>
            <col className="w-56" />
            <col className="w-32" />
            <col className="w-40" />
            <col className="w-44" />
            <col className="w-28" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-36" />
          </colgroup>

          <thead>
            <tr>
              {headerConfigs.map((headerConfig, index) =>
                headerConfig.sort ? (
                  <SortableHeaderCell
                    key={headerConfig.key}
                    label={headerConfig.label}
                    align={headerConfig.align}
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
                      headerConfig.align === "right" && "text-right",
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
            {items.map((customer) => (
              <tr
                key={customer.id}
                className="group border-b border-[rgb(var(--border)/0.58)] transition-colors last:border-b-0 hover:bg-[rgb(var(--muted)/0.28)]"
              >
                <td
                  className={cn(TABLE_BODY_CELL_CLASS, getStickyBodyCellClass(stickySpecs[0]))}
                  style={getStickyBodyCellStyle(stickySpecs[0])}
                >
                  <div className="space-y-0.5">
                    <p className="leading-6 font-semibold wrap-break-word text-[rgb(var(--card-foreground))]">
                      {customer.name}
                    </p>
                    {customer.customerCode ? (
                      <p className="text-xs text-[rgb(var(--muted-foreground))]">
                        {customer.customerCode}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <DataPill tone={getCustomerTypeTone(customer.type)}>
                    {formatEnumLabel(customer.type)}
                  </DataPill>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="whitespace-nowrap text-[rgb(var(--card-foreground))]">
                    {customer.phone}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="text-[rgb(var(--foreground)/0.72)]">{customer.studioName ?? "—"}</p>
                </td>
                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))] tabular-nums">
                    {formatCompactNumber(customer.orderCount)}
                  </p>
                </td>
                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))] tabular-nums">
                    {formatCurrency(customer.totalPayable)}
                  </p>
                </td>
                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  {customer.totalOutstanding > 0 ? (
                    <DataPill tone="rose" appearance="outline" className="ml-auto">
                      {formatCurrency(customer.totalOutstanding)}
                    </DataPill>
                  ) : (
                    <p className="font-medium whitespace-nowrap text-[rgb(var(--muted-foreground))] tabular-nums">
                      {formatCurrency(customer.totalOutstanding)}
                    </p>
                  )}
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))]">
                    {customer.lastOrderDate ? formatDate(customer.lastOrderDate) : "—"}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))]">
                    {formatDate(customer.createdAt)}
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
        variant="customer"
      />
    </DataTableContainer>
  );
}
