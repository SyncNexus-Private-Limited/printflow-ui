import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { ExpenseCategoryInput } from "@/lib/expense-categories/schema";

type MutationFieldErrors = Partial<Record<string, string>>;
type ChangedFields = Record<string, { from: unknown; to: unknown }>;
type ExpenseCategoryAuditAction = "create" | "update" | "deactivate" | "restore";

export class ExpenseCategoryMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "ExpenseCategoryMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

export type ExpenseCategoryAuditSnapshot = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: string;
  isActive: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExpenseCategoryAuditSnapshotRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: string;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchExpenseCategorySnapshotForAudit(
  client: PoolClient,
  categoryId: string,
): Promise<ExpenseCategoryAuditSnapshot | null> {
  const { rows } = await client.query<ExpenseCategoryAuditSnapshotRow>(
    `
      SELECT
        ec.id::text AS id,
        ec.code,
        ec.name,
        ec.description,
        ec.scope,
        ec.is_active,
        ec.sort_order,
        ec.created_by::text AS created_by,
        ec.updated_by::text AS updated_by,
        ec.created_at::text AS created_at,
        ec.updated_at::text AS updated_at
      FROM expense_categories ec
      WHERE ec.id = $1::uuid
      FOR UPDATE
      LIMIT 1
    `,
    [categoryId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    scope: row.scope,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function logExpenseCategoryAudit(
  client: PoolClient,
  categoryId: string,
  action: ExpenseCategoryAuditAction,
  snapshot: ExpenseCategoryAuditSnapshot,
  changedBy: string,
  changedFields?: ChangedFields | null,
): Promise<void> {
  await client.query(
    `
      INSERT INTO expense_category_audit_logs
        (expense_category_id, action, snapshot, changed_fields, changed_by)
      VALUES
        ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid)
    `,
    [
      categoryId,
      action,
      JSON.stringify(snapshot),
      changedFields && Object.keys(changedFields).length > 0 ? JSON.stringify(changedFields) : null,
      changedBy,
    ],
  );
}

function parseSortOrder(value: string) {
  return Number.parseInt(value, 10);
}

function buildUpdateChangedFields(
  snapshot: ExpenseCategoryAuditSnapshot,
  input: ExpenseCategoryInput,
): ChangedFields {
  const nextSortOrder = parseSortOrder(input.sortOrder);
  const nextDescription = input.description ?? null;
  const changedFields: ChangedFields = {};

  if (snapshot.code !== input.code) changedFields.code = { from: snapshot.code, to: input.code };
  if (snapshot.name !== input.name) changedFields.name = { from: snapshot.name, to: input.name };
  if ((snapshot.description ?? null) !== nextDescription) {
    changedFields.description = { from: snapshot.description, to: nextDescription };
  }
  if (snapshot.scope !== input.scope)
    changedFields.scope = { from: snapshot.scope, to: input.scope };
  if (snapshot.isActive !== input.isActive) {
    changedFields.isActive = { from: snapshot.isActive, to: input.isActive };
  }
  if (snapshot.sortOrder !== nextSortOrder) {
    changedFields.sortOrder = { from: snapshot.sortOrder, to: nextSortOrder };
  }

  return changedFields;
}

function handleDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("uq_expense_categories_code_lower") ||
    (message.includes("duplicate key value") && message.includes("expense_categories"))
  ) {
    throw new ExpenseCategoryMutationError("An expense category with this code already exists.", {
      status: 409,
      fieldErrors: { code: "This code is already in use." },
    });
  }

  console.error("Expense category mutation failed", error);
  throw new ExpenseCategoryMutationError("Unable to save expense category right now.", {
    status: 500,
  });
}

export async function createExpenseCategory(
  currentUser: AuthenticatedUser,
  input: ExpenseCategoryInput,
): Promise<{ id: string; redirectTo: string }> {
  assertPermission(currentUser, "expense-categories:create");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ id: string }>(
      `
        INSERT INTO expense_categories
          (code, name, description, scope, is_active, sort_order, created_by, updated_by)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7::uuid, $7::uuid)
        RETURNING id::text AS id
      `,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.scope,
        input.isActive,
        parseSortOrder(input.sortOrder),
        currentUser.userId,
      ],
    );

    const createdId = rows[0]?.id;
    if (!createdId) {
      throw new ExpenseCategoryMutationError("Unable to create expense category right now.", {
        status: 500,
      });
    }

    const snapshot = await fetchExpenseCategorySnapshotForAudit(client, createdId);
    if (!snapshot) {
      throw new ExpenseCategoryMutationError("Unable to create expense category right now.", {
        status: 500,
      });
    }

    await logExpenseCategoryAudit(client, createdId, "create", snapshot, currentUser.userId);
    await client.query("COMMIT");

    return { id: createdId, redirectTo: "/dashboard/expenses/categories" };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof ExpenseCategoryMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function updateExpenseCategory(
  currentUser: AuthenticatedUser,
  categoryId: string,
  input: ExpenseCategoryInput,
): Promise<void> {
  assertPermission(currentUser, "expense-categories:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchExpenseCategorySnapshotForAudit(client, categoryId);
    if (!snapshot) {
      throw new ExpenseCategoryMutationError("Expense category not found.", { status: 404 });
    }

    const changedFields = buildUpdateChangedFields(snapshot, input);

    const { rowCount } = await client.query(
      `
        UPDATE expense_categories
        SET
          code = $2,
          name = $3,
          description = $4,
          scope = $5,
          is_active = $6,
          sort_order = $7,
          updated_by = $8::uuid
        WHERE id = $1::uuid
      `,
      [
        categoryId,
        input.code,
        input.name,
        input.description ?? null,
        input.scope,
        input.isActive,
        parseSortOrder(input.sortOrder),
        currentUser.userId,
      ],
    );

    if (!rowCount) {
      throw new ExpenseCategoryMutationError("Expense category not found.", { status: 404 });
    }

    await logExpenseCategoryAudit(
      client,
      categoryId,
      "update",
      snapshot,
      currentUser.userId,
      changedFields,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof ExpenseCategoryMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function deactivateExpenseCategory(
  currentUser: AuthenticatedUser,
  categoryId: string,
): Promise<void> {
  assertPermission(currentUser, "expense-categories:deactivate");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const snapshot = await fetchExpenseCategorySnapshotForAudit(client, categoryId);
    if (!snapshot) {
      throw new ExpenseCategoryMutationError("Expense category not found.", { status: 404 });
    }

    await client.query(
      `
        UPDATE expense_categories
        SET is_active = false, updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [categoryId, currentUser.userId],
    );

    await logExpenseCategoryAudit(client, categoryId, "deactivate", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: false },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof ExpenseCategoryMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}

export async function restoreExpenseCategory(
  currentUser: AuthenticatedUser,
  categoryId: string,
): Promise<void> {
  assertPermission(currentUser, "expense-categories:restore");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchExpenseCategorySnapshotForAudit(client, categoryId);
    if (!snapshot) {
      throw new ExpenseCategoryMutationError("Expense category not found.", { status: 404 });
    }

    await client.query(
      `
        UPDATE expense_categories
        SET is_active = true, updated_by = $2::uuid
        WHERE id = $1::uuid
      `,
      [categoryId, currentUser.userId],
    );

    await logExpenseCategoryAudit(client, categoryId, "restore", snapshot, currentUser.userId, {
      isActive: { from: snapshot.isActive, to: true },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof ExpenseCategoryMutationError) throw error;
    handleDbError(error);
  } finally {
    client.release();
  }
}
