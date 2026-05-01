import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission, canAccessBranch } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { OfferInput } from "@/lib/offers/schema";

type MutationFieldErrors = Partial<Record<string, string>>;
type ChangedFields = Record<string, { from: unknown; to: unknown }>;
type OfferAuditAction = "create" | "update" | "deactivate" | "restore";

export class OfferMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "OfferMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

export type OfferAuditSnapshot = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description: string | null;
  offerType: string;
  discountValue: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minimumOrderValue: number | null;
  customerType: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type OfferAuditSnapshotRow = {
  id: string;
  branch_id: string;
  code: string;
  name: string;
  description: string | null;
  offer_type: string;
  discount_value: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  minimum_order_value: number | null;
  customer_type: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

function parseOptionalMoney(value: string | undefined) {
  return value ? Number.parseFloat(value) : null;
}

function parseOptionalInteger(value: string | undefined) {
  return value ? Number.parseInt(value, 10) : null;
}

function normalizeOptional(value: string | undefined) {
  return value ?? null;
}

async function assertBranchExists(client: PoolClient, branchId: string) {
  const { rowCount } = await client.query(
    `
      SELECT 1
      FROM branches
      WHERE id = $1::uuid AND is_active = true
      LIMIT 1
    `,
    [branchId],
  );

  if (!rowCount) {
    throw new OfferMutationError("Select a valid branch.", {
      status: 400,
      fieldErrors: { branchId: "Select a valid branch." },
    });
  }
}

function assertOfferBranchAccess(currentUser: AuthenticatedUser, branchId: string) {
  if (!canAccessBranch(currentUser, branchId)) {
    throw new OfferMutationError("You do not have access to this branch.", { status: 403 });
  }
}

export async function fetchOfferSnapshotForAudit(
  client: PoolClient,
  offerId: string,
): Promise<OfferAuditSnapshot | null> {
  const { rows } = await client.query<OfferAuditSnapshotRow>(
    `
      SELECT
        o.id::text AS id,
        o.branch_id::text AS branch_id,
        o.code,
        o.name,
        o.description,
        o.offer_type,
        o.discount_value::double precision AS discount_value,
        o.buy_quantity,
        o.get_quantity,
        o.minimum_order_value::double precision AS minimum_order_value,
        o.customer_type::text AS customer_type,
        o.starts_at::text AS starts_at,
        o.ends_at::text AS ends_at,
        o.is_active,
        o.created_by::text AS created_by,
        o.updated_by::text AS updated_by,
        o.created_at::text AS created_at,
        o.updated_at::text AS updated_at
      FROM offers o
      WHERE o.id = $1::uuid
      FOR UPDATE
      LIMIT 1
    `,
    [offerId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    branchId: row.branch_id,
    code: row.code,
    name: row.name,
    description: row.description,
    offerType: row.offer_type,
    discountValue: row.discount_value,
    buyQuantity: row.buy_quantity,
    getQuantity: row.get_quantity,
    minimumOrderValue: row.minimum_order_value,
    customerType: row.customer_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function logOfferAudit(
  client: PoolClient,
  offerId: string,
  action: OfferAuditAction,
  snapshot: OfferAuditSnapshot,
  changedBy: string,
  changedFields?: ChangedFields | null,
): Promise<void> {
  await client.query(
    `
      INSERT INTO offer_audit_logs
        (offer_id, action, snapshot, changed_fields, changed_by)
      VALUES
        ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid)
    `,
    [
      offerId,
      action,
      JSON.stringify(snapshot),
      changedFields && Object.keys(changedFields).length > 0 ? JSON.stringify(changedFields) : null,
      changedBy,
    ],
  );
}

function buildUpdateChangedFields(snapshot: OfferAuditSnapshot, input: OfferInput): ChangedFields {
  const nextDiscountValue = parseOptionalMoney(input.discountValue);
  const nextBuyQuantity = parseOptionalInteger(input.buyQuantity);
  const nextGetQuantity = parseOptionalInteger(input.getQuantity);
  const nextMinimumOrderValue = parseOptionalMoney(input.minimumOrderValue);
  const nextDescription = normalizeOptional(input.description);
  const nextCustomerType = input.customerType ?? null;
  const nextEndsAt = input.endsAt ?? null;
  const changedFields: ChangedFields = {};

  if (snapshot.branchId !== input.branchId)
    changedFields.branchId = { from: snapshot.branchId, to: input.branchId };
  if (snapshot.code !== input.code) changedFields.code = { from: snapshot.code, to: input.code };
  if (snapshot.name !== input.name) changedFields.name = { from: snapshot.name, to: input.name };
  if ((snapshot.description ?? null) !== nextDescription)
    changedFields.description = { from: snapshot.description, to: nextDescription };
  if (snapshot.offerType !== input.offerType)
    changedFields.offerType = { from: snapshot.offerType, to: input.offerType };
  if ((snapshot.discountValue ?? null) !== nextDiscountValue)
    changedFields.discountValue = { from: snapshot.discountValue, to: nextDiscountValue };
  if ((snapshot.buyQuantity ?? null) !== nextBuyQuantity)
    changedFields.buyQuantity = { from: snapshot.buyQuantity, to: nextBuyQuantity };
  if ((snapshot.getQuantity ?? null) !== nextGetQuantity)
    changedFields.getQuantity = { from: snapshot.getQuantity, to: nextGetQuantity };
  if ((snapshot.minimumOrderValue ?? null) !== nextMinimumOrderValue) {
    changedFields.minimumOrderValue = {
      from: snapshot.minimumOrderValue,
      to: nextMinimumOrderValue,
    };
  }
  if ((snapshot.customerType ?? null) !== nextCustomerType)
    changedFields.customerType = { from: snapshot.customerType, to: nextCustomerType };
  if (snapshot.startsAt !== input.startsAt)
    changedFields.startsAt = { from: snapshot.startsAt, to: input.startsAt };
  if ((snapshot.endsAt ?? null) !== nextEndsAt)
    changedFields.endsAt = { from: snapshot.endsAt, to: nextEndsAt };
  if (snapshot.isActive !== input.isActive)
    changedFields.isActive = { from: snapshot.isActive, to: input.isActive };

  return changedFields;
}

function handleDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("offers_code_key") || message.includes("duplicate key value")) {
    throw new OfferMutationError("An offer with this code already exists.", {
      status: 409,
      fieldErrors: { code: "This code is already in use." },
    });
  }

  console.error("Offer mutation failed", error);
  throw new OfferMutationError("Unable to save offer right now.", { status: 500 });
}

export async function createOffer(
  currentUser: AuthenticatedUser,
  input: OfferInput,
): Promise<{ id: string; redirectTo: string }> {
  assertPermission(currentUser, "offers:create");
  assertOfferBranchAccess(currentUser, input.branchId);

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await assertBranchExists(client, input.branchId);

    const { rows } = await client.query<{ id: string }>(
      `
        INSERT INTO offers
          (
            branch_id, code, name, description, offer_type, discount_value,
            buy_quantity, get_quantity, minimum_order_value, customer_type,
            starts_at, ends_at, is_active, created_by, updated_by
          )
        VALUES
          (
            $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::customer_type,
            $11::date, $12::date, $13, $14::uuid, $14::uuid
          )
        RETURNING id::text AS id
      `,
      [
        input.branchId,
        input.code,
        input.name,
        normalizeOptional(input.description),
        input.offerType,
        parseOptionalMoney(input.discountValue),
        parseOptionalInteger(input.buyQuantity),
        parseOptionalInteger(input.getQuantity),
        parseOptionalMoney(input.minimumOrderValue),
        input.customerType ?? null,
        input.startsAt,
        input.endsAt ?? null,
        input.isActive,
        currentUser.userId,
      ],
    );

    const createdId = rows[0]?.id;
    if (!createdId) throw new OfferMutationError("Unable to create offer right now.", { status: 500 });

    const snapshot = await fetchOfferSnapshotForAudit(client, createdId);
    if (!snapshot) throw new OfferMutationError("Unable to create offer right now.", { status: 500 });

    await logOfferAudit(client, createdId, "create", snapshot, currentUser.userId);
    await client.query("COMMIT");

    return { id: createdId, redirectTo: "/dashboard/offers" };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OfferMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function updateOffer(
  currentUser: AuthenticatedUser,
  offerId: string,
  input: OfferInput,
): Promise<void> {
  assertPermission(currentUser, "offers:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const snapshot = await fetchOfferSnapshotForAudit(client, offerId);
    if (!snapshot) throw new OfferMutationError("Offer not found.", { status: 404 });

    assertOfferBranchAccess(currentUser, snapshot.branchId);
    assertOfferBranchAccess(currentUser, input.branchId);
    await assertBranchExists(client, input.branchId);

    const changedFields = buildUpdateChangedFields(snapshot, input);
    const { rowCount } = await client.query(
      `
        UPDATE offers
        SET
          branch_id = $2::uuid,
          code = $3,
          name = $4,
          description = $5,
          offer_type = $6,
          discount_value = $7,
          buy_quantity = $8,
          get_quantity = $9,
          minimum_order_value = $10,
          customer_type = $11::customer_type,
          starts_at = $12::date,
          ends_at = $13::date,
          is_active = $14,
          updated_by = $15::uuid
        WHERE id = $1::uuid
      `,
      [
        offerId,
        input.branchId,
        input.code,
        input.name,
        normalizeOptional(input.description),
        input.offerType,
        parseOptionalMoney(input.discountValue),
        parseOptionalInteger(input.buyQuantity),
        parseOptionalInteger(input.getQuantity),
        parseOptionalMoney(input.minimumOrderValue),
        input.customerType ?? null,
        input.startsAt,
        input.endsAt ?? null,
        input.isActive,
        currentUser.userId,
      ],
    );

    if (!rowCount) throw new OfferMutationError("Offer not found.", { status: 404 });

    await logOfferAudit(client, offerId, "update", snapshot, currentUser.userId, changedFields);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OfferMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function deactivateOffer(currentUser: AuthenticatedUser, offerId: string): Promise<void> {
  assertPermission(currentUser, "offers:deactivate");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const snapshot = await fetchOfferSnapshotForAudit(client, offerId);
    if (!snapshot) throw new OfferMutationError("Offer not found.", { status: 404 });
    assertOfferBranchAccess(currentUser, snapshot.branchId);

    await client.query(
      `
        UPDATE offers
        SET is_active = false, updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [offerId, currentUser.userId],
    );

    await logOfferAudit(client, offerId, "deactivate", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: false },
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OfferMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function restoreOffer(currentUser: AuthenticatedUser, offerId: string): Promise<void> {
  assertPermission(currentUser, "offers:restore");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const snapshot = await fetchOfferSnapshotForAudit(client, offerId);
    if (!snapshot) throw new OfferMutationError("Offer not found.", { status: 404 });
    assertOfferBranchAccess(currentUser, snapshot.branchId);

    await client.query(
      `
        UPDATE offers
        SET is_active = true, updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [offerId, currentUser.userId],
    );

    await logOfferAudit(client, offerId, "restore", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: true },
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OfferMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}
