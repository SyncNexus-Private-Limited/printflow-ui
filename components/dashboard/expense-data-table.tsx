"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataPill, getExpenseCategoryTone, getExpensePaymentModeTone } from "@/components/dashboard/data-pill";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import {
  buildExpensePageHref,
  type ExpensePageFilterState,
  type ExpenseSortValue,
} from "@/lib/dashboard/expense-page-filters";
import { getPaymentModeLabel } from "@/lib/expenses/types";
import type {
  BusinessExpenseDetailRow,
  DashboardPaginationState,
  EmployeeExpenseDetailRow,
} from "@/lib/dashboard/types";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type ExpenseDataTableBaseProps = {
  emptyMessage: string;
  currentPath: string;
  currentFilters: ExpensePageFilterState;
  pagination: DashboardPaginationState;
  fallbackBranchName?: string;
};

type EmployeeExpenseDataTableProps = ExpenseDataTableBaseProps & {
  kind: "employee";
  items: EmployeeExpenseDetailRow[];
};

type BusinessExpenseDataTableProps = ExpenseDataTableBaseProps & {
  kind: "business";
  items: BusinessExpenseDetailRow[];
  fallbackBranchName: string;
};

type ExpenseDataTableProps = EmployeeExpenseDataTableProps | BusinessExpenseDataTableProps;

type SortDirection = "asc" | "desc";

