import "server-only";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { getDashboardContext, NO_BRANCH_SCOPE_ID } from "@/lib/dashboard/queries";
import { getPool } from "@/lib/db/postgres";
import type {
  AddOrderPageData,
  EditOrderPageData,
  OrderCustomerOption,
  OrderDetailData,
  OrderInventoryOption,
  OrderOfferOption,
  OrderRefund,
  OrderVendorOption,
} from "@/lib/orders/types";
import { assertPermission, canAccessBranch, hasPermission } from "@/lib/auth/permissions";

export async function getAddOrderPageData(
  currentUser: AuthenticatedUser,
  requestedBranchId?: string,
): Promise<AddOrderPageData> {
  const context = await getDashboardContext(currentUser, requestedBranchId);
  const noBranchAssigned = !context.isAdmin && context.selectedBranchId === NO_BRANCH_SCOPE_ID;
  const branchId = context.selectedBranchId ?? context.branches[0]?.id ?? "";
  const selectedBranchName =
    context.branches.find((branch) => branch.id === branchId)?.name ?? context.selectedBranchName;

  const canApplyDiscount = hasPermission(currentUser, "orders:apply_discount");
  const canApplyHighDiscount = hasPermission(currentUser, "orders:apply_high_discount");

  if (!branchId || noBranchAssigned) {
    return {
      branchOptions: context.branches,
      selectedBranchId: "",
      selectedBranchName,
      canSelectBranch: context.canSelectAll,
      noBranchAssigned,
      canApplyDiscount,
      canApplyHighDiscount,
      customers: [],
      inventoryItems: [],
      offers: [],
      vendors: [],
      prefillCustomer: null,
      prefillError: null,
    };
  }

  const db = getPool();
  const [customersResult, inventoryResult, pricesResult, offersResult, vendorsResult] =
    await Promise.all([
      db.query<OrderCustomerOption>(
        `
          SELECT
            c.id::text AS id,
            c.customer_numeric_id AS "customerNumericId",
            c.customer_code AS "customerCode",
            c.type::text AS type,
            c.name,
            c.studio_name AS "studioName",
            c.phone,
            c.alternate_phone AS "alternatePhone",
            c.avatar,
            c.avatar_source AS "avatarSource",
            COALESCE(credits.balance, 0)::double precision AS "creditBalance"
          FROM customers c
          LEFT JOIN LATERAL (
            SELECT SUM(cct.amount) AS balance
            FROM customer_credit_transactions cct
            WHERE cct.customer_id = c.id
          ) credits ON true
          WHERE c.is_active = true
          ORDER BY c.created_at DESC
          LIMIT 10
        `,
      ),
      db.query<Omit<OrderInventoryOption, "prices">>(
        `
          SELECT
            i.id::text AS id,
            i.name,
            i.sku,
            i.quantity::double precision AS quantity,
            i.unit::text AS unit
          FROM inventory i
          WHERE i.branch_id = $1::uuid
            AND i.is_active = true
            AND i.deleted_at IS NULL
          ORDER BY lower(i.name) ASC
        `,
        [branchId],
      ),
      db.query<{ inventoryId: string; customerType: string; sellingRate: number }>(
        `
          SELECT DISTINCT ON (ip.inventory_id, ip.customer_type)
            ip.inventory_id::text AS "inventoryId",
            ip.customer_type::text AS "customerType",
            ip.selling_rate::double precision AS "sellingRate"
          FROM inventory_pricing ip
          WHERE ip.branch_id = $1::uuid
            AND ip.effective_from <= CURRENT_DATE
            AND (ip.effective_to IS NULL OR ip.effective_to >= CURRENT_DATE)
          ORDER BY ip.inventory_id, ip.customer_type, ip.effective_from DESC
        `,
        [branchId],
      ),
      db.query<OrderOfferOption>(
        `
          SELECT
            o.id::text AS id,
            o.code,
            o.name,
            o.offer_type AS "offerType",
            o.discount_value::double precision AS "discountValue",
            o.buy_quantity AS "buyQuantity",
            o.get_quantity AS "getQuantity",
            o.minimum_order_value::double precision AS "minimumOrderValue",
            o.customer_types::text[] AS "customerTypes",
            o.starts_at::text AS "startsAt",
            o.ends_at::text AS "endsAt"
          FROM offers o
          WHERE o.branch_id = $1::uuid
            AND o.is_active = true
            AND o.starts_at <= CURRENT_DATE
            AND (o.ends_at IS NULL OR o.ends_at >= CURRENT_DATE)
          ORDER BY lower(o.name) ASC
        `,
        [branchId],
      ),
      db.query<OrderVendorOption>(
        `
          SELECT v.id::text AS id, v.name
          FROM vendors v
          WHERE v.is_active = true
          ORDER BY lower(v.name) ASC
        `,
      ),
    ]);

  const pricesByInventory = new Map<string, OrderInventoryOption["prices"]>();
  for (const price of pricesResult.rows) {
    const prices = pricesByInventory.get(price.inventoryId) ?? {};
    prices[price.customerType as keyof OrderInventoryOption["prices"]] = price.sellingRate;
    pricesByInventory.set(price.inventoryId, prices);
  }

  return {
    branchOptions: context.branches,
    selectedBranchId: branchId,
    selectedBranchName,
    canSelectBranch: context.canSelectAll,
    noBranchAssigned: false,
    canApplyDiscount,
    canApplyHighDiscount,
    customers: customersResult.rows,
    inventoryItems: inventoryResult.rows.map((item) => ({
      ...item,
      prices: pricesByInventory.get(item.id) ?? {},
    })),
    offers: offersResult.rows,
    vendors: vendorsResult.rows,
    prefillCustomer: null,
    prefillError: null,
  };
}

