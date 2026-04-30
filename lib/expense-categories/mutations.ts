import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { ExpenseCategoryInput } from "@/lib/expense-categories/schema";

type MutationFieldErrors = Partial<Record<string, string>>;

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

type CategorySnapshot = {
  id: string;
  isActive: boolean;
};

async function getCategorySnapshot(
  client: PoolClient,
  categoryId: string,
): Promise<CategorySnapshot | null> {
  const { rows } = await client.query<CategorySnapshot>(
    `
      SELECT id::text AS id, is_active AS "isActive"
      FROM expense_categories
      WHERE id = $1::uuid
      FOR UPDATE
      LIMIT 1
    `,
    [categoryId],
  );

  return rows[0] ?? null;
}

function parseSortOrder(value: string) {
  return Number.parseInt(value, 10);
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

  try {
    const { rows } = await db.query<{ id: string }>(
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

    return { id: createdId, redirectTo: "/dashboard/expenses/categories" };
  } catch (error) {
    if (error instanceof ExpenseCategoryMutationError) throw error;
    handleDbError(error);
  }
}

export async function updateExpenseCategory(
  currentUser: AuthenticatedUser,
  categoryId: string,
  input: ExpenseCategoryInput,
): Promise<void> {
  assertPermission(currentUser, "expense-categories:edit");

  const db = getPool();

  try {
    const { rowCount } = await db.query(
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
  } catch (error) {
    if (error instanceof ExpenseCategoryMutationError) throw error;
    handleDbError(error);
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
    const snapshot = await getCategorySnapshot(client, categoryId);
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
  const { rowCount } = await db.query(
    `
      UPDATE expense_categories
      SET is_active = true, updated_by = $2::uuid
      WHERE id = $1::uuid
    `,
    [categoryId, currentUser.userId],
  );

  if (!rowCount) {
    throw new ExpenseCategoryMutationError("Expense category not found.", { status: 404 });
  }
}
