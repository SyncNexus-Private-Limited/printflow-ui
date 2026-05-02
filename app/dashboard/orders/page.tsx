import { redirect } from "next/navigation";
import { OrderDataTable } from "@/components/dashboard/order-data-table";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrderListControls } from "@/components/dashboard/order-list-controls";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseOrderPageFilters } from "@/lib/dashboard/order-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import {
  getDashboardContext,
  getOrderFilterOptions,
  getOrdersPageData,
} from "@/lib/dashboard/queries";
import { formatCompactNumber, formatCurrency, formatDateRangeLabel } from "@/lib/utils/format";

type OrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canCreate = hasPermission(currentUser, "orders:create");
  const canView = hasPermission(currentUser, "orders:view");
  const canEdit = hasPermission(currentUser, "orders:edit");
  const canAddPayment = hasPermission(currentUser, "orders:add_payment");
  const canUpdateStatus = hasPermission(currentUser, "orders:update_status");
  const canCancel = hasPermission(currentUser, "orders:cancel");
  const canEditVendor = hasPermission(currentUser, "orders:edit_vendor");
  const canAddVendorPayment = hasPermission(currentUser, "orders:add_vendor_payment");

  try {
    const filters = parseOrderPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const [pageData, filterOptions] = await Promise.all([
      getOrdersPageData(context.selectedBranchId, currentFilters),
      getOrderFilterOptions(context.selectedBranchId),
    ]);
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

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ListStatCard
              label="Total orders"
              value={formatCompactNumber(pageData.summary.totalOrders)}
              meta={`For ${context.selectedBranchName}`}
              accent="blue"
            />
            <ListStatCard
              label="Pending orders"
              value={formatCompactNumber(pageData.summary.pendingOrders)}
              meta="Awaiting completion"
              accent="amber"
            />
            <ListStatCard
              label="Total payable"
              value={formatCurrency(pageData.summary.totalPayableAmount)}
              meta={`Across ${dateRangeLabel}`}
              accent="emerald"
            />
            <ListStatCard
              label="Outstanding"
              value={formatCurrency(pageData.summary.totalOutstandingAmount)}
              meta="Total unpaid balance"
              accent="violet"
            />
          </section>

          <OrderListControls
            currentPath="/dashboard/orders"
            currentFilters={currentFilters}
            filterOptions={filterOptions}
            selectedBranchName={context.selectedBranchName}
            canCreate={canCreate}
          />

          <OrderDataTable
            items={pageData.result.items}
            emptyMessage="No orders found for the selected filters."
            currentPath="/dashboard/orders"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            showBranch={context.selectedBranchId === null}
            canView={canView}
            canEdit={canEdit}
            canAddPayment={canAddPayment}
            canUpdateStatus={canUpdateStatus}
            canCancel={canCancel}
            canEditVendor={canEditVendor}
            canAddVendorPayment={canAddVendorPayment}
          />
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
            branchOptions={[
              {
                label: currentUser.branchName ?? "Branch",
                value: currentUser.branchId ?? "all",
              },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load orders data right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
