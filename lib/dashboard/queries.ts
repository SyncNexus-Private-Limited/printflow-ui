import "server-only";
import { getActiveUserWindowMinutes } from "@/lib/auth/session";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { getPool } from "@/lib/db/postgres";
import type { ExpensePageFilterState } from "@/lib/dashboard/expense-page-filters";
import type { OrderPageFilterState } from "@/lib/dashboard/order-page-filters";
import {
  type ActiveUserRow,
  type BranchFilterState,
  type BranchOption,
  type BusinessExpenseDetailRow,
  type BusinessExpensesPageData,
  type CustomerDetailRow,
  type CustomersPageData,
  type CustomersPageSummary,
  type DashboardSummary,
  type DashboardDateRange,
  type DashboardPageFilterState,
  type EmployeeExpenseDetailRow,
  type EmployeeExpensesPageData,
  type ExpenseRangeSummary,
  type InventoryDetailRow,
  type LowStockRow,
  type OrderCustomerOption,
  type OrderCreatorOption,
  type OrderDetailRow,
  type OrderFilterOptions,
  type OrderInventoryOption,
  type OrderOfferItemOption,
  type OrdersPageData,
  type OrdersPageSummary,
  type OrdersSummary,
  type OrderVendorOption,
  type RecentExpenseRow,
  type RecentOrderRow,
} from "@/lib/dashboard/types";
import { branchFilterSchema } from "@/lib/validations/dashboard";

const NO_BRANCH_SCOPE_ID = "00000000-0000-0000-0000-000000000000";

function normalizeBranchSearchParam(branchId: string | string[] | undefined) {
  if (Array.isArray(branchId)) {
    return branchId[0];
  }

  return branchId;
}

export async function getDashboardContext(
  currentUser: AuthenticatedUser,
  requestedBranchId: string | string[] | undefined,
): Promise<BranchFilterState> {
  const isAdmin = currentUser.role === "admin";

  if (!isAdmin) {
    return {
      branches: currentUser.branchId
        ? [
            {
              id: currentUser.branchId,
              name: currentUser.branchName ?? "Your branch",
            },
          ]
        : [],
      selectedBranchId: currentUser.branchId ?? NO_BRANCH_SCOPE_ID,
      selectedBranchValue: currentUser.branchId ?? "all",
      selectedBranchName: currentUser.branchName ?? "No branch assigned",
      isAdmin: false,
      canSelectAll: false,
    };
  }

  const db = getPool();
  const { rows } = await db.query<BranchOption>(
    `
      SELECT id::text AS id, name
      FROM branches
      WHERE is_active = true
      ORDER BY name ASC
    `,
  );
  const normalizedBranchId = normalizeBranchSearchParam(requestedBranchId);
  const parsed = branchFilterSchema.safeParse({
    branchId: normalizedBranchId,
  });
  const branchId = parsed.success ? parsed.data.branchId : undefined;

  if (branchId && branchId !== "all") {
    const selectedBranch = rows.find((branch) => branch.id === branchId);

    if (selectedBranch) {
      return {
        branches: rows,
        selectedBranchId: selectedBranch.id,
        selectedBranchValue: selectedBranch.id,
        selectedBranchName: selectedBranch.name,
        isAdmin: true,
        canSelectAll: true,
      };
    }
  }

  return {
    branches: rows,
    selectedBranchId: null,
    selectedBranchValue: "all",
    selectedBranchName: "All branches",
    isAdmin: true,
    canSelectAll: true,
  };
}

type DashboardSummaryRow = {
  ordersTotalOrders: number;
  ordersPendingOrders: number;
  ordersCompletedOrders: number;
  ordersTotalPayableAmount: number;
  customersTotalCustomers: number;
  customersNewCustomersThisMonth: number;
  inventoryTotalInventoryItems: number;
  inventoryLowStockItems: number;
  inventoryTotalStockQuantity: number;
  activeUsersCurrentActiveUsers: number;
  activeUsersTotalActiveStaffAccounts: number;
  employeeExpensesTotalAmountThisMonth: number;
  employeeExpensesEntryCountThisMonth: number;
  businessExpensesTotalAmountThisMonth: number;
  businessExpensesEntryCountThisMonth: number;
};

