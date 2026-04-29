import "server-only";
import type { Pool, PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { expenseTypeQuerySchema } from "@/lib/expenses/schema";
import type {
  BusinessExpenseDetail,
  EmployeeExpenseDetail,
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

export async function getExpenseBranchesForUser(
  currentUser: AuthenticatedUser,
  db?: Queryable,
): Promise<ExpenseBranchOption[]> {
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

export async function getExpenseCategories(
  type: ExpenseType,
  db?: Queryable,
): Promise<ExpenseCategoryOption[]> {
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

export async function getExpenseEmployees(
  branchId: string | null,
  db?: Queryable,
): Promise<ExpenseEmployeeOption[]> {
  const { rows } = await getQueryable(db).query<ExpenseEmployeeOption>(
    `
      SELECT
        users.id::text AS id,
        users.full_name AS "fullName",
        users.role::text AS role,
        b.name AS "branchName"
      FROM users
      LEFT JOIN branches b ON b.id = users.branch_id
      WHERE ($1::uuid IS NULL OR users.branch_id = $1::uuid)
        AND users.is_active = true
      ORDER BY users.full_name ASC
    `,
    [branchId],
  );

  return rows;
}

export async function getExpenseVendors(
  branchId: string | null,
  db?: Queryable,
): Promise<ExpenseVendorOption[]> {
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
          AND ($1::uuid IS NULL OR o.branch_id = $1::uuid)
      )
      OR EXISTS (
        SELECT 1
        FROM inventory i
        WHERE i.last_vendor_id = v.id
          AND ($1::uuid IS NULL OR i.branch_id = $1::uuid)
      )
      ORDER BY name ASC
    `,
    [branchId],
  );

  return rows;
}

export async function getExpenseOrders(
  branchId: string,
  db?: Queryable,
): Promise<ExpenseOrderOption[]> {
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

export async function getExpenseOrderVendors(
  branchId: string,
  db?: Queryable,
): Promise<ExpenseOrderVendorOption[]> {
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
  const [branchOptions, categoryOptions, employees, vendors, orders, orderVendors] =
    await Promise.all([
      getExpenseBranchesForUser(currentUser, db),
      getExpenseCategories(type, db),
      type === "employee"
        ? getExpenseEmployees(branchId, db)
        : Promise.resolve<ExpenseEmployeeOption[]>([]),
      type === "business"
        ? getExpenseVendors(branchId, db)
        : Promise.resolve<ExpenseVendorOption[]>([]),
      type === "employee"
        ? getExpenseOrders(branchId, db)
        : Promise.resolve<ExpenseOrderOption[]>([]),
      type === "business"
        ? getExpenseOrderVendors(branchId, db)
        : Promise.resolve<ExpenseOrderVendorOption[]>([]),
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

export async function getEmployeeExpenseDetail(
  id: string,
  currentUser: AuthenticatedUser,
  db?: Queryable,
): Promise<EmployeeExpenseDetail | null> {
  const branchId = currentUser.role === "admin" ? null : currentUser.branchId;

  const { rows } = await getQueryable(db).query<EmployeeExpenseDetail>(
    `
      SELECT
        ee.id::text                                             AS id,
        ee.branch_id::text                                      AS "branchId",
        b.name                                                  AS "branchName",
        ee.user_id::text                                        AS "userId",
        u.full_name                                             AS "userName",
        ee.title,
        ee.category_id::text                                    AS "categoryId",
        ec.code                                                 AS "categoryCode",
        ec.name                                                 AS category,
        ee.amount::double precision                             AS amount,
        ee.payment_mode::text                                   AS "paymentMode",
        ee.expense_date::text                                   AS "expenseDate",
        ee.remarks,
        ee.order_id::text                                       AS "orderId",
        ee.created_at::text                                     AS "createdAt",
        creator.full_name                                       AS "createdByName",
        ee.updated_at::text                                     AS "updatedAt",
        updater.full_name                                       AS "updatedByName"
      FROM employee_expenses ee
      JOIN branches b        ON b.id = ee.branch_id
      JOIN users u           ON u.id = ee.user_id
      JOIN expense_categories ec ON ec.id = ee.category_id
      LEFT JOIN users creator  ON creator.id = ee.created_by
      LEFT JOIN users updater  ON updater.id = ee.updated_by
      WHERE ee.id = $1::uuid
        AND ($2::uuid IS NULL OR ee.branch_id = $2::uuid)
      LIMIT 1
    `,
    [id, branchId],
  );

  return rows[0] ?? null;
}

export async function getBusinessExpenseDetail(
  id: string,
  currentUser: AuthenticatedUser,
  db?: Queryable,
): Promise<BusinessExpenseDetail | null> {
  const branchId = currentUser.role === "admin" ? null : currentUser.branchId;

  const { rows } = await getQueryable(db).query<BusinessExpenseDetail>(
    `
      SELECT
        be.id::text                                             AS id,
        be.branch_id::text                                      AS "branchId",
        b.name                                                  AS "branchName",
        be.title,
        be.category_id::text                                    AS "categoryId",
        ec.code                                                 AS "categoryCode",
        ec.name                                                 AS category,
        be.amount::double precision                             AS amount,
        be.payment_mode::text                                   AS "paymentMode",
        be.expense_date::text                                   AS "expenseDate",
        be.remarks,
        be.order_vendor_id::text                                AS "orderVendorId",
        ov.vendor_id::text                                      AS "vendorId",
        v.name                                                  AS "vendorName",
        be.created_at::text                                     AS "createdAt",
        creator.full_name                                       AS "createdByName",
        be.updated_at::text                                     AS "updatedAt",
        updater.full_name                                       AS "updatedByName"
      FROM branch_expenses be
      JOIN branches b              ON b.id = be.branch_id
      JOIN expense_categories ec   ON ec.id = be.category_id
      LEFT JOIN order_vendors ov   ON ov.id = be.order_vendor_id
      LEFT JOIN vendors v          ON v.id = ov.vendor_id
      LEFT JOIN users creator      ON creator.id = be.created_by
      LEFT JOIN users updater      ON updater.id = be.updated_by
      WHERE be.id = $1::uuid
        AND ($2::uuid IS NULL OR be.branch_id = $2::uuid)
      LIMIT 1
    `,
    [id, branchId],
  );

  return rows[0] ?? null;
}
