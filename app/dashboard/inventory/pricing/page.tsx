import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { InventoryPricingTableWithActions } from "@/components/inventory-pricing/inventory-pricing-table-with-actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getCustomerTypeOptions } from "@/lib/customers/queries";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { parseInventoryPricingPageFilters } from "@/lib/dashboard/inventory-pricing-page-filters";
import { getDashboardContext, getInventoryPricingPageData } from "@/lib/dashboard/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type InventoryPricingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryPricingPage({ searchParams }: InventoryPricingPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "inventory:view")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canCreate = hasPermission(currentUser, "inventory:create");
  const canEdit = hasPermission(currentUser, "inventory:edit");

  try {
    const filters = parseInventoryPricingPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const pageData = await getInventoryPricingPageData(context.selectedBranchId, currentFilters);
    const customerTypeOptions = await getCustomerTypeOptions();
    const branchOptions = buildBranchFilterOptions(context);
    const showBranchColumn = context.selectedBranchId === null;

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Inventory Pricing"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ListStatCard
              label="Current"
              value={formatCompactNumber(pageData.summary.currentPricesInRange)}
              meta="Active today"
              accent="emerald"
            />
            <ListStatCard
              label="Upcoming"
              value={formatCompactNumber(pageData.summary.upcomingPricesInRange)}
              meta="Starts later"
              accent="violet"
            />
            <ListStatCard
              label="Expiring soon"
              value={formatCompactNumber(pageData.summary.expiringSoonPricesInRange)}
              meta="Ends in 7 days"
              accent="amber"
            />
            <ListStatCard
              label="Expired"
              value={formatCompactNumber(pageData.summary.expiredPricesInRange)}
              meta="No longer active"
              accent="blue"
            />
          </section>

          <InventoryPricingTableWithActions
            rows={pageData.result.items}
            inventoryOptions={pageData.inventoryOptions}
            currentPath="/dashboard/inventory/pricing"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            showBranchColumn={showBranchColumn}
            canCreate={canCreate}
            canEdit={canEdit}
            selectedBranchName={context.selectedBranchName}
            customerTypeOptions={customerTypeOptions}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load inventory pricing data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Inventory Pricing"
            branchOptions={[
              {
                label: currentUser.branchName ?? "Branch",
                value: currentUser.branchId ?? "all",
              },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load inventory pricing right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
