import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { InventoryDataTable } from "@/components/dashboard/inventory-data-table";
import { InventoryListControls } from "@/components/dashboard/inventory-list-controls";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseInventoryPageFilters } from "@/lib/dashboard/inventory-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import {
  getDashboardContext,
  getInventoryPageData,
  getInventoryVendorOptions,
} from "@/lib/dashboard/queries";
import { formatCompactNumber, formatDateRangeLabel } from "@/lib/utils/format";

type InventoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const filters = parseInventoryPageFilters(resolvedSearchParams);
    const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
    const currentFilters = {
      ...filters,
      branchId: context.selectedBranchValue,
    };
    const [pageData, vendorOptions] = await Promise.all([
      getInventoryPageData(context.selectedBranchId, currentFilters),
      getInventoryVendorOptions(context.selectedBranchId),
    ]);
    const branchOptions = buildBranchFilterOptions(context);
    const hasDateFilter = !!(currentFilters.from || currentFilters.to);
    const dateFieldLabel = currentFilters.dateField === "created" ? "created date" : "updated date";
    const dateRangeLabel = hasDateFilter
      ? formatDateRangeLabel(currentFilters.from, currentFilters.to)
      : null;
    const contextMeta = hasDateFilter
      ? `By ${dateFieldLabel}: ${dateRangeLabel}`
      : `All inventory for ${context.selectedBranchName}`;
    const showBranchColumn = context.selectedBranchId === null;

    return (
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <DashboardHeader
            title="Inventory"
            branchOptions={branchOptions}
            selectedBranchValue={context.selectedBranchValue}
            branchFilterDisabled={!context.canSelectAll}
          />

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ListStatCard
              label="Items in view"
              value={formatCompactNumber(pageData.summary.totalItemsInRange)}
              meta={contextMeta}
              accent="blue"
            />
            <ListStatCard
              label="Low stock"
              value={formatCompactNumber(pageData.summary.lowStockItemsInRange)}
              meta={`Qty ≤ 10 · ${context.selectedBranchName}`}
              accent="amber"
            />
            <ListStatCard
              label="Out of stock"
              value={formatCompactNumber(pageData.summary.outOfStockItemsInRange)}
              meta={`Qty = 0 · ${context.selectedBranchName}`}
              accent="violet"
            />
            <ListStatCard
              label="Total quantity"
              value={formatCompactNumber(pageData.summary.totalStockQuantityInRange)}
              meta={`Units across filtered items`}
              accent="emerald"
            />
          </section>

          <InventoryListControls
            currentPath="/dashboard/inventory"
            currentFilters={currentFilters}
            vendorOptions={vendorOptions}
            selectedBranchName={context.selectedBranchName}
          />

          <InventoryDataTable
            emptyMessage="No inventory items match the current filters."
            items={pageData.result.items}
            currentPath="/dashboard/inventory"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            showBranchColumn={showBranchColumn}
            fallbackBranchName={context.selectedBranchName}
          />
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
            branchOptions={[
              {
                label: currentUser.branchName ?? "Branch",
                value: currentUser.branchId ?? "all",
              },
            ]}
            selectedBranchValue={currentUser.branchId ?? "all"}
            branchFilterDisabled
          />
          <SectionCard title="Unable to load inventory data right now.">
            <p className="text-sm text-slate-600">Please try again shortly.</p>
          </SectionCard>
        </div>
      </main>
    );
  }
}
