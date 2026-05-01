import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { OrderForm } from "@/components/orders/order-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getAddOrderPageData } from "@/lib/orders/queries";

type AddOrderPageProps = {
  searchParams?: Promise<{ branchId?: string | string[] }>;
};

function normalizeSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AddOrderPage({ searchParams }: AddOrderPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) redirect("/login");
  if (!hasPermission(currentUser, "orders:create")) redirect("/dashboard?forbidden=1");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedBranchId = normalizeSingleParam(resolvedSearchParams?.branchId);

  try {
    const pageData = await getAddOrderPageData(currentUser, requestedBranchId);

    if (pageData.branchOptions.length === 0 || !pageData.selectedBranchId) {
      return (
        <main className="min-h-screen px-4 py-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <DashboardHeader
              title="Add Order"
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
              description="A branch is required before you can create orders."
            >
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                Please contact your system administrator.
              </p>
            </SectionCard>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Order"
            branchOptions={pageData.branchOptions.map((branch) => ({
              label: branch.name,
              value: branch.id,
            }))}
            selectedBranchValue={pageData.selectedBranchId}
            branchFilterDisabled={!pageData.canSelectBranch}
          />
          <OrderForm {...pageData} />
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load Add Order page", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Add Order"
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
