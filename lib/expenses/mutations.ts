import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { canAccessBranch, hasPermission } from "@/lib/auth/permissions";
import { buildBranchHref } from "@/lib/dashboard/helpers";
import type {
  CreateExpenseInput,
  UpdateBusinessExpenseInput,
  UpdateEmployeeExpenseInput,
} from "@/lib/expenses/schema";
import { getExpenseBranchesForUser } from "@/lib/expenses/queries";
import type {
  CreateExpenseFieldName,
  CreateExpenseSuccessPayload,
  ExpenseType,
} from "@/lib/expenses/types";
import { getPool } from "@/lib/db/postgres";

type MutationFieldErrors = Partial<Record<string, string>>;

type ExpenseCategoryLookupRow = {
  id: string;
};

type ExpenseOrderLookupRow = {
  id: string;
};

type ExpenseOrderVendorLookupRow = {
  id: string;
  vendorId: string;
};

type ExpenseVendorLookupRow = {
  id: string;
};

type ExpenseRecordInsertRow = {
  id: string;
};

export class ExpenseMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "ExpenseMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

function getExpenseRedirectTarget(type: ExpenseType, branchId: string) {
  return buildBranchHref(
    type === "business" ? "/dashboard/business-expenses" : "/dashboard/employee-expenses",
    branchId,
  );
}

function parseExpenseAmount(value: string) {
  return Number.parseFloat(value);
}

