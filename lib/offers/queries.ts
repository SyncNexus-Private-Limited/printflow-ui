import "server-only";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { getCustomerTypeOptions } from "@/lib/customers/queries";
import { getPool } from "@/lib/db/postgres";
import { getDashboardContext, NO_BRANCH_SCOPE_ID } from "@/lib/dashboard/queries";
import type {
  DashboardPaginationState,
  OfferManagementRow,
  OfferManagementSummary,
  OffersPageData,
} from "@/lib/dashboard/types";
import type {
  OfferSortDirection,
  OfferSortField,
  OffersPageFilterState,
} from "@/lib/dashboard/offers-page-filters";
import type { EditOfferRow, OfferAuditLogRow } from "@/lib/offers/types";
import type { OfferFormPageData } from "@/lib/offers/types";

type QueryParts = {
  whereClause: string;
  values: Array<string | number | null>;
  orderByClause: string;
};

export async function getOfferFormPageData(
  currentUser: AuthenticatedUser,
  requestedBranchId?: string,
): Promise<OfferFormPageData & { selectedBranchName: string }> {
  const context = await getDashboardContext(currentUser, requestedBranchId);
  const noBranchAssigned = !context.isAdmin && context.selectedBranchId === NO_BRANCH_SCOPE_ID;
  const branchOptions = context.branches;
  const selectedBranchId = noBranchAssigned
    ? ""
    : (context.selectedBranchId ?? branchOptions[0]?.id ?? "");
  const selectedBranchName =
    branchOptions.find((branch) => branch.id === selectedBranchId)?.name ??
    context.selectedBranchName;
  const customerTypeOptions = await getCustomerTypeOptions();

  return {
    branchOptions,
    selectedBranchId,
    selectedBranchName,
    canSelectBranch: context.canSelectAll,
    noBranchAssigned,
    customerTypeOptions,
  };
}

function buildPaginationState(
  totalItems: number,
  filters: OffersPageFilterState,
): DashboardPaginationState {
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  return { page, pageSize: filters.pageSize, totalItems, totalPages };
}

function getOrderByClause(sortField: OfferSortField, sortDirection: OfferSortDirection) {
  const direction = sortDirection === "desc" ? "DESC" : "ASC";

  switch (sortField) {
    case "code":
      return `LOWER(o.code) ${direction}, LOWER(o.name) ASC`;
    case "name":
      return `LOWER(o.name) ${direction}, o.starts_at DESC`;
    case "type":
      return `o.offer_type ${direction}, LOWER(o.name) ASC`;
    case "status":
      return `o.is_active ${direction}, LOWER(o.name) ASC`;
    case "starts-at":
      return `o.starts_at ${direction}, LOWER(o.name) ASC`;
    case "ends-at":
      return `o.ends_at ${direction} NULLS LAST, LOWER(o.name) ASC`;
    case "updated-at":
    default:
      return `o.updated_at ${direction}, LOWER(o.name) ASC`;
  }
}

function buildQueryParts(branchId: string | null, filters: OffersPageFilterState): QueryParts {
  const values: Array<string | number | null> = [];
  const whereParts = ["true"];

  if (branchId) {
    values.push(branchId);
    whereParts.push(`o.branch_id = $${values.length}::uuid`);
  }

  if (filters.search) {
    values.push(filters.search);
    whereParts.push(
      `(o.code ILIKE '%' || $${values.length} || '%' OR o.name ILIKE '%' || $${values.length} || '%' OR o.description ILIKE '%' || $${values.length} || '%')`,
    );
  }

  if (filters.status === "active") whereParts.push("o.is_active = true");
  else if (filters.status === "inactive") whereParts.push("o.is_active = false");

  if (filters.offerType !== "all") {
    values.push(filters.offerType);
    whereParts.push(`o.offer_type = $${values.length}`);
  }

  if (filters.timing === "current") {
    whereParts.push(
      "(o.starts_at <= CURRENT_DATE AND (o.ends_at IS NULL OR o.ends_at >= CURRENT_DATE))",
    );
  } else if (filters.timing === "upcoming") {
    whereParts.push("o.starts_at > CURRENT_DATE");
  } else if (filters.timing === "expired") {
    whereParts.push("o.ends_at IS NOT NULL AND o.ends_at < CURRENT_DATE");
  }

  if (filters.startsFrom) {
    values.push(filters.startsFrom);
    whereParts.push(`o.starts_at >= $${values.length}::date`);
  }

  if (filters.startsTo) {
    values.push(filters.startsTo);
    whereParts.push(`o.starts_at <= $${values.length}::date`);
  }

  return {
    whereClause: whereParts.join("\n        AND "),
    values,
    orderByClause: getOrderByClause(filters.sortField, filters.sortDirection),
  };
}

