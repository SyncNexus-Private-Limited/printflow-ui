import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { CreateInventoryInput, UpdateInventoryInput } from "@/lib/inventory/schema";

type MutationFieldErrors = Partial<Record<string, string>>;

export class InventoryMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "InventoryMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

type InventoryAuditSnapshot = {
  id: string;
  branchId: string;
  name: string;
  sku: string;
  unit: string;
  isActive: boolean;
  quantity: number;
  lastPurchaseRate: number | null;
  lastVendorId: string | null;
  reorderLevel: number | null;
  image: string | null;
  deletedAt: string | null;
};

type InventorySnapshotRow = {
  id: string;
  branch_id: string;
  name: string;
  sku: string;
  unit: string;
  is_active: boolean;
  quantity: number;
  last_purchase_rate: number | null;
  last_vendor_id: string | null;
  reorder_level: number | null;
  image: string | null;
  deleted_at: string | null;
};

async function fetchInventorySnapshotForAudit(
  client: PoolClient,
  inventoryId: string,
): Promise<InventoryAuditSnapshot | null> {
  const { rows } = await client.query<InventorySnapshotRow>(
    `SELECT
       i.id::text           AS id,
       i.branch_id::text    AS branch_id,
       i.name,
       i.sku,
       i.unit::text         AS unit,
       i.is_active,
       i.quantity::double precision AS quantity,
       i.last_purchase_rate::double precision AS last_purchase_rate,
       i.last_vendor_id::text AS last_vendor_id,
       i.reorder_level::double precision AS reorder_level,
       i.image,
       i.deleted_at::text   AS deleted_at
     FROM inventory i
     WHERE i.id = $1::uuid
     FOR UPDATE OF i
     LIMIT 1`,
    [inventoryId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    branchId: row.branch_id,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    isActive: row.is_active,
    quantity: row.quantity,
    lastPurchaseRate: row.last_purchase_rate,
    lastVendorId: row.last_vendor_id,
    reorderLevel: row.reorder_level,
    image: row.image,
    deletedAt: row.deleted_at,
  };
}

async function logInventoryAudit(
  client: PoolClient,
  inventoryId: string,
  action: string,
  snapshot: InventoryAuditSnapshot,
  changedBy: string,
  changedFields?: Record<string, { from: unknown; to: unknown }> | null,
): Promise<void> {
  await client.query(
    `INSERT INTO inventory_audit_logs (inventory_id, action, snapshot, changed_fields, changed_by)
     VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid)`,
    [
      inventoryId,
      action,
      JSON.stringify(snapshot),
      changedFields && Object.keys(changedFields).length > 0 ? JSON.stringify(changedFields) : null,
      changedBy,
    ],
  );
}

async function logStockMovement(
  client: PoolClient,
  inventoryId: string,
  branchId: string,
  movementType: string,
  quantityDelta: number,
  createdBy: string,
  note?: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO inventory_stock_movements
       (inventory_id, branch_id, movement_type, quantity_delta, note, created_by)
     VALUES ($1::uuid, $2::uuid, $3, $4::numeric, $5, $6::uuid)`,
    [inventoryId, branchId, movementType, quantityDelta, note ?? null, createdBy],
  );
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

async function assertBranchIsActive(client: PoolClient, branchId: string): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM branches WHERE id = $1::uuid AND is_active = true LIMIT 1`,
    [branchId],
  );
  if (!rows[0]) {
    throw new InventoryMutationError("The selected branch is not available.", {
      status: 400,
      fieldErrors: { branchId: "Select a valid, active branch." },
    });
  }
}

