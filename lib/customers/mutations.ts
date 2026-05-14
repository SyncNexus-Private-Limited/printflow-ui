import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { CustomerInput } from "@/lib/customers/schema";
import type { AvatarSource } from "@/lib/customers/types";

type MutationFieldErrors = Partial<Record<string, string>>;
type ChangedFields = Record<string, { from: unknown; to: unknown }>;
type CustomerAuditAction = "create" | "update" | "deactivate" | "restore";

export class CustomerMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "CustomerMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

export type CustomerAuditSnapshot = {
  id: string;
  customerCode: string | null;
  type: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  studioName: string | null;
  /** Stored as "***" in audit logs to avoid persisting the raw Aadhaar number. */
  aadhaarNumber: string | null;
  studioAssociationName: string | null;
  studioAssociationIdNumber: string | null;
  avatar: string | null;
  avatarSource: AvatarSource;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type CustomerAuditSnapshotRow = {
  id: string;
  customer_code: string | null;
  type: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  address: string | null;
  studio_name: string | null;
  aadhaar_number: string | null;
  studio_association_name: string | null;
  studio_association_id_number: string | null;
  avatar: string | null;
  avatar_source: AvatarSource;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchCustomerSnapshotForAudit(
  client: PoolClient,
  customerId: string,
): Promise<CustomerAuditSnapshot | null> {
  const { rows } = await client.query<CustomerAuditSnapshotRow>(
    `
      SELECT
        c.id::text AS id,
        c.customer_code,
        c.type::text AS type,
        c.name,
        c.phone,
        c.alternate_phone,
        c.address,
        c.studio_name,
        c.aadhaar_number,
        c.studio_association_name,
        c.studio_association_id_number,
        c.avatar,
        c.avatar_source,
        c.is_active,
        c.created_by::text AS created_by,
        c.updated_by::text AS updated_by,
        c.created_at::text AS created_at,
        c.updated_at::text AS updated_at
      FROM customers c
      WHERE c.id = $1::uuid
      FOR UPDATE
      LIMIT 1
    `,
    [customerId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    customerCode: row.customer_code,
    type: row.type,
    name: row.name,
    phone: row.phone,
    alternatePhone: row.alternate_phone,
    address: row.address,
    studioName: row.studio_name,
    // Mask Aadhaar in audit snapshot — never persist the raw number in logs.
    aadhaarNumber: row.aadhaar_number ? "***" : null,
    studioAssociationName: row.studio_association_name,
    studioAssociationIdNumber: row.studio_association_id_number,
    avatar: row.avatar,
    avatarSource: row.avatar_source,
    isActive: row.is_active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function logCustomerAudit(
  client: PoolClient,
  customerId: string,
  action: CustomerAuditAction,
  snapshot: CustomerAuditSnapshot,
  changedBy: string,
  changedFields?: ChangedFields | null,
): Promise<void> {
  await client.query(
    `
      INSERT INTO customer_audit_logs
        (customer_id, action, snapshot, changed_fields, changed_by)
      VALUES
        ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid)
    `,
    [
      customerId,
      action,
      JSON.stringify(snapshot),
      changedFields && Object.keys(changedFields).length > 0 ? JSON.stringify(changedFields) : null,
      changedBy,
    ],
  );
}

function buildUpdateChangedFields(
  snapshot: CustomerAuditSnapshot,
  input: CustomerInput,
): ChangedFields {
  const changedFields: ChangedFields = {};
  const nextAlternatePhone = input.alternatePhone ?? null;
  const nextAddress = input.address ?? null;
  const nextStudioName = input.studioName ?? null;
  const nextCustomerCode = input.customerCode ?? null;
  // When blank, the Aadhaar field means "keep existing" (not "clear"), so we
  // only track a change when the user explicitly provided a new value.
  const nextAadhaarMasked = input.aadhaarNumber ? "***" : null;
  const nextStudioAssociationName = input.studioAssociationName ?? null;
  const nextStudioAssociationIdNumber = input.studioAssociationIdNumber ?? null;

  if (snapshot.type !== input.type) changedFields.type = { from: snapshot.type, to: input.type };
  if (snapshot.name !== input.name) changedFields.name = { from: snapshot.name, to: input.name };
  if (snapshot.phone !== input.phone)
    changedFields.phone = { from: snapshot.phone, to: input.phone };
  if ((snapshot.alternatePhone ?? null) !== nextAlternatePhone) {
    changedFields.alternatePhone = { from: snapshot.alternatePhone, to: nextAlternatePhone };
  }
  if ((snapshot.address ?? null) !== nextAddress) {
    changedFields.address = { from: snapshot.address, to: nextAddress };
  }
  if ((snapshot.studioName ?? null) !== nextStudioName) {
    changedFields.studioName = { from: snapshot.studioName, to: nextStudioName };
  }
  if ((snapshot.customerCode ?? null) !== nextCustomerCode) {
    changedFields.customerCode = { from: snapshot.customerCode, to: nextCustomerCode };
  }
  // Only log Aadhaar as changed when the user provided a new value (non-blank).
  // Blank field means "keep existing", so no change is recorded in that case.
  if (input.aadhaarNumber && (snapshot.aadhaarNumber ?? null) !== nextAadhaarMasked) {
    changedFields.aadhaarNumber = { from: snapshot.aadhaarNumber, to: nextAadhaarMasked };
  }
  if ((snapshot.studioAssociationName ?? null) !== nextStudioAssociationName) {
    changedFields.studioAssociationName = {
      from: snapshot.studioAssociationName,
      to: nextStudioAssociationName,
    };
  }
  if ((snapshot.studioAssociationIdNumber ?? null) !== nextStudioAssociationIdNumber) {
    changedFields.studioAssociationIdNumber = {
      from: snapshot.studioAssociationIdNumber,
      to: nextStudioAssociationIdNumber,
    };
  }

  const nextAvatar = input.avatar ?? null;
  const nextAvatarSource: AvatarSource = input.avatarSource ?? "external";
  if ((snapshot.avatar ?? null) !== nextAvatar) {
    changedFields.avatar = { from: snapshot.avatar, to: nextAvatar };
  }
  if (snapshot.avatarSource !== nextAvatarSource) {
    changedFields.avatarSource = { from: snapshot.avatarSource, to: nextAvatarSource };
  }

  return changedFields;
}

function handleDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("customers_customer_code_key") ||
    message.includes("uq_customers_code_lower") ||
    (message.includes("duplicate key value") && message.includes("customer_code"))
  ) {
    throw new CustomerMutationError("A customer with this code already exists.", {
      status: 409,
      fieldErrors: { customerCode: "This customer code is already in use." },
    });
  }

  if (
    message.includes("customers_aadhaar_number_unique") ||
    (message.includes("duplicate key value") && message.includes("aadhaar_number"))
  ) {
    throw new CustomerMutationError("A customer with this Aadhaar number already exists.", {
      status: 409,
      fieldErrors: { aadhaarNumber: "This Aadhaar number is already in use." },
    });
  }

  if (
    message.includes("customers_aadhaar_number_format") ||
    message.includes("violates check constraint")
  ) {
    throw new CustomerMutationError("Invalid Aadhaar number format.", {
      status: 400,
      fieldErrors: { aadhaarNumber: "Aadhaar must be exactly 12 digits." },
    });
  }

  console.error("Customer mutation failed", error);
  throw new CustomerMutationError("Unable to save customer right now.", { status: 500 });
}

export async function createCustomer(
  currentUser: AuthenticatedUser,
  input: CustomerInput,
): Promise<{ id: string; redirectTo: string }> {
  assertPermission(currentUser, "customers:create");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ id: string }>(
      `
        INSERT INTO customers
          (
            type, name, phone, alternate_phone, address, studio_name, customer_code,
            aadhaar_number, studio_association_name, studio_association_id_number,
            avatar, avatar_source,
            created_by, updated_by
          )
        VALUES
          ($1::customer_type, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::uuid, $13::uuid)
        RETURNING id::text AS id
      `,
      [
        input.type,
        input.name,
        input.phone,
        input.alternatePhone ?? null,
        input.address ?? null,
        input.type === "studio" ? (input.studioName ?? null) : null,
        input.customerCode ?? null,
        input.aadhaarNumber ?? null,
        input.type === "studio" ? (input.studioAssociationName ?? null) : null,
        input.type === "studio" ? (input.studioAssociationIdNumber ?? null) : null,
        input.avatar ?? null,
        input.avatarSource ?? "external",
        currentUser.userId,
      ],
    );

    const createdId = rows[0]?.id;
    if (!createdId) {
      throw new CustomerMutationError("Unable to create customer right now.", { status: 500 });
    }

    const snapshot = await fetchCustomerSnapshotForAudit(client, createdId);
    if (!snapshot) {
      throw new CustomerMutationError("Unable to create customer right now.", { status: 500 });
    }

    await logCustomerAudit(client, createdId, "create", snapshot, currentUser.userId);
    await client.query("COMMIT");

    return { id: createdId, redirectTo: "/dashboard/customers" };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof CustomerMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function updateCustomer(
  currentUser: AuthenticatedUser,
  customerId: string,
  input: CustomerInput,
): Promise<void> {
  assertPermission(currentUser, "customers:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchCustomerSnapshotForAudit(client, customerId);
    if (!snapshot) {
      throw new CustomerMutationError("Customer not found.", { status: 404 });
    }

    const changedFields = buildUpdateChangedFields(snapshot, input);

    // aadhaar_number: blank field means "keep existing" — use CASE WHEN.
    // avatar: blank field means "clear" — written directly (null clears it).
    // avatar_source: always "external" for now.
    const { rowCount } = await client.query(
      `
        UPDATE customers
        SET
          type = $2::customer_type,
          name = $3,
          phone = $4,
          alternate_phone = $5,
          address = $6,
          studio_name = $7,
          customer_code = $8,
          aadhaar_number = CASE WHEN $9::text IS NOT NULL THEN $9::text ELSE aadhaar_number END,
          studio_association_name = $10,
          studio_association_id_number = $11,
          avatar = $12,
          avatar_source = $13,
          updated_by = $14::uuid
        WHERE id = $1::uuid
      `,
      [
        customerId,
        input.type,
        input.name,
        input.phone,
        input.alternatePhone ?? null,
        input.address ?? null,
        input.type === "studio" ? (input.studioName ?? null) : null,
        input.customerCode ?? null,
        input.aadhaarNumber ?? null,
        input.type === "studio" ? (input.studioAssociationName ?? null) : null,
        input.type === "studio" ? (input.studioAssociationIdNumber ?? null) : null,
        input.avatar ?? null,
        input.avatarSource ?? "external",
        currentUser.userId,
      ],
    );

    if (!rowCount) {
      throw new CustomerMutationError("Customer not found.", { status: 404 });
    }

    await logCustomerAudit(
      client,
      customerId,
      "update",
      snapshot,
      currentUser.userId,
      changedFields,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof CustomerMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function deactivateCustomer(
  currentUser: AuthenticatedUser,
  customerId: string,
): Promise<void> {
  assertPermission(currentUser, "customers:deactivate");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchCustomerSnapshotForAudit(client, customerId);
    if (!snapshot) {
      throw new CustomerMutationError("Customer not found.", { status: 404 });
    }

    await client.query(
      `UPDATE customers SET is_active = false, updated_by = $2::uuid WHERE id = $1::uuid`,
      [customerId, currentUser.userId],
    );

    await logCustomerAudit(client, customerId, "deactivate", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: false },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof CustomerMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function restoreCustomer(
  currentUser: AuthenticatedUser,
  customerId: string,
): Promise<void> {
  assertPermission(currentUser, "customers:restore");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchCustomerSnapshotForAudit(client, customerId);
    if (!snapshot) {
      throw new CustomerMutationError("Customer not found.", { status: 404 });
    }

    await client.query(
      `UPDATE customers SET is_active = true, updated_by = $2::uuid WHERE id = $1::uuid`,
      [customerId, currentUser.userId],
    );

    await logCustomerAudit(client, customerId, "restore", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: true },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof CustomerMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}