export async function getOrderPrefillCustomer(
  customerId: string,
): Promise<OrderCustomerOption | null> {
  const db = getPool();
  const { rows } = await db.query<OrderCustomerOption>(
    `
      SELECT
        c.id::text AS id,
        c.customer_numeric_id AS "customerNumericId",
        c.customer_code AS "customerCode",
        c.type::text AS type,
        c.name,
        c.studio_name AS "studioName",
        c.phone,
        c.alternate_phone AS "alternatePhone",
        c.avatar,
        c.avatar_source AS "avatarSource",
        COALESCE(credits.balance, 0)::double precision AS "creditBalance"
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT SUM(cct.amount) AS balance
        FROM customer_credit_transactions cct
        WHERE cct.customer_id = c.id
      ) credits ON true
      WHERE c.id = $1::uuid
        AND c.is_active = true
      LIMIT 1
    `,
    [customerId],
  );
  return rows[0] ?? null;
}

export async function getOrderDetail(
  currentUser: AuthenticatedUser,
  orderId: string,
): Promise<OrderDetailData | null> {
  assertPermission(currentUser, "orders:view");

  const db = getPool();
  const { rows: orderRows } = await db.query<OrderDetailData["order"]>(
    `
      SELECT
        o.id::text AS id,
        o.order_code AS "orderCode",
        o.branch_id::text AS "branchId",
        b.name AS "branchName",
        c.id::text AS "customerId",
        c.name AS "customerName",
        c.phone AS "customerPhone",
        c.customer_code AS "customerCode",
        c.type::text AS "customerType",
        o.status::text AS status,
        o.total_amount::double precision AS "totalAmount",
        o.discount_amount::double precision AS "discountAmount",
        o.offer_discount_amount::double precision AS "offerDiscountAmount",
        o.manual_discount_amount::double precision AS "manualDiscountAmount",
        o.payable_amount::double precision AS "payableAmount",
        o.paid_amount::double precision AS "paidAmount",
        o.payment_status::text AS "paymentStatus",
        o.order_date::text AS "orderDate",
        o.created_at::text AS "createdAt",
        o.updated_at::text AS "updatedAt",
        u.full_name AS "createdByName",
        o.is_deleted AS "isDeleted",
        o.cancellation_reason AS "cancellationReason",
        o.deletion_reason AS "deletionReason"
      FROM orders o
      JOIN branches b ON b.id = o.branch_id
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users u ON u.id = o.created_by
      WHERE o.id = $1::uuid
      LIMIT 1
    `,
    [orderId],
  );

  const order = orderRows[0];
  if (!order) return null;
  if (!canAccessBranch(currentUser, order.branchId)) return null;

  const [
    itemsResult,
    offersResult,
    paymentsResult,
    vendorsResult,
    vendorPaymentsResult,
    refundsResult,
    auditResult,
  ] = await Promise.all([
    db.query<OrderDetailData["items"][number]>(
      `
          SELECT
            oi.id::text AS id,
            oi.inventory_id::text AS "inventoryId",
            i.name,
            i.sku,
            oi.quantity::double precision AS quantity,
            i.unit::text AS unit,
            oi.unit_price::double precision AS "unitPrice",
            oi.line_total::double precision AS "lineTotal"
          FROM order_items oi
          JOIN inventory i ON i.id = oi.inventory_id
          WHERE oi.order_id = $1::uuid
          ORDER BY oi.created_at ASC
        `,
      [orderId],
    ),
    db.query<OrderDetailData["offers"][number]>(
      `
          SELECT
            oao.id::text AS id,
            oao.offer_id::text AS "offerId",
            oao.code,
            oao.name,
            oao.offer_type AS "offerType",
            oao.discount_amount::double precision AS "discountAmount"
          FROM order_applied_offers oao
          WHERE oao.order_id = $1::uuid
          ORDER BY oao.created_at ASC
        `,
      [orderId],
    ),
    db.query<OrderDetailData["payments"][number]>(
      `
          SELECT
            p.id::text AS id,
            p.amount::double precision AS amount,
            p.mode::text AS mode,
            p.txn_reference AS "txnReference",
            u.full_name AS "receivedByName",
            p.created_at::text AS "createdAt"
          FROM payments p
          LEFT JOIN users u ON u.id = p.received_by
          WHERE p.order_id = $1::uuid
          ORDER BY p.created_at DESC
        `,
      [orderId],
    ),
    db.query<Omit<OrderDetailData["vendors"][number], "payments">>(
      `
          SELECT
            ov.id::text AS id,
            ov.vendor_id::text AS "vendorId",
            v.name AS "vendorName",
            ov.vendor_charge_amount::double precision AS "chargeAmount",
            COALESCE(expenses.paid_amount, 0)::double precision AS "paidAmount",
            GREATEST(
              ov.vendor_charge_amount - COALESCE(expenses.paid_amount, 0),
              0
            )::double precision AS "balanceAmount",
            ov.status,
            ov.expected_delivery_date::text AS "expectedDeliveryDate",
            ov.notes
          FROM order_vendors ov
          JOIN vendors v ON v.id = ov.vendor_id
          LEFT JOIN LATERAL (
            SELECT SUM(be.amount) AS paid_amount
            FROM branch_expenses be
            WHERE be.order_vendor_id = ov.id
          ) expenses ON true
          WHERE ov.order_id = $1::uuid
          ORDER BY ov.created_at DESC
        `,
      [orderId],
    ),
    db.query<OrderDetailData["vendors"][number]["payments"][number] & { orderVendorId: string }>(
      `
          SELECT
            be.order_vendor_id::text AS "orderVendorId",
            be.id::text AS id,
            be.title,
            be.amount::double precision AS amount,
            be.payment_mode::text AS "paymentMode",
            be.expense_date::text AS "expenseDate",
            be.remarks,
            u.full_name AS "createdByName",
            be.created_at::text AS "createdAt"
          FROM branch_expenses be
          LEFT JOIN users u ON u.id = be.created_by
          WHERE be.order_vendor_id IN (
            SELECT ov.id
            FROM order_vendors ov
            WHERE ov.order_id = $1::uuid
          )
          ORDER BY be.expense_date DESC, be.created_at DESC
        `,
      [orderId],
    ),
    db.query<OrderRefund>(
      `
          SELECT
            r.id::text AS id,
            r.trigger_action AS "triggerAction",
            r.reason,
            r.refund_basis_amount::double precision AS "refundBasisAmount",
            r.refund_percent::double precision AS "refundPercent",
            r.refund_amount::double precision AS "refundAmount",
            r.refund_mode::text AS "refundMode",
            r.refund_status::text AS "refundStatus",
            r.txn_reference AS "txnReference",
            u.full_name AS "createdByName",
            r.created_at::text AS "createdAt",
            r.updated_at::text AS "updatedAt"
          FROM order_refunds r
          LEFT JOIN users u ON u.id = r.created_by
          WHERE r.order_id = $1::uuid
          ORDER BY r.created_at DESC
        `,
      [orderId],
    ),
    db.query<OrderDetailData["auditLogs"][number]>(
      `
          SELECT
            oal.id::text AS id,
            oal.action,
            oal.changed_fields AS "changedFields",
            u.full_name AS "changedByName",
            oal.created_at::text AS "createdAt"
          FROM order_audit_logs oal
          LEFT JOIN users u ON u.id = oal.changed_by
          WHERE oal.order_id = $1::uuid
          ORDER BY oal.created_at DESC
          LIMIT 30
        `,
      [orderId],
    ),
  ]);

  const vendorPaymentsByOrderVendorId = new Map<
    string,
    OrderDetailData["vendors"][number]["payments"]
  >();
  for (const payment of vendorPaymentsResult.rows) {
    const payments = vendorPaymentsByOrderVendorId.get(payment.orderVendorId) ?? [];
    payments.push({
      id: payment.id,
      title: payment.title,
      amount: payment.amount,
      paymentMode: payment.paymentMode,
      expenseDate: payment.expenseDate,
      remarks: payment.remarks,
      createdByName: payment.createdByName,
      createdAt: payment.createdAt,
    });
    vendorPaymentsByOrderVendorId.set(payment.orderVendorId, payments);
  }

  return {
    order,
    items: itemsResult.rows,
    offers: offersResult.rows,
    payments: paymentsResult.rows,
    vendors: vendorsResult.rows.map((vendor) => ({
      ...vendor,
      payments: vendorPaymentsByOrderVendorId.get(vendor.id) ?? [],
    })),
    refunds: refundsResult.rows,
    auditLogs: auditResult.rows,
  };
}

export async function getEditOrderPageData(
  currentUser: AuthenticatedUser,
  orderId: string,
): Promise<EditOrderPageData | null> {
  const detail = await getOrderDetail(currentUser, orderId);
  if (!detail) return null;
  const pageData = await getAddOrderPageData(currentUser, detail.order.branchId);
  return { ...pageData, detail };
}
