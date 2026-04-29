import { redirect, notFound } from "next/navigation";
import { EditUserForm } from "@/components/users/edit-user-form";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getUserById, getUserBranchesForCreation } from "@/lib/users/queries";
import { userRoleLabels } from "@/lib/users/types";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: EditUserPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "users:edit")) {
    redirect("/dashboard?forbidden=1");
  }

  const { id } = await params;

  const [user, branchOptions] = await Promise.all([
    getUserById(id).catch(() => null),
    getUserBranchesForCreation(currentUser).catch(() => []),
  ]);

  if (!user) {
    notFound();
  }

  const headerBranchOptions = branchOptions.map((b) => ({ label: b.name, value: b.id }));
  const headerSelectedBranchValue =
    user.branchId || branchOptions[0]?.id || currentUser.branchId || "unavailable";

  const roleLabelLower = userRoleLabels[user.role]?.toLowerCase() ?? user.role;
  const sectionDescription =
    user.role === "admin"
      ? "Edit this administrator account. Branch assignment is optional for admin accounts."
      : `Edit this ${roleLabelLower} account. Username is read-only — use the Reset password action in the users list to change the password.`;

  const canSelectBranch = hasPermission(currentUser, "branches:select_all");

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <DashboardHeader
          title="Edit User"
          branchOptions={
            headerBranchOptions.length > 0
              ? headerBranchOptions
              : [{ label: currentUser.branchName ?? "Branch", value: headerSelectedBranchValue }]
          }
          selectedBranchValue={headerSelectedBranchValue}
          branchFilterDisabled={!canSelectBranch || headerBranchOptions.length <= 1}
        />

        <SectionCard
          title={`Edit ${userRoleLabels[user.role] ?? user.role} account`}
          description={sectionDescription}
        >
          <EditUserForm
            userId={id}
            user={user}
            branchOptions={branchOptions}
            canSelectBranch={canSelectBranch}
          />
        </SectionCard>
      </div>
    </main>
  );
}
