"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, Pencil } from "lucide-react";
import { DataPill, getCustomerTypeTone, type DataPillTone } from "@/components/dashboard/data-pill";
import { RowActionMenu, type RowAction } from "@/components/dashboard/row-action-menu";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import {
  buildInventoryPricingPageHref,
  type InventoryPricingPageFilterState,
  type InventoryPricingSortValue,
} from "@/lib/dashboard/inventory-pricing-page-filters";
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
import type {
  DashboardPaginationState,
  InventoryPricingRow,
  InventoryPricingStatus,
} from "@/lib/dashboard/types";
import { formatCurrency, formatDate, formatEnumLabel } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type InventoryPricingDataTableProps = {
  emptyMessage: string;
  currentPath: string;
  currentFilters: InventoryPricingPageFilterState;
  pagination: DashboardPaginationState;
  rows: InventoryPricingRow[];
  showBranchColumn: boolean;
  canEdit: boolean;
  onEditRow: (row: InventoryPricingRow) => void;
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig<InventoryPricingSortValue>;
} & ColumnStickyDef;

function buildHeaderConfigs(showBranchColumn: boolean): HeaderConfig[] {
  const configs: HeaderConfig[] = [
    {
      key: "item",
      label: "Item name",
      sticky: "left",
      width: 240,
      sort: { asc: "item-asc", desc: "item-desc", defaultDirection: "asc" },
    },
    {
      key: "sku",
      label: "SKU",
      sort: { asc: "sku-asc", desc: "sku-desc", defaultDirection: "asc" },
    },
  ];

  if (showBranchColumn) {
    configs.push({
      key: "branch",
      label: "Branch",
      sort: { asc: "branch-asc", desc: "branch-desc", defaultDirection: "asc" },
    });
  }

  configs.push(
    {
      key: "customer-type",
      label: "Customer type",
      sort: { asc: "customer-type-asc", desc: "customer-type-desc", defaultDirection: "asc" },
    },
    {
      key: "selling-rate",
      label: "Selling rate",
      align: "right",
      sort: { asc: "selling-rate-asc", desc: "selling-rate-desc", defaultDirection: "desc" },
    },
    {
      key: "effective-from",
      label: "Effective from",
      sort: { asc: "effective-from-asc", desc: "effective-from-desc", defaultDirection: "desc" },
    },
    {
      key: "effective-to",
      label: "Effective to",
      sort: { asc: "effective-to-asc", desc: "effective-to-desc", defaultDirection: "desc" },
    },
    {
      key: "status",
      label: "Status",
      sort: { asc: "status-asc", desc: "status-desc", defaultDirection: "asc" },
    },
    {
      key: "updated-at",
      label: "Updated",
      sort: { asc: "updated-at-asc", desc: "updated-at-desc", defaultDirection: "desc" },
    },
    { key: "actions", label: "", sticky: "right", width: 56 },
  );

  return configs;
}

export function getInventoryPricingStatusTone(status: InventoryPricingStatus): DataPillTone {
  switch (status) {
    case "current":
      return "emerald";
    case "upcoming":
      return "blue";
    case "expired":
      return "neutral";
  }
}

function renderStatusPill(status: InventoryPricingStatus) {
  return (
    <DataPill tone={getInventoryPricingStatusTone(status)} className="max-w-full">
      {formatEnumLabel(status)}
    </DataPill>
  );
}

