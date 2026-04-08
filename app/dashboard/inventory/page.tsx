import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions, buildBranchHref } from "@/lib/dashboard/helpers";
import { getDashboardContext, getDashboardSummary, getInventoryDetails } from "@/lib/dashboard/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type InventoryPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
  }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const context = await getDashboardContext(currentUser, resolvedSearchParams?.branchId);
    const [summary, inventory] = await Promise.all([
      getDashboardSummary(context.selectedBranchId),
      getInventoryDetails(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Inventory"
            subtitle={`Inventory health • ${context.selectedBranchName}`}
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
            backHref={buildBranchHref("/dashboard", context.selectedBranchValue)}
          />

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Inventory items</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.inventory.totalInventoryItems)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Low stock items</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.inventory.lowStockItems)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Total stock quantity</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.inventory.totalStockQuantity)}
              </p>
            </div>
          </section>

          <SectionCard title="Inventory list" description={`Showing inventory for ${context.selectedBranchName.toLowerCase()}.`}>
            {inventory.length === 0 ? (
              <p className="text-sm text-slate-600">No inventory found for this branch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">SKU</th>
                      <th className="pb-3 font-medium">Quantity</th>
                      <th className="pb-3 font-medium">Unit</th>
                      <th className="pb-3 font-medium">Branch</th>
                      <th className="pb-3 font-medium">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventory.map((item) => (
                      <tr key={item.id} className={item.quantity <= 10 ? "bg-amber-50" : undefined}>
                        <td className="py-3 font-medium text-slate-900">{item.name}</td>
                        <td className="py-3 text-slate-700">{item.sku}</td>
                        <td className="py-3 text-slate-700">{formatCompactNumber(item.quantity)}</td>
                        <td className="py-3 text-slate-700 capitalize">{item.unit}</td>
                        <td className="py-3 text-slate-700">{item.branchName}</td>
                        <td className="py-3 text-slate-700">{item.isActive ? "Yes" : "No"}</td>
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
    console.error("Unable to load inventory data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Inventory"
            subtitle="Inventory health"
            branchOptions={[{ label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" }]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
            backHref={buildBranchHref("/dashboard", currentUser.branchId ?? "all")}
          />
          <SectionCard title="Unable to load dashboard data right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}

