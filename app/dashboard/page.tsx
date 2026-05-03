import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LowStockPanel } from "@/components/dashboard/low-stock-panel";
import {
  MetricCard,
  type MetricCardAccent,
  type MetricCardMetaItem,
} from "@/components/dashboard/metric-card";
import { RecentExpenses } from "@/components/dashboard/recent-expenses";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions, buildBranchHref } from "@/lib/dashboard/helpers";
import {
  getDashboardContext,
  getDashboardSummary,
  getLowStockItems,
  getRecentExpenses,
  getRecentOrders,
} from "@/lib/dashboard/queries";
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
    const branchOptions = buildBranchFilterOptions(context);
    const branchHref = (path: string) => buildBranchHref(path, context.selectedBranchValue);

    const showSections =
      summary.orders.totalOrders > 0 ||
      summary.customers.totalCustomers > 0 ||
      summary.inventory.totalInventoryItems > 0 ||
      summary.activeUsers.totalActiveStaffAccounts > 0 ||
      summary.employeeExpenses.entryCountThisMonth > 0 ||
      summary.businessExpenses.entryCountThisMonth > 0;

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
        meta: [
          {
            label: "New this month",
            value: formatCompactNumber(summary.customers.newCustomersThisMonth),
          },
        ],
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
          {
            label: "Active now",
            value: formatCompactNumber(summary.activeUsers.currentActiveUsers),
          },
          {
            label: "Staff",
            value: formatCompactNumber(summary.activeUsers.totalActiveStaffAccounts),
          },
        ],
      },
      {
        title: "Employee Expenses",
        value: formatCurrency(summary.employeeExpenses.totalAmountThisMonth),
        href: branchHref("/dashboard/employee-expenses"),
        accent: "rose",
        meta: [
          {
            label: "Entries",
            value: formatCompactNumber(summary.employeeExpenses.entryCountThisMonth),
          },
        ],
      },
      {
        title: "Business Expenses",
        value: formatCurrency(summary.businessExpenses.totalAmountThisMonth),
        href: branchHref("/dashboard/business-expenses"),
        accent: "orange",
        meta: [
          {
            label: "Entries",
            value: formatCompactNumber(summary.businessExpenses.entryCountThisMonth),
          },
        ],
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
            greetingName={currentUser.fullName.split(" ")[0] || currentUser.username}
            greetingBranchName={context.selectedBranchName}
          />

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricCards.map((card) => (
              <MetricCard key={card.title} {...card} />
            ))}
          </section>

          {showSections ? (
            <Suspense fallback={<DashboardActivitySkeleton />}>
              <DashboardActivitySections branchId={context.selectedBranchId} />
            </Suspense>
          ) : (
            <SectionCard title="No data yet" description="No data available for this branch yet.">
              <p className="text-sm text-slate-600">
                Once orders, customers, inventory, expenses, or active sessions exist, they will
                appear here.
              </p>
            </SectionCard>
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
            branchOptions={[
              { label: currentUser.branchName ?? "Branch", value: currentUser.branchId ?? "all" },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
            greetingName={currentUser.fullName.split(" ")[0] || currentUser.username}
            greetingBranchName={currentUser.branchName ?? undefined}
          />
          <SectionCard title="Unable to load dashboard data right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}

function DashboardActivitySkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="h-64 rounded-2xl bg-[rgb(var(--muted)/0.5)]" />
        <div className="h-64 rounded-2xl bg-[rgb(var(--muted)/0.5)]" />
      </div>
      <div className="h-48 rounded-2xl bg-[rgb(var(--muted)/0.5)]" />
    </div>
  );
}

async function DashboardActivitySections({ branchId }: { branchId: string | null }) {
  const [recentOrders, lowStockItems, recentExpenses] = await Promise.all([
    getRecentOrders(branchId),
    getLowStockItems(branchId),
    getRecentExpenses(branchId),
  ]);

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <RecentOrders orders={recentOrders} />
        <LowStockPanel items={lowStockItems} />
      </section>
      <RecentExpenses expenses={recentExpenses} />
    </>
  );
}
