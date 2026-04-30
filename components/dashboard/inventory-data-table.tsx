"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, PowerOff, Zap } from "lucide-react";
import { DataPill, getInventoryStockStateTone } from "@/components/dashboard/data-pill";
import { RowActionMenu, type RowAction } from "@/components/dashboard/row-action-menu";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  buildInventoryPageHref,
  type InventoryPageFilterState,
  type InventorySortValue,
} from "@/lib/dashboard/inventory-page-filters";
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
import type { DashboardPaginationState, InventoryPageDetailRow } from "@/lib/dashboard/types";
import type { InventoryRowPatch } from "@/components/inventory/edit-inventory-dialog";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type InventoryDataTableProps = {
  emptyMessage: string;
  currentPath: string;
  currentFilters: InventoryPageFilterState;
  pagination: DashboardPaginationState;
  items: InventoryPageDetailRow[];
  showBranchColumn: boolean;
  fallbackBranchName: string;
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
  onEditRow?: (item: InventoryPageDetailRow) => void;
  pendingPatch?: { id: string; patch: InventoryRowPatch } | null;
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig<InventorySortValue>;
  conditional?: boolean;
} & ColumnStickyDef;

function buildHeaderConfigs(showBranchColumn: boolean): HeaderConfig[] {
  const configs: HeaderConfig[] = [
    {
      key: "name",
      label: "Item name",
      sticky: "left",
      width: 224,
      sort: { asc: "name-asc", desc: "name-desc", defaultDirection: "asc" },
    },
    {
      key: "sku",
      label: "SKU",
      sort: { asc: "sku-asc", desc: "sku-desc", defaultDirection: "asc" },
    },
    {
      key: "unit",
      label: "Unit",
      sort: { asc: "unit-asc", desc: "unit-desc", defaultDirection: "asc" },
    },
    {
      key: "quantity",
      label: "Quantity",
      align: "right",
      sort: { asc: "quantity-asc", desc: "quantity-desc", defaultDirection: "desc" },
    },
    {
      key: "stock",
      label: "Stock",
      sort: { asc: "stock-state-asc", desc: "stock-state-desc", defaultDirection: "asc" },
    },
    {
      key: "active",
      label: "Active",
      sort: { asc: "active-asc", desc: "active-desc", defaultDirection: "desc" },
    },
    {
      key: "purchase-rate",
      label: "Last rate",
      align: "right",
      sort: { asc: "purchase-rate-asc", desc: "purchase-rate-desc", defaultDirection: "desc" },
    },
    {
      key: "vendor",
      label: "Last vendor",
      sort: { asc: "vendor-asc", desc: "vendor-desc", defaultDirection: "asc" },
    },
    {
      key: "updated-at",
      label: "Updated",
      sort: { asc: "updated-at-asc", desc: "updated-at-desc", defaultDirection: "desc" },
    },
  ];

  if (showBranchColumn) {
    configs.push({ key: "branch", label: "Branch" });
  }

  configs.push({ key: "actions", label: "", sticky: "right", width: 56 });

  return configs;
}

function renderStockStatePill(stockState: string, isArchived: boolean) {
  if (isArchived) {
    return (
      <DataPill tone="neutral" appearance="outline" className="max-w-full">
        Archived
      </DataPill>
    );
  }

  let label = "Unknown";
  switch (stockState) {
    case "in-stock":
      label = "In stock";
      break;
    case "low-stock":
      label = "Low stock";
      break;
    case "out-of-stock":
      label = "Out of stock";
      break;
  }

  return (
    <DataPill tone={getInventoryStockStateTone(stockState)} className="max-w-full">
      {label}
    </DataPill>
  );
}

function renderIsActivePill(isActive: boolean) {
  return (
    <DataPill tone={isActive ? "emerald" : "neutral"} className="max-w-full">
      {isActive ? "Active" : "Inactive"}
    </DataPill>
  );
}

function renderUnitPill(unit: string) {
  return (
    <DataPill tone="neutral" appearance="outline" className="max-w-full capitalize">
      {unit}
    </DataPill>
  );
}

