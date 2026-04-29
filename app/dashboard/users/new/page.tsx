import { redirect } from "next/navigation";
import { UserForm } from "@/components/users/staff-account-form";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import {
  normalizeUserSearchParam,
  coerceUserRole,
  getUserBranchesForCreation,
  getUserFormPageData,
} from "@/lib/users/queries";
import { userRoleLabels } from "@/lib/users/types";

type AddUserPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
    role?: string | string[];
    created?: string | string[];
  }>;
};

export default async function AddUserPage({ searchParams }: AddUserPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "users:create")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedBranchId = normalizeUserSearchParam(resolvedSearchParams?.branchId);
  const selectedRole = coerceUserRole(resolvedSearchParams?.role);
  const showSuccess = normalizeUserSearchParam(resolvedSearchParams?.created) === "1";

  const branchOptions = await getUserBranchesForCreation(currentUser);

  // Non-admin roles require a branch — show empty state if none are available.
  if (selectedRole !== "admin" && branchOptions.length === 0) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add User"
            branchOptions={[
              {
                label: currentUser.branchName ?? "No branch",
                value: currentUser.branchId ?? "unavailable",
              },
            ]}
            selectedBranchValue={currentUser.branchId ?? "unavailable"}
            branchFilterDisabled
          />
          <SectionCard
            title="No branch available"
            description={`A branch must exist before you can create ${userRoleLabels[selectedRole].toLowerCase()} accounts.`}
          >
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Please create a branch first or contact your system administrator.
            </p>
          </SectionCard>
        </div>
      </main>
    );
  }

  // Resolve the canonical branch ID.
  // Admin: branchId is optional — validate if present, strip if invalid.
  // Non-admin: branchId is required — fall back to first available branch.
  let canonicalBranchId: string | null = null;

  if (selectedRole === "admin") {
    if (requestedBranchId) {
      const match = branchOptions.find((b) => b.id === requestedBranchId);
      canonicalBranchId = match?.id ?? null;
    }
  } else {
    const match = branchOptions.find((b) => b.id === requestedBranchId) ?? branchOptions[0];
    canonicalBranchId = match?.id ?? null;
  }

  // Build canonical href and compare against what the URL currently has.
  const canonicalParams = new URLSearchParams();
  if (canonicalBranchId) canonicalParams.set("branchId", canonicalBranchId);
  canonicalParams.set("role", selectedRole);
  if (showSuccess) canonicalParams.set("created", "1");

  const isRoleCanonical = normalizeUserSearchParam(resolvedSearchParams?.role) === selectedRole;
  const isBranchCanonical = requestedBranchId === (canonicalBranchId ?? undefined);

  if (!isRoleCanonical || !isBranchCanonical) {
    redirect(`/dashboard/users/new?${canonicalParams.toString()}`);
  }

  try {
    const pageData = await getUserFormPageData(currentUser, canonicalBranchId ?? "", selectedRole);
    const headerBranchOptions = pageData.branchOptions.map((b) => ({ label: b.name, value: b.id }));

    // For admin with no branch selected, show the first branch in the header selector
    // so the component has a valid selected value (admin can still pick a branch via the header).
    const headerSelectedBranchValue =
      pageData.selectedBranchId || pageData.branchOptions[0]?.id || "unavailable";

    const roleLabelLower = userRoleLabels[selectedRole].toLowerCase();
    const sectionDescription =
      selectedRole === "admin"
        ? "Create an administrator account. Admin accounts can optionally be assigned to a branch."
        : `Create a ${roleLabelLower} account for ${pageData.selectedBranchName}. The account will be active immediately unless you change the status below.`;

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add User"
            branchOptions={headerBranchOptions}
            selectedBranchValue={headerSelectedBranchValue}
            branchFilterDisabled={!pageData.canSelectBranch}
          />

          <SectionCard title={`New ${roleLabelLower} account`} description={sectionDescription}>
            <UserForm {...pageData} showSuccess={showSuccess} />
          </SectionCard>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load Add User page", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add User"
            branchOptions={[
              {
                label: currentUser.branchName ?? "Branch",
                value: currentUser.branchId ?? "unavailable",
              },
            ]}
            selectedBranchValue={currentUser.branchId ?? "unavailable"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load this page right now.">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