function normalizeRemarks(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

async function assertCategoryIsAllowed(client: PoolClient, input: CreateExpenseInput) {
  const allowedScopes = input.type === "business" ? ["branch", "both"] : ["employee", "both"];
  const { rows } = await client.query<ExpenseCategoryLookupRow>(
    `
      SELECT id::text AS id
      FROM expense_categories
      WHERE id = $1::uuid
        AND is_active = true
        AND scope = ANY($2::text[])
      LIMIT 1
    `,
    [input.categoryId, allowedScopes],
  );

  if (!rows[0]) {
    throw new ExpenseMutationError("Select a valid expense category.", {
      status: 400,
      fieldErrors: {
        categoryId: "Select a valid expense category.",
      },
    });
  }
}

async function assertEmployeeBelongsToBranch(
  client: PoolClient,
  employeeId: string,
  branchId: string,
) {
  const { rows } = await client.query<ExpenseOrderLookupRow>(
    `
      SELECT id::text AS id
      FROM users
      WHERE id = $1::uuid
        AND branch_id = $2::uuid
        AND is_active = true
      LIMIT 1
    `,
    [employeeId, branchId],
  );

  if (!rows[0]) {
    throw new ExpenseMutationError("Select a valid employee for this branch.", {
      status: 400,
      fieldErrors: {
        employeeId: "Select a valid employee for this branch.",
      },
    });
  }
}

async function assertOrderBelongsToBranch(
  client: PoolClient,
  orderId: string,
  branchId: string,
  fieldName: "orderId" | "orderVendorId",
) {
  const { rows } = await client.query<ExpenseOrderLookupRow>(
    `
      SELECT id::text AS id
      FROM orders
      WHERE id = $1::uuid
        AND branch_id = $2::uuid
        AND status <> 'cancelled'
      LIMIT 1
    `,
    [orderId, branchId],
  );

  if (!rows[0]) {
    const message =
      fieldName === "orderVendorId"
        ? "Select a valid linked order vendor for this branch."
        : "Select a valid linked order for this branch.";

    throw new ExpenseMutationError(message, {
      status: 400,
      fieldErrors: {
        [fieldName]: message,
      },
    });
  }
}

async function assertVendorBelongsToBranch(client: PoolClient, vendorId: string, branchId: string) {
  const { rows } = await client.query<ExpenseVendorLookupRow>(
    `
      SELECT v.id::text AS id
      FROM vendors v
      WHERE v.id = $1::uuid
        AND (
          EXISTS (
            SELECT 1
            FROM order_vendors ov
            JOIN orders o ON o.id = ov.order_id
            WHERE ov.vendor_id = v.id
              AND o.branch_id = $2::uuid
          )
          OR EXISTS (
            SELECT 1
            FROM inventory i
            WHERE i.last_vendor_id = v.id
              AND i.branch_id = $2::uuid
          )
        )
      LIMIT 1
    `,
    [vendorId, branchId],
  );

  if (!rows[0]) {
    throw new ExpenseMutationError("Select a valid vendor for this branch.", {
      status: 400,
      fieldErrors: {
        vendorId: "Select a valid vendor for this branch.",
      },
    });
  }
}

async function getOrderVendorForBranch(
  client: PoolClient,
  orderVendorId: string,
  branchId: string,
) {
  const { rows } = await client.query<ExpenseOrderVendorLookupRow>(
    `
      SELECT
        ov.id::text AS id,
        ov.vendor_id::text AS "vendorId"
      FROM order_vendors ov
      JOIN orders o ON o.id = ov.order_id
      WHERE ov.id = $1::uuid
        AND o.branch_id = $2::uuid
        AND o.status <> 'cancelled'
      LIMIT 1
    `,
    [orderVendorId, branchId],
  );

  if (!rows[0]) {
    throw new ExpenseMutationError("Select a valid linked order vendor for this branch.", {
      status: 400,
      fieldErrors: {
        orderVendorId: "Select a valid linked order vendor for this branch.",
      },
    });
  }

  return rows[0];
}

export async function createExpense(
  currentUser: AuthenticatedUser,
  input: CreateExpenseInput,
): Promise<CreateExpenseSuccessPayload> {
  if (!hasPermission(currentUser, "expenses:create")) {
    throw new ExpenseMutationError("You do not have permission to create expenses.", {
      status: 403,
    });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const availableBranches = await getExpenseBranchesForUser(currentUser, client);
    const selectedBranch = availableBranches.find((branch) => branch.id === input.branchId);

    if (!selectedBranch) {
      throw new ExpenseMutationError("You cannot create expenses for this branch.", {
        status: 403,
        fieldErrors: {
          branchId: "You cannot create expenses for this branch.",
        },
      });
    }

    await assertCategoryIsAllowed(client, input);

    if (input.type === "employee") {
      await assertEmployeeBelongsToBranch(client, input.employeeId, selectedBranch.id);

      if (input.orderId) {
        await assertOrderBelongsToBranch(client, input.orderId, selectedBranch.id, "orderId");
      }

      const { rows } = await client.query<ExpenseRecordInsertRow>(
        `
          INSERT INTO employee_expenses (
            user_id,
            branch_id,
            title,
            amount,
            category_id,
            order_id,
            expense_date,
            payment_mode,
            remarks,
            created_by,
            updated_by
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3,
            $4::numeric(14,2),
            $5::uuid,
            $6::uuid,
            $7::date,
            $8::payment_mode,
            $9,
            $10::uuid,
            $10::uuid
          )
          RETURNING id::text AS id
        `,
        [
          input.employeeId,
          selectedBranch.id,
          input.title,
          parseExpenseAmount(input.amount),
          input.categoryId,
          input.orderId ?? null,
          input.expenseDate,
          input.paymentMode,
          normalizeRemarks(input.remarks),
          currentUser.userId,
        ],
      );

      await client.query("COMMIT");

      return {
        id: rows[0].id,
        type: input.type,
        redirectTo: getExpenseRedirectTarget(input.type, selectedBranch.id),
      };
    }

    if (input.vendorId) {
      await assertVendorBelongsToBranch(client, input.vendorId, selectedBranch.id);
    }

    let orderVendorId: string | null = null;

    if (input.orderVendorId) {
      const orderVendor = await getOrderVendorForBranch(
        client,
        input.orderVendorId,
        selectedBranch.id,
      );

      if (input.vendorId && orderVendor.vendorId !== input.vendorId) {
        throw new ExpenseMutationError("Linked order vendor must match the selected vendor.", {
          status: 400,
          fieldErrors: {
            orderVendorId: "Linked order vendor must match the selected vendor.",
          },
        });
      }

      orderVendorId = orderVendor.id;
    }

    const { rows } = await client.query<ExpenseRecordInsertRow>(
      `
        INSERT INTO branch_expenses (
          branch_id,
          title,
          amount,
          category_id,
          expense_date,
          remarks,
          payment_mode,
          order_vendor_id,
          created_by,
          updated_by
        )
        VALUES (
          $1::uuid,
          $2,
          $3::numeric(14,2),
          $4::uuid,
          $5::date,
          $6,
          $7::payment_mode,
          $8::uuid,
          $9::uuid,
          $9::uuid
        )
        RETURNING id::text AS id
      `,
      [
        selectedBranch.id,
        input.title,
        parseExpenseAmount(input.amount),
        input.categoryId,
        input.expenseDate,
        normalizeRemarks(input.remarks),
        input.paymentMode,
        orderVendorId,
        currentUser.userId,
      ],
    );

    await client.query("COMMIT");

    return {
      id: rows[0].id,
      type: input.type,
      redirectTo: getExpenseRedirectTarget(input.type, selectedBranch.id),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------- Employee expense update ----------

type ExistingEmployeeExpenseRow = {
  id: string;
  branch_id: string;
  user_id: string;
  title: string;
  category_id: string;
  amount: string;
  payment_mode: string;
  expense_date: string;
  remarks: string | null;
  order_id: string | null;
};

const FETCH_EXISTING_SQL = `
  SELECT
    ee.id::text             AS id,
    ee.branch_id::text      AS branch_id,
    ee.user_id::text        AS user_id,
    ee.title,
    ee.category_id::text    AS category_id,
    ee.amount::text         AS amount,
    ee.payment_mode::text   AS payment_mode,
    ee.expense_date::text   AS expense_date,
    ee.remarks,
    ee.order_id::text       AS order_id
  FROM employee_expenses ee
  WHERE ee.id = $1::uuid
  FOR UPDATE
`;

function buildExpenseSnapshot(row: ExistingEmployeeExpenseRow) {
  return {
    id: row.id,
    branchId: row.branch_id,
    userId: row.user_id,
    title: row.title,
    categoryId: row.category_id,
    amount: row.amount,
    paymentMode: row.payment_mode,
    expenseDate: row.expense_date,
    remarks: row.remarks,
    orderId: row.order_id,
  };
}

export async function updateEmployeeExpense(
  currentUser: AuthenticatedUser,
  expenseId: string,
  input: UpdateEmployeeExpenseInput,
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Fetch + lock
    const { rows: existingRows } = await client.query<ExistingEmployeeExpenseRow>(
      FETCH_EXISTING_SQL,
      [expenseId],
    );

    const existing = existingRows[0];

    if (!existing) {
      throw new ExpenseMutationError("Expense not found.", { status: 404 });
    }

    // 2. Permission + branch scope check (separate concerns — see lib/auth/permissions.ts)
    if (!hasPermission(currentUser, "expenses:edit")) {
      throw new ExpenseMutationError("You do not have permission to edit expenses.", {
        status: 403,
      });
    }
    if (!canAccessBranch(currentUser, existing.branch_id)) {
      throw new ExpenseMutationError("You cannot edit this expense.", { status: 403 });
    }

    // 3. Category scope check (employee-only)
    const { rows: catRows } = await client.query(
      `SELECT id FROM expense_categories
       WHERE id = $1::uuid AND is_active = true AND scope = ANY($2::text[]) LIMIT 1`,
      [input.categoryId, ["employee", "both"]],
    );

    if (!catRows[0]) {
      throw new ExpenseMutationError("Select a valid expense category.", {
        status: 400,
        fieldErrors: { categoryId: "Select a valid expense category." },
      });
    }

    // 4. Employee belongs to branch
    const { rows: empRows } = await client.query(
      `SELECT id FROM users
       WHERE id = $1::uuid AND branch_id = $2::uuid AND is_active = true LIMIT 1`,
      [input.employeeId, existing.branch_id],
    );

    if (!empRows[0]) {
      throw new ExpenseMutationError("Select a valid employee for this branch.", {
        status: 400,
        fieldErrors: { employeeId: "Select a valid employee for this branch." },
      });
    }

    // 5. Order belongs to branch (if provided)
    if (input.orderId) {
      const { rows: orderRows } = await client.query(
        `SELECT id FROM orders
         WHERE id = $1::uuid AND branch_id = $2::uuid AND status <> 'cancelled' LIMIT 1`,
        [input.orderId, existing.branch_id],
      );

      if (!orderRows[0]) {
        throw new ExpenseMutationError("Select a valid linked order for this branch.", {
          status: 400,
          fieldErrors: { orderId: "Select a valid linked order for this branch." },
        });
      }
    }

    // 6. Compute changed_fields (before-vs-after)
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    const newRemarks = normalizeRemarks(input.remarks);

    if (existing.title !== input.title)
      changedFields.title = { from: existing.title, to: input.title };
    if (existing.category_id !== input.categoryId)
      changedFields.categoryId = { from: existing.category_id, to: input.categoryId };
    if (existing.payment_mode !== input.paymentMode)
      changedFields.paymentMode = { from: existing.payment_mode, to: input.paymentMode };
    if (existing.expense_date !== input.expenseDate)
      changedFields.expenseDate = { from: existing.expense_date, to: input.expenseDate };
    if ((existing.remarks ?? null) !== (newRemarks ?? null))
      changedFields.remarks = { from: existing.remarks, to: newRemarks };
    if (existing.user_id !== input.employeeId)
      changedFields.employeeId = { from: existing.user_id, to: input.employeeId };
    if ((existing.order_id ?? null) !== (input.orderId ?? null))
      changedFields.orderId = { from: existing.order_id, to: input.orderId ?? null };

    // 7. Audit log (snapshot = before-state)
    await client.query(
      `INSERT INTO employee_expense_audit_logs
         (expense_id, action, snapshot, changed_fields, changed_by)
       VALUES ($1::uuid, 'update', $2::jsonb, $3::jsonb, $4::uuid)`,
      [
        expenseId,
        JSON.stringify(buildExpenseSnapshot(existing)),
        Object.keys(changedFields).length > 0 ? JSON.stringify(changedFields) : null,
        currentUser.userId,
      ],
    );

    // 8. Update live row (updated_at handled by trigger)
    await client.query(
      `UPDATE employee_expenses SET
         title        = $1,
         category_id  = $2::uuid,
         amount       = $3::numeric(14,2),
         payment_mode = $4::payment_mode,
         expense_date = $5::date,
         remarks      = $6,
         user_id      = $7::uuid,
         order_id     = $8::uuid,
         updated_by   = $9::uuid
       WHERE id = $10::uuid`,
      [
        input.title,
        input.categoryId,
        parseExpenseAmount(input.amount),
        input.paymentMode,
        input.expenseDate,
        newRemarks,
        input.employeeId,
        input.orderId ?? null,
        currentUser.userId,
        expenseId,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------- Employee expense delete ----------

export async function deleteEmployeeExpense(
  currentUser: AuthenticatedUser,
  expenseId: string,
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Fetch + lock
    const { rows: existingRows } = await client.query<ExistingEmployeeExpenseRow>(
      FETCH_EXISTING_SQL,
      [expenseId],
    );

    const existing = existingRows[0];

    if (!existing) {
      throw new ExpenseMutationError("Expense not found.", { status: 404 });
    }

    // 2. Permission + branch scope check (separate concerns — see lib/auth/permissions.ts)
    if (!hasPermission(currentUser, "expenses:delete")) {
      throw new ExpenseMutationError("You do not have permission to delete expenses.", {
        status: 403,
      });
    }
    if (!canAccessBranch(currentUser, existing.branch_id)) {
      throw new ExpenseMutationError("You cannot delete this expense.", { status: 403 });
    }

    // 3. Audit log (snapshot = full before-state)
    await client.query(
      `INSERT INTO employee_expense_audit_logs
         (expense_id, action, snapshot, changed_fields, changed_by)
       VALUES ($1::uuid, 'delete', $2::jsonb, NULL, $3::uuid)`,
      [expenseId, JSON.stringify(buildExpenseSnapshot(existing)), currentUser.userId],
    );

    // 4. Delete live row
    await client.query(`DELETE FROM employee_expenses WHERE id = $1::uuid`, [expenseId]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------- Business expense update ----------

type ExistingBusinessExpenseRow = {
  id: string;
  branch_id: string;
  title: string | null;
  category_id: string;
  amount: string;
  payment_mode: string;
  expense_date: string;
  remarks: string | null;
  order_vendor_id: string | null;
};

const FETCH_EXISTING_BUSINESS_SQL = `
  SELECT
    be.id::text                 AS id,
    be.branch_id::text          AS branch_id,
    be.title,
    be.category_id::text        AS category_id,
    be.amount::text             AS amount,
    be.payment_mode::text       AS payment_mode,
    be.expense_date::text       AS expense_date,
    be.remarks,
    be.order_vendor_id::text    AS order_vendor_id
  FROM branch_expenses be
  WHERE be.id = $1::uuid
  FOR UPDATE
`;

function buildBusinessExpenseSnapshot(row: ExistingBusinessExpenseRow) {
  return {
    id: row.id,
    branchId: row.branch_id,
    title: row.title,
    categoryId: row.category_id,
    amount: row.amount,
    paymentMode: row.payment_mode,
    expenseDate: row.expense_date,
    remarks: row.remarks,
    orderVendorId: row.order_vendor_id,
  };
}

export async function updateBusinessExpense(
  currentUser: AuthenticatedUser,
  expenseId: string,
  input: UpdateBusinessExpenseInput,
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Fetch + lock
    const { rows: existingRows } = await client.query<ExistingBusinessExpenseRow>(
      FETCH_EXISTING_BUSINESS_SQL,
      [expenseId],
    );

    const existing = existingRows[0];

    if (!existing) {
      throw new ExpenseMutationError("Expense not found.", { status: 404 });
    }

    // 2. Permission + branch scope check (separate concerns — see lib/auth/permissions.ts)
    if (!hasPermission(currentUser, "expenses:edit")) {
      throw new ExpenseMutationError("You do not have permission to edit expenses.", {
        status: 403,
      });
    }
    if (!canAccessBranch(currentUser, existing.branch_id)) {
      throw new ExpenseMutationError("You cannot edit this expense.", { status: 403 });
    }

    // 3. Category scope check (business = branch/both)
    const { rows: catRows } = await client.query(
      `SELECT id FROM expense_categories
       WHERE id = $1::uuid AND is_active = true AND scope = ANY($2::text[]) LIMIT 1`,
      [input.categoryId, ["branch", "both"]],
    );

    if (!catRows[0]) {
      throw new ExpenseMutationError("Select a valid expense category.", {
        status: 400,
        fieldErrors: { categoryId: "Select a valid expense category." },
      });
    }

    // 4. Vendor belongs to branch (if provided)
    if (input.vendorId) {
      await assertVendorBelongsToBranch(client, input.vendorId, existing.branch_id);
    }

    // 5. OrderVendor validation + cross-check (if provided)
    let resolvedOrderVendorId: string | null = null;

    if (input.orderVendorId) {
      const orderVendor = await getOrderVendorForBranch(
        client,
        input.orderVendorId,
        existing.branch_id,
      );

      if (input.vendorId && orderVendor.vendorId !== input.vendorId) {
        throw new ExpenseMutationError("Linked order vendor must match the selected vendor.", {
          status: 400,
          fieldErrors: { orderVendorId: "Linked order vendor must match the selected vendor." },
        });
      }

      resolvedOrderVendorId = orderVendor.id;
    }

    // 6. Compute changed_fields (before-vs-after)
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    const newRemarks = normalizeRemarks(input.remarks);

    if (existing.title !== input.title)
      changedFields.title = { from: existing.title, to: input.title };
    if (existing.category_id !== input.categoryId)
      changedFields.categoryId = { from: existing.category_id, to: input.categoryId };
    if (existing.payment_mode !== input.paymentMode)
      changedFields.paymentMode = { from: existing.payment_mode, to: input.paymentMode };
    if (existing.expense_date !== input.expenseDate)
      changedFields.expenseDate = { from: existing.expense_date, to: input.expenseDate };
    if ((existing.remarks ?? null) !== (newRemarks ?? null))
      changedFields.remarks = { from: existing.remarks, to: newRemarks };
    if ((existing.order_vendor_id ?? null) !== (resolvedOrderVendorId ?? null))
      changedFields.orderVendorId = { from: existing.order_vendor_id, to: resolvedOrderVendorId };

    // 7. Audit log (snapshot = before-state)
    await client.query(
      `INSERT INTO business_expense_audit_logs
         (expense_id, action, snapshot, changed_fields, changed_by)
       VALUES ($1::uuid, 'update', $2::jsonb, $3::jsonb, $4::uuid)`,
      [
        expenseId,
        JSON.stringify(buildBusinessExpenseSnapshot(existing)),
        Object.keys(changedFields).length > 0 ? JSON.stringify(changedFields) : null,
        currentUser.userId,
      ],
    );

    // 8. Update live row (updated_at handled by trigger)
    await client.query(
      `UPDATE branch_expenses SET
         title           = $1,
         category_id     = $2::uuid,
         amount          = $3::numeric(14,2),
         payment_mode    = $4::payment_mode,
         expense_date    = $5::date,
         remarks         = $6,
         order_vendor_id = $7::uuid,
         updated_by      = $8::uuid
       WHERE id = $9::uuid`,
      [
        input.title,
        input.categoryId,
        parseExpenseAmount(input.amount),
        input.paymentMode,
        input.expenseDate,
        newRemarks,
        resolvedOrderVendorId,
        currentUser.userId,
        expenseId,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------- Business expense delete ----------

export async function deleteBusinessExpense(
  currentUser: AuthenticatedUser,
  expenseId: string,
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Fetch + lock
    const { rows: existingRows } = await client.query<ExistingBusinessExpenseRow>(
      FETCH_EXISTING_BUSINESS_SQL,
      [expenseId],
    );

    const existing = existingRows[0];

    if (!existing) {
      throw new ExpenseMutationError("Expense not found.", { status: 404 });
    }

    // 2. Permission + branch scope check (separate concerns — see lib/auth/permissions.ts)
    if (!hasPermission(currentUser, "expenses:delete")) {
      throw new ExpenseMutationError("You do not have permission to delete expenses.", {
        status: 403,
      });
    }
    if (!canAccessBranch(currentUser, existing.branch_id)) {
      throw new ExpenseMutationError("You cannot delete this expense.", { status: 403 });
    }

    // 3. Audit log (snapshot = full before-state)
    await client.query(
      `INSERT INTO business_expense_audit_logs
         (expense_id, action, snapshot, changed_fields, changed_by)
       VALUES ($1::uuid, 'delete', $2::jsonb, NULL, $3::uuid)`,
      [expenseId, JSON.stringify(buildBusinessExpenseSnapshot(existing)), currentUser.userId],
    );

    // 4. Delete live row
    await client.query(`DELETE FROM branch_expenses WHERE id = $1::uuid`, [expenseId]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
