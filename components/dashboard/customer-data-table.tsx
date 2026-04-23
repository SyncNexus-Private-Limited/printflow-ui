"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataPill, type DataPillTone } from "@/components/dashboard/data-pill";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import {
  buildCustomerPageHref,
  type CustomerPageFilterState,
  type CustomerSortValue,
} from "@/lib/dashboard/customer-page-filters";
import type { CustomerDetailRow, DashboardPaginationState } from "@/lib/dashboard/types";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { formatCompactNumber, formatCurrency, formatDate, formatEnumLabel } from "@/lib/utils/format";

type CustomerDataTableProps = {
  items: CustomerDetailRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: CustomerPageFilterState;
  pagination: DashboardPaginationState;
};

type SortDirection = "asc" | "desc";

type HeaderSortConfig = {
  asc: CustomerSortValue;
  desc: CustomerSortValue;
  defaultDirection: SortDirection;
};

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig;
};

const tableHeaderCellClassName = suggestCanonicalClasses(
  "whitespace-nowrap border-b border-[rgb(var(--border)/0.65)] bg-[rgb(var(--muted)/0.72)] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground)/0.9)] first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
);

const tableBodyCellClassName = suggestCanonicalClasses(
  "px-4 py-4 align-top first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
);

const headerConfigs: HeaderConfig[] = [
  {
    key: "customer",
    label: "Customer",
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

function getCustomerTypeTone(type: string): DataPillTone {
  switch (type.toLowerCase()) {
    case "studio":
      return "blue";
    case "amateur":
      return "emerald";
    case "employee":
      return "violet";
    default:
      return "neutral";
  }
}

function getTableHeaderCellClassName(align: "left" | "right" = "left") {
  return cn(tableHeaderCellClassName, align === "right" && "text-right");
}

function getTableBodyCellClassName(align: "left" | "right" = "left") {
  return cn(tableBodyCellClassName, align === "right" && "text-right");
}

function getSortDirection(
  currentSort: CustomerSortValue,
  sortConfig: HeaderSortConfig,
): SortDirection | null {
  if (currentSort === sortConfig.asc) return "asc";
  if (currentSort === sortConfig.desc) return "desc";
  return null;
}

function getNextSortValue(currentSort: CustomerSortValue, sortConfig: HeaderSortConfig) {
  const activeDirection = getSortDirection(currentSort, sortConfig);

  if (activeDirection === "asc") return sortConfig.desc;
  if (activeDirection === "desc") return sortConfig.asc;

  return sortConfig.defaultDirection === "desc" ? sortConfig.desc : sortConfig.asc;
}

function getNextSortDirectionLabel(currentSort: CustomerSortValue, sortConfig: HeaderSortConfig) {
  const nextSortValue = getNextSortValue(currentSort, sortConfig);

  return nextSortValue === sortConfig.asc ? "ascending" : "descending";
}

export function CustomerDataTable({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
}: CustomerDataTableProps) {
  const router = useRouter();

  const handleSortChange = (sortValue: CustomerSortValue) => {
    const nextHref = buildCustomerPageHref(currentPath, currentFilters, {
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
                  {headerConfigs.map((headerConfig) => {
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
                            <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
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
                {items.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
                  >
                    <td className={getTableBodyCellClassName()}>
                      <div className="space-y-0.5">
                        <p className="wrap-break-word font-semibold leading-6 text-[rgb(var(--card-foreground))]">
                          {customer.name}
                        </p>
                        {customer.customerCode ? (
                          <p className="text-xs text-[rgb(var(--muted-foreground))]">
                            {customer.customerCode}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className={getTableBodyCellClassName()}>
                      <DataPill tone={getCustomerTypeTone(customer.type)}>
                        {formatEnumLabel(customer.type)}
                      </DataPill>
                    </td>
                    <td className={getTableBodyCellClassName()}>
                      <p className="whitespace-nowrap text-[rgb(var(--card-foreground))]">
                        {customer.phone}
                      </p>
                    </td>
                    <td className={getTableBodyCellClassName()}>
                      <p className="text-[rgb(var(--foreground)/0.72)]">
                        {customer.studioName ?? "—"}
                      </p>
                    </td>
                    <td className={getTableBodyCellClassName("right")}>
                      <p className="whitespace-nowrap font-medium tabular-nums text-[rgb(var(--card-foreground))]">
                        {formatCompactNumber(customer.orderCount)}
                      </p>
                    </td>
                    <td className={getTableBodyCellClassName("right")}>
                      <p className="whitespace-nowrap font-medium tabular-nums text-[rgb(var(--card-foreground))]">
                        {formatCurrency(customer.totalPayable)}
                      </p>
                    </td>
                    <td className={getTableBodyCellClassName("right")}>
                      {customer.totalOutstanding > 0 ? (
                        <DataPill tone="rose" appearance="outline" className="ml-auto">
                          {formatCurrency(customer.totalOutstanding)}
                        </DataPill>
                      ) : (
                        <p className="whitespace-nowrap font-medium tabular-nums text-[rgb(var(--muted-foreground))]">
                          {formatCurrency(customer.totalOutstanding)}
                        </p>
                      )}
                    </td>
                    <td className={getTableBodyCellClassName()}>
                      <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
                        {customer.lastOrderDate ? formatDate(customer.lastOrderDate) : "—"}
                      </p>
                    </td>
                    <td className={getTableBodyCellClassName()}>
                      <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
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
        </>
      )}
    </div>
  );
}