export async function getDashboardSummary(branchId: string | null): Promise<DashboardSummary> {
  const db = getPool();
  const activeWindowMinutes = getActiveUserWindowMinutes();
  const { rows } = await db.query<DashboardSummaryRow>(
    `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM orders o
          WHERE ($1::uuid IS NULL OR o.branch_id = $1::uuid)
        ) AS "ordersTotalOrders",
        (
          SELECT COUNT(*) FILTER (WHERE o.status = 'pending')::int
          FROM orders o
          WHERE ($1::uuid IS NULL OR o.branch_id = $1::uuid)
        ) AS "ordersPendingOrders",
        (
          SELECT COUNT(*) FILTER (WHERE o.status = 'completed')::int
          FROM orders o
          WHERE ($1::uuid IS NULL OR o.branch_id = $1::uuid)
        ) AS "ordersCompletedOrders",
        (
          SELECT COALESCE(SUM(o.payable_amount), 0)::double precision
          FROM orders o
          WHERE ($1::uuid IS NULL OR o.branch_id = $1::uuid)
        ) AS "ordersTotalPayableAmount",
        (
          SELECT COUNT(*)::int
          FROM customers c
          WHERE (
            $1::uuid IS NULL
            OR EXISTS (
              SELECT 1
              FROM orders o
              WHERE o.customer_id = c.id
                AND o.branch_id = $1::uuid
            )
          )
        ) AS "customersTotalCustomers",
        (
          SELECT COUNT(*) FILTER (WHERE c.created_at >= date_trunc('month', now()))::int
          FROM customers c
          WHERE (
            $1::uuid IS NULL
            OR EXISTS (
              SELECT 1
              FROM orders o
              WHERE o.customer_id = c.id
                AND o.branch_id = $1::uuid
            )
          )
        ) AS "customersNewCustomersThisMonth",
        (
          SELECT COUNT(*)::int
          FROM inventory i
          WHERE ($1::uuid IS NULL OR i.branch_id = $1::uuid)
        ) AS "inventoryTotalInventoryItems",
        (
          SELECT COUNT(*) FILTER (WHERE i.quantity <= 10)::int
          FROM inventory i
          WHERE ($1::uuid IS NULL OR i.branch_id = $1::uuid)
        ) AS "inventoryLowStockItems",
        (
          SELECT COALESCE(SUM(i.quantity), 0)::double precision
          FROM inventory i
          WHERE ($1::uuid IS NULL OR i.branch_id = $1::uuid)
        ) AS "inventoryTotalStockQuantity",
        (
          SELECT COUNT(DISTINCT s.user_id)::int
          FROM app_sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.is_revoked = false
            AND s.expires_at > now()
            AND s.last_seen_at >= now() - make_interval(mins => $2::int)
            AND u.is_active = true
            AND ($1::uuid IS NULL OR COALESCE(s.branch_id, u.branch_id) = $1::uuid)
        ) AS "activeUsersCurrentActiveUsers",
        (
          SELECT COUNT(*)::int
          FROM users u
          WHERE u.is_active = true
            AND ($1::uuid IS NULL OR u.branch_id = $1::uuid)
        ) AS "activeUsersTotalActiveStaffAccounts",
        (
          SELECT COALESCE(SUM(ee.amount), 0)::double precision
          FROM employee_expenses ee
          WHERE ee.expense_date >= date_trunc('month', CURRENT_DATE)::date
            AND ee.expense_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
            AND ($1::uuid IS NULL OR ee.branch_id = $1::uuid)
        ) AS "employeeExpensesTotalAmountThisMonth",
        (
          SELECT COUNT(*)::int
          FROM employee_expenses ee
          WHERE ee.expense_date >= date_trunc('month', CURRENT_DATE)::date
            AND ee.expense_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
            AND ($1::uuid IS NULL OR ee.branch_id = $1::uuid)
        ) AS "employeeExpensesEntryCountThisMonth",
        (
          SELECT COALESCE(SUM(be.amount), 0)::double precision
          FROM branch_expenses be
          WHERE be.expense_date >= date_trunc('month', CURRENT_DATE)::date
            AND be.expense_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
            AND ($1::uuid IS NULL OR be.branch_id = $1::uuid)
        ) AS "businessExpensesTotalAmountThisMonth",
        (
          SELECT COUNT(*)::int
          FROM branch_expenses be
          WHERE be.expense_date >= date_trunc('month', CURRENT_DATE)::date
            AND be.expense_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
            AND ($1::uuid IS NULL OR be.branch_id = $1::uuid)
        ) AS "businessExpensesEntryCountThisMonth"
    `,
    [branchId, activeWindowMinutes],
  );
  const row = rows[0];

  return {
    orders: {
      totalOrders: row.ordersTotalOrders,
      pendingOrders: row.ordersPendingOrders,
      completedOrders: row.ordersCompletedOrders,
      totalPayableAmount: row.ordersTotalPayableAmount,
    },
    customers: {
      totalCustomers: row.customersTotalCustomers,
      newCustomersThisMonth: row.customersNewCustomersThisMonth,
    },
    inventory: {
      totalInventoryItems: row.inventoryTotalInventoryItems,
      lowStockItems: row.inventoryLowStockItems,
      totalStockQuantity: row.inventoryTotalStockQuantity,
    },
    activeUsers: {
      currentActiveUsers: row.activeUsersCurrentActiveUsers,
      totalActiveStaffAccounts: row.activeUsersTotalActiveStaffAccounts,
    },
    employeeExpenses: {
      totalAmountThisMonth: row.employeeExpensesTotalAmountThisMonth,
      entryCountThisMonth: row.employeeExpensesEntryCountThisMonth,
    },
    businessExpenses: {
      totalAmountThisMonth: row.businessExpensesTotalAmountThisMonth,
      entryCountThisMonth: row.businessExpensesEntryCountThisMonth,
    },
  };
}

type DashboardDateFilterClause = {
  clause: string;
  values: string[];
  nextParameterIndex: number;
};

function buildDashboardDateFilterClause(
  columnExpression: string,
  dateRange: DashboardDateRange,
  startingParameterIndex: number,
): DashboardDateFilterClause {
  const filters: string[] = [];
  const values: string[] = [];
  let parameterIndex = startingParameterIndex;

  if (dateRange.from) {
    filters.push(`${columnExpression} >= $${parameterIndex}::date`);
    values.push(dateRange.from);
    parameterIndex += 1;
  }

  if (dateRange.to) {
    filters.push(`${columnExpression} <= $${parameterIndex}::date`);
    values.push(dateRange.to);
    parameterIndex += 1;
  }

  return {
    clause: filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "",
    values,
    nextParameterIndex: parameterIndex,
  };
}