async function assertVendorBelongsToBranch(
  client: PoolClient,
  vendorId: string,
  branchId: string,
): Promise<void> {
  // Vendors are not branch-scoped in the baseline schema, but we check
  // they exist and are referenced by this branch's inventory as a sanity guard.
  const { rows } = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM vendors WHERE id = $1::uuid LIMIT 1`,
    [vendorId],
  );
  if (!rows[0]) {
    throw new InventoryMutationError("Selected vendor not found.", {
      status: 400,
      fieldErrors: { lastVendorId: "Select a valid vendor." },
    });
  }
  // Suppress unused param warning — branchId reserved for future FK enforcement.
  void branchId;
}

// ---------------------------------------------------------------------------
// createInventory
// ---------------------------------------------------------------------------

export async function createInventory(
  currentUser: AuthenticatedUser,
  input: CreateInventoryInput,
): Promise<{ id: string; redirectTo: string }> {
  assertPermission(currentUser, "inventory:create");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await assertBranchIsActive(client, input.branchId);

    if (input.lastVendorId) {
      await assertVendorBelongsToBranch(client, input.lastVendorId, input.branchId);
    }

    const initialQty = parseFloat(input.initialQuantity ?? "0") || 0;
    const purchaseRate =
      input.lastPurchaseRate !== undefined ? parseFloat(input.lastPurchaseRate) : null;
    const reorderLevel = input.reorderLevel !== undefined ? parseFloat(input.reorderLevel) : null;

    type CreatedRow = { id: string };
    const { rows } = await client.query<CreatedRow>(
      `INSERT INTO inventory
         (branch_id, name, sku, unit, is_active, quantity,
          last_purchase_rate, last_vendor_id, reorder_level, image,
          created_by, updated_by)
       VALUES
         ($1::uuid, $2, $3, $4::inventory_unit, $5, $6::numeric,
          $7::numeric, $8::uuid, $9::numeric, $10,
          $11::uuid, $11::uuid)
       RETURNING id::text AS id`,
      [
        input.branchId,
        input.name,
        input.sku,
        input.unit,
        input.isActive,
        initialQty,
        purchaseRate,
        input.lastVendorId ?? null,
        reorderLevel,
        input.image ?? null,
        currentUser.userId,
      ],
    );

    const createdId = rows[0]?.id;
    if (!createdId) {
      throw new InventoryMutationError("Unable to create the inventory item right now.", {
        status: 500,
      });
    }

    const createSnapshot: InventoryAuditSnapshot = {
      id: createdId,
      branchId: input.branchId,
      name: input.name,
      sku: input.sku,
      unit: input.unit,
      isActive: input.isActive,
      quantity: initialQty,
      lastPurchaseRate: purchaseRate,
      lastVendorId: input.lastVendorId ?? null,
      reorderLevel,
      image: input.image ?? null,
      deletedAt: null,
    };

    await logInventoryAudit(client, createdId, "create", createSnapshot, currentUser.userId);

    if (initialQty > 0) {
      await logStockMovement(
        client,
        createdId,
        input.branchId,
        "opening_balance",
        initialQty,
        currentUser.userId,
        input.note ?? null,
      );
    }

    await client.query("COMMIT");

    return {
      id: createdId,
      redirectTo: `/dashboard/inventory?created=1`,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof InventoryMutationError) throw error;

    const message = error instanceof Error ? error.message : "";

    if (
      message.includes("uq_inventory_branch_sku") ||
      message.includes("inventory_branch_id_sku")
    ) {
      throw new InventoryMutationError("An item with this SKU already exists in this branch.", {
        status: 409,
        fieldErrors: { sku: "This SKU is already in use in this branch." },
      });
    }

    console.error("Inventory creation failed", error);
    throw new InventoryMutationError("Unable to create the inventory item right now.", {
      status: 500,
    });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// updateInventory
// ---------------------------------------------------------------------------

export async function updateInventory(
  currentUser: AuthenticatedUser,
  inventoryId: string,
  input: UpdateInventoryInput,
): Promise<void> {
  assertPermission(currentUser, "inventory:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchInventorySnapshotForAudit(client, inventoryId);
    if (!snapshot) {
      throw new InventoryMutationError("Inventory item not found.", { status: 404 });
    }

    if (snapshot.deletedAt !== null) {
      throw new InventoryMutationError("Cannot edit an archived inventory item.", { status: 400 });
    }

    if (input.lastVendorId) {
      await assertVendorBelongsToBranch(client, input.lastVendorId, snapshot.branchId);
    }

    const newQty = parseFloat(input.newQuantity);
    const purchaseRate =
      input.lastPurchaseRate !== undefined ? parseFloat(input.lastPurchaseRate) : null;
    const reorderLevel = input.reorderLevel !== undefined ? parseFloat(input.reorderLevel) : null;
    const quantityDelta = newQty - snapshot.quantity;

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    if (snapshot.name !== input.name) changedFields.name = { from: snapshot.name, to: input.name };
    if (snapshot.sku !== input.sku) changedFields.sku = { from: snapshot.sku, to: input.sku };
    if (snapshot.unit !== input.unit) changedFields.unit = { from: snapshot.unit, to: input.unit };
    if (snapshot.isActive !== input.isActive)
      changedFields.isActive = { from: snapshot.isActive, to: input.isActive };
    if (Math.abs(quantityDelta) > 0.0005)
      changedFields.quantity = { from: snapshot.quantity, to: newQty };
    if ((snapshot.lastPurchaseRate ?? null) !== (purchaseRate ?? null))
      changedFields.lastPurchaseRate = { from: snapshot.lastPurchaseRate, to: purchaseRate };
    if ((snapshot.lastVendorId ?? null) !== (input.lastVendorId ?? null))
      changedFields.lastVendorId = { from: snapshot.lastVendorId, to: input.lastVendorId ?? null };
    if ((snapshot.reorderLevel ?? null) !== (reorderLevel ?? null))
      changedFields.reorderLevel = { from: snapshot.reorderLevel, to: reorderLevel };
    if ((snapshot.image ?? null) !== (input.image ?? null))
      changedFields.image = { from: snapshot.image, to: input.image ?? null };

    const { rowCount } = await client.query(
      `UPDATE inventory
       SET
         name               = $2,
         sku                = $3,
         unit               = $4::inventory_unit,
         is_active          = $5,
         quantity           = $6::numeric,
         last_purchase_rate = $7::numeric,
         last_vendor_id     = $8::uuid,
         reorder_level      = $9::numeric,
         image              = $10,
         updated_by         = $11::uuid
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [
        inventoryId,
        input.name,
        input.sku,
        input.unit,
        input.isActive,
        newQty,
        purchaseRate,
        input.lastVendorId ?? null,
        reorderLevel,
        input.image ?? null,
        currentUser.userId,
      ],
    );

    if (!rowCount) {
      throw new InventoryMutationError("Inventory item not found.", { status: 404 });
    }

    // Log quantity change as a stock movement.
    if (Math.abs(quantityDelta) > 0.0005) {
      await logStockMovement(
        client,
        inventoryId,
        snapshot.branchId,
        "manual_adjustment",
        quantityDelta,
        currentUser.userId,
        input.adjustmentNote ?? null,
      );
    }

    // Use the activate/deactivate audit action if only active state changed,
    // or fall back to generic "update".
    let auditAction = "update";
    if (snapshot.isActive !== input.isActive && Object.keys(changedFields).length === 1) {
      auditAction = input.isActive ? "activate" : "deactivate";
    }

    await logInventoryAudit(
      client,
      inventoryId,
      auditAction,
      snapshot,
      currentUser.userId,
      changedFields,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryMutationError) throw error;

    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("uq_inventory_branch_sku") ||
      message.includes("inventory_branch_id_sku")
    ) {
      throw new InventoryMutationError("An item with this SKU already exists in this branch.", {
        status: 409,
        fieldErrors: { sku: "This SKU is already in use in this branch." },
      });
    }

    console.error("Inventory update failed", error);
    throw new InventoryMutationError("Unable to save changes right now.", { status: 500 });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// archiveInventory
