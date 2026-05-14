import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { BranchInput } from "@/lib/branches/schema";

type MutationFieldErrors = Partial<Record<string, string>>;
type ChangedFields = Record<string, { from: unknown; to: unknown }>;
type BranchAuditAction = "create" | "update" | "deactivate" | "restore";

export class BranchMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "BranchMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

export type BranchAuditSnapshot = {
  id: string;
  code: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  logo: string | null;
  banner: string | null;
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type BranchAuditSnapshotRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  address: string | null;
  logo: string | null;
  banner: string | null;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchBranchSnapshotForAudit(
  client: PoolClient,
  branchId: string,
): Promise<BranchAuditSnapshot | null> {
  const { rows } = await client.query<BranchAuditSnapshotRow>(
    `
      SELECT
        b.id::text AS id,
        b.code,
        b.name,
        b.phone,
        b.alternate_phone,
        b.email,
        b.address,
        b.logo,
        b.banner,
        b.description,
        b.is_active,
        b.created_by::text AS created_by,
        b.updated_by::text AS updated_by,
        b.created_at::text AS created_at,
        b.updated_at::text AS updated_at
      FROM branches b
      WHERE b.id = $1::uuid
      FOR UPDATE
      LIMIT 1
    `,
    [branchId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    alternatePhone: row.alternate_phone,
    email: row.email,
    address: row.address,
    logo: row.logo,
    banner: row.banner,
    description: row.description,
    isActive: row.is_active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function logBranchAudit(
  client: PoolClient,
  branchId: string,
  action: BranchAuditAction,
  snapshot: BranchAuditSnapshot,
  changedBy: string,
  changedFields?: ChangedFields | null,
): Promise<void> {
  await client.query(
    `
      INSERT INTO branch_audit_logs
        (branch_id, action, snapshot, changed_fields, changed_by)
      VALUES
        ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid)
    `,
    [
      branchId,
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
  snapshot: BranchAuditSnapshot,
  input: BranchInput,
): ChangedFields {
  const changedFields: ChangedFields = {};
  const optionalFields = [
    "alternatePhone",
    "email",
    "address",
    "logo",
    "banner",
    "description",
  ] as const;

  if (snapshot.code !== input.code) changedFields.code = { from: snapshot.code, to: input.code };
  if (snapshot.name !== input.name) changedFields.name = { from: snapshot.name, to: input.name };
  if (snapshot.phone !== input.phone)
    changedFields.phone = { from: snapshot.phone, to: input.phone };

  for (const field of optionalFields) {
    const nextValue = normalizeOptional(input[field]);
    if ((snapshot[field] ?? null) !== nextValue) {
      changedFields[field] = { from: snapshot[field], to: nextValue };
    }
  }

  if (snapshot.isActive !== input.isActive) {
    changedFields.isActive = { from: snapshot.isActive, to: input.isActive };
  }

  return changedFields;
}

function handleDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("branches_code_key") ||
    message.includes("idx_branches_code") ||
    message.includes("uq_branches_code_lower")
  ) {
    throw new BranchMutationError("A branch with this code already exists.", {
      status: 409,
      fieldErrors: { code: "This code is already in use." },
    });
  }

  console.error("Branch mutation failed", error);
  throw new BranchMutationError("Unable to save branch right now.", { status: 500 });
}

export async function createBranch(
  currentUser: AuthenticatedUser,
  input: BranchInput,
): Promise<{ id: string; redirectTo: string }> {
  assertPermission(currentUser, "branches:create");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ id: string }>(
      `
        INSERT INTO branches
          (code, name, phone, alternate_phone, email, address, logo, banner, description, is_active, created_by, updated_by)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid, $11::uuid)
        RETURNING id::text AS id
      `,
      [
        input.code,
        input.name,
        input.phone,
        normalizeOptional(input.alternatePhone),
        normalizeOptional(input.email),
        normalizeOptional(input.address),
        normalizeOptional(input.logo),
        normalizeOptional(input.banner),
        normalizeOptional(input.description),
        input.isActive,
        currentUser.userId,
      ],
    );

    const createdId = rows[0]?.id;
    if (!createdId) {
      throw new BranchMutationError("Unable to create branch right now.", { status: 500 });
    }

    const snapshot = await fetchBranchSnapshotForAudit(client, createdId);
    if (!snapshot) {
      throw new BranchMutationError("Unable to create branch right now.", { status: 500 });
    }

    await logBranchAudit(client, createdId, "create", snapshot, currentUser.userId);
    await client.query("COMMIT");

    return { id: createdId, redirectTo: "/dashboard/branches" };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof BranchMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function updateBranch(
  currentUser: AuthenticatedUser,
  branchId: string,
  input: BranchInput,
): Promise<void> {
  assertPermission(currentUser, "branches:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchBranchSnapshotForAudit(client, branchId);
    if (!snapshot) throw new BranchMutationError("Branch not found.", { status: 404 });

    const changedFields = buildUpdateChangedFields(snapshot, input);

    const { rowCount } = await client.query(
      `
        UPDATE branches
        SET
          code = $2,
          name = $3,
          phone = $4,
          alternate_phone = $5,
          email = $6,
          address = $7,
          logo = $8,
          banner = $9,
          description = $10,
          is_active = $11,
          updated_by = $12::uuid
        WHERE id = $1::uuid
      `,
      [
        branchId,
        input.code,
        input.name,
        input.phone,
        normalizeOptional(input.alternatePhone),
        normalizeOptional(input.email),
        normalizeOptional(input.address),
        normalizeOptional(input.logo),
        normalizeOptional(input.banner),
        normalizeOptional(input.description),
        input.isActive,
        currentUser.userId,
      ],
    );

    if (!rowCount) throw new BranchMutationError("Branch not found.", { status: 404 });

    await logBranchAudit(client, branchId, "update", snapshot, currentUser.userId, changedFields);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof BranchMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function deactivateBranch(
  currentUser: AuthenticatedUser,
  branchId: string,
): Promise<void> {
  assertPermission(currentUser, "branches:deactivate");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const snapshot = await fetchBranchSnapshotForAudit(client, branchId);
    if (!snapshot) throw new BranchMutationError("Branch not found.", { status: 404 });

    await client.query(
      `
        UPDATE branches
        SET is_active = false, updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [branchId, currentUser.userId],
    );

    await logBranchAudit(client, branchId, "deactivate", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: false },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof BranchMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function restoreBranch(
  currentUser: AuthenticatedUser,
  branchId: string,
): Promise<void> {
  assertPermission(currentUser, "branches:restore");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchBranchSnapshotForAudit(client, branchId);
    if (!snapshot) throw new BranchMutationError("Branch not found.", { status: 404 });

    await client.query(
      `
        UPDATE branches
        SET is_active = true, updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [branchId, currentUser.userId],
    );

    await logBranchAudit(client, branchId, "restore", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: true },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof BranchMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}
