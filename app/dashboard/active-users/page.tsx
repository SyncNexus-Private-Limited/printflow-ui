import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { getActiveUserDetails, getDashboardContext, getDashboardSummary } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatDateTime } from "@/lib/utils/format";

type ActiveUsersPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
  }>;
};

export default async function ActiveUsersPage({ searchParams }: ActiveUsersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const context = await getDashboardContext(currentUser, resolvedSearchParams?.branchId);
    const [summary, activeUsers] = await Promise.all([
      getDashboardSummary(context.selectedBranchId),
      getActiveUserDetails(context.selectedBranchId),
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

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Users active right now</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.activeUsers.currentActiveUsers)}
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Total active staff accounts</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.activeUsers.totalActiveStaffAccounts)}
              </p>
            </div>
          </section>

          <SectionCard title="Active sessions" description="Only sessions active in the last 15 minutes are shown.">
            {activeUsers.length === 0 ? (
              <p className="text-sm text-slate-600">No active users found right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-3 font-medium">Full name</th>
                      <th className="pb-3 font-medium">Username</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium">Branch</th>
                      <th className="pb-3 font-medium">Last seen</th>
                      <th className="pb-3 font-medium">Session created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeUsers.map((activeUser) => (
                      <tr key={activeUser.sessionId}>
                        <td className="py-3 font-medium text-slate-900">{activeUser.fullName}</td>
                        <td className="py-3 text-slate-700">{activeUser.username}</td>
                        <td className="py-3 capitalize text-slate-700">{activeUser.role}</td>
                        <td className="py-3 text-slate-700">{activeUser.branchName ?? "—"}</td>
                        <td className="py-3 text-slate-700">{formatDateTime(activeUser.lastSeenAt)}</td>
                        <td className="py-3 text-slate-700">{formatDateTime(activeUser.sessionCreatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
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