function buildPaginationState(totalItems: number, filters: DashboardPageFilterState) {
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);

  return {
    page,
    pageSize: filters.pageSize,
    totalItems,
    totalPages,
  };
}

type ExpenseQueryParts = {
  joins: string;
  whereClause: string;
  values: Array<number | string | null>;
  orderByClause: string;
};

function getExpenseDateColumnExpression(alias: string, filters: ExpensePageFilterState) {
  return filters.dateField === "logged" ? `${alias}.created_at::date` : `${alias}.expense_date`;
}

function getEmployeeExpensesOrderByClause(filters: ExpensePageFilterState) {
  switch (filters.sort) {
    case "expense-date-asc":
      return "ee.expense_date ASC, ee.created_at ASC";
    case "logged-date-desc":
      return "ee.created_at DESC, ee.expense_date DESC";
    case "logged-date-asc":
      return "ee.created_at ASC, ee.expense_date ASC";
    case "amount-desc":
      return "ee.amount DESC, ee.expense_date DESC, ee.created_at DESC";
    case "amount-asc":
      return "ee.amount ASC, ee.expense_date DESC, ee.created_at DESC";
    case "category-asc":
      return "LOWER(ec.name) ASC, ee.expense_date DESC, ee.created_at DESC";
    case "category-desc":
      return "LOWER(ec.name) DESC, ee.expense_date DESC, ee.created_at DESC";
    case "payment-asc":
      return "LOWER(ee.payment_mode::text) ASC, ee.expense_date DESC, ee.created_at DESC";
    case "payment-desc":
      return "LOWER(ee.payment_mode::text) DESC, ee.expense_date DESC, ee.created_at DESC";
    case "title-asc":
      return "LOWER(ee.title) ASC, ee.expense_date DESC, ee.created_at DESC";
    case "title-desc":
      return "LOWER(ee.title) DESC, ee.expense_date DESC, ee.created_at DESC";
    case "employee-asc":
      return "LOWER(u.full_name) ASC, ee.expense_date DESC, ee.created_at DESC";
    case "employee-desc":
      return "LOWER(u.full_name) DESC, ee.expense_date DESC, ee.created_at DESC";
    case "expense-date-desc":
    case "vendor-asc":
    case "vendor-desc":
    default:
      return "ee.expense_date DESC, ee.created_at DESC";
  }
}

function getBusinessExpensesOrderByClause(filters: ExpensePageFilterState) {
  switch (filters.sort) {
    case "expense-date-asc":
      return "be.expense_date ASC, be.created_at ASC";
    case "logged-date-desc":
      return "be.created_at DESC, be.expense_date DESC";
    case "logged-date-asc":
      return "be.created_at ASC, be.expense_date ASC";
    case "amount-desc":
      return "be.amount DESC, be.expense_date DESC, be.created_at DESC";
    case "amount-asc":
      return "be.amount ASC, be.expense_date DESC, be.created_at DESC";
    case "category-asc":
      return "LOWER(ec.name) ASC, be.expense_date DESC, be.created_at DESC";
    case "category-desc":
      return "LOWER(ec.name) DESC, be.expense_date DESC, be.created_at DESC";
    case "payment-asc":
      return "LOWER(be.payment_mode::text) ASC, be.expense_date DESC, be.created_at DESC";
    case "payment-desc":
      return "LOWER(be.payment_mode::text) DESC, be.expense_date DESC, be.created_at DESC";
    case "title-asc":
      return "LOWER(COALESCE(be.title, '')) ASC, be.expense_date DESC, be.created_at DESC";
    case "title-desc":
      return "LOWER(COALESCE(be.title, '')) DESC, be.expense_date DESC, be.created_at DESC";
    case "vendor-asc":
      return "CASE WHEN v.name IS NULL THEN 1 ELSE 0 END ASC, LOWER(v.name) ASC, be.expense_date DESC, be.created_at DESC";
    case "vendor-desc":
      return "CASE WHEN v.name IS NULL THEN 1 ELSE 0 END ASC, LOWER(v.name) DESC, be.expense_date DESC, be.created_at DESC";
    case "expense-date-desc":
    case "employee-asc":
    case "employee-desc":
    default:
      return "be.expense_date DESC, be.created_at DESC";
  }
}

function buildEmployeeExpensesQueryParts(branchId: string | null, filters: ExpensePageFilterState): ExpenseQueryParts {
  const values: Array<number | string | null> = [branchId];
  const whereParts = ["($1::uuid IS NULL OR ee.branch_id = $1::uuid)"];
  const joins = ["JOIN users u ON u.id = ee.user_id", "JOIN expense_categories ec ON ec.id = ee.category_id"];
  const dateColumnExpression = getExpenseDateColumnExpression("ee", filters);

  if (filters.from) {
    values.push(filters.from);
    whereParts.push(`${dateColumnExpression} >= $${values.length}::date`);
  }

  if (filters.to) {
    values.push(filters.to);
    whereParts.push(`${dateColumnExpression} <= $${values.length}::date`);
  }

  if (filters.categoryId) {
    values.push(filters.categoryId);
    whereParts.push(`ee.category_id = $${values.length}::uuid`);
  }

  if (filters.paymentMode) {
    values.push(filters.paymentMode);
    whereParts.push(`ee.payment_mode::text = $${values.length}`);
  }

  if (filters.amountMin) {
    values.push(filters.amountMin);
    whereParts.push(`ee.amount >= $${values.length}::numeric`);
  }

  if (filters.amountMax) {
    values.push(filters.amountMax);
    whereParts.push(`ee.amount <= $${values.length}::numeric`);
  }

  if (filters.remarks === "with") {
    whereParts.push("NULLIF(BTRIM(COALESCE(ee.remarks, '')), '') IS NOT NULL");
  }

  if (filters.remarks === "without") {
    whereParts.push("NULLIF(BTRIM(COALESCE(ee.remarks, '')), '') IS NULL");
  }

  if (filters.employeeId) {
    values.push(filters.employeeId);
    whereParts.push(`ee.user_id = $${values.length}::uuid`);
  }

  return {
    joins: joins.join("\n      "),
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getEmployeeExpensesOrderByClause(filters),
  };
}

