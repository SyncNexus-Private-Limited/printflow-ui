import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ExpenseCategoriesListControls } from "@/components/dashboard/expense-categories-list-controls";
import { ExpenseCategoriesDataTable } from "@/components/dashboard/expense-categories-data-table";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseExpenseCategoriesPageFilters } from "@/lib/dashboard/expense-categories-page-filters";
import { getExpenseCategoriesPageData } from "@/lib/expense-categories/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type ExpenseCategoriesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExpenseCategoriesPage({ searchParams }: ExpenseCategoriesPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "expense-categories:view")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canEdit = hasPermission(currentUser, "expense-categories:edit");
  const canDeactivate = hasPermission(currentUser, "expense-categories:deactivate");
  const canRestore = hasPermission(currentUser, "expense-categories:restore");
  const canCreate = hasPermission(currentUser, "expense-categories:create");

  try {
    const filters = parseExpenseCategoriesPageFilters(resolvedSearchParams);
    const pageData = await getExpenseCategoriesPageData(filters);
    const branchOptions = [
      {
        label: currentUser.branchName ?? "All branches",
        value: currentUser.branchId ?? "all",
      },
    ];

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Expense Categories"
            branchOptions={branchOptions}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />

          <section className="grid gap-4 md:grid-cols-3">
            <ListStatCard
              label="Branch categories"
              value={formatCompactNumber(pageData.summary.branchCategories)}
              meta="Branch expense scope"
              accent="blue"
            />
            <ListStatCard
              label="Employee categories"
              value={formatCompactNumber(pageData.summary.employeeCategories)}
              meta="Employee expense scope"
              accent="emerald"
            />
            <ListStatCard
              label="Both-scope categories"
              value={formatCompactNumber(pageData.summary.bothScopeCategories)}
              meta="Shared across expense flows"
              accent="violet"
            />
          </section>

          <ExpenseCategoriesListControls
            currentPath="/dashboard/expenses/categories"
            currentFilters={filters}
            canCreate={canCreate}
          />

          <ExpenseCategoriesDataTable
            items={pageData.result.items}
            emptyMessage="No expense categories match the current filters."
            currentPath="/dashboard/expenses/categories"
            currentFilters={filters}
            pagination={pageData.result.pagination}
            canEdit={canEdit}
            canDeactivate={canDeactivate}
            canRestore={canRestore}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load expense categories", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Expense Categories"
            branchOptions={[
              { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load expense categories right now.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
