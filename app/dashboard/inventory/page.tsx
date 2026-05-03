import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { InventoryListControls } from "@/components/dashboard/inventory-list-controls";
import { InventoryTableWithActions } from "@/components/inventory/inventory-table-with-actions";
import { ListStatCard } from "@/components/dashboard/list-stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseInventoryPageFilters } from "@/lib/dashboard/inventory-page-filters";
import { buildBranchFilterOptions } from "@/lib/dashboard/helpers";
import {
  getDashboardContext,
  getInventoryPageData,
  getInventoryVendorOptions,
} from "@/lib/dashboard/queries";
import { formatCompactNumber } from "@/lib/utils/format";

type InventoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const canCreate = hasPermission(currentUser, "inventory:create");
  const canEdit = hasPermission(currentUser, "inventory:edit");
  const canArchive = hasPermission(currentUser, "inventory:archive");
  const canRestore = hasPermission(currentUser, "inventory:restore");
  const canCreatePricing = canCreate;

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
              label="Low stock"
              value={formatCompactNumber(pageData.summary.lowStockItemsInRange)}
              meta="At reorder level"
              accent="amber"
            />
            <ListStatCard
              label="Out of stock"
              value={formatCompactNumber(pageData.summary.outOfStockItemsInRange)}
              meta="Needs restock"
              accent="violet"
            />
            <ListStatCard
              label="No current price"
              value={formatCompactNumber(pageData.summary.itemsWithoutPricingInRange)}
              meta="Pricing missing"
              accent="amber"
            />
            <ListStatCard
              label="Total quantity"
              value={formatCompactNumber(pageData.summary.totalStockQuantityInRange)}
              meta="Units in stock"
              accent="emerald"
            />
          </section>

          <InventoryListControls
            currentPath="/dashboard/inventory"
            currentFilters={currentFilters}
            vendorOptions={vendorOptions}
            selectedBranchName={context.selectedBranchName}
            canCreate={canCreate}
          />

          <InventoryTableWithActions
            emptyMessage="No inventory items match the current filters."
            items={pageData.result.items}
            currentPath="/dashboard/inventory"
            currentFilters={currentFilters}
            pagination={pageData.result.pagination}
            showBranchColumn={showBranchColumn}
            fallbackBranchName={context.selectedBranchName}
            canEdit={canEdit}
            canArchive={canArchive}
            canRestore={canRestore}
            canCreatePricing={canCreatePricing}
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
