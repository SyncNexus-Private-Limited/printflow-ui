import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions, buildBranchHref } from "@/lib/dashboard/helpers";
import { getCustomerDetails, getDashboardContext, getDashboardSummary } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatDate } from "@/lib/utils/format";

type CustomersPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const context = await getDashboardContext(currentUser, resolvedSearchParams?.branchId);
    const [summary, customers] = await Promise.all([
      getDashboardSummary(context.selectedBranchId),
      getCustomerDetails(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Customers"
            subtitle={`Customer overview / ${context.selectedBranchName}`}
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
            backHref={buildBranchHref("/dashboard", context.selectedBranchValue)}
          />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Total customers</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.customers.totalCustomers)}
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">New customers this month</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.customers.newCustomersThisMonth)}
              </p>
            </div>
          </section>

          <SectionCard title="Customer list" description={`Showing customers for ${context.selectedBranchName.toLowerCase()}.`}>
            {customers.length === 0 ? (
              <p className="text-sm text-slate-600">No customers found for this branch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Phone</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Studio name</th>
                      <th className="pb-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((customer) => (
                      <tr key={customer.id}>
                        <td className="py-3 font-medium text-slate-900">{customer.name}</td>
                        <td className="py-3 text-slate-700">{customer.phone}</td>
                        <td className="py-3 capitalize text-slate-700">{customer.type}</td>
                        <td className="py-3 text-slate-700">{customer.studioName ?? "—"}</td>
                        <td className="py-3 text-slate-700">{formatDate(customer.createdAt)}</td>
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
    console.error("Unable to load customers data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Customers"
            subtitle="Customer overview"
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
