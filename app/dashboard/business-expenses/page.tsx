import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions, buildBranchHref } from "@/lib/dashboard/helpers";
import { getBusinessExpenseDetails, getDashboardContext, getDashboardSummary } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatCurrency, formatDateTime } from "@/lib/utils/format";

type BusinessExpensesPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
  }>;
};

export default async function BusinessExpensesPage({ searchParams }: BusinessExpensesPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const context = await getDashboardContext(currentUser, resolvedSearchParams?.branchId);
    const [summary, expenses] = await Promise.all([
      getDashboardSummary(context.selectedBranchId),
      getBusinessExpenseDetails(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Business Expenses"
            subtitle={`Branch expense overview / ${context.selectedBranchName}`}
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
            backHref={buildBranchHref("/dashboard", context.selectedBranchValue)}
          />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Total this month</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCurrency(summary.businessExpenses.totalAmountThisMonth)}
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Entries this month</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.businessExpenses.entryCountThisMonth)}
              </p>
            </div>
          </section>

          <SectionCard title="Business expenses list" description={`Showing business expenses for ${context.selectedBranchName.toLowerCase()}.`}>
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-600">No business expenses found for this branch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Payment mode</th>
                      <th className="pb-3 font-medium">Remarks</th>
                      <th className="pb-3 font-medium">Created</th>
                      <th className="pb-3 font-medium">Branch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="py-3 font-medium text-slate-900">{expense.category}</td>
                        <td className="py-3 text-slate-700">{expense.name ?? "—"}</td>
                        <td className="py-3 text-slate-700">{formatCurrency(expense.amount)}</td>
                        <td className="py-3 capitalize text-slate-700">{expense.paymentMode}</td>
                        <td className="py-3 text-slate-700">{expense.remarks ?? "—"}</td>
                        <td className="py-3 text-slate-700">{formatDateTime(expense.createdAt)}</td>
                        <td className="py-3 text-slate-700">{expense.branchName ?? "—"}</td>
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
    console.error("Unable to load business expenses data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Business Expenses"
            subtitle="Branch expense overview"
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
