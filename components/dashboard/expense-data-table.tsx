import { DataPill, getExpenseCategoryTone, getExpensePaymentModeTone } from "@/components/dashboard/data-pill";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { TableScrollArea } from "@/components/dashboard/table-scroll-area";
import { type ExpensePageFilterState } from "@/lib/dashboard/expense-page-filters";
import { getPaymentModeLabel } from "@/lib/expenses/types";
import type {
  BusinessExpenseDetailRow,
  DashboardPaginationState,
  EmployeeExpenseDetailRow,
} from "@/lib/dashboard/types";
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

const tableHeaderCellClassName = suggestCanonicalClasses(
  "whitespace-nowrap border-b border-[rgb(var(--border)/0.65)] bg-[rgb(var(--muted)/0.72)] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground)/0.9)] first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
);

const tableBodyCellClassName = suggestCanonicalClasses(
  "px-4 py-4 align-top first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
);

function getTableHeaderCellClassName(align: "left" | "right" = "left") {
  return cn(tableHeaderCellClassName, align === "right" && "text-right");
}

function getTableBodyCellClassName(align: "left" | "right" = "left") {
  return cn(tableBodyCellClassName, align === "right" && "text-right");
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
          <p className="break-words font-semibold leading-6 text-[rgb(var(--card-foreground))]">{expense.userName}</p>
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
          <p className="break-words text-sm leading-6 text-[rgb(var(--foreground)/0.68)]">
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
          <p className="break-words text-sm leading-6 text-[rgb(var(--foreground)/0.68)]">
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
        <p className="max-w-44 break-words font-medium leading-6 text-[rgb(var(--foreground)/0.76)]">
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
  const tableMinWidthClassName = kind === "employee" ? "min-w-[76rem]" : "min-w-[82rem]";

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
                {kind === "employee" ? (
                  <tr>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Employee
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Expense
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Category
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName("right")}>
                      Amount
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Payment
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Notes
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Expense date
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Logged date
                    </th>
                  </tr>
                ) : (
                  <tr>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Category
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Expense
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName("right")}>
                      Amount
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Payment
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Notes
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Expense date
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Logged date
                    </th>
                    <th scope="col" className={getTableHeaderCellClassName()}>
                      Branch
                    </th>
                  </tr>
                )}
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