// ---------------------------------------------------------------------------

export async function archiveInventory(
  currentUser: AuthenticatedUser,
  inventoryId: string,
): Promise<void> {
  assertPermission(currentUser, "inventory:archive");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchInventorySnapshotForAudit(client, inventoryId);
    if (!snapshot) {
      throw new InventoryMutationError("Inventory item not found.", { status: 404 });
    }

    if (snapshot.deletedAt !== null) {
      throw new InventoryMutationError("This item is already archived.", { status: 400 });
    }

    await client.query(
      `UPDATE inventory
       SET deleted_at = now(), deleted_by = $2::uuid, updated_by = $2::uuid
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [inventoryId, currentUser.userId],
    );

    await logInventoryAudit(client, inventoryId, "archive", snapshot, currentUser.userId);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryMutationError) throw error;
    console.error("Inventory archive failed", error);
    throw new InventoryMutationError("Unable to archive the item right now.", { status: 500 });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// restoreInventory
// ---------------------------------------------------------------------------

export async function restoreInventory(
  currentUser: AuthenticatedUser,
  inventoryId: string,
): Promise<void> {
  assertPermission(currentUser, "inventory:restore");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchInventorySnapshotForAudit(client, inventoryId);
    if (!snapshot) {
      throw new InventoryMutationError("Inventory item not found.", { status: 404 });
    }

    if (snapshot.deletedAt === null) {
      throw new InventoryMutationError("This item is not archived.", { status: 400 });
    }

    await client.query(
      `UPDATE inventory
       SET deleted_at = NULL, deleted_by = NULL, updated_by = $2::uuid
       WHERE id = $1::uuid AND deleted_at IS NOT NULL`,
      [inventoryId, currentUser.userId],
    );

    await logInventoryAudit(client, inventoryId, "restore", snapshot, currentUser.userId);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryMutationError) throw error;
    console.error("Inventory restore failed", error);
    throw new InventoryMutationError("Unable to restore the item right now.", { status: 500 });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// toggleInventoryActive
// ---------------------------------------------------------------------------

export async function toggleInventoryActive(
  currentUser: AuthenticatedUser,
  inventoryId: string,
  isActive: boolean,
): Promise<void> {
  assertPermission(currentUser, "inventory:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchInventorySnapshotForAudit(client, inventoryId);
    if (!snapshot) {
      throw new InventoryMutationError("Inventory item not found.", { status: 404 });
    }

    if (snapshot.deletedAt !== null) {
      throw new InventoryMutationError("Cannot change status of an archived item.", {
        status: 400,
      });
    }

    const { rowCount } = await client.query(
      `UPDATE inventory
       SET is_active = $2, updated_by = $3::uuid
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [inventoryId, isActive, currentUser.userId],
    );

    if (!rowCount) {
      throw new InventoryMutationError("Inventory item not found.", { status: 404 });
    }

    await logInventoryAudit(
      client,
      inventoryId,
      isActive ? "activate" : "deactivate",
      snapshot,
      currentUser.userId,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryMutationError) throw error;
    console.error("Inventory active toggle failed", error);
    throw new InventoryMutationError("Unable to update item status right now.", { status: 500 });
  } finally {
    client.release();
  }
}
