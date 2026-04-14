import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { buildBranchHref } from "@/lib/dashboard/helpers";
import type { CreateExpenseInput } from "@/lib/expenses/schema";
import { getExpenseBranchesForUser } from "@/lib/expenses/queries";
import type { CreateExpenseFieldName, CreateExpenseSuccessPayload, ExpenseType } from "@/lib/expenses/types";
import { getPool } from "@/lib/db/postgres";

type MutationFieldErrors = Partial<Record<CreateExpenseFieldName, string>>;

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
  return buildBranchHref(type === "business" ? "/dashboard/business-expenses" : "/dashboard/employee-expenses", branchId);
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

async function assertEmployeeBelongsToBranch(client: PoolClient, employeeId: string, branchId: string) {
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

async function assertOrderBelongsToBranch(client: PoolClient, orderId: string, branchId: string, fieldName: "orderId" | "orderVendorId") {
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

async function getOrderVendorForBranch(client: PoolClient, orderVendorId: string, branchId: string) {
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

export async function createExpense(currentUser: AuthenticatedUser, input: CreateExpenseInput): Promise<CreateExpenseSuccessPayload> {
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
      const orderVendor = await getOrderVendorForBranch(client, input.orderVendorId, selectedBranch.id);

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
