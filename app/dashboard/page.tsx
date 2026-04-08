import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LowStockPanel } from "@/components/dashboard/low-stock-panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RecentExpenses } from "@/components/dashboard/recent-expenses";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions, buildBranchHref, hasDashboardData } from "@/lib/dashboard/helpers";
import { getDashboardContext, getDashboardSummary, getLowStockItems, getRecentExpenses, getRecentOrders } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatCurrency } from "@/lib/utils/format";

type DashboardPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const context = await getDashboardContext(currentUser, resolvedSearchParams?.branchId);
    const [summary, recentOrders, lowStockItems, recentExpenses] = await Promise.all([
      getDashboardSummary(context.selectedBranchId),
      getRecentOrders(context.selectedBranchId),
      getLowStockItems(context.selectedBranchId),
      getRecentExpenses(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);
    const branchHref = (path: string) => buildBranchHref(path, context.selectedBranchValue);
    const showData = hasDashboardData(summary, recentOrders, lowStockItems, recentExpenses);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Dashboard"
            subtitle={`Business overview • ${context.selectedBranchName}`}
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Orders"
              value={formatCompactNumber(summary.orders.totalOrders)}
              helperText="Track order volume and payment value at a glance."
              href={branchHref("/dashboard/orders")}
              accent="blue"
              stats={[
                { label: "Pending", value: formatCompactNumber(summary.orders.pendingOrders) },
                { label: "Completed", value: formatCompactNumber(summary.orders.completedOrders) },
                { label: "Payable", value: formatCurrency(summary.orders.totalPayableAmount) },
              ]}
            />
            <MetricCard
              title="Customers"
              value={formatCompactNumber(summary.customers.totalCustomers)}
              helperText="See customer growth for the selected branch scope."
              href={branchHref("/dashboard/customers")}
              accent="emerald"
              stats={[
                { label: "New this month", value: formatCompactNumber(summary.customers.newCustomersThisMonth) },
                { label: "Scope", value: context.selectedBranchName },
              ]}
            />
            <MetricCard
              title="Inventory"
              value={formatCompactNumber(summary.inventory.totalInventoryItems)}
              helperText="Monitor total items, low stock, and quantity levels."
              href={branchHref("/dashboard/inventory")}
              accent="amber"
              stats={[
                { label: "Low stock", value: formatCompactNumber(summary.inventory.lowStockItems) },
                { label: "Stock qty", value: formatCompactNumber(summary.inventory.totalStockQuantity) },
              ]}
            />
            <MetricCard
              title="Active Logged In Users"
              value={formatCompactNumber(summary.activeUsers.currentActiveUsers)}
              helperText="Based on live sessions active in the last 15 minutes."
              href={branchHref("/dashboard/active-users")}
              accent="violet"
              stats={[
                { label: "Active now", value: formatCompactNumber(summary.activeUsers.currentActiveUsers) },
                { label: "Active staff", value: formatCompactNumber(summary.activeUsers.totalActiveStaffAccounts) },
              ]}
            />
            <MetricCard
              title="Employee Expenses"
              value={formatCurrency(summary.employeeExpenses.totalAmountThisMonth)}
              helperText="Current-month employee expense spend and activity."
              href={branchHref("/dashboard/employee-expenses")}
              accent="rose"
              stats={[
                { label: "Entries", value: formatCompactNumber(summary.employeeExpenses.entryCountThisMonth) },
                { label: "This month", value: context.selectedBranchName },
              ]}
            />
            <MetricCard
              title="Business Expenses"
              value={formatCurrency(summary.businessExpenses.totalAmountThisMonth)}
              helperText="Current-month branch expense spend and activity."
              href={branchHref("/dashboard/business-expenses")}
              accent="orange"
              stats={[
                { label: "Entries", value: formatCompactNumber(summary.businessExpenses.entryCountThisMonth) },
                { label: "This month", value: context.selectedBranchName },
              ]}
            />
          </section>

          {!showData ? (
            <SectionCard title="No data yet" description="No data available for this branch yet.">
              <p className="text-sm text-slate-600">
                Once orders, customers, inventory, expenses, or active sessions exist, they will appear here.
              </p>
            </SectionCard>
          ) : (
            <>
              <section className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
                <RecentOrders orders={recentOrders} />
                <LowStockPanel items={lowStockItems} />
              </section>
              <RecentExpenses expenses={recentExpenses} />
            </>
          )}
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load dashboard data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Dashboard"
            subtitle="Business overview"
            branchOptions={[{ label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" }]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load dashboard data right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
