import "server-only";
import { getPool } from "@/lib/db/postgres";
import type {
  CustomerAuditLogEntry,
  CustomerCreditTransactionEntry,
  CustomerDetailPageData,
  CustomerOrderMetrics,
  CustomerRecentOrder,
  CustomerRecentPayment,
  CustomerRefundEntry,
  CustomerTypeOption,
  EditCustomerRow,
} from "@/lib/customers/types";
import { formatEnumLabel } from "@/lib/utils/format";

export async function getCustomerTypeOptions(): Promise<CustomerTypeOption[]> {
  const db = getPool();
  const { rows } = await db.query<{ value: string }>(
    `
      SELECT enumlabel AS value
      FROM pg_enum
      WHERE enumtypid = 'customer_type'::regtype
      ORDER BY enumsortorder
    `,
  );

  return rows.map((row) => ({ value: row.value, label: formatEnumLabel(row.value) }));
}

export async function getCustomerTypeValues(): Promise<string[]> {
  const options = await getCustomerTypeOptions();
  return options.map((option) => option.value);
}

type EditCustomerDbRow = {
  id: string;
  customer_numeric_id: number;
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
  cancelled_orders: number;
  credit_balance: number;
  total_refunded: number;
  pending_refund_amount: number;
};

type CustomerRefundDbRow = {
  id: string;
  order_id: string;
  order_code: string;
  trigger_action: string;
  reason: string;
  refund_amount: number;
  refund_mode: string;
  refund_status: string;
  created_at: string;
};

type CustomerCreditTransactionDbRow = {
  id: string;
  transaction_type: string;
  amount: number;
  related_order_code: string | null;
  note: string | null;
  created_at: string;
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

  const [
    customerResult,
    metricsResult,
    recentOrdersResult,
    recentPaymentsResult,
    recentRefundsResult,
    recentCreditTransactionsResult,
    auditLogsResult,
  ] = await Promise.all([
    db.query<EditCustomerDbRow>(
      `
        SELECT
          c.id::text AS id,
          c.customer_numeric_id,
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
            AS total_outstanding,
          COUNT(o.id) FILTER (WHERE o.status::text = 'cancelled')::int AS cancelled_orders,
          COALESCE(
            (SELECT SUM(cct.amount) FROM customer_credit_transactions cct
              WHERE cct.customer_id = $1::uuid), 0
          )::double precision AS credit_balance,
          COALESCE(
            (SELECT SUM(r.refund_amount) FROM order_refunds r
              WHERE r.customer_id = $1::uuid AND r.refund_status = 'completed'), 0
          )::double precision AS total_refunded,
          COALESCE(
            (SELECT SUM(r.refund_amount) FROM order_refunds r
              WHERE r.customer_id = $1::uuid AND r.refund_status IN ('pending', 'processing')), 0
          )::double precision AS pending_refund_amount
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

    db.query<CustomerRefundDbRow>(
      `
        SELECT
          r.id::text AS id,
          r.order_id::text AS order_id,
          o.order_code,
          r.trigger_action,
          r.reason,
          r.refund_amount::double precision AS refund_amount,
          r.refund_mode::text AS refund_mode,
          r.refund_status::text AS refund_status,
          r.created_at::text AS created_at
        FROM order_refunds r
        JOIN orders o ON o.id = r.order_id
        WHERE r.customer_id = $1::uuid
        ORDER BY r.created_at DESC
        LIMIT 10
      `,
      [id],
    ),

    db.query<CustomerCreditTransactionDbRow>(
      `
        SELECT
          cct.id::text AS id,
          cct.transaction_type,
          cct.amount::double precision AS amount,
          o.order_code AS related_order_code,
          cct.note,
          cct.created_at::text AS created_at
        FROM customer_credit_transactions cct
        LEFT JOIN orders o ON o.id = cct.related_order_id
        WHERE cct.customer_id = $1::uuid
        ORDER BY cct.created_at DESC
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
        cancelledOrders: metricsRow.cancelled_orders,
        creditBalance: metricsRow.credit_balance,
        totalRefunded: metricsRow.total_refunded,
        pendingRefundAmount: metricsRow.pending_refund_amount,
      }
    : {
        totalOrders: 0,
        totalPayable: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        cancelledOrders: 0,
        creditBalance: 0,
        totalRefunded: 0,
        pendingRefundAmount: 0,
      };

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

  const recentRefunds: CustomerRefundEntry[] = recentRefundsResult.rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderCode: row.order_code,
    triggerAction: row.trigger_action,
    reason: row.reason,
    refundAmount: row.refund_amount,
    refundMode: row.refund_mode,
    refundStatus: row.refund_status,
    createdAt: row.created_at,
  }));

  const recentCreditTransactions: CustomerCreditTransactionEntry[] =
    recentCreditTransactionsResult.rows.map((row) => ({
      id: row.id,
      transactionType: row.transaction_type,
      amount: row.amount,
      relatedOrderCode: row.related_order_code,
      note: row.note,
      createdAt: row.created_at,
    }));

  const auditLogs: CustomerAuditLogEntry[] = auditLogsResult.rows.map((row) => ({
    id: row.id,
    action: row.action,
    changedByName: row.changed_by_name,
    changedFields: row.changed_fields,
    createdAt: row.created_at,
  }));

  return {
    customer,
    metrics,
    recentOrders,
    recentPayments,
    recentRefunds,
    recentCreditTransactions,
    auditLogs,
  };
}
