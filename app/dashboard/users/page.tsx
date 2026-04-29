import { redirect } from "next/navigation";
import { UserManagementDataTable } from "@/components/dashboard/user-management-data-table";
import { UserManagementListControls } from "@/components/dashboard/user-management-list-controls";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseUsersPageFilters } from "@/lib/dashboard/users-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { getUsersPageData, getUserManagementRoleOptions, getDashboardContext } from "@/lib/dashboard/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type UsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "users:view")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const filters = parseUsersPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const [pageData, roleOptions] = await Promise.all([
      getUsersPageData(context.selectedBranchId, currentFilters),
      getUserManagementRoleOptions(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Users"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 sm:grid-cols-4">
            <ListStatCard
              label="Total users"
              value={formatCompactNumber(pageData.summary.totalUsers)}
              meta="All user accounts"
              accent="blue"
            />
            <ListStatCard
              label="Active"
              value={formatCompactNumber(pageData.summary.activeUsers)}
              meta="Can log in"
              accent="emerald"
            />
            <ListStatCard
              label="Inactive"
              value={formatCompactNumber(pageData.summary.inactiveUsers)}
              meta="Disabled accounts"
              accent="amber"
            />
            <ListStatCard
              label="Locked"
              value={formatCompactNumber(pageData.summary.lockedUsers)}
              meta="Too many failed attempts"
              accent="violet"
            />
          </section>

          <UserManagementListControls
            currentPath="/dashboard/users"
            currentFilters={currentFilters}
            roleOptions={roleOptions}
            branchOptions={branchOptions}
            canSelectBranch={context.canSelectAll}
            selectedBranchName={context.selectedBranchName}
          />

          <UserManagementDataTable
            items={pageData.result.items}
            emptyMessage="No users found for the selected filters."
            currentPath="/dashboard/users"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            showBranch={context.selectedBranchId === null}
            currentUserId={currentUser.userId}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load users data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Users"
            branchOptions={[{ label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" }]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load users data right now.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
