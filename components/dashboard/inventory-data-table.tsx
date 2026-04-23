"use client";

import { useRouter } from "next/navigation";
import { DataPill, getInventoryStockStateTone } from "@/components/dashboard/data-pill";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import {
  buildInventoryPageHref,
  type InventoryPageFilterState,
  type InventorySortValue,
} from "@/lib/dashboard/inventory-page-filters";
import { TABLE_BODY_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "@/lib/dashboard/list-page-classes";
import { type HeaderSortConfig } from "@/lib/dashboard/sortable-header-utils";
import type { DashboardPaginationState, InventoryPageDetailRow } from "@/lib/dashboard/types";
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
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig<InventorySortValue>;
  conditional?: boolean;
};

const headerConfigs: HeaderConfig[] = [
  {
    key: "name",
    label: "Item name",
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
  {
    key: "branch",
    label: "Branch",
    conditional: true,
  },
];

function renderStockStatePill(stockState: string) {
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
}: InventoryDataTableProps) {
  const router = useRouter();
  const visibleHeaders = headerConfigs.filter(
    (h) => !h.conditional || (h.key === "branch" && showBranchColumn),
  );

  if (items.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const handleSortChange = (sortValue: InventorySortValue) => {
    const nextHref = buildInventoryPageHref(currentPath, currentFilters, {
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
          </colgroup>

          <thead>
            <tr>
              {visibleHeaders.map((headerConfig) =>
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
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
              >
                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="wrap-break-word font-semibold leading-6 text-[rgb(var(--card-foreground))]">
                    {item.name}
                  </p>
                </td>

                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="font-mono text-xs text-[rgb(var(--foreground)/0.72)]">{item.sku}</p>
                </td>

                <td className={TABLE_BODY_CELL_CLASS}>{renderUnitPill(item.unit)}</td>

                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  <p className="whitespace-nowrap font-semibold tabular-nums text-[rgb(var(--card-foreground))]">
                    {item.quantity.toLocaleString("en-IN")}
                  </p>
                </td>

                <td className={TABLE_BODY_CELL_CLASS}>{renderStockStatePill(item.stockState)}</td>

                <td className={TABLE_BODY_CELL_CLASS}>{renderIsActivePill(item.isActive)}</td>

                <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
                  {item.lastPurchaseRate !== null ? (
                    <p className="whitespace-nowrap tabular-nums text-[rgb(var(--card-foreground))]">
                      {formatCurrency(item.lastPurchaseRate)}
                    </p>
                  ) : (
                    <p className="text-sm text-[rgb(var(--muted-foreground)/0.6)]">—</p>
                  )}
                </td>

                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="max-w-44 wrap-break-word text-sm leading-6 text-[rgb(var(--foreground)/0.76)]">
                    {item.lastVendorName ?? (
                      <span className="text-[rgb(var(--muted-foreground)/0.6)]">—</span>
                    )}
                  </p>
                </td>

                <td className={TABLE_BODY_CELL_CLASS}>
                  <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
                    {formatDate(item.updatedAt)}
                  </p>
                </td>

                {showBranchColumn && (
                  <td className={TABLE_BODY_CELL_CLASS}>
                    <p className="max-w-44 wrap-break-word font-medium leading-6 text-[rgb(var(--foreground)/0.76)]">
                      {item.branchName || fallbackBranchName}
                    </p>
                  </td>
                )}
              </tr>
            ))}
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
  );
}