export async function getOffersPageData(
  branchId: string | null,
  filters: OffersPageFilterState,
): Promise<OffersPageData> {
  const db = getPool();
  const queryParts = buildQueryParts(branchId, filters);

  const { rows: totalRows } = await db.query<{ totalItems: number }>(
    `
      SELECT COUNT(*)::int AS "totalItems"
      FROM offers o
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const { rows: summaryRows } = await db.query<OfferManagementSummary>(
    `
      SELECT
        COUNT(*)::int AS "totalOffers",
        COUNT(*) FILTER (WHERE o.is_active = true)::int AS "activeOffers",
        COUNT(*) FILTER (
          WHERE o.starts_at <= CURRENT_DATE
            AND (o.ends_at IS NULL OR o.ends_at >= CURRENT_DATE)
        )::int AS "currentOffers",
        COUNT(*) FILTER (WHERE o.starts_at > CURRENT_DATE)::int AS "upcomingOffers"
      FROM offers o
      WHERE ${queryParts.whereClause}
    `,
    queryParts.values,
  );

  const summary = summaryRows[0] ?? {
    totalOffers: 0,
    activeOffers: 0,
    currentOffers: 0,
    upcomingOffers: 0,
  };
  const pagination = buildPaginationState(totalRows[0]?.totalItems ?? 0, filters);
  const listValues = [
    ...queryParts.values,
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ];
  const limitIndex = queryParts.values.length + 1;
  const offsetIndex = queryParts.values.length + 2;

  const { rows } = await db.query<OfferManagementRow>(
    `
      SELECT
        o.id::text AS id,
        o.branch_id::text AS "branchId",
        b.name AS "branchName",
        o.code,
        o.name,
        o.description,
        o.offer_type AS "offerType",
        o.discount_value::double precision AS "discountValue",
        o.buy_quantity AS "buyQuantity",
        o.get_quantity AS "getQuantity",
        o.minimum_order_value::double precision AS "minimumOrderValue",
        o.customer_types::text[] AS "customerTypes",
        o.starts_at::text AS "startsAt",
        o.ends_at::text AS "endsAt",
        o.is_active AS "isActive",
        CASE
          WHEN o.starts_at > CURRENT_DATE THEN 'upcoming'
          WHEN o.ends_at IS NOT NULL AND o.ends_at < CURRENT_DATE THEN 'expired'
          ELSE 'current'
        END AS "timingState",
        updater.full_name AS "updatedByName",
        o.created_at::text AS "createdAt",
        o.updated_at::text AS "updatedAt"
      FROM offers o
      INNER JOIN branches b ON b.id = o.branch_id
      LEFT JOIN users updater ON updater.id = o.updated_by
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

export async function getOfferById(offerId: string): Promise<EditOfferRow | null> {
  const db = getPool();
  const { rows } = await db.query<EditOfferRow>(
    `
      SELECT
        o.id::text AS id,
        o.branch_id::text AS "branchId",
        b.name AS "branchName",
        o.code,
        o.name,
        o.description,
        o.offer_type AS "offerType",
        o.discount_value::double precision AS "discountValue",
        o.buy_quantity AS "buyQuantity",
        o.get_quantity AS "getQuantity",
        o.minimum_order_value::double precision AS "minimumOrderValue",
        o.customer_types::text[] AS "customerTypes",
        o.starts_at::text AS "startsAt",
        o.ends_at::text AS "endsAt",
        o.is_active AS "isActive",
        o.created_at::text AS "createdAt",
        o.updated_at::text AS "updatedAt",
        updater.full_name AS "updatedByName"
      FROM offers o
      INNER JOIN branches b ON b.id = o.branch_id
      LEFT JOIN users updater ON updater.id = o.updated_by
      WHERE o.id = $1::uuid
      LIMIT 1
    `,
    [offerId],
  );

  return rows[0] ?? null;
}

export async function getOfferAuditLogs(offerId: string): Promise<OfferAuditLogRow[]> {
  const db = getPool();
  const { rows } = await db.query<OfferAuditLogRow>(
    `
      SELECT
        logs.action,
        logs.snapshot,
        logs.changed_fields AS "changedFields",
        changed_by.full_name AS "changedByName",
        logs.created_at::text AS "createdAt"
      FROM offer_audit_logs logs
      LEFT JOIN users changed_by ON changed_by.id = logs.changed_by
      WHERE logs.offer_id = $1::uuid
      ORDER BY logs.created_at DESC
    `,
    [offerId],
  );

  return rows;
}