type HeaderSortConfig = {
  asc: ExpenseSortValue;
  desc: ExpenseSortValue;
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

const employeeHeaderConfigs: HeaderConfig[] = [
  {
    key: "employee",
    label: "Employee",
    sort: {
      asc: "employee-asc",
      desc: "employee-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "expense",
    label: "Expense",
    sort: {
      asc: "title-asc",
      desc: "title-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "category",
    label: "Category",
    sort: {
      asc: "category-asc",
      desc: "category-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sort: {
      asc: "amount-asc",
      desc: "amount-desc",
      defaultDirection: "desc",
    },
  },
  {
    key: "payment",
    label: "Payment",
    sort: {
      asc: "payment-asc",
      desc: "payment-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "notes",
    label: "Notes",
  },
  {
    key: "expense-date",
    label: "Expense date",
    sort: {
      asc: "expense-date-asc",
      desc: "expense-date-desc",
      defaultDirection: "desc",
    },
  },
  {
    key: "logged-date",
    label: "Logged date",
    sort: {
      asc: "logged-date-asc",
      desc: "logged-date-desc",
      defaultDirection: "desc",
    },
  },
];

const businessHeaderConfigs: HeaderConfig[] = [
  {
    key: "category",
    label: "Category",
    sort: {
      asc: "category-asc",
      desc: "category-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "expense",
    label: "Expense",
    sort: {
      asc: "title-asc",
      desc: "title-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sort: {
      asc: "amount-asc",
      desc: "amount-desc",
      defaultDirection: "desc",
    },
  },
  {
    key: "payment",
    label: "Payment",
    sort: {
      asc: "payment-asc",
      desc: "payment-desc",
      defaultDirection: "asc",
    },
  },
  {
    key: "notes",
    label: "Notes",
  },
  {
    key: "expense-date",
    label: "Expense date",
    sort: {
      asc: "expense-date-asc",
      desc: "expense-date-desc",
      defaultDirection: "desc",
    },
  },
  {
    key: "logged-date",
    label: "Logged date",
    sort: {
      asc: "logged-date-asc",
      desc: "logged-date-desc",
      defaultDirection: "desc",
    },
  },
  {
    key: "branch",
    label: "Branch",
  },
];

function getTableHeaderCellClassName(align: "left" | "right" = "left") {
  return cn(tableHeaderCellClassName, align === "right" && "text-right");
}

function getTableBodyCellClassName(align: "left" | "right" = "left") {
  return cn(tableBodyCellClassName, align === "right" && "text-right");
}

function getSortDirection(currentSort: ExpenseSortValue, sortConfig: HeaderSortConfig): SortDirection | null {
  if (currentSort === sortConfig.asc) {
    return "asc";
  }

  if (currentSort === sortConfig.desc) {
    return "desc";
  }

  return null;
}

function getNextSortValue(currentSort: ExpenseSortValue, sortConfig: HeaderSortConfig) {
  const activeDirection = getSortDirection(currentSort, sortConfig);

  if (activeDirection === "asc") {
    return sortConfig.desc;
  }

  if (activeDirection === "desc") {
    return sortConfig.asc;
  }

  return sortConfig.defaultDirection === "desc" ? sortConfig.desc : sortConfig.asc;
}

function getNextSortDirectionLabel(currentSort: ExpenseSortValue, sortConfig: HeaderSortConfig) {
  const nextSortValue = getNextSortValue(currentSort, sortConfig);

  return nextSortValue === sortConfig.asc ? "ascending" : "descending";
}

function getTableMinWidthClassName(kind: ExpenseDataTableProps["kind"]) {
  return kind === "employee" ? "min-w-304" : "min-w-328";
}

function getHeaderConfigs(kind: ExpenseDataTableProps["kind"]) {
  return kind === "employee" ? employeeHeaderConfigs : businessHeaderConfigs;
}

function renderPaymentPill(paymentMode: string) {
  return (
    <DataPill tone={getExpensePaymentModeTone(paymentMode)} appearance="outline" className="max-w-full">
      {getPaymentModeLabel(paymentMode)}
    </DataPill>
  );
}

function renderEmployeeRows(items: EmployeeExpenseDetailRow[]) {
  return items.map((expense) => (
    <tr
      key={expense.id}
      className="border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
    >
      <td className={getTableBodyCellClassName()}>
        <div className="space-y-1">
          <p className="wrap-break-word font-semibold leading-6 text-[rgb(var(--card-foreground))]">{expense.userName}</p>
        </div>
      </td>
      <td className={getTableBodyCellClassName()}>
        <div className="space-y-1">
          <p className="font-semibold leading-6 text-[rgb(var(--card-foreground))]">{expense.title}</p>
        </div>
      </td>
      <td className={getTableBodyCellClassName()}>
        <DataPill tone={getExpenseCategoryTone(expense.categoryCode)} className="max-w-full">
          {expense.category}
        </DataPill>
      </td>
      <td className={getTableBodyCellClassName("right")}>
        <p className="whitespace-nowrap text-base font-semibold tabular-nums text-[rgb(var(--card-foreground))]">
          {formatCurrency(expense.amount)}
        </p>
      </td>
      <td className={getTableBodyCellClassName()}>{renderPaymentPill(expense.paymentMode)}</td>
      <td className={getTableBodyCellClassName()}>
        <div className="max-w-lg">
          <p className="wrap-break-word text-sm leading-6 text-[rgb(var(--foreground)/0.68)]">
            {expense.remarks ?? "No remarks added."}
          </p>
        </div>
      </td>
      <td className={getTableBodyCellClassName()}>
        <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">{formatDate(expense.expenseDate)}</p>
      </td>
      <td className={getTableBodyCellClassName()}>
        <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">{formatDate(expense.createdAt)}</p>
      </td>
    </tr>
  ));
}

function renderBusinessRows(items: BusinessExpenseDetailRow[], fallbackBranchName: string) {
  return items.map((expense) => (
    <tr
      key={expense.id}
      className="border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
    >
      <td className={getTableBodyCellClassName()}>
        <DataPill tone={getExpenseCategoryTone(expense.categoryCode)} className="max-w-full">
          {expense.category}
        </DataPill>
      </td>
      <td className={getTableBodyCellClassName()}>
        <div className="space-y-1">
          <p className="font-semibold leading-6 text-[rgb(var(--card-foreground))]">
            {expense.title ?? "Untitled expense"}
          </p>
        </div>
      </td>
      <td className={getTableBodyCellClassName("right")}>
        <p className="whitespace-nowrap text-base font-semibold tabular-nums text-[rgb(var(--card-foreground))]">
          {formatCurrency(expense.amount)}
        </p>
      </td>
      <td className={getTableBodyCellClassName()}>{renderPaymentPill(expense.paymentMode)}</td>
      <td className={getTableBodyCellClassName()}>
        <div className="max-w-lg">
          <p className="wrap-break-word text-sm leading-6 text-[rgb(var(--foreground)/0.68)]">
            {expense.remarks ?? "No remarks added."}
          </p>
        </div>
      </td>
      <td className={getTableBodyCellClassName()}>
        <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">{formatDate(expense.expenseDate)}</p>
      </td>
      <td className={getTableBodyCellClassName()}>
        <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">{formatDate(expense.createdAt)}</p>
      </td>
      <td className={getTableBodyCellClassName()}>
        <p className="max-w-44 wrap-break-word font-medium leading-6 text-[rgb(var(--foreground)/0.76)]">
          {expense.branchName ?? fallbackBranchName}
        </p>
      </td>
    </tr>
  ));
}

export function ExpenseDataTable({
  kind,
  emptyMessage,
  items,
  currentPath,
  currentFilters,
  pagination,
  fallbackBranchName,
}: ExpenseDataTableProps) {
  const router = useRouter();
  const { showBlockingLoader } = useGlobalLoader();
  const tableMinWidthClassName = getTableMinWidthClassName(kind);
  const headerConfigs = getHeaderConfigs(kind);

  const handleSortChange = (sortValue: ExpenseSortValue) => {
    const nextHref = buildExpensePageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });

    showBlockingLoader("Updating expense sort...", {
      autoHideOnRouteChange: true,
    });
    router.push(nextHref);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.98)]">
      {items.length === 0 ? (
        <div className="px-6 py-12 text-sm leading-6 text-[rgb(var(--muted-foreground))]">{emptyMessage}</div>
      ) : (
        <>
          <TableScrollArea className="bg-[rgb(var(--card)/0.98)]" viewportClassName="pb-0">
            <table className={cn("w-max min-w-full border-collapse text-left text-sm", tableMinWidthClassName)}>
              {kind === "employee" ? (
                <colgroup>
                  <col className="w-48" />
                  <col className="w-72" />
                  <col className="w-40" />
                  <col className="w-32" />
                  <col className="w-36" />
                  <col className="w-72" />
                  <col className="w-36" />
                  <col className="w-36" />
                </colgroup>
              ) : (
                <colgroup>
                  <col className="w-44" />
                  <col className="w-72" />
                  <col className="w-32" />
                  <col className="w-36" />
                  <col className="w-72" />
                  <col className="w-36" />
                  <col className="w-36" />
                  <col className="w-44" />
                </colgroup>
              )}

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
                              headerConfig.align === "right" ? "justify-end text-right" : "justify-between text-left",
                              activeDirection ? "text-[rgb(var(--card-foreground))]" : "hover:text-[rgb(var(--foreground))]",
                            )}
                            onClick={() => handleSortChange(getNextSortValue(currentFilters.sort, headerConfig.sort!))}
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
                {kind === "employee"
                  ? renderEmployeeRows(items)
                  : renderBusinessRows(items, fallbackBranchName ?? "Branch")}
              </tbody>
            </table>
          </TableScrollArea>

          <DashboardPagination
            currentPath={currentPath}
            currentFilters={currentFilters}
            pagination={pagination}
            variant="expense"
          />
        </>
      )}
    </div>
  );
}
