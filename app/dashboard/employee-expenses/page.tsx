import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions, buildBranchHref } from "@/lib/dashboard/helpers";
import { getDashboardContext, getDashboardSummary, getEmployeeExpenseDetails } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatCurrency, formatDateTime } from "@/lib/utils/format";

type EmployeeExpensesPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
  }>;
};

export default async function EmployeeExpensesPage({ searchParams }: EmployeeExpensesPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const context = await getDashboardContext(currentUser, resolvedSearchParams?.branchId);
    const [summary, expenses] = await Promise.all([
      getDashboardSummary(context.selectedBranchId),
      getEmployeeExpenseDetails(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Employee Expenses"
            subtitle={`Employee spend overview • ${context.selectedBranchName}`}
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
            backHref={buildBranchHref("/dashboard", context.selectedBranchValue)}
          />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Total this month</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCurrency(summary.employeeExpenses.totalAmountThisMonth)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Entries this month</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(summary.employeeExpenses.entryCountThisMonth)}
              </p>
            </div>
          </section>

          <SectionCard title="Employee expenses list" description={`Showing employee expenses for ${context.selectedBranchName.toLowerCase()}.`}>
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-600">No employee expenses found for this branch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Payment mode</th>
                      <th className="pb-3 font-medium">Remarks</th>
                      <th className="pb-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="py-3 font-medium text-slate-900">{expense.userName}</td>
                        <td className="py-3 text-slate-700">{expense.category}</td>
                        <td className="py-3 text-slate-700">{formatCurrency(expense.amount)}</td>
                        <td className="py-3 capitalize text-slate-700">{expense.paymentMode}</td>
                        <td className="py-3 text-slate-700">{expense.remarks ?? "—"}</td>
                        <td className="py-3 text-slate-700">{formatDateTime(expense.createdAt)}</td>
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
    console.error("Unable to load employee expenses data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Employee Expenses"
            subtitle="Employee spend overview"
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

