import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission, canAccessBranch } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { InventoryPricingInput } from "@/lib/inventory-pricing/schema";

type MutationFieldErrors = Partial<Record<string, string>>;

export class InventoryPricingMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "InventoryPricingMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

type InventoryPricingAuditSnapshot = {
  id: string;
  branchId: string;
  inventoryId: string;
  customerType: string;
  sellingRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  updatedBy: string | null;
};

type InventoryPricingSnapshotRow = {
  id: string;
  branch_id: string;
  inventory_id: string;
  customer_type: string;
  selling_rate: number;
  effective_from: string;
  effective_to: string | null;
  updated_by: string | null;
};

async function fetchInventoryPricingSnapshotForAudit(
  client: PoolClient,
  pricingId: string,
): Promise<InventoryPricingAuditSnapshot | null> {
  const { rows } = await client.query<InventoryPricingSnapshotRow>(
    `SELECT
       ip.id::text               AS id,
       ip.branch_id::text        AS branch_id,
       ip.inventory_id::text     AS inventory_id,
       ip.customer_type::text    AS customer_type,
       ip.selling_rate::double precision AS selling_rate,
       ip.effective_from::text   AS effective_from,
       ip.effective_to::text     AS effective_to,
       ip.updated_by::text       AS updated_by
     FROM inventory_pricing ip
     WHERE ip.id = $1::uuid
     FOR UPDATE
     LIMIT 1`,
    [pricingId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    branchId: row.branch_id,
    inventoryId: row.inventory_id,
    customerType: row.customer_type,
    sellingRate: row.selling_rate,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    updatedBy: row.updated_by,
  };
}

async function logInventoryPricingAudit(
  client: PoolClient,
  pricingId: string,
  branchId: string,
  inventoryId: string,
  action: string,
  snapshot: InventoryPricingAuditSnapshot,
  changedBy: string,
  changedFields?: Record<string, { from: unknown; to: unknown }> | null,
): Promise<void> {
  await client.query(
    `INSERT INTO inventory_pricing_audit_logs
       (inventory_pricing_id, branch_id, inventory_id, action, snapshot, changed_fields, changed_by)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6::jsonb, $7::uuid)`,
    [
      pricingId,
      branchId,
      inventoryId,
      action,
      JSON.stringify(snapshot),
      changedFields && Object.keys(changedFields).length > 0 ? JSON.stringify(changedFields) : null,
      changedBy,
    ],
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type InventoryBranchRow = {
  inventoryId: string;
  branchId: string;
  deletedAt: string | null;
};

async function getInventoryBranch(
  client: PoolClient,
  inventoryId: string,
): Promise<InventoryBranchRow | null> {
  const { rows } = await client.query<InventoryBranchRow>(
    `
      SELECT
        i.id::text AS "inventoryId",
        i.branch_id::text AS "branchId",
        i.deleted_at::text AS "deletedAt"
      FROM inventory i
      WHERE i.id = $1::uuid
      LIMIT 1
    `,
    [inventoryId],
  );

  return rows[0] ?? null;
}

function toRate(value: string): number {
  return Number.parseFloat(value);
}

function handlePricingDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Overlapping inventory pricing range")) {
    throw new InventoryPricingMutationError(
      "This pricing window overlaps an existing price for the same item, branch, and customer type.",
      {
        status: 409,
        fieldErrors: {
          effectiveFrom: "Adjust the date range to avoid overlap.",
          effectiveTo: "Adjust the date range to avoid overlap.",
        },
      },
    );
  }

  if (message.includes("inventory_id does not belong to branch_id")) {
    throw new InventoryPricingMutationError("Selected item does not belong to the target branch.", {
      status: 400,
      fieldErrors: { inventoryId: "Select an item from the selected branch." },
    });
  }

  console.error("Inventory pricing mutation failed", error);
  throw new InventoryPricingMutationError("Unable to save inventory pricing right now.", {
    status: 500,
  });
}

// ---------------------------------------------------------------------------
// createInventoryPricing
// ---------------------------------------------------------------------------

export async function createInventoryPricing(
  currentUser: AuthenticatedUser,
  input: InventoryPricingInput,
): Promise<{ id: string }> {
  assertPermission(currentUser, "inventory:create");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const inventory = await getInventoryBranch(client, input.inventoryId);
    if (!inventory || inventory.deletedAt !== null) {
      throw new InventoryPricingMutationError("Inventory item not found.", {
        status: 404,
        fieldErrors: { inventoryId: "Select an active inventory item." },
      });
    }

    if (!canAccessBranch(currentUser, inventory.branchId)) {
      throw new InventoryPricingMutationError("Forbidden.", { status: 403 });
    }

    const { rows } = await client.query<{ id: string }>(
      `
        INSERT INTO inventory_pricing
          (branch_id, inventory_id, customer_type, selling_rate, effective_from, effective_to, created_by, updated_by)
        VALUES
          ($1::uuid, $2::uuid, $3::customer_type, $4::numeric, $5::date, $6::date, $7::uuid, $7::uuid)
        RETURNING id::text AS id
      `,
      [
        inventory.branchId,
        input.inventoryId,
        input.customerType,
        toRate(input.sellingRate),
        input.effectiveFrom,
        input.effectiveTo ?? null,
        currentUser.userId,
      ],
    );

    const createdId = rows[0]?.id;
    if (!createdId) {
      throw new InventoryPricingMutationError("Unable to create inventory pricing right now.", {
        status: 500,
      });
    }

    const createSnapshot: InventoryPricingAuditSnapshot = {
      id: createdId,
      branchId: inventory.branchId,
      inventoryId: input.inventoryId,
      customerType: input.customerType,
      sellingRate: toRate(input.sellingRate),
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
      updatedBy: currentUser.userId,
    };

    await logInventoryPricingAudit(
      client,
      createdId,
      inventory.branchId,
      input.inventoryId,
      "create",
      createSnapshot,
      currentUser.userId,
    );

    await client.query("COMMIT");
    return { id: createdId };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryPricingMutationError) throw error;
    handlePricingDbError(error);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// updateInventoryPricing
// ---------------------------------------------------------------------------

export async function updateInventoryPricing(
  currentUser: AuthenticatedUser,
  pricingId: string,
  input: InventoryPricingInput,
): Promise<void> {
  assertPermission(currentUser, "inventory:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchInventoryPricingSnapshotForAudit(client, pricingId);
    if (!snapshot) {
      throw new InventoryPricingMutationError("Inventory pricing not found.", { status: 404 });
    }

    const inventory = await getInventoryBranch(client, input.inventoryId);
    if (!inventory || inventory.deletedAt !== null) {
      throw new InventoryPricingMutationError("Inventory item not found.", {
        status: 404,
        fieldErrors: { inventoryId: "Select an active inventory item." },
      });
    }

    if (
      !canAccessBranch(currentUser, snapshot.branchId) ||
      !canAccessBranch(currentUser, inventory.branchId)
    ) {
      throw new InventoryPricingMutationError("Forbidden.", { status: 403 });
    }

    const newRate = toRate(input.sellingRate);
    const newEffectiveTo = input.effectiveTo ?? null;

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    if (snapshot.inventoryId !== input.inventoryId)
      changedFields.inventoryId = { from: snapshot.inventoryId, to: input.inventoryId };
    if (snapshot.branchId !== inventory.branchId)
      changedFields.branchId = { from: snapshot.branchId, to: inventory.branchId };
    if (snapshot.customerType !== input.customerType)
      changedFields.customerType = { from: snapshot.customerType, to: input.customerType };
    if (snapshot.sellingRate !== newRate)
      changedFields.sellingRate = { from: snapshot.sellingRate, to: newRate };
    if (snapshot.effectiveFrom !== input.effectiveFrom)
      changedFields.effectiveFrom = { from: snapshot.effectiveFrom, to: input.effectiveFrom };
    if ((snapshot.effectiveTo ?? null) !== newEffectiveTo)
      changedFields.effectiveTo = { from: snapshot.effectiveTo, to: newEffectiveTo };

    const { rowCount } = await client.query(
      `
        UPDATE inventory_pricing
        SET
          branch_id = $2::uuid,
          inventory_id = $3::uuid,
          customer_type = $4::customer_type,
          selling_rate = $5::numeric,
          effective_from = $6::date,
          effective_to = $7::date,
          updated_by = $8::uuid
        WHERE id = $1::uuid
      `,
      [
        pricingId,
        inventory.branchId,
        input.inventoryId,
        input.customerType,
        newRate,
        input.effectiveFrom,
        newEffectiveTo,
        currentUser.userId,
      ],
    );

    if (!rowCount) {
      throw new InventoryPricingMutationError("Inventory pricing not found.", { status: 404 });
    }

    await logInventoryPricingAudit(
      client,
      pricingId,
      snapshot.branchId,
      snapshot.inventoryId,
      "update",
      snapshot,
      currentUser.userId,
      changedFields,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryPricingMutationError) throw error;
    handlePricingDbError(error);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// closeInventoryPricing
// ---------------------------------------------------------------------------

export async function closeInventoryPricing(
  currentUser: AuthenticatedUser,
  pricingId: string,
): Promise<void> {
  assertPermission(currentUser, "inventory:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchInventoryPricingSnapshotForAudit(client, pricingId);
    if (!snapshot) {
      throw new InventoryPricingMutationError("Inventory pricing not found.", { status: 404 });
    }

    if (!canAccessBranch(currentUser, snapshot.branchId)) {
      throw new InventoryPricingMutationError("Forbidden.", { status: 403 });
    }

    await client.query(
      `
        UPDATE inventory_pricing
        SET
          effective_to = CASE
            WHEN effective_from > CURRENT_DATE THEN effective_from
            ELSE CURRENT_DATE
          END,
          updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [pricingId, currentUser.userId],
    );

    // Fetch the DB-computed effective_to to record the exact value in the audit log.
    const { rows: closedRows } = await client.query<{ effectiveTo: string }>(
      `SELECT effective_to::text AS "effectiveTo" FROM inventory_pricing WHERE id = $1::uuid LIMIT 1`,
      [pricingId],
    );
    const newEffectiveTo = closedRows[0]?.effectiveTo ?? null;

    const changedFields: Record<string, { from: unknown; to: unknown }> = {
      effectiveTo: { from: snapshot.effectiveTo, to: newEffectiveTo },
    };

    await logInventoryPricingAudit(
      client,
      pricingId,
      snapshot.branchId,
      snapshot.inventoryId,
      "close",
      snapshot,
      currentUser.userId,
      changedFields,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryPricingMutationError) throw error;
    handlePricingDbError(error);
  } finally {
    client.release();
  }
}