function buildBusinessExpensesQueryParts(branchId: string | null, filters: ExpensePageFilterState): ExpenseQueryParts {
  const values: Array<number | string | null> = [branchId];
  const whereParts = ["($1::uuid IS NULL OR be.branch_id = $1::uuid)"];
  const joins = [
    "JOIN expense_categories ec ON ec.id = be.category_id",
    "LEFT JOIN branches b ON b.id = be.branch_id",
    "LEFT JOIN order_vendors ov ON ov.id = be.order_vendor_id",
    "LEFT JOIN vendors v ON v.id = ov.vendor_id",
  ];
  const dateColumnExpression = getExpenseDateColumnExpression("be", filters);

  if (filters.from) {
    values.push(filters.from);
    whereParts.push(`${dateColumnExpression} >= $${values.length}::date`);
  }

  if (filters.to) {
    values.push(filters.to);
    whereParts.push(`${dateColumnExpression} <= $${values.length}::date`);
  }

  if (filters.categoryId) {
    values.push(filters.categoryId);
    whereParts.push(`be.category_id = $${values.length}::uuid`);
  }

  if (filters.paymentMode) {
    values.push(filters.paymentMode);
    whereParts.push(`be.payment_mode::text = $${values.length}`);
  }

  if (filters.amountMin) {
    values.push(filters.amountMin);
    whereParts.push(`be.amount >= $${values.length}::numeric`);
  }

  if (filters.amountMax) {
    values.push(filters.amountMax);
    whereParts.push(`be.amount <= $${values.length}::numeric`);
  }

  if (filters.remarks === "with") {
    whereParts.push("NULLIF(BTRIM(COALESCE(be.remarks, '')), '') IS NOT NULL");
  }

  if (filters.remarks === "without") {
    whereParts.push("NULLIF(BTRIM(COALESCE(be.remarks, '')), '') IS NULL");
  }

  if (filters.vendorId) {
    values.push(filters.vendorId);
    whereParts.push(`v.id = $${values.length}::uuid`);
  }

  return {
    joins: joins.join("\n      "),
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getBusinessExpensesOrderByClause(filters),
  };
}

type OrderQueryParts = {
  joins: string;
  whereClause: string;
  values: Array<number | string | null>;
  orderByClause: string;
};

function getOrdersOrderByClause(filters: OrderPageFilterState): string {
  switch (filters.sort) {
    case "order-date-asc":
      return "o.order_date ASC, o.created_at ASC";
    case "created-at-desc":
      return "o.created_at DESC, o.order_date DESC";
    case "created-at-asc":
      return "o.created_at ASC, o.order_date ASC";
    case "order-code-asc":
      return "LOWER(o.order_code) ASC, o.order_date DESC, o.created_at DESC";
    case "order-code-desc":
      return "LOWER(o.order_code) DESC, o.order_date DESC, o.created_at DESC";
    case "payable-desc":
      return "o.payable_amount DESC, o.order_date DESC, o.created_at DESC";
    case "payable-asc":
      return "o.payable_amount ASC, o.order_date DESC, o.created_at DESC";
    case "paid-desc":
      return "o.paid_amount DESC, o.order_date DESC, o.created_at DESC";
    case "paid-asc":
      return "o.paid_amount ASC, o.order_date DESC, o.created_at DESC";
    case "outstanding-desc":
      return "(o.payable_amount - o.paid_amount) DESC, o.order_date DESC, o.created_at DESC";
    case "outstanding-asc":
      return "(o.payable_amount - o.paid_amount) ASC, o.order_date DESC, o.created_at DESC";
    case "customer-asc":
      return "LOWER(c.name) ASC, o.order_date DESC, o.created_at DESC";
    case "customer-desc":
      return "LOWER(c.name) DESC, o.order_date DESC, o.created_at DESC";
    case "status-asc":
      return "LOWER(o.status::text) ASC, o.order_date DESC, o.created_at DESC";
    case "status-desc":
      return "LOWER(o.status::text) DESC, o.order_date DESC, o.created_at DESC";
    case "payment-status-asc":
      return "LOWER(o.payment_status::text) ASC, o.order_date DESC, o.created_at DESC";
    case "payment-status-desc":
      return "LOWER(o.payment_status::text) DESC, o.order_date DESC, o.created_at DESC";
    case "order-date-desc":
    default:
      return "o.order_date DESC, o.created_at DESC";
  }
}

