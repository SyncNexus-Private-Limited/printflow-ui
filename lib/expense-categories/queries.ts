import "server-only";
import { getPool } from "@/lib/db/postgres";
import type {
  ExpenseCategoriesPageFilterState,
  ExpenseCategorySortDirection,
  ExpenseCategorySortField,
} from "@/lib/dashboard/expense-categories-page-filters";
import type {
  DashboardPaginationState,
  ExpenseCategoriesPageData,
  ExpenseCategoryManagementRow,
  ExpenseCategoryManagementSummary,
} from "@/lib/dashboard/types";
import type { EditExpenseCategoryRow } from "@/lib/expense-categories/types";

type QueryParts = {
  whereClause: string;
  values: Array<string | number | null>;
  orderByClause: string;
};

function buildPaginationState(
  totalItems: number,
  filters: ExpenseCategoriesPageFilterState,
): DashboardPaginationState {
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  return { page, pageSize: filters.pageSize, totalItems, totalPages };
}

function getOrderByClause(
  sortField: ExpenseCategorySortField,
  sortDirection: ExpenseCategorySortDirection,
) {
  const direction = sortDirection === "desc" ? "DESC" : "ASC";

  switch (sortField) {
    case "code":
      return `LOWER(ec.code) ${direction}, ec.sort_order ASC`;
    case "name":
      return `LOWER(ec.name) ${direction}, ec.sort_order ASC`;
    case "scope":
      return `ec.scope ${direction}, ec.sort_order ASC`;
    case "status":
      return `ec.is_active ${direction}, ec.sort_order ASC`;
    case "updated-at":
      return `ec.updated_at ${direction}, ec.sort_order ASC`;
    case "sort-order":
    default:
      return `ec.sort_order ${direction}, LOWER(ec.name) ASC`;
  }
}

function buildQueryParts(filters: ExpenseCategoriesPageFilterState): QueryParts {
  const values: Array<string | number | null> = [];
  const whereParts = ["true"];

  if (filters.search) {
    values.push(filters.search);
    whereParts.push(
      `(ec.code ILIKE '%' || $${values.length} || '%' OR ec.name ILIKE '%' || $${values.length} || '%' OR ec.description ILIKE '%' || $${values.length} || '%')`,
    );
  }

  if (filters.scope) {
    values.push(filters.scope);
    whereParts.push(`ec.scope = $${values.length}`);
  }

  if (filters.status === "active") whereParts.push("ec.is_active = true");
  else if (filters.status === "inactive") whereParts.push("ec.is_active = false");

  if (filters.createdFrom) {
    values.push(filters.createdFrom);
    whereParts.push(`ec.created_at::date >= $${values.length}::date`);
  }

  if (filters.createdTo) {
    values.push(filters.createdTo);
    whereParts.push(`ec.created_at::date <= $${values.length}::date`);
  }

  if (filters.updatedFrom) {
    values.push(filters.updatedFrom);
    whereParts.push(`ec.updated_at::date >= $${values.length}::date`);
  }

  if (filters.updatedTo) {
    values.push(filters.updatedTo);
    whereParts.push(`ec.updated_at::date <= $${values.length}::date`);
  }

  return {
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getOrderByClause(filters.sortField, filters.sortDirection),
  };
}

export async function getExpenseCategoriesPageData(
  filters: ExpenseCategoriesPageFilterState,
): Promise<ExpenseCategoriesPageData> {
  const db = getPool();
  const queryParts = buildQueryParts(filters);

  const { rows: totalRows } = await db.query<{ totalItems: number }>(
    `
      SELECT COUNT(*)::int AS "totalItems"
      FROM expense_categories ec
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const { rows: summaryRows } = await db.query<ExpenseCategoryManagementSummary>(
    `
      SELECT
        COUNT(*) FILTER (WHERE ec.scope = 'branch')::int AS "branchCategories",
        COUNT(*) FILTER (WHERE ec.scope = 'employee')::int AS "employeeCategories",
        COUNT(*) FILTER (WHERE ec.scope = 'both')::int AS "bothScopeCategories"
      FROM expense_categories ec
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const summary = summaryRows[0] ?? {
    branchCategories: 0,
    employeeCategories: 0,
    bothScopeCategories: 0,
  };
  const pagination = buildPaginationState(totalRows[0]?.totalItems ?? 0, filters);
  const listValues = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitIndex = queryParts.values.length + 1;
  const offsetIndex = queryParts.values.length + 2;

  const { rows } = await db.query<ExpenseCategoryManagementRow>(
    `
      SELECT
        ec.id::text AS id,
        ec.code,
        ec.name,
        ec.description,
        ec.scope,
        ec.is_active AS "isActive",
        ec.sort_order AS "sortOrder",
        updater.full_name AS "updatedByName",
        ec.created_at::text AS "createdAt",
        ec.updated_at::text AS "updatedAt"
      FROM expense_categories ec
      LEFT JOIN users updater ON updater.id = ec.updated_by
      WHERE ${queryParts.whereClause}
      ORDER BY ${queryParts.orderByClause}
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    listValues,
  );

  return {
    summary,
    result: { items: rows, pagination },
  };
}

export async function getExpenseCategoryById(
  categoryId: string,
): Promise<EditExpenseCategoryRow | null> {
  const db = getPool();
  const { rows } = await db.query<EditExpenseCategoryRow>(
    `
      SELECT
        ec.id::text AS id,
        ec.code,
        ec.name,
        ec.description,
        ec.scope,
        ec.is_active AS "isActive",
        ec.sort_order AS "sortOrder",
        ec.created_at::text AS "createdAt",
        ec.updated_at::text AS "updatedAt",
        updater.full_name AS "updatedByName"
      FROM expense_categories ec
      LEFT JOIN users updater ON updater.id = ec.updated_by
      WHERE ec.id = $1::uuid
      LIMIT 1
    `,
    [categoryId],
  );

  return rows[0] ?? null;
}
