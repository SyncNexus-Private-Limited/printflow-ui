import "server-only";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { getPool } from "@/lib/db/postgres";
import type {
  EditInventoryItem,
  InventoryFormBranchOption,
  InventoryFormPageData,
  InventoryFormVendorOption,
} from "@/lib/inventory/types";

export async function getBranchOptionsForInventory(
  currentUser: AuthenticatedUser,
): Promise<InventoryFormBranchOption[]> {
  if (currentUser.role !== "admin") {
    return currentUser.branchId
      ? [{ id: currentUser.branchId, name: currentUser.branchName ?? "Your branch" }]
      : [];
  }

  const db = getPool();
  const { rows } = await db.query<InventoryFormBranchOption>(
    `
      SELECT id::text AS id, name
      FROM branches
      WHERE is_active = true
      ORDER BY name ASC
    `,
  );

  return rows;
}

export async function getVendorOptions(): Promise<InventoryFormVendorOption[]> {
  const db = getPool();
  const { rows } = await db.query<InventoryFormVendorOption>(
    `
      SELECT id::text AS id, name
      FROM vendors
      ORDER BY name ASC
    `,
  );

  return rows;
}

export async function getInventoryFormPageData(
  currentUser: AuthenticatedUser,
  requestedBranchId?: string,
): Promise<InventoryFormPageData> {
  const branchOptions = await getBranchOptionsForInventory(currentUser);

  const selectedBranch =
    (requestedBranchId ? branchOptions.find((b) => b.id === requestedBranchId) : undefined) ??
    branchOptions[0] ??
    null;

  const vendorOptions = await getVendorOptions();

  return {
    branchOptions,
    vendorOptions,
    selectedBranchId: selectedBranch?.id ?? "",
    selectedBranchName: selectedBranch?.name ?? "Branch",
    canSelectBranch: currentUser.role === "admin" && branchOptions.length > 1,
  };
}

export async function getInventoryById(inventoryId: string): Promise<EditInventoryItem | null> {
  const db = getPool();
  const { rows } = await db.query<EditInventoryItem>(
    `
      SELECT
        i.id::text                                AS id,
        i.branch_id::text                         AS "branchId",
        b.name                                    AS "branchName",
        i.name,
        i.sku,
        i.unit::text                              AS unit,
        i.is_active                               AS "isActive",
        i.quantity::double precision              AS quantity,
        i.last_purchase_rate::double precision    AS "lastPurchaseRate",
        COALESCE(i.last_vendor_id::text, '')      AS "lastVendorId",
        i.reorder_level::double precision         AS "reorderLevel",
        i.image,
        i.updated_at                              AS "updatedAt",
        u.full_name                               AS "updatedByName"
      FROM inventory i
      JOIN branches b ON b.id = i.branch_id
      LEFT JOIN users u ON u.id = i.updated_by
      WHERE i.id = $1::uuid
        AND i.deleted_at IS NULL
      LIMIT 1
    `,
    [inventoryId],
  );

  if (!rows[0]) return null;

  const row = rows[0];

  return {
    ...row,
    lastVendorId: row.lastVendorId === "" ? null : row.lastVendorId,
  };
}
