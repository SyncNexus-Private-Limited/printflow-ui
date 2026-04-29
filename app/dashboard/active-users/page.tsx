import { redirect } from "next/navigation";
import { ActiveUsersDataTable } from "@/components/dashboard/active-users-data-table";
import { ActiveUsersListControls } from "@/components/dashboard/active-users-list-controls";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseActiveUserPageFilters } from "@/lib/dashboard/active-users-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import {
  getActiveUserRoleOptions,
  getActiveUsersPageData,
  getDashboardContext,
} from "@/lib/dashboard/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type ActiveUsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ActiveUsersPage({ searchParams }: ActiveUsersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "users:view")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const filters = parseActiveUserPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const [pageData, roleOptions] = await Promise.all([
      getActiveUsersPageData(context.selectedBranchId, currentFilters),
      getActiveUserRoleOptions(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Active Users"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 sm:grid-cols-3">
            <ListStatCard
              label="Active now"
              value={formatCompactNumber(pageData.summary.totalActiveUsers)}
              meta="Based on recent session activity"
              accent="blue"
            />
            <ListStatCard
              label="Admin users"
              value={formatCompactNumber(pageData.summary.adminActiveUsers)}
              meta="Currently active admins"
              accent="violet"
            />
            <ListStatCard
              label="Other active users"
              value={formatCompactNumber(pageData.summary.staffActiveUsers)}
              meta="Currently active non-admin"
              accent="emerald"
            />
          </section>

          <ActiveUsersListControls
            currentPath="/dashboard/active-users"
            currentFilters={currentFilters}
            roleOptions={roleOptions}
            branchOptions={branchOptions}
            canSelectBranch={context.canSelectAll}
            selectedBranchName={context.selectedBranchName}
          />

          <ActiveUsersDataTable
            items={pageData.result.items}
            emptyMessage="No active sessions found for the selected branch."
            currentPath="/dashboard/active-users"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            showBranch={context.selectedBranchId === null}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load active users data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Active Users"
            branchOptions={[
              { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load active users data right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
