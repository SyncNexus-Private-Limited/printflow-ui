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

async function getPricingBranch(
  client: PoolClient,
  pricingId: string,
): Promise<{ id: string; branchId: string } | null> {
  const { rows } = await client.query<{ id: string; branchId: string }>(
    `
      SELECT id::text AS id, branch_id::text AS "branchId"
      FROM inventory_pricing
      WHERE id = $1::uuid
      FOR UPDATE
      LIMIT 1
    `,
    [pricingId],
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

    const pricing = await getPricingBranch(client, pricingId);
    if (!pricing) {
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
      !canAccessBranch(currentUser, pricing.branchId) ||
      !canAccessBranch(currentUser, inventory.branchId)
    ) {
      throw new InventoryPricingMutationError("Forbidden.", { status: 403 });
    }

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
        toRate(input.sellingRate),
        input.effectiveFrom,
        input.effectiveTo ?? null,
        currentUser.userId,
      ],
    );

    if (!rowCount) {
      throw new InventoryPricingMutationError("Inventory pricing not found.", { status: 404 });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryPricingMutationError) throw error;
    handlePricingDbError(error);
  } finally {
    client.release();
  }
}

export async function closeInventoryPricing(
  currentUser: AuthenticatedUser,
  pricingId: string,
): Promise<void> {
  assertPermission(currentUser, "inventory:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const pricing = await getPricingBranch(client, pricingId);
    if (!pricing) {
      throw new InventoryPricingMutationError("Inventory pricing not found.", { status: 404 });
    }

    if (!canAccessBranch(currentUser, pricing.branchId)) {
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

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof InventoryPricingMutationError) throw error;
    handlePricingDbError(error);
  } finally {
    client.release();
  }
}
