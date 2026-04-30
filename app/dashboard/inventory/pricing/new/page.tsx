import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { InventoryPricingForm } from "@/components/inventory-pricing/inventory-pricing-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { getDashboardContext, getInventoryPricingInventoryOptions } from "@/lib/dashboard/queries";

type AddInventoryPricingPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
    inventoryId?: string | string[];
  }>;
};

function normalizeSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AddInventoryPricingPage({
  searchParams,
}: AddInventoryPricingPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  if (!hasPermission(currentUser, "inventory:create")) {
    redirect("/dashboard?forbidden=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedBranchId = normalizeSingleParam(resolvedSearchParams?.branchId);
  const requestedInventoryId = normalizeSingleParam(resolvedSearchParams?.inventoryId);

  try {
    const context = await getDashboardContext(currentUser, requestedBranchId);
    const branchOptions = buildBranchFilterOptions(context);
    const inventoryOptions = await getInventoryPricingInventoryOptions(context.selectedBranchId);
    const redirectTo =
      context.selectedBranchId === null
        ? "/dashboard/inventory/pricing"
        : `/dashboard/inventory/pricing?branchId=${encodeURIComponent(context.selectedBranchId)}`;

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Pricing"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <SectionCard
            title="New inventory pricing"
            description={`Create a selling-rate window for ${context.selectedBranchName}.`}
          >
            {inventoryOptions.length === 0 ? (
              <div className="rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.42)] px-4 py-3 text-sm text-[rgb(var(--muted-foreground))]">
                No active inventory items are available for this branch context.
              </div>
            ) : null}
            <InventoryPricingForm
              inventoryOptions={inventoryOptions}
              selectedBranchName={context.selectedBranchName}
              redirectTo={redirectTo}
              initialInventoryId={requestedInventoryId}
            />
          </SectionCard>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load Add Pricing page", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Pricing"
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
