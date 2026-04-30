import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { getActiveUserWindowMinutes } from "@/lib/auth/session";
import type {
  ActiveUserPageFilterState,
  ActiveUserSortValue,
} from "@/lib/dashboard/active-users-page-filters";
import type { CustomerPageFilterState } from "@/lib/dashboard/customer-page-filters";
import type { ExpensePageFilterState } from "@/lib/dashboard/expense-page-filters";
import {
  INVENTORY_LOW_STOCK_THRESHOLD,
  type InventoryPageFilterState,
  type InventorySortValue,
} from "@/lib/dashboard/inventory-page-filters";
import type {
  InventoryPricingPageFilterState,
  InventoryPricingSortValue,
} from "@/lib/dashboard/inventory-pricing-page-filters";
import type { OrderPageFilterState } from "@/lib/dashboard/order-page-filters";
import {
  type ActiveUserRoleOption,
  type ActiveUserRow,
  type ActiveUsersPageData,
  type ActiveUsersPageSummary,
  type BranchFilterState,
  type BranchOption,
  type BusinessExpenseDetailRow,
  type BusinessExpensesPageData,
  type CustomerDetailRow,
  type CustomersPageData,
  type CustomersPageSummary,
  type DashboardPageFilterState,
  type DashboardSummary,
  type EmployeeExpenseDetailRow,
  type EmployeeExpensesPageData,
  type ExpenseRangeSummary,
  type InventoryDetailRow,
  type InventoryPageData,
  type InventoryPageDetailRow,
  type InventoryPageSummary,
  type InventoryPricingInventoryOption,
  type InventoryPricingPageData,
  type InventoryPricingPageSummary,
  type InventoryPricingRow,
  type InventoryVendorOption,
  type LowStockRow,
  type OrderCreatorOption,
  type OrderCustomerOption,
  type OrderDetailRow,
  type OrderFilterOptions,
  type OrderInventoryOption,
  type OrderOfferItemOption,
  type OrdersPageData,
  type OrdersPageSummary,
  type OrderVendorOption,
  type RecentExpenseRow,
  type RecentOrderRow,
  type UserManagementPageData,
  type UserManagementPageSummary,
  type UserManagementRow,
} from "@/lib/dashboard/types";
import type {
  UserManagementPageFilterState,
  UserManagementSortValue,
} from "@/lib/dashboard/users-page-filters";
import { getPool } from "@/lib/db/postgres";
import { branchFilterSchema } from "@/lib/validations/dashboard";
import "server-only";

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

