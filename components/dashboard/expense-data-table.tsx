"use client";

import { useRouter } from "next/navigation";
import { DataPill, getExpenseCategoryTone, getExpensePaymentModeTone } from "@/components/dashboard/data-pill";
import { DataTableContainer } from "@/components/dashboard/data-table-container";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { SortableHeaderCell } from "@/components/dashboard/sortable-header-cell";
import { TableEmptyState } from "@/components/dashboard/table-empty-state";
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
import { TABLE_BODY_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "@/lib/dashboard/list-page-classes";
import { type HeaderSortConfig } from "@/lib/dashboard/sortable-header-utils";
import {
  type ColumnStickyDef,
  type StickySpec,
  computeStickySpecs,
  getStickyHeaderCellClass,
  getStickyHeaderCellStyle,
  getStickyBodyCellClass,
  getStickyBodyCellStyle,
  getStickyEdgeTotalWidth,
} from "@/lib/dashboard/sticky-column-utils";
import { cn } from "@/lib/utils/cn";
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

type HeaderConfig = {
  key: string;
  label: string;
  align?: "left" | "right";
  sort?: HeaderSortConfig<ExpenseSortValue>;
} & ColumnStickyDef;

// Employee: w-48 = 192px. The Employee column is the natural anchor for this table.
const employeeHeaderConfigs: HeaderConfig[] = [
  {
    key: "employee",
    label: "Employee",
    sticky: "left",
    width: 192, // matches <col className="w-48">
    sort: { asc: "employee-asc", desc: "employee-desc", defaultDirection: "asc" },
  },
  {
    key: "expense",
    label: "Expense",
    sort: { asc: "title-asc", desc: "title-desc", defaultDirection: "asc" },
  },
  {
    key: "category",
    label: "Category",
    sort: { asc: "category-asc", desc: "category-desc", defaultDirection: "asc" },
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sort: { asc: "amount-asc", desc: "amount-desc", defaultDirection: "desc" },
  },
  {
    key: "payment",
    label: "Payment",
    sort: { asc: "payment-asc", desc: "payment-desc", defaultDirection: "asc" },
  },
  { key: "notes", label: "Notes" },
  {
    key: "expense-date",
    label: "Expense date",
    sort: { asc: "expense-date-asc", desc: "expense-date-desc", defaultDirection: "desc" },
  },
  {
    key: "logged-date",
    label: "Logged date",
    sort: { asc: "logged-date-asc", desc: "logged-date-desc", defaultDirection: "desc" },
  },
];

const businessHeaderConfigs: HeaderConfig[] = [
  {
    key: "category",
    label: "Category",
    sort: { asc: "category-asc", desc: "category-desc", defaultDirection: "asc" },
  },
  {
    key: "expense",
    label: "Expense",
    sort: { asc: "title-asc", desc: "title-desc", defaultDirection: "asc" },
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sort: { asc: "amount-asc", desc: "amount-desc", defaultDirection: "desc" },
  },
  {
    key: "payment",
    label: "Payment",
    sort: { asc: "payment-asc", desc: "payment-desc", defaultDirection: "asc" },
  },
  { key: "notes", label: "Notes" },
  {
    key: "expense-date",
    label: "Expense date",
    sort: { asc: "expense-date-asc", desc: "expense-date-desc", defaultDirection: "desc" },
  },
  {
    key: "logged-date",
    label: "Logged date",
    sort: { asc: "logged-date-asc", desc: "logged-date-desc", defaultDirection: "desc" },
  },
  { key: "branch", label: "Branch" },
];

function getTableMinWidthClassName(kind: ExpenseDataTableProps["kind"]) {
  return kind === "employee" ? "min-w-304" : "min-w-328";
}

function getHeaderConfigs(kind: ExpenseDataTableProps["kind"]) {
  return kind === "employee" ? employeeHeaderConfigs : businessHeaderConfigs;
}

function renderPaymentPill(paymentMode: string) {
  return (
    <DataPill
      tone={getExpensePaymentModeTone(paymentMode)}
      appearance="outline"
      className="max-w-full"
    >
      {getPaymentModeLabel(paymentMode)}
    </DataPill>
  );
}

function renderEmployeeRows(
  items: EmployeeExpenseDetailRow[],
  stickySpecs: (StickySpec | null)[],
) {
  return items.map((expense) => (
    <tr
      key={expense.id}
      // `group` enables group-hover: on sticky body cells
      className="group border-b border-[rgb(var(--border)/0.58)] transition-colors hover:bg-[rgb(var(--muted)/0.28)] last:border-b-0"
    >
      <td
        className={cn(TABLE_BODY_CELL_CLASS, getStickyBodyCellClass(stickySpecs[0]))}
        style={getStickyBodyCellStyle(stickySpecs[0])}
      >
        <p className="wrap-break-word font-semibold leading-6 text-[rgb(var(--card-foreground))]">
          {expense.userName}
        </p>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <p className="font-semibold leading-6 text-[rgb(var(--card-foreground))]">{expense.title}</p>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <DataPill tone={getExpenseCategoryTone(expense.categoryCode)} className="max-w-full">
          {expense.category}
        </DataPill>
      </td>
      <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
        <p className="whitespace-nowrap text-base font-semibold tabular-nums text-[rgb(var(--card-foreground))]">
          {formatCurrency(expense.amount)}
        </p>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>{renderPaymentPill(expense.paymentMode)}</td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <div className="max-w-lg">
          <p className="wrap-break-word text-sm leading-6 text-[rgb(var(--foreground)/0.68)]">
            {expense.remarks ?? "No remarks added."}
          </p>
        </div>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
          {formatDate(expense.expenseDate)}
        </p>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
          {formatDate(expense.createdAt)}
        </p>
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
      <td className={TABLE_BODY_CELL_CLASS}>
        <DataPill tone={getExpenseCategoryTone(expense.categoryCode)} className="max-w-full">
          {expense.category}
        </DataPill>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <p className="font-semibold leading-6 text-[rgb(var(--card-foreground))]">
          {expense.title ?? "Untitled expense"}
        </p>
      </td>
      <td className={cn(TABLE_BODY_CELL_CLASS, "text-right")}>
        <p className="whitespace-nowrap text-base font-semibold tabular-nums text-[rgb(var(--card-foreground))]">
          {formatCurrency(expense.amount)}
        </p>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>{renderPaymentPill(expense.paymentMode)}</td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <div className="max-w-lg">
          <p className="wrap-break-word text-sm leading-6 text-[rgb(var(--foreground)/0.68)]">
            {expense.remarks ?? "No remarks added."}
          </p>
        </div>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
          {formatDate(expense.expenseDate)}
        </p>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>
        <p className="whitespace-nowrap font-medium text-[rgb(var(--card-foreground))]">
          {formatDate(expense.createdAt)}
        </p>
      </td>
      <td className={TABLE_BODY_CELL_CLASS}>
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

  if (items.length === 0) {
    return <TableEmptyState message={emptyMessage} />;
  }

  const tableMinWidthClassName = getTableMinWidthClassName(kind);
  const headerConfigs = getHeaderConfigs(kind);
  const stickySpecs = computeStickySpecs(headerConfigs);
  const stickyLeftWidth = getStickyEdgeTotalWidth(headerConfigs, "left") || undefined;

  const handleSortChange = (sortValue: ExpenseSortValue) => {
    const nextHref = buildExpensePageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });

    router.push(nextHref);
  };

  return (
    <DataTableContainer>
      <TableScrollArea className="bg-[rgb(var(--card)/0.98)]" viewportClassName="pb-0" stickyLeftWidth={stickyLeftWidth}>
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
            {kind === "employee"
              ? renderEmployeeRows(items, stickySpecs)
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
    </DataTableContainer>
  );
}
