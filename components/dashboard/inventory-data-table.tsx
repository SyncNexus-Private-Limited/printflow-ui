"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataPill, getInventoryStockStateTone } from "@/components/dashboard/data-pill";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import {
  buildInventoryPageHref,
  type InventoryPageFilterState,
  type InventorySortValue,
} from "@/lib/dashboard/inventory-page-filters";
import type { DashboardPaginationState, InventoryPageDetailRow } from "@/lib/dashboard/types";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
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

type SortDirection = "asc" | "desc";

type HeaderSortConfig = {
  asc: InventorySortValue;
  desc: InventorySortValue;
  defaultDirection: SortDirection;
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig;
  conditional?: boolean;
};

const tableHeaderCellClassName = suggestCanonicalClasses(
  "whitespace-nowrap border-b border-[rgb(var(--border)/0.65)] bg-[rgb(var(--muted)/0.72)] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground)/0.9)] first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
);

const tableBodyCellClassName = suggestCanonicalClasses(
  "px-4 py-4 align-top first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
);

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

function getTableHeaderCellClassName(align: "left" | "right" = "left") {
  return cn(tableHeaderCellClassName, align === "right" && "text-right");
}

function getTableBodyCellClassName(align: "left" | "right" = "left") {
  return cn(tableBodyCellClassName, align === "right" && "text-right");
}

function getSortDirection(
  currentSort: InventorySortValue,
  sortConfig: HeaderSortConfig,
): SortDirection | null {
  if (currentSort === sortConfig.asc) return "asc";
  if (currentSort === sortConfig.desc) return "desc";

  return null;
}

function getNextSortValue(
  currentSort: InventorySortValue,
  sortConfig: HeaderSortConfig,
): InventorySortValue {
  const activeDirection = getSortDirection(currentSort, sortConfig);

  if (activeDirection === "asc") return sortConfig.desc;
  if (activeDirection === "desc") return sortConfig.asc;

  return sortConfig.defaultDirection === "desc" ? sortConfig.desc : sortConfig.asc;
}

function getNextSortDirectionLabel(
  currentSort: InventorySortValue,
  sortConfig: HeaderSortConfig,
): string {
  const nextSortValue = getNextSortValue(currentSort, sortConfig);

  return nextSortValue === sortConfig.asc ? "ascending" : "descending";
}

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

  const handleSortChange = (sortValue: InventorySortValue) => {
    const nextHref = buildInventoryPageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });

    router.push(nextHref);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.98)]">
      {items.length === 0 ? (
        <div className="px-6 py-12 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
          {emptyMessage}
        </div>
      ) : (
        <>
          <TableScrollArea className="bg-[rgb(var(--card)/0.98)]" viewportClassName="pb-0">
            <table
              className={cn(
                "w-max min-w-full border-collapse text-left text-sm",
                showBranchColumn ? "min-w-336" : "min-w-288",
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
                  {visibleHeaders.map((headerConfig) => {
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
                        className={getTableHeaderCellClassName(headerConfig.align)}
                      >
                        {headerConfig.sort ? (
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl transition-colors",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                              headerConfig.align === "right"
                                ? "justify-end text-right"
                                : "justify-between text-left",
                              activeDirection
                                ? "text-[rgb(var(--card-foreground))]"
                                : "hover:text-[rgb(var(--foreground))]",
                            )}
                            onClick={() =>
                              handleSortChange(
                                getNextSortValue(currentFilters.sort, headerConfig.sort!),
                              )
                            }
                            aria-label={`Sort ${headerConfig.label} ${getNextSortDirectionLabel(currentFilters.sort, headerConfig.sort!)}`}
                            title={`Sort ${headerConfig.label} ${getNextSortDirectionLabel(currentFilters.sort, headerConfig.sort!)}`}
                          >
                            <span className="min-w-0 truncate">{headerConfig.label}</span>
                            <span
                              className="flex shrink-0 items-center gap-0.5"
                              aria-hidden="true"
                            >
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
                          headerConfig.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
                  >
                    {/* Name */}
                    <td className={getTableBodyCellClassName()}>
                      <p className="wrap-break-word font-semibold leading-6 text-[rgb(var(--card-foreground))]">
                        {item.name}
                      </p>
                    </td>

                    {/* SKU */}
                    <td className={getTableBodyCellClassName()}>
                      <p className="font-mono text-xs text-[rgb(var(--foreground)/0.72)]">
                        {item.sku}
                      </p>
                    </td>

                    {/* Unit pill */}
                    <td className={getTableBodyCellClassName()}>
                      {renderUnitPill(item.unit)}
                    </td>

                    {/* Quantity */}
                    <td className={getTableBodyCellClassName("right")}>
                      <p className="whitespace-nowrap font-semibold tabular-nums text-[rgb(var(--card-foreground))]">
                        {item.quantity.toLocaleString("en-IN")}
                      </p>
                    </td>

                    {/* Stock state pill */}
                    <td className={getTableBodyCellClassName()}>
                      {renderStockStatePill(item.stockState)}
                    </td>

                    {/* Active pill */}
                    <td className={getTableBodyCellClassName()}>
                      {renderIsActivePill(item.isActive)}
                    </td>

                    {/* Last purchase rate */}
                    <td className={getTableBodyCellClassName("right")}>
                      {item.lastPurchaseRate !== null ? (
                        <p className="whitespace-nowrap tabular-nums text-[rgb(var(--card-foreground))]">
                          {formatCurrency(item.lastPurchaseRate)}
                        </p>
                      ) : (
                        <p className="text-sm text-[rgb(var(--muted-foreground)/0.6)]">—</p>
                      )}
                    </td>

                    {/* Last vendor */}
                    <td className={getTableBodyCellClassName()}>
                      <p className="max-w-44 wrap-break-word text-sm leading-6 text-[rgb(var(--foreground)/0.76)]">
                        {item.lastVendorName ?? (
                          <span className="text-[rgb(var(--muted-foreground)/0.6)]">—</span>
                        )}
                      </p>
                    </td>

                    {/* Updated at */}
                    <td className={getTableBodyCellClassName()}>
                      <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
                        {formatDate(item.updatedAt)}
                      </p>
                    </td>

                    {/* Branch (conditional) */}
                    {showBranchColumn && (
                      <td className={getTableBodyCellClassName()}>
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
        </>
      )}
    </div>
  );
}