function buildEmployeeExpensesQueryParts(
  branchId: string | null,
  filters: ExpensePageFilterState,
): ExpenseQueryParts {
  const values: Array<number | string | null> = [branchId];
  const whereParts = ["($1::uuid IS NULL OR ee.branch_id = $1::uuid)"];
  const joins = [
    "JOIN users u ON u.id = ee.user_id",
    "JOIN expense_categories ec ON ec.id = ee.category_id",
  ];
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

function buildBusinessExpensesQueryParts(
  branchId: string | null,
  filters: ExpensePageFilterState,
): ExpenseQueryParts {
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

type CustomerQueryParts = {
  whereClause: string;
  values: Array<number | string | null>;
  orderByClause: string;
};

function getCustomerOrderByClause(filters: CustomerPageFilterState): string {
  switch (filters.sort) {
    case "created-asc":
      return "c.created_at ASC, c.name ASC";
    case "updated-desc":
      return "c.updated_at DESC, c.created_at DESC";
    case "updated-asc":
      return "c.updated_at ASC, c.created_at ASC";
    case "name-asc":
      return "LOWER(c.name) ASC, c.created_at DESC";
    case "name-desc":
      return "LOWER(c.name) DESC, c.created_at DESC";
    case "type-asc":
      return "LOWER(c.type::text) ASC, c.created_at DESC";
    case "type-desc":
      return "LOWER(c.type::text) DESC, c.created_at DESC";
    case "phone-asc":
      return "c.phone ASC, c.created_at DESC";
    case "phone-desc":
      return "c.phone DESC, c.created_at DESC";
    case "studio-name-asc":
      return "CASE WHEN c.studio_name IS NULL THEN 1 ELSE 0 END ASC, LOWER(COALESCE(c.studio_name, '')) ASC, c.created_at DESC";
    case "studio-name-desc":
      return "CASE WHEN c.studio_name IS NULL THEN 1 ELSE 0 END ASC, LOWER(COALESCE(c.studio_name, '')) DESC, c.created_at DESC";
    case "customer-code-asc":
      return "CASE WHEN c.customer_code IS NULL THEN 1 ELSE 0 END ASC, LOWER(COALESCE(c.customer_code, '')) ASC, c.created_at DESC";
    case "customer-code-desc":
      return "CASE WHEN c.customer_code IS NULL THEN 1 ELSE 0 END ASC, LOWER(COALESCE(c.customer_code, '')) DESC, c.created_at DESC";
    case "order-count-desc":
      return "ord_agg.order_count DESC, c.created_at DESC";
    case "order-count-asc":
      return "ord_agg.order_count ASC, c.created_at DESC";
    case "total-payable-desc":
      return "ord_agg.total_payable DESC, c.created_at DESC";
    case "total-payable-asc":
      return "ord_agg.total_payable ASC, c.created_at DESC";
    case "outstanding-desc":
      return "ord_agg.total_outstanding DESC, c.created_at DESC";
    case "outstanding-asc":
      return "ord_agg.total_outstanding ASC, c.created_at DESC";
    case "last-order-date-desc":
      return "ord_agg.last_order_date DESC NULLS LAST, c.created_at DESC";
    case "last-order-date-asc":
      return "ord_agg.last_order_date ASC NULLS LAST, c.created_at DESC";
    case "created-desc":
    default:
      return "c.created_at DESC, c.name ASC";
  }
}

function buildCustomerQueryParts(
  branchId: string | null,
  filters: CustomerPageFilterState,
): CustomerQueryParts {
  const values: Array<number | string | null> = [branchId];
  const whereParts: string[] = [];
  const branchScope = `($1::uuid IS NULL OR o.branch_id = $1::uuid)`;

  whereParts.push(`(
        $1::uuid IS NULL
        OR EXISTS (
          SELECT 1 FROM orders o
          WHERE o.customer_id = c.id
            AND o.branch_id = $1::uuid
        )
      )`);

  const dateCol = filters.dateField === "updated" ? "c.updated_at::date" : "c.created_at::date";

  if (filters.from) {
    values.push(filters.from);
    whereParts.push(`${dateCol} >= $${values.length}::date`);
  }

  if (filters.to) {
    values.push(filters.to);
    whereParts.push(`${dateCol} <= $${values.length}::date`);
  }

  if (filters.type) {
    values.push(filters.type);
    whereParts.push(`c.type::text = $${values.length}`);
  }

  if (filters.name) {
    values.push(filters.name);
    whereParts.push(`c.name ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.phone) {
    values.push(filters.phone);
    whereParts.push(`c.phone ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.alternatePhone) {
    values.push(filters.alternatePhone);
    whereParts.push(`c.alternate_phone ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.customerCode) {
    values.push(filters.customerCode);
    whereParts.push(`c.customer_code ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.customerNumericId) {
    values.push(filters.customerNumericId);
    whereParts.push(`c.customer_numeric_id::text ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.studioName) {
    values.push(filters.studioName);
    whereParts.push(`c.studio_name ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.address) {
    values.push(filters.address);
    whereParts.push(`c.address ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.hasAlternatePhone === "with") {
    whereParts.push(`NULLIF(BTRIM(COALESCE(c.alternate_phone, '')), '') IS NOT NULL`);
  } else if (filters.hasAlternatePhone === "without") {
    whereParts.push(`NULLIF(BTRIM(COALESCE(c.alternate_phone, '')), '') IS NULL`);
  }

  if (filters.hasStudioName === "with") {
    whereParts.push(`NULLIF(BTRIM(COALESCE(c.studio_name, '')), '') IS NOT NULL`);
  } else if (filters.hasStudioName === "without") {
    whereParts.push(`NULLIF(BTRIM(COALESCE(c.studio_name, '')), '') IS NULL`);
  }

  if (filters.hasAddress === "with") {
    whereParts.push(`NULLIF(BTRIM(COALESCE(c.address, '')), '') IS NOT NULL`);
  } else if (filters.hasAddress === "without") {
    whereParts.push(`NULLIF(BTRIM(COALESCE(c.address, '')), '') IS NULL`);
  }

  if (filters.hasAvatar === "with") {
    whereParts.push(`c.avatar IS NOT NULL`);
  } else if (filters.hasAvatar === "without") {
    whereParts.push(`c.avatar IS NULL`);
  }

  if (filters.hasOrders === "yes") {
    whereParts.push(`EXISTS (
        SELECT 1 FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      )`);
  } else if (filters.hasOrders === "no") {
    whereParts.push(`NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      )`);
  }

  if (filters.orderCountMin) {
    values.push(filters.orderCountMin);
    whereParts.push(`(
        SELECT COUNT(*) FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      ) >= $${values.length}::int`);
  }

  if (filters.orderCountMax) {
    values.push(filters.orderCountMax);
    whereParts.push(`(
        SELECT COUNT(*) FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      ) <= $${values.length}::int`);
  }

  if (filters.lastOrderDateFrom) {
    values.push(filters.lastOrderDateFrom);
    whereParts.push(`(
        SELECT MAX(o.order_date::date) FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      ) >= $${values.length}::date`);
  }

  if (filters.lastOrderDateTo) {
    values.push(filters.lastOrderDateTo);
    whereParts.push(`(
        SELECT MAX(o.order_date::date) FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      ) <= $${values.length}::date`);
  }

  if (filters.totalPayableMin) {
    values.push(filters.totalPayableMin);
    whereParts.push(`(
        SELECT COALESCE(SUM(o.payable_amount), 0) FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      ) >= $${values.length}::numeric`);
  }

  if (filters.totalPayableMax) {
    values.push(filters.totalPayableMax);
    whereParts.push(`(
        SELECT COALESCE(SUM(o.payable_amount), 0) FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      ) <= $${values.length}::numeric`);
  }

  if (filters.outstandingMin) {
    values.push(filters.outstandingMin);
    whereParts.push(`(
        SELECT COALESCE(SUM(o.payable_amount - o.paid_amount), 0) FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      ) >= $${values.length}::numeric`);
  }

  if (filters.outstandingMax) {
    values.push(filters.outstandingMax);
    whereParts.push(`(
        SELECT COALESCE(SUM(o.payable_amount - o.paid_amount), 0) FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
      ) <= $${values.length}::numeric`);
  }

  if (filters.lastOrderStatus) {
    values.push(filters.lastOrderStatus);
    whereParts.push(`(
        SELECT o.status::text FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
        ORDER BY o.order_date DESC, o.created_at DESC
        LIMIT 1
      ) = $${values.length}`);
  }

  if (filters.lastPaymentStatus) {
    values.push(filters.lastPaymentStatus);
    whereParts.push(`(
        SELECT o.payment_status::text FROM orders o
        WHERE o.customer_id = c.id AND ${branchScope}
        ORDER BY o.order_date DESC, o.created_at DESC
        LIMIT 1
      ) = $${values.length}`);
  }

  return {
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getCustomerOrderByClause(filters),
  };
}

export async function getCustomersPageData(
  branchId: string | null,
  filters: CustomerPageFilterState,
): Promise<CustomersPageData> {
  const db = getPool();
  const queryParts = buildCustomerQueryParts(branchId, filters);

  const { rows: summaryRows } = await db.query<CustomersPageSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalCustomersInRange",
        COUNT(*) FILTER (WHERE LOWER(c.type::text) = 'studio')::int AS "studioCustomersInRange",
        COUNT(*) FILTER (WHERE ord_agg.order_count > 0)::int AS "customersWithOrders",
        COALESCE(SUM(ord_agg.total_payable), 0)::double precision AS "totalPayable",
        COALESCE(SUM(ord_agg.total_outstanding), 0)::double precision AS "totalOutstanding"
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS order_count,
          COALESCE(SUM(o.payable_amount), 0) AS total_payable,
          COALESCE(SUM(o.payable_amount - o.paid_amount), 0) AS total_outstanding
        FROM orders o
        WHERE o.customer_id = c.id
          AND ($1::uuid IS NULL OR o.branch_id = $1::uuid)
      ) ord_agg ON true
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );
  const summary = summaryRows[0];
  const pagination = buildPaginationState(summary.totalCustomersInRange, filters);
  const listQueryParams = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitParameterIndex = queryParts.values.length + 1;
  const offsetParameterIndex = queryParts.values.length + 2;

  const { rows } = await db.query<CustomerDetailRow>(
    `
      SELECT
        c.id::text AS id,
        c.customer_numeric_id AS "customerNumericId",
        c.customer_code AS "customerCode",
        c.type::text AS type,
        c.name,
        c.avatar,
        c.studio_name AS "studioName",
        c.phone,
        c.alternate_phone AS "alternatePhone",
        c.address,
        c.created_at::text AS "createdAt",
        c.updated_at::text AS "updatedAt",
        ord_agg.order_count::int AS "orderCount",
        ord_agg.last_order_date::text AS "lastOrderDate",
        ord_agg.total_payable::double precision AS "totalPayable",
        ord_agg.total_outstanding::double precision AS "totalOutstanding",
        ord_agg.last_order_status AS "lastOrderStatus",
        ord_agg.last_payment_status AS "lastPaymentStatus"
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS order_count,
          COALESCE(SUM(o.payable_amount), 0) AS total_payable,
          COALESCE(SUM(o.payable_amount - o.paid_amount), 0) AS total_outstanding,
          MAX(o.order_date::date) AS last_order_date,
          (
            SELECT o2.status::text FROM orders o2
            WHERE o2.customer_id = c.id
              AND ($1::uuid IS NULL OR o2.branch_id = $1::uuid)
            ORDER BY o2.order_date DESC, o2.created_at DESC
            LIMIT 1
          ) AS last_order_status,
          (
            SELECT o2.payment_status::text FROM orders o2
            WHERE o2.customer_id = c.id
              AND ($1::uuid IS NULL OR o2.branch_id = $1::uuid)
            ORDER BY o2.order_date DESC, o2.created_at DESC
            LIMIT 1
          ) AS last_payment_status
        FROM orders o
        WHERE o.customer_id = c.id
          AND ($1::uuid IS NULL OR o.branch_id = $1::uuid)
      ) ord_agg ON true
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
  const listQueryParams = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
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
  const listQueryParams = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
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
        c.customer_numeric_id AS "customerNumericId",
        c.customer_code AS "customerCode",
        c.type::text AS type,
        c.name,
        c.avatar,
        c.studio_name AS "studioName",
        c.phone,
        c.alternate_phone AS "alternatePhone",
        c.address,
        c.created_at::text AS "createdAt",
        c.updated_at::text AS "updatedAt",
        ord_agg.order_count::int AS "orderCount",
        ord_agg.last_order_date::text AS "lastOrderDate",
        ord_agg.total_payable::double precision AS "totalPayable",
        ord_agg.total_outstanding::double precision AS "totalOutstanding",
        ord_agg.last_order_status AS "lastOrderStatus",
        ord_agg.last_payment_status AS "lastPaymentStatus"
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS order_count,
          COALESCE(SUM(o.payable_amount), 0) AS total_payable,
          COALESCE(SUM(o.payable_amount - o.paid_amount), 0) AS total_outstanding,
          MAX(o.order_date::date) AS last_order_date,
          (
            SELECT o2.status::text FROM orders o2
            WHERE o2.customer_id = c.id
              AND ($1::uuid IS NULL OR o2.branch_id = $1::uuid)
            ORDER BY o2.order_date DESC, o2.created_at DESC
            LIMIT 1
          ) AS last_order_status,
          (
            SELECT o2.payment_status::text FROM orders o2
            WHERE o2.customer_id = c.id
              AND ($1::uuid IS NULL OR o2.branch_id = $1::uuid)
            ORDER BY o2.order_date DESC, o2.created_at DESC
            LIMIT 1
          ) AS last_payment_status
        FROM orders o
        WHERE o.customer_id = c.id
          AND ($1::uuid IS NULL OR o.branch_id = $1::uuid)
      ) ord_agg ON true
      WHERE (
        $1::uuid IS NULL
        OR EXISTS (
          SELECT 1 FROM orders o
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

// ---------------------------------------------------------------------------
// Inventory page queries
// ---------------------------------------------------------------------------

type InventoryQueryParts = {
  joins: string;
  whereClause: string;
  values: Array<number | string | null>;
  orderByClause: string;
};

function getInventoryOrderByClause(sort: InventorySortValue): string {
  const t = INVENTORY_LOW_STOCK_THRESHOLD;

  switch (sort) {
    case "name-asc":
      return "LOWER(i.name) ASC, i.updated_at DESC";
    case "name-desc":
      return "LOWER(i.name) DESC, i.updated_at DESC";
    case "sku-asc":
      return "LOWER(i.sku) ASC, LOWER(i.name) ASC";
    case "sku-desc":
      return "LOWER(i.sku) DESC, LOWER(i.name) ASC";
    case "quantity-asc":
      return "i.quantity ASC, LOWER(i.name) ASC";
    case "quantity-desc":
      return "i.quantity DESC, LOWER(i.name) ASC";
    case "unit-asc":
      return "LOWER(i.unit::text) ASC, LOWER(i.name) ASC";
    case "unit-desc":
      return "LOWER(i.unit::text) DESC, LOWER(i.name) ASC";
    case "active-asc":
      return "i.is_active ASC, LOWER(i.name) ASC";
    case "active-desc":
      return "i.is_active DESC, LOWER(i.name) ASC";
    case "purchase-rate-asc":
      return "CASE WHEN i.last_purchase_rate IS NULL THEN 1 ELSE 0 END ASC, i.last_purchase_rate ASC NULLS LAST, LOWER(i.name) ASC";
    case "purchase-rate-desc":
      return "CASE WHEN i.last_purchase_rate IS NULL THEN 1 ELSE 0 END ASC, i.last_purchase_rate DESC NULLS LAST, LOWER(i.name) ASC";
    case "vendor-asc":
      return "CASE WHEN v.name IS NULL THEN 1 ELSE 0 END ASC, LOWER(v.name) ASC NULLS LAST, LOWER(i.name) ASC";
    case "vendor-desc":
      return "CASE WHEN v.name IS NULL THEN 1 ELSE 0 END ASC, LOWER(v.name) DESC NULLS LAST, LOWER(i.name) ASC";
    case "stock-state-asc":
      // out-of-stock (0) first, then low-stock (1), then in-stock (2)
      return `CASE WHEN i.quantity = 0 THEN 0 WHEN i.quantity <= ${t} THEN 1 ELSE 2 END ASC, LOWER(i.name) ASC`;
    case "stock-state-desc":
      return `CASE WHEN i.quantity = 0 THEN 0 WHEN i.quantity <= ${t} THEN 1 ELSE 2 END DESC, LOWER(i.name) ASC`;
    case "created-at-asc":
      return "i.created_at ASC, LOWER(i.name) ASC";
    case "created-at-desc":
      return "i.created_at DESC, LOWER(i.name) ASC";
    case "updated-at-asc":
      return "i.updated_at ASC, LOWER(i.name) ASC";
    case "updated-at-desc":
    default:
      return "i.updated_at DESC, LOWER(i.name) ASC";
  }
}

function buildInventoryQueryParts(
  branchId: string | null,
  filters: InventoryPageFilterState,
): InventoryQueryParts {
  const t = INVENTORY_LOW_STOCK_THRESHOLD;
  const values: Array<number | string | null> = [branchId];
  const whereParts = ["($1::uuid IS NULL OR i.branch_id = $1::uuid)"];

  if (!filters.includeArchived) {
    whereParts.push("i.deleted_at IS NULL");
  }

  const joins = [
    "LEFT JOIN vendors v ON v.id = i.last_vendor_id",
    "LEFT JOIN branches b ON b.id = i.branch_id",
  ];

  // Date filter — only applied when explicitly set (inventory has no default date range)
  if (filters.from || filters.to) {
    const dateCol = filters.dateField === "created" ? "i.created_at::date" : "i.updated_at::date";

    if (filters.from) {
      values.push(filters.from);
      whereParts.push(`${dateCol} >= $${values.length}::date`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereParts.push(`${dateCol} <= $${values.length}::date`);
    }
  }

  if (filters.name) {
    values.push(filters.name);
    whereParts.push(`i.name ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.sku) {
    values.push(filters.sku);
    whereParts.push(`i.sku ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.unit) {
    values.push(filters.unit);
    whereParts.push(`i.unit::text ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.isActive === "active") {
    whereParts.push("i.is_active = true");
  } else if (filters.isActive === "inactive") {
    whereParts.push("i.is_active = false");
  }

  if (filters.stockState === "out-of-stock") {
    whereParts.push("i.quantity = 0");
  } else if (filters.stockState === "low-stock") {
    whereParts.push(`i.quantity > 0 AND i.quantity <= ${t}`);
  } else if (filters.stockState === "in-stock") {
    whereParts.push(`i.quantity > ${t}`);
  }

  if (filters.quantityMin) {
    values.push(filters.quantityMin);
    whereParts.push(`i.quantity >= $${values.length}::numeric`);
  }

  if (filters.quantityMax) {
    values.push(filters.quantityMax);
    whereParts.push(`i.quantity <= $${values.length}::numeric`);
  }

  if (filters.lastVendorId) {
    values.push(filters.lastVendorId);
    whereParts.push(`i.last_vendor_id = $${values.length}::uuid`);
  }

  if (filters.purchaseRateMin) {
    values.push(filters.purchaseRateMin);
    whereParts.push(`i.last_purchase_rate >= $${values.length}::numeric`);
  }

  if (filters.purchaseRateMax) {
    values.push(filters.purchaseRateMax);
    whereParts.push(`i.last_purchase_rate <= $${values.length}::numeric`);
  }

  if (filters.hasLastPurchaseRate === "with") {
    whereParts.push("i.last_purchase_rate IS NOT NULL");
  } else if (filters.hasLastPurchaseRate === "without") {
    whereParts.push("i.last_purchase_rate IS NULL");
  }

  if (filters.hasImage === "with") {
    whereParts.push("i.image IS NOT NULL");
  } else if (filters.hasImage === "without") {
    whereParts.push("i.image IS NULL");
  }

  return {
    joins: joins.join("\n      "),
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getInventoryOrderByClause(filters.sort),
  };
}

export async function getInventoryPageData(
  branchId: string | null,
  filters: InventoryPageFilterState,
): Promise<InventoryPageData> {
  const db = getPool();
  const t = INVENTORY_LOW_STOCK_THRESHOLD;
  const queryParts = buildInventoryQueryParts(branchId, filters);

  const { rows: summaryRows } = await db.query<InventoryPageSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalItemsInRange",
        COUNT(*) FILTER (WHERE i.quantity > 0 AND i.quantity <= ${t})::int AS "lowStockItemsInRange",
        COUNT(*) FILTER (WHERE i.quantity = 0)::int AS "outOfStockItemsInRange",
        COALESCE(SUM(i.quantity), 0)::double precision AS "totalStockQuantityInRange"
      FROM inventory i
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const summary = summaryRows[0];
  const pagination = buildPaginationState(summary.totalItemsInRange, filters);
  const listQueryParams = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitParameterIndex = queryParts.values.length + 1;
  const offsetParameterIndex = queryParts.values.length + 2;

  const { rows } = await db.query<InventoryPageDetailRow>(
    `
      SELECT
        i.id::text AS id,
        i.branch_id::text AS "branchId",
        i.name,
        i.sku,
        i.quantity::double precision AS quantity,
        i.unit::text AS unit,
        i.is_active AS "isActive",
        COALESCE(b.name, '') AS "branchName",
        i.last_purchase_rate::double precision AS "lastPurchaseRate",
        v.name AS "lastVendorName",
        i.created_at::text AS "createdAt",
        i.updated_at::text AS "updatedAt",
        i.image,
        i.deleted_at::text AS "deletedAt",
        CASE
          WHEN i.quantity = 0 THEN 'out-of-stock'
          WHEN i.quantity <= ${t} THEN 'low-stock'
          ELSE 'in-stock'
        END AS "stockState"
      FROM inventory i
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

export async function getInventoryVendorOptions(
  branchId: string | null,
): Promise<InventoryVendorOption[]> {
  const db = getPool();
  const { rows } = await db.query<InventoryVendorOption>(
    `
      SELECT DISTINCT v.id::text AS id, v.name
      FROM vendors v
      INNER JOIN inventory i ON i.last_vendor_id = v.id
      WHERE ($1::uuid IS NULL OR i.branch_id = $1::uuid)
      ORDER BY v.name ASC
    `,
    [branchId],
  );

  return rows;
}

// ---------------------------------------------------------------------------
// Inventory pricing page queries
// ---------------------------------------------------------------------------

type InventoryPricingQueryParts = {
  joins: string;
  whereClause: string;
  values: Array<number | string | null>;
  orderByClause: string;
};

const inventoryPricingStatusSql = `CASE
  WHEN ip.effective_from > CURRENT_DATE THEN 'upcoming'
  WHEN ip.effective_to IS NOT NULL AND ip.effective_to < CURRENT_DATE THEN 'expired'
  ELSE 'current'
END`;

function getInventoryPricingOrderByClause(sort: InventoryPricingSortValue): string {
  switch (sort) {
    case "item-asc":
      return "LOWER(i.name) ASC, ip.updated_at DESC";
    case "item-desc":
      return "LOWER(i.name) DESC, ip.updated_at DESC";
    case "sku-asc":
      return "LOWER(i.sku) ASC, LOWER(i.name) ASC";
    case "sku-desc":
      return "LOWER(i.sku) DESC, LOWER(i.name) ASC";
    case "branch-asc":
      return "LOWER(b.name) ASC, LOWER(i.name) ASC";
    case "branch-desc":
      return "LOWER(b.name) DESC, LOWER(i.name) ASC";
    case "customer-type-asc":
      return "LOWER(ip.customer_type::text) ASC, LOWER(i.name) ASC";
    case "customer-type-desc":
      return "LOWER(ip.customer_type::text) DESC, LOWER(i.name) ASC";
    case "selling-rate-asc":
      return "ip.selling_rate ASC, LOWER(i.name) ASC";
    case "selling-rate-desc":
      return "ip.selling_rate DESC, LOWER(i.name) ASC";
    case "effective-from-asc":
      return "ip.effective_from ASC, LOWER(i.name) ASC";
    case "effective-from-desc":
      return "ip.effective_from DESC, LOWER(i.name) ASC";
    case "effective-to-asc":
      return "CASE WHEN ip.effective_to IS NULL THEN 1 ELSE 0 END ASC, ip.effective_to ASC, LOWER(i.name) ASC";
    case "effective-to-desc":
      return "CASE WHEN ip.effective_to IS NULL THEN 1 ELSE 0 END ASC, ip.effective_to DESC, LOWER(i.name) ASC";
    case "status-asc":
      return `${inventoryPricingStatusSql} ASC, LOWER(i.name) ASC`;
    case "status-desc":
      return `${inventoryPricingStatusSql} DESC, LOWER(i.name) ASC`;
    case "updated-at-asc":
      return "ip.updated_at ASC, LOWER(i.name) ASC";
    case "updated-at-desc":
    default:
      return "ip.updated_at DESC, LOWER(i.name) ASC";
  }
}

function buildInventoryPricingQueryParts(
  branchId: string | null,
  filters: InventoryPricingPageFilterState,
): InventoryPricingQueryParts {
  const values: Array<number | string | null> = [branchId];
  const whereParts = ["($1::uuid IS NULL OR ip.branch_id = $1::uuid)"];
  const joins = [
    "INNER JOIN inventory i ON i.id = ip.inventory_id",
    "INNER JOIN branches b ON b.id = ip.branch_id",
    "LEFT JOIN users updater ON updater.id = ip.updated_by",
  ];

  if (filters.from) {
    values.push(filters.from);
    whereParts.push("COALESCE(ip.effective_to, 'infinity'::date) >= $" + values.length + "::date");
  }

  if (filters.to) {
    values.push(filters.to);
    whereParts.push("ip.effective_from <= $" + values.length + "::date");
  }

  if (filters.itemName) {
    values.push(filters.itemName);
    whereParts.push(`i.name ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.sku) {
    values.push(filters.sku);
    whereParts.push(`i.sku ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.customerType) {
    values.push(filters.customerType);
    whereParts.push(`ip.customer_type = $${values.length}::customer_type`);
  }

  if (filters.status !== "all") {
    whereParts.push(`${inventoryPricingStatusSql} = '${filters.status}'`);
  }

  return {
    joins: joins.join("\n      "),
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getInventoryPricingOrderByClause(filters.sort),
  };
}

export async function getInventoryPricingPageData(
  branchId: string | null,
  filters: InventoryPricingPageFilterState,
): Promise<InventoryPricingPageData> {
  const db = getPool();
  const queryParts = buildInventoryPricingQueryParts(branchId, filters);

  const { rows: summaryRows } = await db.query<InventoryPricingPageSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalPricesInRange",
        COUNT(*) FILTER (WHERE ${inventoryPricingStatusSql} = 'current')::int AS "currentPricesInRange",
        COUNT(*) FILTER (WHERE ${inventoryPricingStatusSql} = 'upcoming')::int AS "upcomingPricesInRange",
        COUNT(*) FILTER (WHERE ${inventoryPricingStatusSql} = 'expired')::int AS "expiredPricesInRange"
      FROM inventory_pricing ip
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const summary = summaryRows[0] ?? {
    totalPricesInRange: 0,
    currentPricesInRange: 0,
    upcomingPricesInRange: 0,
    expiredPricesInRange: 0,
  };
  const pagination = buildPaginationState(summary.totalPricesInRange, filters);
  const listQueryParams = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitParameterIndex = queryParts.values.length + 1;
  const offsetParameterIndex = queryParts.values.length + 2;

  const { rows } = await db.query<InventoryPricingRow>(
    `
      SELECT
        ip.id::text AS id,
        ip.branch_id::text AS "branchId",
        ip.inventory_id::text AS "inventoryId",
        i.name AS "itemName",
        i.sku,
        b.name AS "branchName",
        ip.customer_type::text AS "customerType",
        ip.selling_rate::double precision AS "sellingRate",
        ip.effective_from::text AS "effectiveFrom",
        ip.effective_to::text AS "effectiveTo",
        ${inventoryPricingStatusSql} AS "pricingStatus",
        ip.updated_at::text AS "updatedAt",
        updater.full_name AS "updatedByName"
      FROM inventory_pricing ip
      ${queryParts.joins}
      WHERE ${queryParts.whereClause}
      ORDER BY ${queryParts.orderByClause}
      LIMIT $${limitParameterIndex}
      OFFSET $${offsetParameterIndex}
    `,
    listQueryParams,
  );

  const inventoryOptions = await getInventoryPricingInventoryOptions(branchId);

  return {
    summary,
    result: { items: rows, pagination },
    inventoryOptions,
  };
}

export async function getInventoryPricingInventoryOptions(
  branchId: string | null,
): Promise<InventoryPricingInventoryOption[]> {
  const db = getPool();
  const { rows } = await db.query<InventoryPricingInventoryOption>(
    `
      SELECT
        i.id::text AS id,
        i.branch_id::text AS "branchId",
        b.name AS "branchName",
        i.name,
        i.sku
      FROM inventory i
      INNER JOIN branches b ON b.id = i.branch_id
      WHERE ($1::uuid IS NULL OR i.branch_id = $1::uuid)
        AND i.deleted_at IS NULL
        AND i.is_active = true
      ORDER BY LOWER(b.name) ASC, LOWER(i.name) ASC
    `,
    [branchId],
  );

  return rows;
}

function getActiveUsersOrderByClause(sort: ActiveUserSortValue): string {
  switch (sort) {
    case "last-seen-asc":
      return "s.last_seen_at ASC";
    case "session-created-desc":
      return "s.created_at DESC, s.last_seen_at DESC";
    case "session-created-asc":
      return "s.created_at ASC, s.last_seen_at ASC";
    case "name-asc":
      return "LOWER(u.full_name) ASC, s.last_seen_at DESC";
    case "name-desc":
      return "LOWER(u.full_name) DESC, s.last_seen_at DESC";
    case "role-asc":
      return "LOWER(u.role::text) ASC, s.last_seen_at DESC";
    case "role-desc":
      return "LOWER(u.role::text) DESC, s.last_seen_at DESC";
    case "last-seen-desc":
    default:
      return "s.last_seen_at DESC";
  }
}

export async function getActiveUsersPageData(
  branchId: string | null,
  filters: ActiveUserPageFilterState,
): Promise<ActiveUsersPageData> {
  const db = getPool();
  const activeWindowMinutes = getActiveUserWindowMinutes();
  const queryValues: Array<number | string | null> = [branchId, activeWindowMinutes];
  const whereParts = [
    "s.is_revoked = false",
    "s.expires_at > now()",
    "s.last_seen_at >= now() - make_interval(mins => $2::int)",
    "u.is_active = true",
    "($1::uuid IS NULL OR COALESCE(s.branch_id, u.branch_id) = $1::uuid)",
  ];

  if (filters.role) {
    queryValues.push(filters.role);
    whereParts.push(`u.role::text = $${queryValues.length}`);
  }

  const whereClause = whereParts.join("\n      AND ");

  const { rows: summaryRows } = await db.query<ActiveUsersPageSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalActiveUsers",
        COUNT(*) FILTER (WHERE u.role::text = 'admin')::int AS "adminActiveUsers",
        COUNT(*) FILTER (WHERE u.role::text != 'admin')::int AS "staffActiveUsers"
      FROM app_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE ${whereClause}
    `,
    queryValues,
  );

  const summary = summaryRows[0];
  const totalPages = Math.max(1, Math.ceil(summary.totalActiveUsers / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const orderByClause = getActiveUsersOrderByClause(filters.sort);
  const listQueryValues = [...queryValues, filters.pageSize, (page - 1) * filters.pageSize];
  const limitIdx = queryValues.length + 1;
  const offsetIdx = queryValues.length + 2;

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
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `,
    listQueryValues,
  );

  return {
    summary,
    result: {
      items: rows,
      pagination: {
        page,
        pageSize: filters.pageSize,
        totalItems: summary.totalActiveUsers,
        totalPages,
      },
    },
  };
}

export async function getActiveUserRoleOptions(
  branchId: string | null,
): Promise<ActiveUserRoleOption[]> {
  const db = getPool();
  const { rows } = await db.query<ActiveUserRoleOption>(
    `
      SELECT DISTINCT u.role::text AS role
      FROM users u
      WHERE u.is_active = true
        AND ($1::uuid IS NULL OR u.branch_id = $1::uuid)
      ORDER BY u.role::text ASC
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

function getUsersOrderByClause(sort: UserManagementSortValue): string {
  switch (sort) {
    case "name-desc":
      return "LOWER(u.full_name) DESC";
    case "role-asc":
      return "LOWER(u.role::text) ASC, LOWER(u.full_name) ASC";
    case "role-desc":
      return "LOWER(u.role::text) DESC, LOWER(u.full_name) ASC";
    case "created-desc":
      return "u.created_at DESC";
    case "created-asc":
      return "u.created_at ASC";
    case "name-asc":
    default:
      return "LOWER(u.full_name) ASC";
  }
}

export async function getUsersPageData(
  branchId: string | null,
  filters: UserManagementPageFilterState,
): Promise<UserManagementPageData> {
  const db = getPool();
  const queryValues: Array<string | null> = [branchId];
  const whereParts = ["($1::uuid IS NULL OR u.branch_id = $1::uuid)"];

  if (filters.role) {
    queryValues.push(filters.role);
    whereParts.push(`u.role::text = $${queryValues.length}`);
  }

  if (filters.status === "active") {
    whereParts.push("u.is_active = true");
  } else if (filters.status === "inactive") {
    whereParts.push("u.is_active = false");
  }

  if (filters.locked === "locked") {
    whereParts.push("COALESCE(ua.is_locked, false) = true");
  } else if (filters.locked === "unlocked") {
    whereParts.push("COALESCE(ua.is_locked, false) = false");
  }

  if (filters.name) {
    queryValues.push(`%${filters.name}%`);
    whereParts.push(`LOWER(u.full_name) LIKE LOWER($${queryValues.length})`);
  }

  if (filters.username) {
    queryValues.push(`%${filters.username}%`);
    whereParts.push(`LOWER(COALESCE(ua.username, '')) LIKE LOWER($${queryValues.length})`);
  }

  const whereClause = whereParts.join("\n      AND ");

  const { rows: summaryRows } = await db.query<UserManagementPageSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalUsers",
        COUNT(*) FILTER (WHERE u.is_active = true)::int AS "activeUsers",
        COUNT(*) FILTER (WHERE u.is_active = false)::int AS "inactiveUsers",
        COUNT(*) FILTER (WHERE ua.is_locked = true)::int AS "lockedUsers"
      FROM users u
      LEFT JOIN user_auth ua ON ua.user_id = u.id
      WHERE ${whereClause}
    `,
    queryValues,
  );

  const summary = summaryRows[0];
  const totalPages = Math.max(1, Math.ceil(summary.totalUsers / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const orderByClause = getUsersOrderByClause(filters.sort);
  const listQueryValues = [...queryValues, filters.pageSize, (page - 1) * filters.pageSize];
  const limitIdx = queryValues.length + 1;
  const offsetIdx = queryValues.length + 2;

  const { rows } = await db.query<UserManagementRow>(
    `
      SELECT
        u.id::text AS id,
        u.full_name AS "fullName",
        COALESCE(ua.username, '') AS username,
        u.role::text AS role,
        u.branch_id::text AS "branchId",
        b.name AS "branchName",
        u.is_active AS "isActive",
        COALESCE(ua.is_locked, false) AS "isLocked",
        u.created_at::text AS "createdAt"
      FROM users u
      LEFT JOIN user_auth ua ON ua.user_id = u.id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `,
    listQueryValues,
  );

  return {
    summary,
    result: {
      items: rows,
      pagination: {
        page,
        pageSize: filters.pageSize,
        totalItems: summary.totalUsers,
        totalPages,
      },
    },
  };
}

export async function getUserManagementRoleOptions(
  branchId: string | null,
): Promise<ActiveUserRoleOption[]> {
  const db = getPool();
  const { rows } = await db.query<ActiveUserRoleOption>(
    `
      SELECT DISTINCT u.role::text AS role
      FROM users u
      WHERE ($1::uuid IS NULL OR u.branch_id = $1::uuid)
      ORDER BY u.role::text ASC
    `,
    [branchId],
  );

  return rows;
}
