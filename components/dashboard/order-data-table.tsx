"use client";

import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { RowActionMenu } from "@/components/dashboard/row-action-menu";
import {
  DataPill,
  getOrderPaymentStatusLabel,
  getOrderPaymentStatusTone,
  getOrderStatusLabel,
  getOrderStatusTone,
} from "@/components/dashboard/data-pill";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import { AddPaymentDialog } from "@/components/orders/add-payment-dialog";
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog";
import { DeleteOrderDialog } from "@/components/orders/delete-order-dialog";
import { OrderStatusDialog } from "@/components/orders/order-status-dialog";
import { TABLE_BODY_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "@/lib/dashboard/list-page-classes";
import {
  buildOrderPageHref,
  type OrderPageFilterState,
  type OrderSortValue,
} from "@/lib/dashboard/order-page-filters";
import { type HeaderSortConfig } from "@/lib/dashboard/sortable-header-utils";
import {
  computeStickySpecs,
  getStickyBodyCellClass,
  getStickyBodyCellStyle,
  getStickyEdgeTotalWidth,
  getStickyHeaderCellClass,
  getStickyHeaderCellStyle,
  type ColumnStickyDef,
} from "@/lib/dashboard/sticky-column-utils";
import type { DashboardPaginationState, OrderDetailRow } from "@/lib/dashboard/types";
import type { OrderStatusValue } from "@/lib/orders/types";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { CreditCard, Eye, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderDataTableProps = {
  items: OrderDetailRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: OrderPageFilterState;
  pagination: DashboardPaginationState;
  showBranch?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canAddPayment?: boolean;
  canUpdateStatus?: boolean;
  canCancel?: boolean;
  canDelete?: boolean;
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig<OrderSortValue>;
  conditional?: boolean;
} & ColumnStickyDef;

const baseHeaderConfigs: HeaderConfig[] = [
  {
    key: "order-code",
    label: "Order code",
    sticky: "left",
    width: 144, // matches <col className="w-36">
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
  {
    key: "actions",
    label: "",
    align: "right",
    sticky: "right",
    width: 64,
  },
];

function getHeaderConfigs(showBranch: boolean): HeaderConfig[] {
  return showBranch ? baseHeaderConfigs : baseHeaderConfigs.filter((h) => h.key !== "branch");
}

export function OrderDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  showBranch = false,
  canView = false,
  canEdit = false,
  canAddPayment = false,
  canUpdateStatus = false,
  canCancel = false,
  canDelete = false,
}: OrderDataTableProps) {
  const router = useRouter();
  const headerConfigs = getHeaderConfigs(showBranch);
  const [paymentOrder, setPaymentOrder] = useState<OrderDetailRow | null>(null);
  const [statusOrder, setStatusOrder] = useState<OrderDetailRow | null>(null);
  const [cancelOrder, setCancelOrder] = useState<OrderDetailRow | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<OrderDetailRow | null>(null);

  if (items.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const stickySpecs = computeStickySpecs(headerConfigs);
  const stickyLeftWidth = getStickyEdgeTotalWidth(headerConfigs, "left") || undefined;

  const handleSortChange = (sortValue: OrderSortValue) => {
    const nextHref = buildOrderPageHref(currentPath, currentFilters, {
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
            <col className="w-16" />
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
            {items.map((order) => (
              <tr
                key={order.id}
                className="group border-b border-[rgb(var(--border)/0.58)] transition-colors last:border-b-0 hover:bg-[rgb(var(--muted)/0.28)]"
              >
                <td
                  className={cn(TABLE_BODY_CELL_CLASS, getStickyBodyCellClass(stickySpecs[0]))}
                  style={getStickyBodyCellStyle(stickySpecs[0])}
                >
                  <p className="leading-6 font-semibold whitespace-nowrap text-[rgb(var(--card-foreground))]">
                    {order.orderCode}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="leading-6 wrap-break-word text-[rgb(var(--card-foreground))]">
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
                  <p className="text-base font-semibold whitespace-nowrap text-[rgb(var(--card-foreground))] tabular-nums">
                    {formatCurrency(order.payableAmount)}
                  </p>
                </td>
                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))] tabular-nums">
                    {formatCurrency(order.paidAmount)}
                  </p>
                </td>
                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  <p
                    className={cn(
                      "font-medium whitespace-nowrap tabular-nums",
                      order.outstandingAmount > 0
                        ? "text-[rgb(var(--metric-rose-ink))]"
                        : "text-[rgb(var(--foreground)/0.6)]",
                    )}
                  >
                    {formatCurrency(order.outstandingAmount)}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))]">
                    {formatDate(order.orderDate)}
                  </p>
                </td>
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))]">
                    {formatDate(order.createdAt)}
                  </p>
                </td>
                {showBranch && (
                  <td className={TABLE_BODY_CELL_CLASS}>
                    <p className="max-w-40 leading-6 font-medium wrap-break-word text-[rgb(var(--foreground)/0.76)]">
                      {order.branchName ?? "—"}
                    </p>
                  </td>
                )}
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="max-w-36 text-sm leading-6 wrap-break-word text-[rgb(var(--foreground)/0.68)]">
                    {order.createdByName ?? "—"}
                  </p>
                </td>
                <td
                  className={cn(
                    TABLE_BODY_CELL_CLASS,
                    "text-right",
                    getStickyBodyCellClass(stickySpecs[stickySpecs.length - 1]),
                  )}
                  style={getStickyBodyCellStyle(stickySpecs[stickySpecs.length - 1])}
                >
                  <RowActionMenu
                    label={`Actions for ${order.orderCode}`}
                    actions={[
                      {
                        key: "view",
                        label: "View",
                        icon: <Eye className="h-4 w-4" />,
                        disabled: !canView,
                        onClick: () => router.push(`/dashboard/orders/${order.id}`),
                      },
                      {
                        key: "edit",
                        label: "Edit Order",
                        icon: <Pencil className="h-4 w-4" />,
                        disabled: !canEdit || order.status === "cancelled",
                        onClick: () => router.push(`/dashboard/orders/${order.id}/edit`),
                      },
                      {
                        key: "payment",
                        label: "Add Customer Payment",
                        icon: <CreditCard className="h-4 w-4" />,
                        disabled:
                          !canAddPayment ||
                          order.status === "cancelled" ||
                          order.outstandingAmount <= 0,
                        onClick: () => setPaymentOrder(order),
                      },
                      {
                        key: "status",
                        label: "Update Status",
                        icon: <RotateCcw className="h-4 w-4" />,
                        disabled: !canUpdateStatus || order.status === "cancelled",
                        onClick: () => setStatusOrder(order),
                      },
                      {
                        key: "cancel",
                        label: "Cancel Order",
                        icon: <XCircle className="h-4 w-4" />,
                        destructive: true,
                        disabled: !canCancel || order.status === "cancelled",
                        onClick: () => setCancelOrder(order),
                      },
                      {
                        key: "delete",
                        label: "Delete Order",
                        icon: <Trash2 className="h-4 w-4" />,
                        destructive: true,
                        disabled: !canDelete || order.status !== "cancelled",
                        onClick: () => setDeleteOrder(order),
                      },
                    ]}
                  />
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
      <AddPaymentDialog
        isOpen={paymentOrder !== null}
        orderId={paymentOrder?.id ?? null}
        orderLabel={paymentOrder?.orderCode}
        outstandingAmount={paymentOrder?.outstandingAmount}
        onClose={() => setPaymentOrder(null)}
      />
      <OrderStatusDialog
        isOpen={statusOrder !== null}
        orderId={statusOrder?.id ?? null}
        currentStatus={statusOrder?.status as OrderStatusValue | undefined}
        onClose={() => setStatusOrder(null)}
      />
      <CancelOrderDialog
        isOpen={cancelOrder !== null}
        orderId={cancelOrder?.id ?? null}
        orderLabel={cancelOrder?.orderCode}
        paidAmount={cancelOrder?.paidAmount ?? 0}
        onClose={() => setCancelOrder(null)}
      />
      <DeleteOrderDialog
        isOpen={deleteOrder !== null}
        orderId={deleteOrder?.id ?? null}
        orderLabel={deleteOrder?.orderCode}
        remainingRefundableAmount={
          deleteOrder ? Math.max(0, deleteOrder.paidAmount - deleteOrder.refundedAmount) : 0
        }
        onClose={() => setDeleteOrder(null)}
      />
    </DataTableContainer>
  );
}
