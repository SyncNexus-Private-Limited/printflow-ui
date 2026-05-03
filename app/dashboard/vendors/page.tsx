import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { VendorsDataTable } from "@/components/dashboard/vendors-data-table";
import { VendorsListControls } from "@/components/dashboard/vendors-list-controls";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseVendorsPageFilters } from "@/lib/dashboard/vendors-page-filters";
import { getVendorsPageData } from "@/lib/vendors/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type VendorsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VendorsPage({ searchParams }: VendorsPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "vendors:view")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canCreate = hasPermission(currentUser, "vendors:create");
  const canEdit = hasPermission(currentUser, "vendors:edit");
  const canDeactivate = hasPermission(currentUser, "vendors:deactivate");
  const canRestore = hasPermission(currentUser, "vendors:restore");

  try {
    const filters = parseVendorsPageFilters(resolvedSearchParams);
    const pageData = await getVendorsPageData(filters);
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
            title="Vendors"
            branchOptions={branchOptions}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />

          <section className="grid gap-4 md:grid-cols-3">
            <ListStatCard
              label="Total vendors"
              value={formatCompactNumber(pageData.summary.totalVendors)}
              meta="Supplier records"
              accent="blue"
            />
            <ListStatCard
              label="Active vendors"
              value={formatCompactNumber(pageData.summary.activeVendors)}
              meta="Available for new work"
              accent="emerald"
            />
            <ListStatCard
              label="Inactive vendors"
              value={formatCompactNumber(pageData.summary.inactiveVendors)}
              meta="Retained for history"
              accent="amber"
            />
          </section>

          <VendorsListControls
            currentPath="/dashboard/vendors"
            currentFilters={filters}
            canCreate={canCreate}
          />

          <VendorsDataTable
            items={pageData.result.items}
            emptyMessage="No vendors match the current filters."
            currentPath="/dashboard/vendors"
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
    console.error("Unable to load vendors", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Vendors"
            branchOptions={[
              { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load vendors right now.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