function buildOrdersQueryParts(
  branchId: string | null,
  filters: OrderPageFilterState,
): OrderQueryParts {
  const values: Array<number | string | null> = [branchId];
  const whereParts = ["($1::uuid IS NULL OR o.branch_id = $1::uuid)"];
  const joins = [
    "JOIN customers c ON c.id = o.customer_id",
    "LEFT JOIN users u ON u.id = o.created_by",
    "LEFT JOIN branches b ON b.id = o.branch_id",
  ];

  const dateColExpression =
    filters.dateField === "created" ? "o.created_at::date" : "o.order_date::date";

  if (filters.from) {
    values.push(filters.from);
    whereParts.push(`${dateColExpression} >= $${values.length}::date`);
  }

  if (filters.to) {
    values.push(filters.to);
    whereParts.push(`${dateColExpression} <= $${values.length}::date`);
  }

  if (filters.status) {
    values.push(filters.status);
    whereParts.push(`o.status::text = $${values.length}`);
  }

  if (filters.paymentStatus) {
    values.push(filters.paymentStatus);
    whereParts.push(`o.payment_status::text = $${values.length}`);
  }

  if (filters.customerId) {
    values.push(filters.customerId);
    whereParts.push(`o.customer_id = $${values.length}::uuid`);
  }

  if (filters.createdBy) {
    values.push(filters.createdBy);
    whereParts.push(`o.created_by = $${values.length}::uuid`);
  }

  if (filters.orderCode) {
    values.push(filters.orderCode);
    whereParts.push(`o.order_code ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.paymentMode) {
    values.push(filters.paymentMode);
    whereParts.push(
      `EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.mode::text = $${values.length})`,
    );
  }

  if (filters.vendorId) {
    values.push(filters.vendorId);
    whereParts.push(
      `EXISTS (SELECT 1 FROM order_vendors ov WHERE ov.order_id = o.id AND ov.vendor_id = $${values.length}::uuid)`,
    );
  }

  if (filters.inventoryId) {
    values.push(filters.inventoryId);
    whereParts.push(
      `EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.inventory_id = $${values.length}::uuid)`,
    );
  }

  if (filters.offerItemId) {
    values.push(filters.offerItemId);
    whereParts.push(
      `EXISTS (SELECT 1 FROM order_offer_items ooi WHERE ooi.order_id = o.id AND ooi.offer_item_id = $${values.length}::uuid)`,
    );
  }

  if (filters.txnReference) {
    values.push(filters.txnReference);
    whereParts.push(
      `EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.txn_reference ILIKE '%' || $${values.length} || '%')`,
    );
  }

  if (filters.payableMin) {
    values.push(filters.payableMin);
    whereParts.push(`o.payable_amount >= $${values.length}::numeric`);
  }

  if (filters.payableMax) {
    values.push(filters.payableMax);
    whereParts.push(`o.payable_amount <= $${values.length}::numeric`);
  }

  if (filters.paidMin) {
    values.push(filters.paidMin);
    whereParts.push(`o.paid_amount >= $${values.length}::numeric`);
  }

  if (filters.paidMax) {
    values.push(filters.paidMax);
    whereParts.push(`o.paid_amount <= $${values.length}::numeric`);
  }

  if (filters.outstandingMin) {
    values.push(filters.outstandingMin);
    whereParts.push(`(o.payable_amount - o.paid_amount) >= $${values.length}::numeric`);
  }

  if (filters.outstandingMax) {
    values.push(filters.outstandingMax);
    whereParts.push(`(o.payable_amount - o.paid_amount) <= $${values.length}::numeric`);
  }

  return {
    joins: joins.join("\n      "),
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getOrdersOrderByClause(filters),
  };
}

export async function getOrdersPageData(
  branchId: string | null,
  filters: OrderPageFilterState,
): Promise<OrdersPageData> {
  const db = getPool();
  const queryParts = buildOrdersQueryParts(branchId, filters);

  const { rows: summaryRows } = await db.query<OrdersPageSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalOrders",
        COUNT(*) FILTER (WHERE o.status::text = 'pending')::int AS "pendingOrders",
        COUNT(*) FILTER (WHERE o.status::text = 'completed')::int AS "completedOrders",
        COALESCE(SUM(o.payable_amount), 0)::double precision AS "totalPayableAmount",
        COALESCE(SUM(o.paid_amount), 0)::double precision AS "totalPaidAmount",
        COALESCE(SUM(o.payable_amount - o.paid_amount), 0)::double precision AS "totalOutstandingAmount"
      FROM orders o
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );
  const summary = summaryRows[0];
  const pagination = buildPaginationState(summary.totalOrders, filters);
  const listQueryParams = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitParameterIndex = queryParts.values.length + 1;
  const offsetParameterIndex = queryParts.values.length + 2;

  const { rows } = await db.query<OrderDetailRow>(
    `
      SELECT
        o.id::text AS id,
        o.order_code AS "orderCode",
        c.name AS "customerName",
        o.status::text AS status,
        o.payable_amount::double precision AS "payableAmount",
        o.paid_amount::double precision AS "paidAmount",
        o.payment_status::text AS "paymentStatus",
        o.order_date::text AS "orderDate",
        (o.payable_amount - o.paid_amount)::double precision AS "outstandingAmount",
        o.created_at::text AS "createdAt",
        b.name AS "branchName",
        u.full_name AS "createdByName",
        (
          SELECT STRING_AGG(DISTINCT p.mode::text, ', ' ORDER BY p.mode::text)
          FROM payments p
          WHERE p.order_id = o.id
        ) AS "paymentModeSummary",
        (
          SELECT COUNT(*)::int
          FROM order_vendors ov
          WHERE ov.order_id = o.id
        ) AS "vendorCount",
        (
          (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) +
          (SELECT COUNT(*)::int FROM order_offer_items ooi WHERE ooi.order_id = o.id)
        ) AS "itemCount"
      FROM orders o
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
      ORDER BY ${queryParts.orderByClause}
      LIMIT $${limitParameterIndex}
      OFFSET $${offsetParameterIndex}
    `,
    listQueryParams,
  );

  return {
    summary,
    result: {
      items: rows,
      pagination,
    },
  };
}

export async function getOrderFilterOptions(branchId: string | null): Promise<OrderFilterOptions> {
  const db = getPool();

  const [customersResult, creatorsResult, vendorsResult, inventoryResult, offerItemsResult] =
    await Promise.all([
      db.query<OrderCustomerOption>(
        `
          SELECT c.id::text AS id, c.name
          FROM customers c
          WHERE (
            $1::uuid IS NULL
            OR EXISTS (
              SELECT 1 FROM orders o
              WHERE o.customer_id = c.id AND o.branch_id = $1::uuid
            )
          )
          ORDER BY c.name ASC
        `,
        [branchId],
      ),
      db.query<OrderCreatorOption>(
        `
          SELECT DISTINCT u.id::text AS id, u.full_name AS "fullName", b.name AS "branchName"
          FROM users u
          LEFT JOIN branches b ON b.id = u.branch_id
          WHERE EXISTS (
            SELECT 1 FROM orders o
            WHERE o.created_by = u.id
              AND ($1::uuid IS NULL OR o.branch_id = $1::uuid)
          )
          ORDER BY u.full_name ASC
        `,
        [branchId],
      ),
      db.query<OrderVendorOption>(
        `
          SELECT DISTINCT v.id::text AS id, v.name
          FROM vendors v
          WHERE EXISTS (
            SELECT 1 FROM order_vendors ov
            JOIN orders o ON o.id = ov.order_id
            WHERE ov.vendor_id = v.id
              AND ($1::uuid IS NULL OR o.branch_id = $1::uuid)
          )
          ORDER BY v.name ASC
        `,
        [branchId],
      ),
      db.query<OrderInventoryOption>(
        `
          SELECT DISTINCT i.id::text AS id, i.name, i.sku
          FROM inventory i
          WHERE EXISTS (
            SELECT 1 FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.inventory_id = i.id
              AND ($1::uuid IS NULL OR o.branch_id = $1::uuid)
          )
          ORDER BY i.name ASC
        `,
        [branchId],
      ),
      db.query<OrderOfferItemOption>(
        `
          SELECT id::text AS id, item_name AS "itemName"
          FROM offer_items
          WHERE ($1::uuid IS NULL OR branch_id = $1::uuid)
            AND is_active = true
          ORDER BY item_name ASC
        `,
        [branchId],
      ),
    ]);

  return {
    customers: customersResult.rows,
    creators: creatorsResult.rows,
    vendors: vendorsResult.rows,
    inventoryItems: inventoryResult.rows,
    offerItems: offerItemsResult.rows,
  };
}

export async function getCustomersPageData(
  branchId: string | null,
  filters: DashboardPageFilterState,
): Promise<CustomersPageData> {
  const db = getPool();
  const dateRange = {
    from: filters.from,
    to: filters.to,
  };
  const summaryDateFilter = buildDashboardDateFilterClause("c.created_at::date", dateRange, 2);
  const { rows: summaryRows } = await db.query<CustomersPageSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalCustomersInRange",
        COUNT(*) FILTER (WHERE LOWER(c.type::text) = 'studio')::int AS "studioCustomersInRange"
      FROM customers c
      WHERE (
        $1::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.customer_id = c.id
            AND o.branch_id = $1::uuid
        )
      )
      ${summaryDateFilter.clause}
    `,
    [branchId, ...summaryDateFilter.values],
  );
  const summary = summaryRows[0];
  const pagination = buildPaginationState(summary.totalCustomersInRange, filters);
  const listDateFilter = buildDashboardDateFilterClause("c.created_at::date", dateRange, 2);
  const listQueryParams = [
    branchId,
    ...listDateFilter.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitParameterIndex = listDateFilter.nextParameterIndex;
  const offsetParameterIndex = listDateFilter.nextParameterIndex + 1;
  const { rows } = await db.query<CustomerDetailRow>(
    `
      SELECT
        c.id::text AS id,
        c.name,
        c.phone,
        c.type::text AS type,
        c.studio_name AS "studioName",
        c.created_at::text AS "createdAt"
      FROM customers c
      WHERE (
        $1::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.customer_id = c.id
            AND o.branch_id = $1::uuid
        )
      )
      ${listDateFilter.clause}
      ORDER BY c.created_at DESC, c.name ASC
      LIMIT $${limitParameterIndex}
      OFFSET $${offsetParameterIndex}
    `,
    listQueryParams,
  );

  return {
    summary,
    result: {
      items: rows,
      pagination,
    },
  };
}

