import { redirect } from "next/navigation";
import { CustomerDataTable } from "@/components/dashboard/customer-data-table";
import { CustomerListControls } from "@/components/dashboard/customer-list-controls";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getCustomerTypeOptions } from "@/lib/customers/queries";
import { parseCustomerPageFilters } from "@/lib/dashboard/customer-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { getCustomersPageData, getDashboardContext } from "@/lib/dashboard/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type CustomersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "customers:view")) {
    redirect("/dashboard?forbidden=1");
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
    const customerTypeOptions = await getCustomerTypeOptions();
    const branchOptions = buildBranchFilterOptions(context);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Customers"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ListStatCard
              label="Active Customers"
              value={formatCompactNumber(pageData.summary.activeCustomers)}
              meta="Currently active"
              accent="emerald"
            />
            <ListStatCard
              label="New Customers"
              value={formatCompactNumber(pageData.summary.newCustomersInRange)}
              meta="Added in range"
              accent="blue"
            />
            <ListStatCard
              label="Studio Customers"
              value={formatCompactNumber(pageData.summary.studioCustomers)}
              meta="Studio accounts"
              accent="violet"
            />
            <ListStatCard
              label="Outstanding"
              value={formatCompactNumber(pageData.summary.outstandingCustomers)}
              meta="Payment pending"
              accent="amber"
            />
          </section>

          <CustomerListControls
            currentPath="/dashboard/customers"
            currentFilters={currentFilters}
            selectedBranchName={context.selectedBranchName}
            canCreate={hasPermission(currentUser, "customers:create")}
            customerTypeOptions={customerTypeOptions}
          />

          <CustomerDataTable
            items={pageData.result.items}
            emptyMessage="No customers found for the selected filters."
            currentPath="/dashboard/customers"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            canEdit={hasPermission(currentUser, "customers:edit")}
            canDeactivate={hasPermission(currentUser, "customers:deactivate")}
            canRestore={hasPermission(currentUser, "customers:restore")}
            customerTypeOptions={customerTypeOptions}
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
