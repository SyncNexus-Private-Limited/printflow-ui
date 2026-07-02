import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { OffersDataTable } from "@/components/dashboard/offers-data-table";
import { OffersListControls } from "@/components/dashboard/offers-list-controls";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getCustomerTypeOptions } from "@/lib/customers/queries";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { parseOffersPageFilters } from "@/lib/dashboard/offers-page-filters";
import { getDashboardContext } from "@/lib/dashboard/queries";
import { getOffersPageData } from "@/lib/offers/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type OffersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OffersPage({ searchParams }: OffersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "offers:view")) redirect("/dashboard?forbidden=1");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canCreate = hasPermission(currentUser, "offers:create");
  const canEdit = hasPermission(currentUser, "offers:edit");
  const canDeactivate = hasPermission(currentUser, "offers:deactivate");
  const canRestore = hasPermission(currentUser, "offers:restore");

  try {
    const filters = parseOffersPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = { ...filters, branchId: context.selectedBranchValue };
    const pageData = await getOffersPageData(context.selectedBranchId, currentFilters);
    const customerTypeOptions = await getCustomerTypeOptions();
    const branchOptions = buildBranchFilterOptions(context);
    const formBranchOptions = context.branches;
    const showBranchColumn = context.selectedBranchId === null;

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Offers"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ListStatCard
              label="Total offers"
              value={formatCompactNumber(pageData.summary.totalOffers)}
              meta="Promotion rules"
              accent="blue"
            />
            <ListStatCard
              label="Active offers"
              value={formatCompactNumber(pageData.summary.activeOffers)}
              meta="Enabled rules"
              accent="emerald"
            />
            <ListStatCard
              label="Current offers"
              value={formatCompactNumber(pageData.summary.currentOffers)}
              meta="Valid today"
              accent="violet"
            />
            <ListStatCard
              label="Upcoming offers"
              value={formatCompactNumber(pageData.summary.upcomingOffers)}
              meta="Starts later"
              accent="amber"
            />
          </section>

          <OffersListControls
            currentPath="/dashboard/offers"
            currentFilters={currentFilters}
            selectedBranchName={context.selectedBranchName}
            canCreate={canCreate}
          />

          <OffersDataTable
            items={pageData.result.items}
            emptyMessage="No offers match the current filters."
            currentPath="/dashboard/offers"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            branchOptions={formBranchOptions}
            showBranchColumn={showBranchColumn}
            canSelectBranch={context.canSelectAll}
            canEdit={canEdit}
            canDeactivate={canDeactivate}
            canRestore={canRestore}
            customerTypeOptions={customerTypeOptions}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load offers", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Offers"
            branchOptions={[
              { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load offers right now.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
