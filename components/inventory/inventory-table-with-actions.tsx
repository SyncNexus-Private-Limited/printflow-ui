"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InventoryDataTable } from "@/components/dashboard/inventory-data-table";
import {
  EditInventoryDialog,
  type InventoryRowPatch,
} from "@/components/inventory/edit-inventory-dialog";
import type { InventoryPageDetailRow, DashboardPaginationState } from "@/lib/dashboard/types";
import type { InventoryPageFilterState } from "@/lib/dashboard/inventory-page-filters";

type PendingPatch = { id: string; patch: InventoryRowPatch };

type InventoryTableWithActionsProps = {
  items: InventoryPageDetailRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: InventoryPageFilterState;
  pagination: DashboardPaginationState;
  showBranchColumn: boolean;
  fallbackBranchName: string;
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
};

export function InventoryTableWithActions({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  showBranchColumn,
  fallbackBranchName,
  canEdit,
  canArchive,
  canRestore,
}: InventoryTableWithActionsProps) {
  const router = useRouter();
  const [editInventoryId, setEditInventoryId] = useState<string | null>(null);
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null);

  // Once router.refresh() delivers fresh server data, the optimistic patch is
  // no longer needed — the server-confirmed values take over.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPendingPatch(null);
  }, [items]);

  return (
    <>
      <InventoryDataTable
        items={items}
        emptyMessage={emptyMessage}
        currentPath={currentPath}
        currentFilters={currentFilters}
        pagination={pagination}
        showBranchColumn={showBranchColumn}
        fallbackBranchName={fallbackBranchName}
        canEdit={canEdit}
        canArchive={canArchive}
        canRestore={canRestore}
        onEditRow={(item) => setEditInventoryId(item.id)}
        pendingPatch={pendingPatch}
      />

      <EditInventoryDialog
        inventoryId={editInventoryId}
        onClose={() => setEditInventoryId(null)}
        onSuccess={(id, patch) => {
          setEditInventoryId(null);
          setPendingPatch({ id, patch });
          router.refresh();
        }}
      />
    </>
  );
}
