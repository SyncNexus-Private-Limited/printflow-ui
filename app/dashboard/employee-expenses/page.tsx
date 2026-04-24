import { redirect } from "next/navigation";
import { ExpenseDataTable } from "@/components/dashboard/expense-data-table";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ExpenseListControls } from "@/components/dashboard/expense-list-controls";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseExpensePageFilters } from "@/lib/dashboard/expense-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { getDashboardContext, getEmployeeExpensesPageData } from "@/lib/dashboard/queries";
import { getExpenseCategories, getExpenseEmployees } from "@/lib/expenses/queries";
import { formatCompactNumber, formatCurrency, formatDateRangeLabel } from "@/lib/utils/format";

type EmployeeExpensesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmployeeExpensesPage({ searchParams }: EmployeeExpensesPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const filters = parseExpensePageFilters(resolvedSearchParams, "employee");
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const [pageData, categoryOptions, employeeOptions] = await Promise.all([
      getEmployeeExpensesPageData(context.selectedBranchId, currentFilters),
      getExpenseCategories("employee"),
      getExpenseEmployees(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);
    const dateRangeLabel = formatDateRangeLabel(currentFilters.from, currentFilters.to);
    const dateBasisLabel = currentFilters.dateField === "logged" ? "logged dates" : "expense dates";

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Employee Expenses"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 lg:grid-cols-2">
            <ListStatCard
              label="Spend in range"
              value={formatCurrency(pageData.summary.totalAmountInRange)}
              meta={`Across ${dateBasisLabel} for ${dateRangeLabel}`}
              accent="emerald"
            />
            <ListStatCard
              label="Entries in range"
              value={formatCompactNumber(pageData.summary.entryCountInRange)}
              meta={`Tracked for ${context.selectedBranchName}`}
              accent="blue"
            />
          </section>

          <ExpenseListControls
            kind="employee"
            currentPath="/dashboard/employee-expenses"
            currentFilters={currentFilters}
            categoryOptions={categoryOptions}
            employeeOptions={employeeOptions}
            selectedBranchName={context.selectedBranchName}
          />

          <ExpenseDataTable
            kind="employee"
            emptyMessage="No employee expenses were recorded for the selected branch and date range."
            items={pageData.result.items}
            currentPath="/dashboard/employee-expenses"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load employee expenses data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Employee Expenses"
            branchOptions={[{ label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" }]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load dashboard data right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
