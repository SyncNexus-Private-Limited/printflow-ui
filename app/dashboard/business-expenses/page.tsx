import { redirect } from "next/navigation";
import { BusinessExpenseTableWithActions } from "@/components/dashboard/business-expense-table-with-actions";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ExpenseListControls } from "@/components/dashboard/expense-list-controls";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseExpensePageFilters } from "@/lib/dashboard/expense-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { getBusinessExpensesPageData, getDashboardContext } from "@/lib/dashboard/queries";
import { getExpenseCategories, getExpenseVendors } from "@/lib/expenses/queries";
import { formatCompactNumber, formatCurrency, formatDateRangeLabel } from "@/lib/utils/format";

type BusinessExpensesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BusinessExpensesPage({ searchParams }: BusinessExpensesPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canCreateExpense = hasPermission(currentUser, "expenses:create");

  try {
    const filters = parseExpensePageFilters(resolvedSearchParams, "business");
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const [pageData, categoryOptions, vendorOptions] = await Promise.all([
      getBusinessExpensesPageData(context.selectedBranchId, currentFilters),
      getExpenseCategories("business"),
      getExpenseVendors(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);
    const dateRangeLabel = formatDateRangeLabel(currentFilters.from, currentFilters.to);
    const dateBasisLabel = currentFilters.dateField === "logged" ? "logged dates" : "expense dates";

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Business Expenses"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 md:grid-cols-2">
            <ListStatCard
              label="Spend in range"
              value={formatCurrency(pageData.summary.totalAmountInRange)}
              meta={`Across ${dateBasisLabel} for ${dateRangeLabel}`}
              accent="amber"
            />
            <ListStatCard
              label="Entries in range"
              value={formatCompactNumber(pageData.summary.entryCountInRange)}
              meta={`Tracked for ${context.selectedBranchName}`}
              accent="violet"
            />
          </section>

          <ExpenseListControls
            kind="business"
            currentPath="/dashboard/business-expenses"
            currentFilters={currentFilters}
            categoryOptions={categoryOptions}
            vendorOptions={vendorOptions}
            selectedBranchName={context.selectedBranchName}
            canCreate={canCreateExpense}
          />

          <BusinessExpenseTableWithActions
            emptyMessage="No business expenses were recorded for the selected branch and date range."
            items={pageData.result.items}
            currentPath="/dashboard/business-expenses"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            fallbackBranchName={context.selectedBranchName}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load business expenses data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Business Expenses"
            branchOptions={[
              { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
            ]}
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
