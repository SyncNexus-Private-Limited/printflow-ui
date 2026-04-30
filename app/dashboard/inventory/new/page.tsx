import { redirect } from "next/navigation";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getInventoryFormPageData } from "@/lib/inventory/queries";

type AddInventoryPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
  }>;
};

function normalizeSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AddInventoryPage({ searchParams }: AddInventoryPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "inventory:create")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedBranchId = normalizeSingleParam(resolvedSearchParams?.branchId);

  try {
    const pageData = await getInventoryFormPageData(currentUser, requestedBranchId);

    if (pageData.branchOptions.length === 0) {
      return (
        <main className="min-h-screen px-4 py-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <DashboardHeader
              title="Add Inventory Item"
              branchOptions={[
                {
                  label: currentUser.branchName ?? "Branch",
                  value: currentUser.branchId ?? "unavailable",
                },
              ]}
              selectedBranchValue={currentUser.branchId ?? "unavailable"}
              branchFilterDisabled
            />
            <SectionCard
              title="No branch available"
              description="A branch must exist before you can add inventory items."
            >
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                Please create a branch first or contact your system administrator.
              </p>
            </SectionCard>
          </div>
        </main>
      );
    }

    const headerBranchOptions = pageData.branchOptions.map((b) => ({
      label: b.name,
      value: b.id,
    }));

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Inventory Item"
            branchOptions={headerBranchOptions}
            selectedBranchValue={
              pageData.selectedBranchId || headerBranchOptions[0]?.value || "unavailable"
            }
            branchFilterDisabled={!pageData.canSelectBranch}
          />

          <SectionCard
            title="New inventory item"
            description={`Add a new item to ${pageData.selectedBranchName} inventory.`}
          >
            <InventoryForm {...pageData} />
          </SectionCard>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load Add Inventory page", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Inventory Item"
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
