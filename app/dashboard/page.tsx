import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LowStockPanel } from "@/components/dashboard/low-stock-panel";
import { MetricCard, type MetricCardAccent, type MetricCardMetaItem } from "@/components/dashboard/metric-card";
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

type DashboardMetricCardConfig = {
  title: string;
  value: string;
  href: string;
  accent: MetricCardAccent;
  meta: MetricCardMetaItem[];
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const context = await getDashboardContext(currentUser, resolvedSearchParams?.branchId);
    const summary = await getDashboardSummary(context.selectedBranchId);
    const [recentOrders, lowStockItems, recentExpenses] = await Promise.all([
      getRecentOrders(context.selectedBranchId),
      getLowStockItems(context.selectedBranchId),
      getRecentExpenses(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);
    const branchHref = (path: string) => buildBranchHref(path, context.selectedBranchValue);
    const showData = hasDashboardData(summary, recentOrders, lowStockItems, recentExpenses);
    const metricCards: DashboardMetricCardConfig[] = [
      {
        title: "Orders",
        value: formatCompactNumber(summary.orders.totalOrders),
        href: branchHref("/dashboard/orders"),
        accent: "blue",
        meta: [
          { label: "Pending", value: formatCompactNumber(summary.orders.pendingOrders) },
          { label: "Completed", value: formatCompactNumber(summary.orders.completedOrders) },
        ],
      },
      {
        title: "Customers",
        value: formatCompactNumber(summary.customers.totalCustomers),
        href: branchHref("/dashboard/customers"),
        accent: "emerald",
        meta: [{ label: "New this month", value: formatCompactNumber(summary.customers.newCustomersThisMonth) }],
      },
      {
        title: "Inventory",
        value: formatCompactNumber(summary.inventory.totalInventoryItems),
        href: branchHref("/dashboard/inventory"),
        accent: "amber",
        meta: [
          { label: "Low stock", value: formatCompactNumber(summary.inventory.lowStockItems) },
          { label: "Qty", value: formatCompactNumber(summary.inventory.totalStockQuantity) },
        ],
      },
      {
        title: "Active Users",
        value: formatCompactNumber(summary.activeUsers.currentActiveUsers),
        href: branchHref("/dashboard/active-users"),
        accent: "violet",
        meta: [
          { label: "Active now", value: formatCompactNumber(summary.activeUsers.currentActiveUsers) },
          { label: "Staff", value: formatCompactNumber(summary.activeUsers.totalActiveStaffAccounts) },
        ],
      },
      {
        title: "Employee Expenses",
        value: formatCurrency(summary.employeeExpenses.totalAmountThisMonth),
        href: branchHref("/dashboard/employee-expenses"),
        accent: "rose",
        meta: [{ label: "Entries", value: formatCompactNumber(summary.employeeExpenses.entryCountThisMonth) }],
      },
      {
        title: "Business Expenses",
        value: formatCurrency(summary.businessExpenses.totalAmountThisMonth),
        href: branchHref("/dashboard/business-expenses"),
        accent: "orange",
        meta: [{ label: "Entries", value: formatCompactNumber(summary.businessExpenses.entryCountThisMonth) }],
      },
    ];

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Dashboard"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metricCards.map((card) => (
              <MetricCard key={card.title} {...card} />
            ))}
          </section>

          {!showData ? (
            <SectionCard title="No data yet" description="No data available for this branch yet.">
              <p className="text-sm text-slate-600">
                Once orders, customers, inventory, expenses, or active sessions exist, they will appear here.
              </p>
            </SectionCard>
          ) : (
            <>
              <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
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