export function InventoryDataTable({
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  items,
  showBranchColumn,
  fallbackBranchName,
  canEdit,
  canArchive,
  canRestore,
  onEditRow,
  pendingPatch,
}: InventoryDataTableProps) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState<InventoryPageDetailRow[]>(items);
  const [archiveTarget, setArchiveTarget] = useState<InventoryPageDetailRow | null>(null);
  const [isArchivePending, setIsArchivePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Apply the optimistic patch from the edit dialog immediately, without waiting
  // for router.refresh() to commit (which is deferred by Next.js via startTransition).
  const renderedItems = useMemo(() => {
    if (!pendingPatch) return localItems;
    return localItems.map((item) =>
      item.id === pendingPatch.id ? { ...item, ...pendingPatch.patch } : item,
    );
  }, [localItems, pendingPatch]);

  const headerConfigs = buildHeaderConfigs(showBranchColumn);
  const stickySpecs = computeStickySpecs(headerConfigs);
  const stickyLeftWidth = getStickyEdgeTotalWidth(headerConfigs, "left") || undefined;
  const actionsStickySpec = stickySpecs[stickySpecs.length - 1];

  if (renderedItems.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const handleSortChange = (sortValue: InventorySortValue) => {
    const nextHref = buildInventoryPageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });
    router.replace(nextHref, { scroll: false });
  };

  async function executeSimpleAction(
    inventoryId: string,
    body: Record<string, unknown>,
    onSuccess: (id: string) => void,
  ) {
    setActionError(null);
    try {
      const res = await fetch(`/api/inventory/${inventoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as {
        success: boolean;
        message?: string;
      } | null;

      if (!res.ok || !data?.success) {
        setActionError(data?.message ?? "Unable to complete the action right now.");
        return;
      }

      onSuccess(inventoryId);
      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      setActionError("Unable to complete the action right now.");
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setIsArchivePending(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/inventory/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      const data = (await res.json().catch(() => null)) as {
        success: boolean;
        message?: string;
      } | null;

      if (!res.ok || !data?.success) {
        setActionError(data?.message ?? "Unable to archive the item right now.");
        setIsArchivePending(false);
        return;
      }

      const archivedId = archiveTarget.id;
      setArchiveTarget(null);
      setIsArchivePending(false);
      setLocalItems((prev) =>
        prev.map((i) => (i.id === archivedId ? { ...i, deletedAt: new Date().toISOString() } : i)),
      );
      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      setActionError("Unable to archive the item right now.");
      setIsArchivePending(false);
    }
  }

  function buildRowActions(item: InventoryPageDetailRow): RowAction[] {
    const isArchived = item.deletedAt !== null;
    const actions: RowAction[] = [];

    if (canEdit && !isArchived) {
      actions.push({
        key: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () =>
          onEditRow ? onEditRow(item) : router.push(`/dashboard/inventory/${item.id}/edit`),
      });
    }

    if (canEdit && !isArchived) {
      actions.push(
        item.isActive
          ? {
              key: "deactivate",
              label: "Deactivate",
              icon: <PowerOff className="h-4 w-4" strokeWidth={1.9} />,
              destructive: true,
              onClick: () =>
                executeSimpleAction(item.id, { action: "toggle-active", isActive: false }, (id) => {
                  setLocalItems((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, isActive: false } : i)),
                  );
                }),
            }
          : {
              key: "activate",
              label: "Activate",
              icon: <Zap className="h-4 w-4" strokeWidth={1.9} />,
              onClick: () =>
                executeSimpleAction(item.id, { action: "toggle-active", isActive: true }, (id) => {
                  setLocalItems((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, isActive: true } : i)),
                  );
                }),
            },
      );
    }

    if (canArchive && !isArchived) {
      actions.push({
        key: "archive",
        label: "Archive",
        icon: <Archive className="h-4 w-4" strokeWidth={1.9} />,
        destructive: true,
        onClick: () => setArchiveTarget(item),
      });
    }

    if (canRestore && isArchived) {
      actions.push({
        key: "restore",
        label: "Restore",
        icon: <ArchiveRestore className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () =>
          executeSimpleAction(item.id, { action: "restore" }, (id) => {
            setLocalItems((prev) => prev.map((i) => (i.id === id ? { ...i, deletedAt: null } : i)));
          }),
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
          <table
            className={cn(
              "w-max min-w-full border-collapse text-left text-sm",
              showBranchColumn ? "min-w-336" : "min-w-6xl",
            )}
          >
            <colgroup>
              <col className="w-56" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-32" />
              <col className="w-36" />
              <col className="w-44" />
              <col className="w-36" />
              {showBranchColumn && <col className="w-44" />}
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
                      {headerConfig.label ? (
                        headerConfig.label
                      ) : (
                        <span className="sr-only">Actions</span>
                      )}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {renderedItems.map((item) => {
                const isArchived = item.deletedAt !== null;
                const rowActions = buildRowActions(item);

                return (
                  <tr
                    key={item.id}
                    className="group border-b border-[rgb(var(--border)/0.58)] transition-colors last:border-b-0 hover:bg-[rgb(var(--muted)/0.28)]"
                  >
                    <td
                      className={cn(
                        TABLE_BODY_CELL_CLASS,
                        getStickyBodyCellClass(stickySpecs[0]),
                        isArchived && "opacity-60",
                      )}
                      style={getStickyBodyCellStyle(stickySpecs[0])}
                    >
                      <p className="leading-6 font-semibold wrap-break-word text-[rgb(var(--card-foreground))]">
                        {item.name}
                      </p>
                    </td>

                    <td className={cn(TABLE_BODY_CELL_CLASS, isArchived && "opacity-60")}>
                      <p className="font-mono text-xs text-[rgb(var(--foreground)/0.72)]">
                        {item.sku}
                      </p>
                    </td>

                    <td className={cn(TABLE_BODY_CELL_CLASS, isArchived && "opacity-60")}>
                      {renderUnitPill(item.unit)}
                    </td>

                    <td
                      className={cn(
                        TABLE_BODY_CELL_CLASS,
                        "text-right",
                        isArchived && "opacity-60",
                      )}
                    >
                      <p className="font-semibold whitespace-nowrap text-[rgb(var(--card-foreground))] tabular-nums">
                        {item.quantity.toLocaleString("en-IN")}
                      </p>
                    </td>

                    <td className={TABLE_BODY_CELL_CLASS}>
                      {renderStockStatePill(item.stockState, isArchived)}
                    </td>

                    <td className={cn(TABLE_BODY_CELL_CLASS, isArchived && "opacity-60")}>
                      {renderIsActivePill(item.isActive)}
                    </td>

                    <td
                      className={cn(
                        TABLE_BODY_CELL_CLASS,
                        "text-right",
                        isArchived && "opacity-60",
                      )}
                    >
                      {item.lastPurchaseRate !== null ? (
                        <p className="whitespace-nowrap text-[rgb(var(--card-foreground))] tabular-nums">
                          {formatCurrency(item.lastPurchaseRate)}
                        </p>
                      ) : (
                        <p className="text-sm text-[rgb(var(--muted-foreground)/0.6)]">—</p>
                      )}
                    </td>

                    <td className={cn(TABLE_BODY_CELL_CLASS, isArchived && "opacity-60")}>
                      <p className="max-w-44 text-sm leading-6 wrap-break-word text-[rgb(var(--foreground)/0.76)]">
                        {item.lastVendorName ?? (
                          <span className="text-[rgb(var(--muted-foreground)/0.6)]">—</span>
                        )}
                      </p>
                    </td>

                    <td className={cn(TABLE_BODY_CELL_CLASS, isArchived && "opacity-60")}>
                      <p className="font-medium whitespace-nowrap text-[rgb(var(--card-foreground))]">
                        {formatDate(item.updatedAt)}
                      </p>
                    </td>

                    {showBranchColumn && (
                      <td className={cn(TABLE_BODY_CELL_CLASS, isArchived && "opacity-60")}>
                        <p className="max-w-44 leading-6 font-medium wrap-break-word text-[rgb(var(--foreground)/0.76)]">
                          {item.branchName || fallbackBranchName}
                        </p>
                      </td>
                    )}

                    <td
                      className={cn(
                        TABLE_BODY_CELL_CLASS,
                        "py-2",
                        getStickyBodyCellClass(actionsStickySpec),
                      )}
                      style={getStickyBodyCellStyle(actionsStickySpec)}
                    >
                      {rowActions.length > 0 ? (
                        <RowActionMenu actions={rowActions} label={`Actions for ${item.name}`} />
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
          variant="inventory"
        />
      </DataTableContainer>

      <ConfirmDialog
        isOpen={archiveTarget !== null}
        onClose={() => {
          if (!isArchivePending) setArchiveTarget(null);
        }}
        onConfirm={handleArchiveConfirm}
        title="Archive inventory item"
        description="The item will be hidden from the active inventory list. Stock movements and audit history are preserved. You can restore it at any time."
        confirmKeyword="archive"
        confirmLabel="Archive item"
        isPending={isArchivePending}
      >
        {archiveTarget ? (
          <div className="rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.4)] px-4 py-3">
            <p className="text-sm font-medium text-[rgb(var(--foreground))]">
              {archiveTarget.name}
            </p>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
              SKU: {archiveTarget.sku} &middot; Qty:{" "}
              {archiveTarget.quantity.toLocaleString("en-IN")}
            </p>
          </div>
        ) : null}

        {actionError && archiveTarget ? (
          <div className="mt-3 rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
            {actionError}
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
