"use client";

import { useState } from "react";
import { InventoryPricingListControls } from "@/components/dashboard/inventory-pricing-list-controls";
import { InventoryPricingDataTable } from "@/components/inventory-pricing/inventory-pricing-data-table";
import { InventoryPricingDialog } from "@/components/inventory-pricing/inventory-pricing-dialog";
import type { CustomerTypeOption } from "@/lib/customers/types";
import type {
  DashboardPaginationState,
  InventoryPricingInventoryOption,
  InventoryPricingRow,
} from "@/lib/dashboard/types";
import type { InventoryPricingPageFilterState } from "@/lib/dashboard/inventory-pricing-page-filters";

type InventoryPricingTableWithActionsProps = {
  rows: InventoryPricingRow[];
  inventoryOptions: InventoryPricingInventoryOption[];
  currentPath: string;
  currentFilters: InventoryPricingPageFilterState;
  pagination: DashboardPaginationState;
  showBranchColumn: boolean;
  canCreate: boolean;
  canEdit: boolean;
  selectedBranchName: string;
  customerTypeOptions: CustomerTypeOption[];
};

export function InventoryPricingTableWithActions({
  rows,
  inventoryOptions,
  currentPath,
  currentFilters,
  pagination,
  showBranchColumn,
  canCreate,
  canEdit,
  selectedBranchName,
  customerTypeOptions,
}: InventoryPricingTableWithActionsProps) {
  const [editRow, setEditRow] = useState<InventoryPricingRow | null>(null);
  const addPricingDisabled = inventoryOptions.length === 0;
  const addPricingHref =
    currentFilters.branchId === null
      ? "/dashboard/inventory/pricing/new"
      : `/dashboard/inventory/pricing/new?branchId=${encodeURIComponent(currentFilters.branchId)}`;

  return (
    <>
      <InventoryPricingListControls
        currentPath={currentPath}
        currentFilters={currentFilters}
        selectedBranchName={selectedBranchName}
        canCreate={canCreate}
        addPricingDisabled={addPricingDisabled}
        addPricingHref={addPricingHref}
        customerTypeOptions={customerTypeOptions}
      />

      <InventoryPricingDataTable
        emptyMessage="No inventory pricing rows match the current filters."
        rows={rows}
        currentPath={currentPath}
        currentFilters={currentFilters}
        pagination={pagination}
        showBranchColumn={showBranchColumn}
        canEdit={canEdit}
        onEditRow={setEditRow}
      />

      <InventoryPricingDialog
        mode="edit"
        isOpen={editRow !== null}
        pricing={editRow}
        inventoryOptions={inventoryOptions}
        onClose={() => setEditRow(null)}
        onSaved={() => setEditRow(null)}
        customerTypeOptions={customerTypeOptions}
      />
    </>
  );
}