export async function getEmployeeExpensesPageData(
  branchId: string | null,
  filters: ExpensePageFilterState,
): Promise<EmployeeExpensesPageData> {
  const db = getPool();
  const queryParts = buildEmployeeExpensesQueryParts(branchId, filters);
  const { rows: summaryRows } = await db.query<ExpenseRangeSummary>(
    `
      SELECT
        COALESCE(SUM(ee.amount), 0)::double precision AS "totalAmountInRange",
        COUNT(*)::int AS "entryCountInRange"
      FROM employee_expenses ee
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );
  const summary = summaryRows[0];
  const pagination = buildPaginationState(summary.entryCountInRange, filters);
  const listQueryParams = [...queryParts.values, pagination.pageSize, (pagination.page - 1) * pagination.pageSize];
  const limitParameterIndex = queryParts.values.length + 1;
  const offsetParameterIndex = queryParts.values.length + 2;
  const { rows } = await db.query<EmployeeExpenseDetailRow>(
    `
      SELECT
        ee.id::text AS id,
        u.full_name AS "userName",
        ee.title,
        ec.id::text AS "categoryId",
        ec.code AS "categoryCode",
        ec.name AS category,
        ec.scope AS "categoryScope",
        ee.amount::double precision AS amount,
        ee.payment_mode::text AS "paymentMode",
        ee.remarks,
        ee.expense_date::text AS "expenseDate",
        ee.created_at::text AS "createdAt"
      FROM employee_expenses ee
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
      ORDER BY ${queryParts.orderByClause}
      LIMIT $${limitParameterIndex}
      OFFSET $${offsetParameterIndex}
    `,
    listQueryParams,
  );

  return {
    summary,
    result: {
      items: rows,
      pagination,
    },
  };
}

export async function getBusinessExpensesPageData(
  branchId: string | null,
  filters: ExpensePageFilterState,
): Promise<BusinessExpensesPageData> {
  const db = getPool();
  const queryParts = buildBusinessExpensesQueryParts(branchId, filters);
  const { rows: summaryRows } = await db.query<ExpenseRangeSummary>(
    `
      SELECT
        COALESCE(SUM(be.amount), 0)::double precision AS "totalAmountInRange",
        COUNT(*)::int AS "entryCountInRange"
      FROM branch_expenses be
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );
  const summary = summaryRows[0];
  const pagination = buildPaginationState(summary.entryCountInRange, filters);
  const listQueryParams = [...queryParts.values, pagination.pageSize, (pagination.page - 1) * pagination.pageSize];
  const limitParameterIndex = queryParts.values.length + 1;
  const offsetParameterIndex = queryParts.values.length + 2;
  const { rows } = await db.query<BusinessExpenseDetailRow>(
    `
      SELECT
        be.id::text AS id,
        be.title,
        ec.id::text AS "categoryId",
        ec.code AS "categoryCode",
        ec.name AS category,
        ec.scope AS "categoryScope",
        be.amount::double precision AS amount,
        be.payment_mode::text AS "paymentMode",
        be.remarks,
        be.expense_date::text AS "expenseDate",
        be.created_at::text AS "createdAt",
        b.name AS "branchName"
      FROM branch_expenses be
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
      ORDER BY ${queryParts.orderByClause}
      LIMIT $${limitParameterIndex}
      OFFSET $${offsetParameterIndex}
    `,
    listQueryParams,
  );

  return {
    summary,
    result: {
      items: rows,
      pagination,
    },
  };
}

