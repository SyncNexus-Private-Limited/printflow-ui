import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { BranchForm } from "@/components/branches/branch-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";

export default async function AddBranchPage() {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "branches:create")) {
    redirect("/dashboard?forbidden=1");
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <DashboardHeader
          title="Add Branch"
          branchOptions={[
            { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
          ]}
          selectedBranchValue={currentUser.branchId ?? "all"}
          branchFilterDisabled
        />

        <SectionCard
          title="New branch"
          description="Create a branch record for operational scoping and reporting."
        >
          <BranchForm redirectTo="/dashboard/branches" />
        </SectionCard>
      </div>
    </main>
  );
}
