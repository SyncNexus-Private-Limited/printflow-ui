import { redirect } from "next/navigation";
import { BranchesDataTable } from "@/components/dashboard/branches-data-table";
import { BranchesListControls } from "@/components/dashboard/branches-list-controls";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseBranchesPageFilters } from "@/lib/dashboard/branches-page-filters";
import { getBranchesPageData } from "@/lib/branches/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type BranchesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BranchesPage({ searchParams }: BranchesPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "branches:view")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canCreate = hasPermission(currentUser, "branches:create");
  const canEdit = hasPermission(currentUser, "branches:edit");
  const canDeactivate = hasPermission(currentUser, "branches:deactivate");
  const canRestore = hasPermission(currentUser, "branches:restore");

  try {
    const filters = parseBranchesPageFilters(resolvedSearchParams);
    const pageData = await getBranchesPageData(filters);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Branches"
            branchOptions={[
              {
                label: currentUser.branchName ?? "All branches",
                value: currentUser.branchId ?? "all",
              },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ListStatCard
              label="Total Branches"
              value={formatCompactNumber(pageData.summary.totalBranches)}
              meta="Matching branches"
              accent="blue"
            />
            <ListStatCard
              label="Active Branches"
              value={formatCompactNumber(pageData.summary.activeBranches)}
              meta="Available for use"
              accent="emerald"
            />
            <ListStatCard
              label="Inactive Branches"
              value={formatCompactNumber(pageData.summary.inactiveBranches)}
              meta="Disabled branches"
              accent="amber"
            />
            <ListStatCard
              label="New Branches"
              value={formatCompactNumber(pageData.summary.newBranchesInRange)}
              meta="Added in range"
              accent="violet"
            />
          </section>

          <BranchesListControls
            currentPath="/dashboard/branches"
            currentFilters={filters}
            canCreate={canCreate}
          />

          <BranchesDataTable
            items={pageData.result.items}
            emptyMessage="No branches match the current filters."
            currentPath="/dashboard/branches"
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
    console.error("Unable to load branches", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Branches"
            branchOptions={[
              { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load branches right now.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