export async function getRecentOrders(branchId: string | null) {
  const db = getPool();
  const { rows } = await db.query<RecentOrderRow>(
    `
      SELECT
        o.id::text AS id,
        o.order_code AS "orderCode",
        c.name AS "customerName",
        o.status::text AS status,
        o.payable_amount::double precision AS "payableAmount",
        o.order_date::text AS "orderDate"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE ($1::uuid IS NULL OR o.branch_id = $1::uuid)
      ORDER BY o.order_date DESC
      LIMIT 5
    `,
    [branchId],
  );

  return rows;
}

export async function getLowStockItems(branchId: string | null) {
  const db = getPool();
  const { rows } = await db.query<LowStockRow>(
    `
      SELECT
        i.id::text AS id,
        i.name,
        i.sku,
        i.quantity::double precision AS quantity,
        b.name AS "branchName"
      FROM inventory i
      JOIN branches b ON b.id = i.branch_id
      WHERE i.quantity <= 10
        AND ($1::uuid IS NULL OR i.branch_id = $1::uuid)
      ORDER BY i.quantity ASC, i.updated_at DESC
      LIMIT 5
    `,
    [branchId],
  );

  return rows;
}

export async function getRecentExpenses(branchId: string | null) {
  const db = getPool();
  const { rows } = await db.query<RecentExpenseRow>(
    `
      (
        SELECT
          ee.id::text AS id,
          'Employee Expense'::text AS type,
          ee.title,
          ec.id::text AS "categoryId",
          ec.code AS "categoryCode",
          ec.name AS category,
          ec.scope AS "categoryScope",
          ee.amount::double precision AS amount,
          ee.expense_date::text AS "expenseDate",
          ee.created_at::text AS "createdAt",
          CONCAT(COALESCE(u.full_name, 'Unknown user'), ' - ', COALESCE(b.name, 'No branch')) AS context
        FROM employee_expenses ee
        JOIN users u ON u.id = ee.user_id
        JOIN expense_categories ec ON ec.id = ee.category_id
        LEFT JOIN branches b ON b.id = ee.branch_id
        WHERE ($1::uuid IS NULL OR ee.branch_id = $1::uuid)
      )
      UNION ALL
      (
        SELECT
          be.id::text AS id,
          'Business Expense'::text AS type,
          be.title,
          ec.id::text AS "categoryId",
          ec.code AS "categoryCode",
          ec.name AS category,
          ec.scope AS "categoryScope",
          be.amount::double precision AS amount,
          be.expense_date::text AS "expenseDate",
          be.created_at::text AS "createdAt",
          COALESCE(b.name, 'No branch') AS context
        FROM branch_expenses be
        JOIN expense_categories ec ON ec.id = be.category_id
        LEFT JOIN branches b ON b.id = be.branch_id
        WHERE ($1::uuid IS NULL OR be.branch_id = $1::uuid)
      )
      ORDER BY "expenseDate" DESC, "createdAt" DESC
      LIMIT 5
    `,
    [branchId],
  );

  return rows;
}

