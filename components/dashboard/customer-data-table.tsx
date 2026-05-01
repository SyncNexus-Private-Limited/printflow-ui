"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import {
  DataPill,
  getCustomerStatusTone,
  getCustomerTypeTone,
} from "@/components/dashboard/data-pill";
import { RowActionMenu, type RowAction } from "@/components/dashboard/row-action-menu";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomerEditDialog } from "@/components/customers/customer-edit-dialog";
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
  canEdit: boolean;
  canDeactivate: boolean;
  canRestore: boolean;
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
    width: 224,
    sort: { asc: "name-asc", desc: "name-desc", defaultDirection: "asc" },
  },
  {
    key: "type",
    label: "Type",
    sort: { asc: "type-asc", desc: "type-desc", defaultDirection: "asc" },
  },
  {
    key: "status",
    label: "Status",
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
  {
    key: "actions",
    label: "",
    sticky: "right",
    width: 56,
  },
];

export function CustomerDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  canEdit,
  canDeactivate,
  canRestore,
}: CustomerDataTableProps) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<CustomerDetailRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setLocalItems(items), [items]);

  if (localItems.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const stickySpecs = computeStickySpecs(headerConfigs);
  const stickyLeftWidth = getStickyEdgeTotalWidth(headerConfigs, "left") || undefined;
  const actionsStickySpec = stickySpecs[stickySpecs.length - 1];

  const handleSortChange = (sortValue: CustomerSortValue) => {
    router.replace(
      buildCustomerPageHref(currentPath, currentFilters, { page: 1, sort: sortValue }),
      { scroll: false },
    );
  };

  async function executeAction(customer: CustomerDetailRow, action: "deactivate" | "restore") {
    setActionError(null);

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => null)) as {
        success: boolean;
        message?: string;
      } | null;

      if (!res.ok || !data?.success) {
        setActionError(data?.message ?? "Unable to update customer right now.");
        return;
      }

      setLocalItems((current) =>
        current.map((item) =>
          item.id === customer.id ? { ...item, isActive: action === "restore" } : item,
        ),
      );
      setPendingDeactivate(null);
      startTransition(() => router.refresh());
    } catch {
      setActionError("Unable to update customer right now.");
    }
  }

  function buildRowActions(customer: CustomerDetailRow): RowAction[] {
    const actions: RowAction[] = [];
    if (canEdit) {
      actions.push({
        key: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () => setEditingId(customer.id),
      });
    }
    if (customer.isActive && canDeactivate) {
      actions.push({
        key: "deactivate",
        label: "Deactivate",
        icon: <Trash2 className="h-4 w-4" strokeWidth={1.9} />,
        destructive: true,
        onClick: () => setPendingDeactivate(customer),
      });
    }
    if (!customer.isActive && canRestore) {
      actions.push({
        key: "restore",
        label: "Restore",
        icon: <RotateCcw className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () => executeAction(customer, "restore"),
      });
    }
    return actions;
  }

  return (
    <>
      {actionError ? (
        <div className="mb-3 rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {actionError}
        </div>
      ) : null}

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
              <col className="w-28" />
              <col className="w-40" />
              <col className="w-44" />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-14" />
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
                      {headerConfig.label || <span className="sr-only">Actions</span>}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {localItems.map((customer) => {
                const rowActions = buildRowActions(customer);
                const statusLabel = customer.isActive ? "active" : "inactive";

                return (
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
                      <DataPill
                        tone={getCustomerStatusTone(statusLabel)}
                        appearance="outline"
                      >
                        {formatEnumLabel(statusLabel)}
                      </DataPill>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="whitespace-nowrap text-[rgb(var(--card-foreground))]">
                        {customer.phone}
                      </p>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="text-[rgb(var(--foreground)/0.72)]">
                        {customer.studioName ?? "—"}
                      </p>
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
                    <td
                      className={cn(
                        TABLE_BODY_CELL_CLASS,
                        "px-2",
                        getStickyBodyCellClass(actionsStickySpec),
                      )}
                      style={getStickyBodyCellStyle(actionsStickySpec)}
                    >
                      {rowActions.length > 0 ? (
                        <RowActionMenu
                          label={`Actions for ${customer.name}`}
                          actions={rowActions}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
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

      <ConfirmDialog
        isOpen={pendingDeactivate !== null}
        onClose={() => {
          setPendingDeactivate(null);
          setActionError(null);
        }}
        onConfirm={() => {
          if (pendingDeactivate) void executeAction(pendingDeactivate, "deactivate");
        }}
        title="Deactivate customer"
        description="This customer will be marked inactive and won't appear in active customer selectors. Their order history is preserved. This can be undone by restoring the customer."
        confirmKeyword="delete"
        confirmLabel="Deactivate customer"
        isPending={isPending}
      >
        {pendingDeactivate ? (
          <div className="rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.4)] px-4 py-3">
            <p className="text-sm font-medium text-[rgb(var(--foreground))]">
              {pendingDeactivate.name}
            </p>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
              {pendingDeactivate.phone}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>

      <CustomerEditDialog
        customerId={editingId}
        onClose={() => setEditingId(null)}
        onSuccess={() => {
          setEditingId(null);
          startTransition(() => router.refresh());
        }}
      />
    </>
  );
}
