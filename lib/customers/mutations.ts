import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { CustomerInput } from "@/lib/customers/schema";

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

  return changedFields;
}

function handleDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("customers_customer_code_key") ||
    (message.includes("duplicate key value") && message.includes("customer_code"))
  ) {
    throw new CustomerMutationError("A customer with this code already exists.", {
      status: 409,
      fieldErrors: { customerCode: "This customer code is already in use." },
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
          (type, name, phone, alternate_phone, address, studio_name, customer_code, created_by, updated_by)
        VALUES
          ($1::customer_type, $2, $3, $4, $5, $6, $7, $8::uuid, $8::uuid)
        RETURNING id::text AS id
      `,
      [
        input.type,
        input.name,
        input.phone,
        input.alternatePhone ?? null,
        input.address ?? null,
        input.studioName ?? null,
        input.customerCode ?? null,
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
          updated_by = $9::uuid
        WHERE id = $1::uuid
      `,
      [
        customerId,
        input.type,
        input.name,
        input.phone,
        input.alternatePhone ?? null,
        input.address ?? null,
        input.studioName ?? null,
        input.customerCode ?? null,
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
