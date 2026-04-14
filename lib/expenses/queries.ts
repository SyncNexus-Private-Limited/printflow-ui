import "server-only";
import type { Pool, PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { expenseTypeQuerySchema } from "@/lib/expenses/schema";
import type {
  ExpenseBranchOption,
  ExpenseCategoryOption,
  ExpenseEmployeeOption,
  ExpenseFormPageData,
  ExpenseOrderOption,
  ExpenseOrderVendorOption,
  ExpenseType,
  ExpenseVendorOption,
} from "@/lib/expenses/types";
import { getPool } from "@/lib/db/postgres";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function getQueryable(db?: Queryable) {
  return db ?? getPool();
}

export function normalizeExpenseSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function coerceExpenseType(value: string | string[] | undefined): ExpenseType {
  const normalizedValue = normalizeExpenseSearchParam(value);
  const parsed = expenseTypeQuerySchema.safeParse(normalizedValue);

  return parsed.success ? parsed.data : "business";
}

export function resolveExpenseType(value: string | string[] | undefined): ExpenseType {
  return expenseTypeQuerySchema.parse(normalizeExpenseSearchParam(value));
}

export async function getExpenseBranchesForUser(currentUser: AuthenticatedUser, db?: Queryable): Promise<ExpenseBranchOption[]> {
  if (currentUser.role !== "admin") {
    return currentUser.branchId
      ? [
          {
            id: currentUser.branchId,
            name: currentUser.branchName ?? "Your branch",
          },
        ]
      : [];
  }

  const { rows } = await getQueryable(db).query<ExpenseBranchOption>(
    `
      SELECT id::text AS id, name
      FROM branches
      WHERE is_active = true
      ORDER BY name ASC
    `,
  );

  return rows;
}

export async function getExpenseCategories(type: ExpenseType, db?: Queryable): Promise<ExpenseCategoryOption[]> {
  const scopes = type === "business" ? ["branch", "both"] : ["employee", "both"];
  const { rows } = await getQueryable(db).query<ExpenseCategoryOption>(
    `
      SELECT
        id::text AS id,
        code,
        name,
        scope::text AS scope
      FROM expense_categories
      WHERE is_active = true
        AND scope = ANY($1::text[])
      ORDER BY sort_order ASC, name ASC
    `,
    [scopes],
  );

  return rows;
}

export async function getExpenseEmployees(branchId: string, db?: Queryable): Promise<ExpenseEmployeeOption[]> {
  const { rows } = await getQueryable(db).query<ExpenseEmployeeOption>(
    `
      SELECT
        id::text AS id,
        full_name AS "fullName",
        role::text AS role
      FROM users
      WHERE branch_id = $1::uuid
        AND is_active = true
      ORDER BY full_name ASC
    `,
    [branchId],
  );

  return rows;
}

export async function getExpenseVendors(branchId: string, db?: Queryable): Promise<ExpenseVendorOption[]> {
  const { rows } = await getQueryable(db).query<ExpenseVendorOption>(
    `
      SELECT DISTINCT
        v.id::text AS id,
        v.name
      FROM vendors v
      WHERE EXISTS (
        SELECT 1
        FROM order_vendors ov
        JOIN orders o ON o.id = ov.order_id
        WHERE ov.vendor_id = v.id
          AND o.branch_id = $1::uuid
      )
      OR EXISTS (
        SELECT 1
        FROM inventory i
        WHERE i.last_vendor_id = v.id
          AND i.branch_id = $1::uuid
      )
      ORDER BY name ASC
    `,
    [branchId],
  );

  return rows;
}

export async function getExpenseOrders(branchId: string, db?: Queryable): Promise<ExpenseOrderOption[]> {
  const { rows } = await getQueryable(db).query<ExpenseOrderOption>(
    `
      SELECT
        o.id::text AS id,
        o.order_code AS "orderCode",
        c.name AS "customerName",
        o.status::text AS status,
        o.order_date::text AS "orderDate"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.branch_id = $1::uuid
        AND o.status <> 'cancelled'
      ORDER BY
        CASE
          WHEN o.status IN ('pending', 'processing') THEN 0
          ELSE 1
        END ASC,
        o.order_date DESC
      LIMIT 25
    `,
    [branchId],
  );

  return rows;
}

export async function getExpenseOrderVendors(branchId: string, db?: Queryable): Promise<ExpenseOrderVendorOption[]> {
  const { rows } = await getQueryable(db).query<ExpenseOrderVendorOption>(
    `
      SELECT
        ov.id::text AS id,
        o.id::text AS "orderId",
        o.order_code AS "orderCode",
        v.id::text AS "vendorId",
        v.name AS "vendorName",
        ov.vendor_paid_amount::double precision AS "vendorPaidAmount",
        o.order_date::text AS "orderDate"
      FROM order_vendors ov
      JOIN orders o ON o.id = ov.order_id
      JOIN vendors v ON v.id = ov.vendor_id
      WHERE o.branch_id = $1::uuid
        AND o.status <> 'cancelled'
      ORDER BY o.order_date DESC, v.name ASC
      LIMIT 25
    `,
    [branchId],
  );

  return rows;
}

export async function getExpenseFormPageData(
  currentUser: AuthenticatedUser,
  branchId: string,
  type: ExpenseType,
  db?: Queryable,
): Promise<ExpenseFormPageData> {
  const [branchOptions, categoryOptions, employees, vendors, orders, orderVendors] = await Promise.all([
    getExpenseBranchesForUser(currentUser, db),
    getExpenseCategories(type, db),
    type === "employee" ? getExpenseEmployees(branchId, db) : Promise.resolve<ExpenseEmployeeOption[]>([]),
    type === "business" ? getExpenseVendors(branchId, db) : Promise.resolve<ExpenseVendorOption[]>([]),
    type === "employee" ? getExpenseOrders(branchId, db) : Promise.resolve<ExpenseOrderOption[]>([]),
    type === "business" ? getExpenseOrderVendors(branchId, db) : Promise.resolve<ExpenseOrderVendorOption[]>([]),
  ]);

  const selectedBranch = branchOptions.find((option) => option.id === branchId);

  return {
    branchOptions,
    selectedBranchId: branchId,
    selectedBranchName: selectedBranch?.name ?? "Selected branch",
    selectedType: type,
    canSelectBranch: currentUser.role === "admin" && branchOptions.length > 1,
    categoryOptions,
    employeeOptions: employees,
    vendorOptions: vendors,
    orderOptions: orders,
    orderVendorOptions: orderVendors,
  };
}
