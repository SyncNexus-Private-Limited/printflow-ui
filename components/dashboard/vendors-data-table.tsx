"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { DataPill, getExpenseCategoryStatusTone } from "@/components/dashboard/data-pill";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { RowActionMenu, type RowAction } from "@/components/dashboard/row-action-menu";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { VendorEditDialog } from "@/components/vendors/vendor-edit-dialog";
import {
  buildVendorsPageHref,
  type VendorSortDirection,
  type VendorSortField,
  type VendorsPageFilterState,
} from "@/lib/dashboard/vendors-page-filters";
import { TABLE_BODY_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "@/lib/dashboard/list-page-classes";
import type { HeaderSortConfig } from "@/lib/dashboard/sortable-header-utils";
import {
  type ColumnStickyDef,
  computeStickySpecs,
  getStickyBodyCellClass,
  getStickyBodyCellStyle,
  getStickyEdgeTotalWidth,
  getStickyHeaderCellClass,
  getStickyHeaderCellStyle,
} from "@/lib/dashboard/sticky-column-utils";
import type { DashboardPaginationState, VendorManagementRow } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { formatCompactNumber, formatDate, formatEnumLabel } from "@/lib/utils/format";

type VendorsDataTableProps = {
  items: VendorManagementRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: VendorsPageFilterState;
  pagination: DashboardPaginationState;
  canEdit: boolean;
  canDeactivate: boolean;
  canRestore: boolean;
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sortField?: VendorSortField;
  sort?: HeaderSortConfig<string>;
} & ColumnStickyDef;

const headerConfigs: HeaderConfig[] = [
  { key: "vendor", label: "Vendor", sticky: "left", width: 248, sortField: "name" },
  { key: "code", label: "Code", sortField: "code" },
  { key: "phone", label: "Phone", sortField: "phone" },
  { key: "address", label: "Address" },
  { key: "usage", label: "Usage" },
  { key: "status", label: "Status", sortField: "status" },
  { key: "updated-by", label: "Last updated by" },
  { key: "updated-at", label: "Last updated", sortField: "updated-at" },
  { key: "actions", label: "", sticky: "right", width: 56 },
];

function getSortValue(field: VendorSortField, direction: VendorSortDirection) {
  return `${field}:${direction}`;
}

function getSortConfig(field: VendorSortField): HeaderSortConfig<string> {
  return {
    asc: getSortValue(field, "asc"),
    desc: getSortValue(field, "desc"),
    defaultDirection: field === "updated-at" || field === "created-at" ? "desc" : "asc",
  };
}

function parseSortValue(value: string) {
  const [field, direction] = value.split(":");
  return {
    sortField: field as VendorSortField,
    sortDirection: direction === "desc" ? "desc" : ("asc" as VendorSortDirection),
  };
}

export function VendorsDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  canEdit,
  canDeactivate,
  canRestore,
}: VendorsDataTableProps) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<VendorManagementRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setLocalItems(items), [items]);

  const resolvedHeaders = headerConfigs.map((header) =>
    header.sortField ? { ...header, sort: getSortConfig(header.sortField) } : header,
  );
  const stickySpecs = computeStickySpecs(resolvedHeaders);
  const stickyLeftWidth = getStickyEdgeTotalWidth(resolvedHeaders, "left") || undefined;
  const actionsStickySpec = stickySpecs[stickySpecs.length - 1];

  if (localItems.length === 0) return <TableEmptyState message={emptyMessage} />;

  const currentSort = getSortValue(currentFilters.sortField, currentFilters.sortDirection);

  function handleSortChange(sortValue: string) {
    router.replace(
      buildVendorsPageHref(currentPath, currentFilters, { ...parseSortValue(sortValue), page: 1 }),
      {
        scroll: false,
      },
    );
  }

  async function executeAction(vendor: VendorManagementRow, action: "deactivate" | "restore") {
    setActionError(null);

    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => null)) as {
        success: boolean;
        message?: string;
      } | null;

      if (!res.ok || !data?.success) {
        setActionError(data?.message ?? "Unable to update vendor right now.");
        return;
      }

      setLocalItems((current) =>
        current.map((item) =>
          item.id === vendor.id ? { ...item, isActive: action === "restore" } : item,
        ),
      );
      setPendingDeactivate(null);
      startTransition(() => router.refresh());
    } catch {
      setActionError("Unable to update vendor right now.");
    }
  }

  function buildRowActions(vendor: VendorManagementRow): RowAction[] {
    const actions: RowAction[] = [];
    if (canEdit) {
      actions.push({
        key: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () => setEditingId(vendor.id),
      });
    }
    if (vendor.isActive && canDeactivate) {
      actions.push({
        key: "deactivate",
        label: "Deactivate",
        icon: <Trash2 className="h-4 w-4" strokeWidth={1.9} />,
        destructive: true,
        onClick: () => setPendingDeactivate(vendor),
      });
    }
    if (!vendor.isActive && canRestore) {
      actions.push({
        key: "restore",
        label: "Restore",
        icon: <RotateCcw className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () => executeAction(vendor, "restore"),
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
          <table className="w-max min-w-7xl border-collapse text-left text-sm">
            <colgroup>
              <col className="w-62" />
              <col className="w-36" />
              <col className="w-40" />
              <col className="w-80" />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-44" />
              <col className="w-36" />
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr>
                {resolvedHeaders.map((header, index) =>
                  header.sort ? (
                    <SortableHeaderCell
                      key={header.key}
                      label={header.label}
                      align={header.align}
                      sortConfig={header.sort}
                      currentSort={currentSort}
                      onSort={handleSortChange}
                      stickySpec={stickySpecs[index] ?? undefined}
                    />
                  ) : (
                    <th
                      key={header.key}
                      scope="col"
                      className={cn(
                        TABLE_HEADER_CELL_CLASS,
                        header.align === "right" && "text-right",
                        getStickyHeaderCellClass(stickySpecs[index]),
                      )}
                      style={getStickyHeaderCellStyle(stickySpecs[index])}
                    >
                      {header.label || <span className="sr-only">Actions</span>}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {localItems.map((vendor) => {
                const rowActions = buildRowActions(vendor);
                const status = vendor.isActive ? "active" : "inactive";

                return (
                  <tr
                    key={vendor.id}
                    className="group border-b border-[rgb(var(--border)/0.58)] transition-colors last:border-b-0 hover:bg-[rgb(var(--muted)/0.28)]"
                  >
                    <td
                      className={cn(TABLE_BODY_CELL_CLASS, getStickyBodyCellClass(stickySpecs[0]))}
                      style={getStickyBodyCellStyle(stickySpecs[0])}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold wrap-break-word text-[rgb(var(--card-foreground))]">
                          {vendor.businessName}
                        </p>
                        <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                          {vendor.name}
                        </p>
                      </div>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="font-mono text-xs font-semibold text-[rgb(var(--card-foreground))]">
                        {vendor.vendorCode ?? "-"}
                      </p>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>{vendor.phone}</td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="max-w-80 leading-6 wrap-break-word text-[rgb(var(--foreground)/0.72)]">
                        {vendor.address || (
                          <span className="text-[rgb(var(--muted-foreground)/0.6)]">-</span>
                        )}
                      </p>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="text-xs text-[rgb(var(--muted-foreground))]">
                        {formatCompactNumber(vendor.orderCount)} orders
                      </p>
                      <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                        {formatCompactNumber(vendor.inventoryItemCount)} inventory
                      </p>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <DataPill tone={getExpenseCategoryStatusTone(status)} appearance="outline">
                        {formatEnumLabel(status)}
                      </DataPill>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="max-w-44 truncate text-[rgb(var(--foreground)/0.72)]">
                        {vendor.updatedByName ?? "Unknown user"}
                      </p>
                    </td>
                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="whitespace-nowrap text-[rgb(var(--foreground)/0.72)]">
                        {formatDate(vendor.updatedAt)}
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
                        <RowActionMenu label={`Actions for ${vendor.name}`} actions={rowActions} />
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
          variant="vendors"
        />
      </DataTableContainer>

      <ConfirmDialog
        isOpen={pendingDeactivate !== null}
        onClose={() => {
          setPendingDeactivate(null);
          setActionError(null);
        }}
        onConfirm={() => {
          if (pendingDeactivate) executeAction(pendingDeactivate, "deactivate");
        }}
        title="Deactivate vendor"
        description="This will deactivate the vendor so it can no longer be selected for new work. Historical orders, expenses, and inventory references stay linked. This is not a permanent delete."
        confirmKeyword="delete"
        confirmLabel="Deactivate vendor"
        isPending={isPending}
      >
        {pendingDeactivate ? (
          <div className="rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.4)] px-4 py-3">
            <p className="text-sm font-medium text-[rgb(var(--foreground))]">
              {pendingDeactivate.name}
            </p>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
              Phone: {pendingDeactivate.phone}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>

      <VendorEditDialog
        vendorId={editingId}
        onClose={() => setEditingId(null)}
        onSuccess={() => {
          setEditingId(null);
          startTransition(() => router.refresh());
        }}
      />
    </>
  );
}
