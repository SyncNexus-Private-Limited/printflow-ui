import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { VendorInput } from "@/lib/vendors/schema";

type MutationFieldErrors = Partial<Record<string, string>>;
type ChangedFields = Record<string, { from: unknown; to: unknown }>;
type VendorAuditAction = "create" | "update" | "deactivate" | "restore";

export class VendorMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "VendorMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

export type VendorAuditSnapshot = {
  id: string;
  vendorCode: string | null;
  name: string;
  avatar: string | null;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type VendorAuditSnapshotRow = {
  id: string;
  vendor_code: string | null;
  name: string;
  avatar: string | null;
  phone: string;
  alternate_phone: string | null;
  address: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchVendorSnapshotForAudit(
  client: PoolClient,
  vendorId: string,
): Promise<VendorAuditSnapshot | null> {
  const { rows } = await client.query<VendorAuditSnapshotRow>(
    `
      SELECT
        v.id::text AS id,
        v.vendor_code,
        v.name,
        v.avatar,
        v.phone,
        v.alternate_phone,
        v.address,
        v.is_active,
        v.created_by::text AS created_by,
        v.updated_by::text AS updated_by,
        v.created_at::text AS created_at,
        v.updated_at::text AS updated_at
      FROM vendors v
      WHERE v.id = $1::uuid
      FOR UPDATE
      LIMIT 1
    `,
    [vendorId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    vendorCode: row.vendor_code,
    name: row.name,
    avatar: row.avatar,
    phone: row.phone,
    alternatePhone: row.alternate_phone,
    address: row.address,
    isActive: row.is_active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function logVendorAudit(
  client: PoolClient,
  vendorId: string,
  action: VendorAuditAction,
  snapshot: VendorAuditSnapshot,
  changedBy: string,
  changedFields?: ChangedFields | null,
): Promise<void> {
  await client.query(
    `
      INSERT INTO vendor_audit_logs
        (vendor_id, action, snapshot, changed_fields, changed_by)
      VALUES
        ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid)
    `,
    [
      vendorId,
      action,
      JSON.stringify(snapshot),
      changedFields && Object.keys(changedFields).length > 0 ? JSON.stringify(changedFields) : null,
      changedBy,
    ],
  );
}

function normalizeOptional(value: string | undefined) {
  return value ?? null;
}

function buildUpdateChangedFields(
  snapshot: VendorAuditSnapshot,
  input: VendorInput,
): ChangedFields {
  const changedFields: ChangedFields = {};
  const nextVendorCode = normalizeOptional(input.vendorCode);
  const nextAvatar = normalizeOptional(input.avatar);
  const nextAlternatePhone = normalizeOptional(input.alternatePhone);
  const nextAddress = normalizeOptional(input.address);

  if ((snapshot.vendorCode ?? null) !== nextVendorCode) {
    changedFields.vendorCode = { from: snapshot.vendorCode, to: nextVendorCode };
  }
  if (snapshot.name !== input.name) changedFields.name = { from: snapshot.name, to: input.name };
  if ((snapshot.avatar ?? null) !== nextAvatar) {
    changedFields.avatar = { from: snapshot.avatar, to: nextAvatar };
  }
  if (snapshot.phone !== input.phone)
    changedFields.phone = { from: snapshot.phone, to: input.phone };
  if ((snapshot.alternatePhone ?? null) !== nextAlternatePhone) {
    changedFields.alternatePhone = { from: snapshot.alternatePhone, to: nextAlternatePhone };
  }
  if ((snapshot.address ?? null) !== nextAddress) {
    changedFields.address = { from: snapshot.address, to: nextAddress };
  }
  if (snapshot.isActive !== input.isActive) {
    changedFields.isActive = { from: snapshot.isActive, to: input.isActive };
  }

  return changedFields;
}

function handleDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("vendors_vendor_code_key") ||
    message.includes("idx_vendors_vendor_code") ||
    message.includes("uq_vendors_code_lower")
  ) {
    throw new VendorMutationError("A vendor with this code already exists.", {
      status: 409,
      fieldErrors: { vendorCode: "This code is already in use." },
    });
  }

  console.error("Vendor mutation failed", error);
  throw new VendorMutationError("Unable to save vendor right now.", { status: 500 });
}

export async function createVendor(
  currentUser: AuthenticatedUser,
  input: VendorInput,
): Promise<{ id: string; redirectTo: string }> {
  assertPermission(currentUser, "vendors:create");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ id: string }>(
      `
        INSERT INTO vendors
          (vendor_code, name, avatar, phone, alternate_phone, address, is_active, created_by, updated_by)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8::uuid, $8::uuid)
        RETURNING id::text AS id
      `,
      [
        normalizeOptional(input.vendorCode),
        input.name,
        normalizeOptional(input.avatar),
        input.phone,
        normalizeOptional(input.alternatePhone),
        normalizeOptional(input.address),
        input.isActive,
        currentUser.userId,
      ],
    );

    const createdId = rows[0]?.id;
    if (!createdId) {
      throw new VendorMutationError("Unable to create vendor right now.", { status: 500 });
    }

    const snapshot = await fetchVendorSnapshotForAudit(client, createdId);
    if (!snapshot) {
      throw new VendorMutationError("Unable to create vendor right now.", { status: 500 });
    }

    await logVendorAudit(client, createdId, "create", snapshot, currentUser.userId);
    await client.query("COMMIT");

    return { id: createdId, redirectTo: "/dashboard/vendors" };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof VendorMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function updateVendor(
  currentUser: AuthenticatedUser,
  vendorId: string,
  input: VendorInput,
): Promise<void> {
  assertPermission(currentUser, "vendors:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchVendorSnapshotForAudit(client, vendorId);
    if (!snapshot) throw new VendorMutationError("Vendor not found.", { status: 404 });

    const changedFields = buildUpdateChangedFields(snapshot, input);

    const { rowCount } = await client.query(
      `
        UPDATE vendors
        SET
          vendor_code = $2,
          name = $3,
          avatar = $4,
          phone = $5,
          alternate_phone = $6,
          address = $7,
          is_active = $8,
          updated_by = $9::uuid
        WHERE id = $1::uuid
      `,
      [
        vendorId,
        normalizeOptional(input.vendorCode),
        input.name,
        normalizeOptional(input.avatar),
        input.phone,
        normalizeOptional(input.alternatePhone),
        normalizeOptional(input.address),
        input.isActive,
        currentUser.userId,
      ],
    );

    if (!rowCount) throw new VendorMutationError("Vendor not found.", { status: 404 });

    await logVendorAudit(client, vendorId, "update", snapshot, currentUser.userId, changedFields);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof VendorMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function deactivateVendor(
  currentUser: AuthenticatedUser,
  vendorId: string,
): Promise<void> {
  assertPermission(currentUser, "vendors:deactivate");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const snapshot = await fetchVendorSnapshotForAudit(client, vendorId);
    if (!snapshot) throw new VendorMutationError("Vendor not found.", { status: 404 });

    await client.query(
      `
        UPDATE vendors
        SET is_active = false, updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [vendorId, currentUser.userId],
    );

    await logVendorAudit(client, vendorId, "deactivate", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: false },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof VendorMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function restoreVendor(
  currentUser: AuthenticatedUser,
  vendorId: string,
): Promise<void> {
  assertPermission(currentUser, "vendors:restore");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchVendorSnapshotForAudit(client, vendorId);
    if (!snapshot) throw new VendorMutationError("Vendor not found.", { status: 404 });

    await client.query(
      `
        UPDATE vendors
        SET is_active = true, updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [vendorId, currentUser.userId],
    );

    await logVendorAudit(client, vendorId, "restore", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: true },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof VendorMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}
