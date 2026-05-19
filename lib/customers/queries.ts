import "server-only";
import { getPool } from "@/lib/db/postgres";
import type {
  CustomerAuditLogEntry,
  CustomerDetailPageData,
  CustomerOrderMetrics,
  CustomerRecentOrder,
  CustomerRecentPayment,
  EditCustomerRow,
} from "@/lib/customers/types";

type EditCustomerDbRow = {
  id: string;
  customer_numeric_id: number | null;
  customer_code: string | null;
  type: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  address: string | null;
  studio_name: string | null;
  avatar: string | null;
  avatar_source: "external" | "uploaded";
  aadhaar_number: string | null;
  studio_association_name: string | null;
  studio_association_id_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
};

export async function getCustomerById(id: string): Promise<EditCustomerRow | null> {
  const db = getPool();
  const { rows } = await db.query<EditCustomerDbRow>(
    `
      SELECT
        c.id::text AS id,
        c.customer_numeric_id,
        c.customer_code,
        c.type::text AS type,
        c.name,
        c.phone,
        c.alternate_phone,
        c.address,
        c.studio_name,
        c.avatar,
        c.avatar_source,
        c.aadhaar_number,
        c.studio_association_name,
        c.studio_association_id_number,
        c.is_active,
        c.created_at::text AS created_at,
        c.updated_at::text AS updated_at,
        creator.full_name AS created_by_name,
        updater.full_name AS updated_by_name
      FROM customers c
      LEFT JOIN users creator ON creator.id = c.created_by
      LEFT JOIN users updater ON updater.id = c.updated_by
      WHERE c.id = $1::uuid
      LIMIT 1
    `,
    [id],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    customerNumericId: row.customer_numeric_id,
    customerCode: row.customer_code,
    type: row.type,
    name: row.name,
    phone: row.phone,
    alternatePhone: row.alternate_phone,
    address: row.address,
    studioName: row.studio_name,
    avatar: row.avatar,
    avatarSource: row.avatar_source,
    aadhaarNumber: row.aadhaar_number,
    studioAssociationName: row.studio_association_name,
    studioAssociationIdNumber: row.studio_association_id_number,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name,
    updatedByName: row.updated_by_name,
  };
}

// ─── Customer detail page data ────────────────────────────────────────────────

type CustomerMetricsDbRow = {
  total_orders: number;
  total_payable: number;
  total_paid: number;
  total_outstanding: number;
};

type CustomerRecentOrderDbRow = {
  id: string;
  order_code: string;
  order_date: string;
  status: string;
  payment_status: string;
  total_amount: number;
  payable_amount: number;
  paid_amount: number;
  branch_name: string | null;
};

type CustomerRecentPaymentDbRow = {
  id: string;
  order_id: string;
  order_code: string;
  amount: number;
  mode: string;
  txn_reference: string | null;
  received_by_name: string | null;
  created_at: string;
};

type CustomerAuditLogDbRow = {
  id: string;
  action: string;
  changed_by_name: string | null;
  changed_fields: Record<string, unknown> | null;
  created_at: string;
};

