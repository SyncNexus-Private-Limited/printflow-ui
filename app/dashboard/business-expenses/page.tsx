import { redirect } from "next/navigation";
import { ExpenseDataTable } from "@/components/dashboard/expense-data-table";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { parseDashboardPageFilters } from "@/lib/dashboard/page-filters";
import { getBusinessExpensesPageData, getDashboardContext } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatCurrency, formatDateRangeLabel } from "@/lib/utils/format";

type BusinessExpensesPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
    from?: string | string[];
    to?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
  }>;
};

export default async function BusinessExpensesPage({ searchParams }: BusinessExpensesPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const filters = parseDashboardPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const pageData = await getBusinessExpensesPageData(context.selectedBranchId, currentFilters);
    const branchOptions = buildBranchFilterOptions(context);
    const dateRangeLabel = formatDateRangeLabel(currentFilters.from, currentFilters.to);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Business Expenses"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 lg:grid-cols-2">
            <ListStatCard
              label="Spend in range"
              value={formatCurrency(pageData.summary.totalAmountInRange)}
              meta={`Across ${dateRangeLabel}`}
              accent="amber"
            />
            <ListStatCard
              label="Entries in range"
              value={formatCompactNumber(pageData.summary.entryCountInRange)}
              meta={`Tracked for ${context.selectedBranchName}`}
              accent="violet"
            />
          </section>

          <ExpenseDataTable
            kind="business"
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