export function InventoryPricingDataTable({
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  rows,
  showBranchColumn,
  canEdit,
  onEditRow,
}: InventoryPricingDataTableProps) {
  const router = useRouter();
  const [localRows, setLocalRows] = useState(rows);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const headerConfigs = useMemo(() => buildHeaderConfigs(showBranchColumn), [showBranchColumn]);
  const stickySpecs = computeStickySpecs(headerConfigs);
  const stickyLeftWidth = getStickyEdgeTotalWidth(headerConfigs, "left") || undefined;
  const actionsStickySpec = stickySpecs[stickySpecs.length - 1];

  if (localRows.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const handleSortChange = (sortValue: InventoryPricingSortValue) => {
    const nextHref = buildInventoryPricingPageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });
    router.replace(nextHref, { scroll: false });
  };

  async function handleClosePricing(row: InventoryPricingRow) {
    setActionError(null);

    try {
      const res = await fetch(`/api/inventory-pricing/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      const data = (await res.json().catch(() => null)) as {
        success: boolean;
        message?: string;
      } | null;

      if (!res.ok || !data?.success) {
        setActionError(data?.message ?? "Unable to close this pricing window right now.");
        return;
      }

      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      setActionError("Unable to close this pricing window right now.");
    }
  }

  function buildRowActions(row: InventoryPricingRow): RowAction[] {
    if (!canEdit) return [];

    const actions: RowAction[] = [
      {
        key: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" strokeWidth={1.9} />,
        onClick: () => onEditRow(row),
      },
    ];

    if (row.pricingStatus !== "expired") {
      actions.push({
        key: "close",
        label: "End price",
        icon: <CalendarX2 className="h-4 w-4" strokeWidth={1.9} />,
        destructive: true,
        onClick: () => handleClosePricing(row),
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
              showBranchColumn ? "min-w-7xl" : "min-w-6xl",
            )}
          >
            <colgroup>
              <col className="w-60" />
              <col className="w-32" />
              {showBranchColumn ? <col className="w-44" /> : null}
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-32" />
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
              {localRows.map((row) => {
                const actions = buildRowActions(row);

                return (
                  <tr
                    key={row.id}
                    className="group border-b border-[rgb(var(--border)/0.58)] transition-colors last:border-b-0 hover:bg-[rgb(var(--muted)/0.28)]"
                  >
                    <td
                      className={cn(TABLE_BODY_CELL_CLASS, getStickyBodyCellClass(stickySpecs[0]))}
                      style={getStickyBodyCellStyle(stickySpecs[0])}
                    >
                      <p className="leading-6 font-semibold wrap-break-word text-[rgb(var(--card-foreground))]">
                        {row.itemName}
                      </p>
                    </td>

                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="font-mono text-xs text-[rgb(var(--foreground)/0.72)]">
                        {row.sku}
                      </p>
                    </td>

                    {showBranchColumn ? (
                      <td className={TABLE_BODY_CELL_CLASS}>
                        <p className="max-w-44 leading-6 font-medium wrap-break-word text-[rgb(var(--foreground)/0.76)]">
                          {row.branchName}
                        </p>
                      </td>
                    ) : null}

                    <td className={TABLE_BODY_CELL_CLASS}>
                      <DataPill tone={getCustomerTypeTone(row.customerType)} className="max-w-full">
                        {formatEnumLabel(row.customerType)}
                      </DataPill>
                    </td>

                    <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                      <p className="font-semibold whitespace-nowrap text-[rgb(var(--card-foreground))] tabular-nums">
                        {formatCurrency(row.sellingRate)}
                      </p>
                    </td>

                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="whitespace-nowrap text-[rgb(var(--card-foreground))]">
                        {formatDate(row.effectiveFrom)}
                      </p>
                    </td>

                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="whitespace-nowrap text-[rgb(var(--card-foreground))]">
                        {row.effectiveTo ? (
                          formatDate(row.effectiveTo)
                        ) : (
                          <span className="text-[rgb(var(--muted-foreground)/0.6)]">Open</span>
                        )}
                      </p>
                    </td>

                    <td className={TABLE_BODY_CELL_CLASS}>
                      <div className="flex flex-col gap-1">
                        {renderStatusPill(row.pricingStatus)}
                        {row.isExpiringSoon ? (
                          <DataPill tone="amber" className="max-w-full">
                            Expiring soon
                          </DataPill>
                        ) : null}
                      </div>
                    </td>

                    <td className={TABLE_BODY_CELL_CLASS}>
                      <p className="whitespace-nowrap text-[rgb(var(--card-foreground))]">
                        {formatDate(row.updatedAt)}
                      </p>
                    </td>

                    <td
                      className={cn(
                        TABLE_BODY_CELL_CLASS,
                        "py-2",
                        getStickyBodyCellClass(actionsStickySpec),
                      )}
                      style={getStickyBodyCellStyle(actionsStickySpec)}
                    >
                      {actions.length > 0 ? (
                        <RowActionMenu
                          actions={actions}
                          label={`Actions for ${row.itemName} pricing`}
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
          variant="inventory-pricing"
        />
      </DataTableContainer>
    </>
  );
}
