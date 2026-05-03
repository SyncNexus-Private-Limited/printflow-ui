import "server-only";
import { getPool } from "@/lib/db/postgres";
import type {
  BranchManagementRow,
  BranchManagementSummary,
  BranchesPageData,
  DashboardPaginationState,
} from "@/lib/dashboard/types";
import type {
  BranchSortDirection,
  BranchSortField,
  BranchesPageFilterState,
} from "@/lib/dashboard/branches-page-filters";
import type { BranchAuditLogRow, EditBranchRow } from "@/lib/branches/types";

type QueryParts = {
  whereClause: string;
  values: Array<string | number | null>;
  orderByClause: string;
};

function buildPaginationState(
  totalItems: number,
  filters: BranchesPageFilterState,
): DashboardPaginationState {
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  return { page, pageSize: filters.pageSize, totalItems, totalPages };
}

function getOrderByClause(sortField: BranchSortField, sortDirection: BranchSortDirection) {
  const direction = sortDirection === "desc" ? "DESC" : "ASC";

  switch (sortField) {
    case "code":
      return `LOWER(b.code) ${direction}, LOWER(b.name) ASC`;
    case "name":
      return `LOWER(b.name) ${direction}, b.updated_at DESC`;
    case "phone":
      return `b.phone ${direction}, LOWER(b.name) ASC`;
    case "email":
      return `LOWER(b.email) ${direction} NULLS LAST, LOWER(b.name) ASC`;
    case "status":
      return `b.is_active ${direction}, LOWER(b.name) ASC`;
    case "created-at":
      return `b.created_at ${direction}, LOWER(b.name) ASC`;
    case "updated-at":
    default:
      return `b.updated_at ${direction}, LOWER(b.name) ASC`;
  }
}

function buildQueryParts(filters: BranchesPageFilterState): QueryParts {
  const values: Array<string | number | null> = [];
  const whereParts = ["true"];

  if (filters.search) {
    values.push(filters.search);
    whereParts.push(
      `(b.code ILIKE '%' || $${values.length} || '%' OR b.name ILIKE '%' || $${values.length} || '%' OR b.phone ILIKE '%' || $${values.length} || '%' OR b.alternate_phone ILIKE '%' || $${values.length} || '%' OR b.email ILIKE '%' || $${values.length} || '%' OR b.address ILIKE '%' || $${values.length} || '%')`,
    );
  }

  if (filters.status === "active") whereParts.push("b.is_active = true");
  else if (filters.status === "inactive") whereParts.push("b.is_active = false");

  if (filters.createdFrom) {
    values.push(filters.createdFrom);
    whereParts.push(`b.created_at::date >= $${values.length}::date`);
  }

  if (filters.createdTo) {
    values.push(filters.createdTo);
    whereParts.push(`b.created_at::date <= $${values.length}::date`);
  }

  if (filters.updatedFrom) {
    values.push(filters.updatedFrom);
    whereParts.push(`b.updated_at::date >= $${values.length}::date`);
  }

  if (filters.updatedTo) {
    values.push(filters.updatedTo);
    whereParts.push(`b.updated_at::date <= $${values.length}::date`);
  }

  return {
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getOrderByClause(filters.sortField, filters.sortDirection),
  };
}

export async function getBranchesPageData(
  filters: BranchesPageFilterState,
): Promise<BranchesPageData> {
  const db = getPool();
  const queryParts = buildQueryParts(filters);

  const { rows: totalRows } = await db.query<{ totalItems: number }>(
    `
      SELECT COUNT(*)::int AS "totalItems"
      FROM branches b
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const { rows: summaryRows } = await db.query<BranchManagementSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalBranches",
        COUNT(*) FILTER (WHERE b.is_active = true)::int AS "activeBranches",
        COUNT(*) FILTER (WHERE b.is_active = false)::int AS "inactiveBranches",
        COUNT(*)::int AS "newBranchesInRange"
      FROM branches b
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const summary = summaryRows[0] ?? {
    totalBranches: 0,
    activeBranches: 0,
    inactiveBranches: 0,
    newBranchesInRange: 0,
  };
  const pagination = buildPaginationState(totalRows[0]?.totalItems ?? 0, filters);
  const listValues = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitIndex = queryParts.values.length + 1;
  const offsetIndex = queryParts.values.length + 2;

  const { rows } = await db.query<BranchManagementRow>(
    `
      SELECT
        b.id::text AS id,
        b.code,
        b.name,
        b.phone,
        b.alternate_phone AS "alternatePhone",
        b.email,
        b.address,
        b.logo,
        b.banner,
        b.description,
        b.is_active AS "isActive",
        updater.full_name AS "updatedByName",
        b.created_at::text AS "createdAt",
        b.updated_at::text AS "updatedAt"
      FROM branches b
      LEFT JOIN users updater ON updater.id = b.updated_by
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

export async function getBranchById(branchId: string): Promise<EditBranchRow | null> {
  const db = getPool();
  const { rows } = await db.query<EditBranchRow>(
    `
      SELECT
        b.id::text AS id,
        b.code,
        b.name,
        b.phone,
        b.alternate_phone AS "alternatePhone",
        b.email,
        b.address,
        b.logo,
        b.banner,
        b.description,
        b.is_active AS "isActive",
        b.created_at::text AS "createdAt",
        b.updated_at::text AS "updatedAt",
        updater.full_name AS "updatedByName"
      FROM branches b
      LEFT JOIN users updater ON updater.id = b.updated_by
      WHERE b.id = $1::uuid
      LIMIT 1
    `,
    [branchId],
  );

  return rows[0] ?? null;
}

export async function getBranchAuditLogs(branchId: string): Promise<BranchAuditLogRow[]> {
  const db = getPool();
  const { rows } = await db.query<BranchAuditLogRow>(
    `
      SELECT
        logs.action,
        logs.snapshot,
        logs.changed_fields AS "changedFields",
        changed_by.full_name AS "changedByName",
        logs.created_at::text AS "createdAt"
      FROM branch_audit_logs logs
      LEFT JOIN users changed_by ON changed_by.id = logs.changed_by
      WHERE logs.branch_id = $1::uuid
      ORDER BY logs.created_at DESC
    `,
    [branchId],
  );

  return rows;
}
