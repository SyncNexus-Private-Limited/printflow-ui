import { redirect } from "next/navigation";
import { DashboardPagination } from "@/components/dashboard/dashboard-pagination";
import { DashboardPageToolbar } from "@/components/dashboard/dashboard-page-toolbar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import { parseDashboardPageFilters } from "@/lib/dashboard/page-filters";
import { getDashboardContext, getOrdersPageData } from "@/lib/dashboard/queries";
import { formatCompactNumber, formatCurrency, formatDate, formatDateRangeLabel } from "@/lib/utils/format";

type OrdersPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
    from?: string | string[];
    to?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
  }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const filters = parseDashboardPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const pageData = await getOrdersPageData(context.selectedBranchId, currentFilters);
    const branchOptions = buildBranchFilterOptions(context);
    const dateRangeLabel = formatDateRangeLabel(currentFilters.from, currentFilters.to);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Orders"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <DashboardPageToolbar
            currentPath="/dashboard/orders"
            currentFilters={currentFilters}
            selectedFrom={currentFilters.from}
            selectedTo={currentFilters.to}
            exportAction={{
              label: "Export",
              disabled: true,
              disabledReason: "Order export is coming soon.",
            }}
            moreActions={[
              {
                key: "orders-bulk-actions",
                label: "Bulk actions",
                disabled: true,
                disabledReason: "Bulk actions are coming soon.",
              },
            ]}
            createAction={{
              label: "Create Order",
              disabled: true,
              disabledReason: "Order creation is coming soon.",
            }}
          />

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Orders in range</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(pageData.summary.totalOrders)}
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Pending vs completed in range</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCompactNumber(pageData.summary.pendingOrders)} /{" "}
                {formatCompactNumber(pageData.summary.completedOrders)}
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]">
              <p className="text-sm text-slate-500">Total payable amount in range</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCurrency(pageData.summary.totalPayableAmount)}
              </p>
            </div>
          </section>

          <SectionCard
            title="Orders list"
            description={`Showing orders for ${context.selectedBranchName.toLowerCase()} across ${dateRangeLabel}.`}
          >
            {pageData.result.items.length === 0 ? (
              <p className="text-sm text-slate-600">No orders found for the selected branch and date range.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-3 font-medium">Order code</th>
                        <th className="pb-3 font-medium">Customer</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Payable</th>
                        <th className="pb-3 font-medium">Paid</th>
                        <th className="pb-3 font-medium">Payment status</th>
                        <th className="pb-3 font-medium">Order date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageData.result.items.map((order) => (
                        <tr key={order.id}>
                          <td className="py-3 font-medium text-slate-900">{order.orderCode}</td>
                          <td className="py-3 text-slate-700">{order.customerName}</td>
                          <td className="py-3 capitalize text-slate-700">{order.status}</td>
                          <td className="py-3 text-slate-700">{formatCurrency(order.payableAmount)}</td>
                          <td className="py-3 text-slate-700">{formatCurrency(order.paidAmount)}</td>
                          <td className="py-3 capitalize text-slate-700">{order.paymentStatus}</td>
                          <td className="py-3 text-slate-700">{formatDate(order.orderDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DashboardPagination
                  currentPath="/dashboard/orders"
                  currentFilters={currentFilters}
                  pagination={pageData.result.pagination}
                />
              </div>
            )}
          </SectionCard>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Unable to load orders data", error);

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Orders"
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
