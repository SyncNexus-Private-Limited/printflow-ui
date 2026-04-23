"use client";

import { useRouter } from "next/navigation";
import {
  DataPill,
  getOrderStatusTone,
  getOrderStatusLabel,
  getOrderPaymentStatusTone,
  getOrderPaymentStatusLabel,
} from "@/components/dashboard/data-pill";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import {
  buildOrderPageHref,
  type OrderPageFilterState,
  type OrderSortValue,
} from "@/lib/dashboard/order-page-filters";
import { TABLE_BODY_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "@/lib/dashboard/list-page-classes";
import { type HeaderSortConfig } from "@/lib/dashboard/sortable-header-utils";
import type { DashboardPaginationState, OrderDetailRow } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type OrderDataTableProps = {
  items: OrderDetailRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: OrderPageFilterState;
  pagination: DashboardPaginationState;
  showBranch?: boolean;
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig<OrderSortValue>;
  conditional?: boolean;
};

const baseHeaderConfigs: HeaderConfig[] = [
  {
    key: "order-code",
    label: "Order code",
    sort: { asc: "order-code-asc", desc: "order-code-desc", defaultDirection: "asc" },
  },
  {
    key: "customer",
    label: "Customer",
    sort: { asc: "customer-asc", desc: "customer-desc", defaultDirection: "asc" },
  },
  {
    key: "status",
    label: "Status",
    sort: { asc: "status-asc", desc: "status-desc", defaultDirection: "asc" },
  },
  {
    key: "payment-status",
    label: "Payment",
    sort: { asc: "payment-status-asc", desc: "payment-status-desc", defaultDirection: "asc" },
  },
  {
    key: "payable",
    label: "Payable",
    align: "right",
    sort: { asc: "payable-asc", desc: "payable-desc", defaultDirection: "desc" },
  },
  {
    key: "paid",
    label: "Paid",
    align: "right",
    sort: { asc: "paid-asc", desc: "paid-desc", defaultDirection: "desc" },
  },
  {
    key: "outstanding",
    label: "Outstanding",
    align: "right",
    sort: { asc: "outstanding-asc", desc: "outstanding-desc", defaultDirection: "desc" },
  },
  {
    key: "order-date",
    label: "Order date",
    sort: { asc: "order-date-asc", desc: "order-date-desc", defaultDirection: "desc" },
  },
  {
    key: "created-at",
    label: "Created",
    sort: { asc: "created-at-asc", desc: "created-at-desc", defaultDirection: "desc" },
  },
  {
    key: "branch",
    label: "Branch",
    conditional: true,
  },
  {
    key: "created-by",
    label: "Created by",
  },
];

function getHeaderConfigs(showBranch: boolean): HeaderConfig[] {
  return showBranch
    ? baseHeaderConfigs
    : baseHeaderConfigs.filter((h) => h.key !== "branch");
}

export function OrderDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  showBranch = false,
}: OrderDataTableProps) {
  const router = useRouter();
  const headerConfigs = getHeaderConfigs(showBranch);

  if (items.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const handleSortChange = (sortValue: OrderSortValue) => {
    const nextHref = buildOrderPageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });

    router.push(nextHref);
  };

  return (
    <DataTableContainer>
      <TableScrollArea className="bg-[rgb(var(--card)/0.98)]" viewportClassName="pb-0">
        <table
          className={cn(
            "w-max min-w-full border-collapse text-left text-sm",
            showBranch ? "min-w-360" : "min-w-7xl",
          )}
        >
          <colgroup>
            <col className="w-36" />
            <col className="w-44" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-36" />
            {showBranch && <col className="w-40" />}
            <col className="w-40" />
          </colgroup>

          <thead>
            <tr>
              {headerConfigs.map((headerConfig) =>
                headerConfig.sort ? (
                  <SortableHeaderCell
                    key={headerConfig.key}
                    label={headerConfig.label}
                    align={headerConfig.align}
                    sortConfig={headerConfig.sort}
                    currentSort={currentFilters.sort}
                    onSort={handleSortChange}
                  />
                ) : (
                  <th
                    key={headerConfig.key}
                    scope="col"
                    className={cn(
                      TABLE_HEADER_CELL_CLASS,
                      headerConfig.align === "right" && "text-right",
                    )}
                  >
                    {headerConfig.label}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {items.map((order) => (
              <tr
                key={order.id}
                className="border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
              >
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="whitespace-nowrap font-semibold leading-6 text-[rgb(var(--card-foreground))]">
                    {order.orderCode}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="wrap-break-word leading-6 text-[rgb(var(--card-foreground))]">
                    {order.customerName}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <DataPill tone={getOrderStatusTone(order.status)} className="max-w-full">
                    {getOrderStatusLabel(order.status)}
                  </DataPill>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <DataPill
                    tone={getOrderPaymentStatusTone(order.paymentStatus)}
                    appearance="outline"
                    className="max-w-full"
                  >
                    {getOrderPaymentStatusLabel(order.paymentStatus)}
                  </DataPill>
                </td>
                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  <p className="whitespace-nowrap text-base font-semibold tabular-nums text-[rgb(var(--card-foreground))]">
                    {formatCurrency(order.payableAmount)}
                  </p>
                </td>
                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  <p className="whitespace-nowrap font-medium tabular-nums text-[rgb(var(--card-foreground))]">
                    {formatCurrency(order.paidAmount)}
                  </p>
                </td>
                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  <p
                    className={cn(
                      "whitespace-nowrap font-medium tabular-nums",
                      order.outstandingAmount > 0
                        ? "text-[rgb(var(--metric-rose-ink))]"
                        : "text-[rgb(var(--foreground)/0.6)]",
                    )}
                  >
                    {formatCurrency(order.outstandingAmount)}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
                    {formatDate(order.orderDate)}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
                    {formatDate(order.createdAt)}
                  </p>
                </td>
                {showBranch && (
                  <td className={TABLE_BODY_CELL_CLASS}>
                    <p className="max-w-40 wrap-break-word font-medium leading-6 text-[rgb(var(--foreground)/0.76)]">
                      {order.branchName ?? "—"}
                    </p>
                  </td>
                )}
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="max-w-36 wrap-break-word text-sm leading-6 text-[rgb(var(--foreground)/0.68)]">
                    {order.createdByName ?? "—"}
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
        variant="order"
      />
    </DataTableContainer>
  );
}
