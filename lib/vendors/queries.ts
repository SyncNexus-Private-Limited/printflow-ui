import "server-only";
import { getPool } from "@/lib/db/postgres";
import type {
  DashboardPaginationState,
  VendorManagementRow,
  VendorManagementSummary,
  VendorsPageData,
} from "@/lib/dashboard/types";
import type {
  VendorSortDirection,
  VendorSortField,
  VendorsPageFilterState,
} from "@/lib/dashboard/vendors-page-filters";
import type { EditVendorRow, VendorAuditLogRow } from "@/lib/vendors/types";

type QueryParts = {
  whereClause: string;
  values: Array<string | number | null>;
  orderByClause: string;
};

function buildPaginationState(
  totalItems: number,
  filters: VendorsPageFilterState,
): DashboardPaginationState {
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  return { page, pageSize: filters.pageSize, totalItems, totalPages };
}

function getOrderByClause(sortField: VendorSortField, sortDirection: VendorSortDirection) {
  const direction = sortDirection === "desc" ? "DESC" : "ASC";

  switch (sortField) {
    case "code":
      return `LOWER(v.vendor_code) ${direction} NULLS LAST, LOWER(v.name) ASC`;
    case "name":
      return `LOWER(v.name) ${direction}, v.updated_at DESC`;
    case "phone":
      return `v.phone ${direction}, LOWER(v.name) ASC`;
    case "status":
      return `v.is_active ${direction}, LOWER(v.name) ASC`;
    case "created-at":
      return `v.created_at ${direction}, LOWER(v.name) ASC`;
    case "updated-at":
    default:
      return `v.updated_at ${direction}, LOWER(v.name) ASC`;
  }
}

function buildQueryParts(filters: VendorsPageFilterState): QueryParts {
  const values: Array<string | number | null> = [];
  const whereParts = ["true"];

  if (filters.search) {
    values.push(filters.search);
    whereParts.push(
      `(v.vendor_code ILIKE '%' || $${values.length} || '%' OR v.name ILIKE '%' || $${values.length} || '%' OR v.phone ILIKE '%' || $${values.length} || '%' OR v.alternate_phone ILIKE '%' || $${values.length} || '%' OR v.address ILIKE '%' || $${values.length} || '%')`,
    );
  }

  if (filters.status === "active") whereParts.push("v.is_active = true");
  else if (filters.status === "inactive") whereParts.push("v.is_active = false");

  if (filters.createdFrom) {
    values.push(filters.createdFrom);
    whereParts.push(`v.created_at::date >= $${values.length}::date`);
  }

  if (filters.createdTo) {
    values.push(filters.createdTo);
    whereParts.push(`v.created_at::date <= $${values.length}::date`);
  }

  if (filters.updatedFrom) {
    values.push(filters.updatedFrom);
    whereParts.push(`v.updated_at::date >= $${values.length}::date`);
  }

  if (filters.updatedTo) {
    values.push(filters.updatedTo);
    whereParts.push(`v.updated_at::date <= $${values.length}::date`);
  }

  return {
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getOrderByClause(filters.sortField, filters.sortDirection),
  };
}

export async function getVendorsPageData(
  filters: VendorsPageFilterState,
): Promise<VendorsPageData> {
  const db = getPool();
  const queryParts = buildQueryParts(filters);

  const { rows: totalRows } = await db.query<{ totalItems: number }>(
    `
      SELECT COUNT(*)::int AS "totalItems"
      FROM vendors v
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const { rows: summaryRows } = await db.query<VendorManagementSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalVendors",
        COUNT(*) FILTER (WHERE v.is_active = true)::int AS "activeVendors",
        COUNT(*) FILTER (WHERE v.is_active = false)::int AS "inactiveVendors"
      FROM vendors v
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const summary = summaryRows[0] ?? {
    totalVendors: 0,
    activeVendors: 0,
    inactiveVendors: 0,
  };
  const pagination = buildPaginationState(totalRows[0]?.totalItems ?? 0, filters);
  const listValues = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitIndex = queryParts.values.length + 1;
  const offsetIndex = queryParts.values.length + 2;

  const { rows } = await db.query<VendorManagementRow>(
    `
      SELECT
        v.id::text AS id,
        v.vendor_code AS "vendorCode",
        v.name,
        v.avatar,
        v.phone,
        v.alternate_phone AS "alternatePhone",
        v.address,
        v.is_active AS "isActive",
        COALESCE(order_counts.order_count, 0)::int AS "orderCount",
        COALESCE(inventory_counts.inventory_item_count, 0)::int AS "inventoryItemCount",
        updater.full_name AS "updatedByName",
        v.created_at::text AS "createdAt",
        v.updated_at::text AS "updatedAt"
      FROM vendors v
      LEFT JOIN users updater ON updater.id = v.updated_by
      LEFT JOIN (
        SELECT ov.vendor_id, COUNT(*)::int AS order_count
        FROM order_vendors ov
        GROUP BY ov.vendor_id
      ) order_counts ON order_counts.vendor_id = v.id
      LEFT JOIN (
        SELECT i.last_vendor_id, COUNT(*)::int AS inventory_item_count
        FROM inventory i
        WHERE i.last_vendor_id IS NOT NULL
        GROUP BY i.last_vendor_id
      ) inventory_counts ON inventory_counts.last_vendor_id = v.id
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

export async function getVendorById(vendorId: string): Promise<EditVendorRow | null> {
  const db = getPool();
  const { rows } = await db.query<EditVendorRow>(
    `
      SELECT
        v.id::text AS id,
        v.vendor_code AS "vendorCode",
        v.name,
        v.avatar,
        v.phone,
        v.alternate_phone AS "alternatePhone",
        v.address,
        v.is_active AS "isActive",
        v.created_at::text AS "createdAt",
        v.updated_at::text AS "updatedAt",
        updater.full_name AS "updatedByName"
      FROM vendors v
      LEFT JOIN users updater ON updater.id = v.updated_by
      WHERE v.id = $1::uuid
      LIMIT 1
    `,
    [vendorId],
  );

  return rows[0] ?? null;
}

export async function getVendorAuditLogs(vendorId: string): Promise<VendorAuditLogRow[]> {
  const db = getPool();
  const { rows } = await db.query<VendorAuditLogRow>(
    `
      SELECT
        logs.action,
        logs.snapshot,
        logs.changed_fields AS "changedFields",
        changed_by.full_name AS "changedByName",
        logs.created_at::text AS "createdAt"
      FROM vendor_audit_logs logs
      LEFT JOIN users changed_by ON changed_by.id = logs.changed_by
      WHERE logs.vendor_id = $1::uuid
      ORDER BY logs.created_at DESC
    `,
    [vendorId],
  );

  return rows;
}