export async function getOrderDetails(branchId: string | null) {
  const db = getPool();
  const { rows } = await db.query<OrderDetailRow>(
    `
      SELECT
        o.id::text AS id,
        o.order_code AS "orderCode",
        c.name AS "customerName",
        o.status::text AS status,
        o.payable_amount::double precision AS "payableAmount",
        o.paid_amount::double precision AS "paidAmount",
        o.payment_status::text AS "paymentStatus",
        o.order_date::text AS "orderDate"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE ($1::uuid IS NULL OR o.branch_id = $1::uuid)
      ORDER BY o.order_date DESC
    `,
    [branchId],
  );

  return rows;
}

export async function getCustomerDetails(branchId: string | null) {
  const db = getPool();
  const { rows } = await db.query<CustomerDetailRow>(
    `
      SELECT
        c.id::text AS id,
        c.name,
        c.phone,
        c.type::text AS type,
        c.studio_name AS "studioName",
        c.created_at::text AS "createdAt"
      FROM customers c
      WHERE (
        $1::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.customer_id = c.id
            AND o.branch_id = $1::uuid
        )
      )
      ORDER BY c.created_at DESC
    `,
    [branchId],
  );

  return rows;
}

export async function getInventoryDetails(branchId: string | null) {
  const db = getPool();
  const { rows } = await db.query<InventoryDetailRow>(
    `
      SELECT
        i.id::text AS id,
        i.name,
        i.sku,
        i.quantity::double precision AS quantity,
        i.unit::text AS unit,
        b.name AS "branchName",
        i.is_active AS "isActive"
      FROM inventory i
      JOIN branches b ON b.id = i.branch_id
      WHERE ($1::uuid IS NULL OR i.branch_id = $1::uuid)
      ORDER BY i.name ASC
    `,
    [branchId],
  );

  return rows;
}

export async function getActiveUserDetails(branchId: string | null) {
  const db = getPool();
  const activeWindowMinutes = getActiveUserWindowMinutes();
  const { rows } = await db.query<ActiveUserRow>(
    `
      SELECT
        s.id::text AS "sessionId",
        u.full_name AS "fullName",
        ua.username,
        u.role::text AS role,
        b.name AS "branchName",
        s.last_seen_at::text AS "lastSeenAt",
        s.created_at::text AS "sessionCreatedAt"
      FROM app_sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN user_auth ua ON ua.user_id = u.id
      LEFT JOIN branches b ON b.id = COALESCE(s.branch_id, u.branch_id)
      WHERE s.is_revoked = false
        AND s.expires_at > now()
        AND s.last_seen_at >= now() - make_interval(mins => $2::int)
        AND u.is_active = true
        AND ($1::uuid IS NULL OR COALESCE(s.branch_id, u.branch_id) = $1::uuid)
      ORDER BY s.last_seen_at DESC
    `,
    [branchId, activeWindowMinutes],
  );

  return rows;
}

export async function getEmployeeExpenseDetails(branchId: string | null) {
  const db = getPool();
  const { rows } = await db.query<EmployeeExpenseDetailRow>(
    `
      SELECT
        ee.id::text AS id,
        u.full_name AS "userName",
        ee.title,
        ec.id::text AS "categoryId",
        ec.code AS "categoryCode",
        ec.name AS category,
        ec.scope AS "categoryScope",
        ee.amount::double precision AS amount,
        ee.payment_mode::text AS "paymentMode",
        ee.remarks,
        ee.expense_date::text AS "expenseDate",
        ee.created_at::text AS "createdAt"
      FROM employee_expenses ee
      JOIN users u ON u.id = ee.user_id
      JOIN expense_categories ec ON ec.id = ee.category_id
      WHERE ($1::uuid IS NULL OR ee.branch_id = $1::uuid)
      ORDER BY ee.expense_date DESC, ee.created_at DESC
    `,
    [branchId],
  );

  return rows;
}

export async function getBusinessExpenseDetails(branchId: string | null) {
  const db = getPool();
  const { rows } = await db.query<BusinessExpenseDetailRow>(
    `
      SELECT
        be.id::text AS id,
        be.title,
        ec.id::text AS "categoryId",
        ec.code AS "categoryCode",
        ec.name AS category,
        ec.scope AS "categoryScope",
        be.amount::double precision AS amount,
        be.payment_mode::text AS "paymentMode",
        be.remarks,
        be.expense_date::text AS "expenseDate",
        be.created_at::text AS "createdAt",
        b.name AS "branchName"
      FROM branch_expenses be
      JOIN expense_categories ec ON ec.id = be.category_id
      LEFT JOIN branches b ON b.id = be.branch_id
      WHERE ($1::uuid IS NULL OR be.branch_id = $1::uuid)
      ORDER BY be.expense_date DESC, be.created_at DESC
    `,
    [branchId],
  );

  return rows;
}