export async function getCustomerDetailPageData(
  id: string,
): Promise<CustomerDetailPageData | null> {
  const db = getPool();

  const [customerResult, metricsResult, recentOrdersResult, recentPaymentsResult, auditLogsResult] =
    await Promise.all([
      db.query<EditCustomerDbRow>(
        `
        SELECT
          c.id::text AS id,
          c.customer_numeric_id,
          c.customer_code,
          c.type::text AS type,
          c.name,
          c.phone,
          c.alternate_phone,
          c.address,
          c.studio_name,
          c.avatar,
          c.avatar_source,
          c.aadhaar_number,
          c.studio_association_name,
          c.studio_association_id_number,
          c.is_active,
          c.created_at::text AS created_at,
          c.updated_at::text AS updated_at,
          creator.full_name AS created_by_name,
          updater.full_name AS updated_by_name
        FROM customers c
        LEFT JOIN users creator ON creator.id = c.created_by
        LEFT JOIN users updater ON updater.id = c.updated_by
        WHERE c.id = $1::uuid
        LIMIT 1
      `,
        [id],
      ),

      db.query<CustomerMetricsDbRow>(
        `
        SELECT
          COUNT(o.id)::int AS total_orders,
          COALESCE(SUM(o.payable_amount), 0)::double precision AS total_payable,
          COALESCE(SUM(o.paid_amount), 0)::double precision AS total_paid,
          COALESCE(SUM(GREATEST(o.payable_amount - o.paid_amount, 0)), 0)::double precision
            AS total_outstanding
        FROM orders o
        WHERE o.customer_id = $1::uuid
      `,
        [id],
      ),

      db.query<CustomerRecentOrderDbRow>(
        `
        SELECT
          o.id::text AS id,
          o.order_code,
          o.order_date::text AS order_date,
          o.status::text AS status,
          o.payment_status::text AS payment_status,
          o.total_amount::double precision AS total_amount,
          o.payable_amount::double precision AS payable_amount,
          o.paid_amount::double precision AS paid_amount,
          b.name AS branch_name
        FROM orders o
        LEFT JOIN branches b ON b.id = o.branch_id
        WHERE o.customer_id = $1::uuid
        ORDER BY o.created_at DESC
        LIMIT 10
      `,
        [id],
      ),

      db.query<CustomerRecentPaymentDbRow>(
        `
        SELECT
          p.id::text AS id,
          o.id::text AS order_id,
          o.order_code,
          p.amount::double precision AS amount,
          p.mode::text AS mode,
          p.txn_reference,
          u.full_name AS received_by_name,
          p.created_at::text AS created_at
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        LEFT JOIN users u ON u.id = p.received_by
        WHERE o.customer_id = $1::uuid
        ORDER BY p.created_at DESC
        LIMIT 10
      `,
        [id],
      ),

      db.query<CustomerAuditLogDbRow>(
        `
        SELECT
          cal.id::text AS id,
          cal.action,
          cal.changed_fields,
          u.full_name AS changed_by_name,
          cal.created_at::text AS created_at
        FROM customer_audit_logs cal
        LEFT JOIN users u ON u.id = cal.changed_by
        WHERE cal.customer_id = $1::uuid
        ORDER BY cal.created_at DESC
        LIMIT 10
      `,
        [id],
      ),
    ]);

  const customerRow = customerResult.rows[0];
  if (!customerRow) return null;

  const metricsRow = metricsResult.rows[0];

  const customer: EditCustomerRow = {
    id: customerRow.id,
    customerNumericId: customerRow.customer_numeric_id,
    customerCode: customerRow.customer_code,
    type: customerRow.type,
    name: customerRow.name,
    phone: customerRow.phone,
    alternatePhone: customerRow.alternate_phone,
    address: customerRow.address,
    studioName: customerRow.studio_name,
    avatar: customerRow.avatar,
    avatarSource: customerRow.avatar_source,
    aadhaarNumber: customerRow.aadhaar_number,
    studioAssociationName: customerRow.studio_association_name,
    studioAssociationIdNumber: customerRow.studio_association_id_number,
    isActive: customerRow.is_active,
    createdAt: customerRow.created_at,
    updatedAt: customerRow.updated_at,
    createdByName: customerRow.created_by_name,
    updatedByName: customerRow.updated_by_name,
  };

  const metrics: CustomerOrderMetrics = metricsRow
    ? {
        totalOrders: metricsRow.total_orders,
        totalPayable: metricsRow.total_payable,
        totalPaid: metricsRow.total_paid,
        totalOutstanding: metricsRow.total_outstanding,
      }
    : { totalOrders: 0, totalPayable: 0, totalPaid: 0, totalOutstanding: 0 };

  const recentOrders: CustomerRecentOrder[] = recentOrdersResult.rows.map((row) => ({
    id: row.id,
    orderCode: row.order_code,
    orderDate: row.order_date,
    status: row.status,
    paymentStatus: row.payment_status,
    totalAmount: row.total_amount,
    payableAmount: row.payable_amount,
    paidAmount: row.paid_amount,
    branchName: row.branch_name,
  }));

  const recentPayments: CustomerRecentPayment[] = recentPaymentsResult.rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderCode: row.order_code,
    amount: row.amount,
    mode: row.mode,
    txnReference: row.txn_reference,
    receivedByName: row.received_by_name,
    createdAt: row.created_at,
  }));

  const auditLogs: CustomerAuditLogEntry[] = auditLogsResult.rows.map((row) => ({
    id: row.id,
    action: row.action,
    changedByName: row.changed_by_name,
    changedFields: row.changed_fields,
    createdAt: row.created_at,
  }));

  return { customer, metrics, recentOrders, recentPayments, auditLogs };
}
