import { redirect } from "next/navigation";
import { CustomerDataTable } from "@/components/dashboard/customer-data-table";
import { CustomerListControls } from "@/components/dashboard/customer-list-controls";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseCustomerPageFilters } from "@/lib/dashboard/customer-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { getCustomersPageData, getDashboardContext } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatDateRangeLabel } from "@/lib/utils/format";

type CustomersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const filters = parseCustomerPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const pageData = await getCustomersPageData(context.selectedBranchId, currentFilters);
    const branchOptions = buildBranchFilterOptions(context);
    const dateRangeLabel = formatDateRangeLabel(currentFilters.from, currentFilters.to);
    const dateBasisLabel = currentFilters.dateField === "updated" ? "updated date" : "created date";

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Customers"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 lg:grid-cols-3">
            <ListStatCard
              label="Customers in range"
              value={formatCompactNumber(pageData.summary.totalCustomersInRange)}
              meta={`Added by ${dateBasisLabel} for ${dateRangeLabel}`}
              accent="blue"
            />
            <ListStatCard
              label="Studios in range"
              value={formatCompactNumber(pageData.summary.studioCustomersInRange)}
              meta="Studio accounts matching filters"
              accent="violet"
            />
            <ListStatCard
              label="With orders"
              value={formatCompactNumber(pageData.summary.customersWithOrders)}
              meta="Have at least one order in scope"
              accent="emerald"
            />
          </section>

          <CustomerListControls
            currentPath="/dashboard/customers"
            currentFilters={currentFilters}
            selectedBranchName={context.selectedBranchName}
          />

          <CustomerDataTable
            items={pageData.result.items}
            emptyMessage="No customers found for the selected filters."
            currentPath="/dashboard/customers"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load customers data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Customers"
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
