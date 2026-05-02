import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission, canAccessBranch } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import {
  type AddOrderPaymentInput,
  type CreateOrderInput,
  type RecordOrderVendorPaymentInput,
  type UpdateOrderInput,
  type UpdateOrderStatusInput,
  type UpsertOrderVendorInput,
} from "@/lib/orders/schema";
import {
  canAddCustomerPayment,
  canAddVendorPayment,
  canCancelOrder,
  canEditOrder,
  canEditOrderDiscount,
  canEditOrderItems,
  canEditOrderVendor,
  canUpdateOrderStatus,
} from "@/lib/orders/guards";

type MutationFieldErrors = Partial<Record<string, string>>;

export class OrderMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "OrderMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

type CustomerRow = {
  id: string;
  type: string;
};

type InventoryPricingRow = {
  inventory_id: string;
  name: string;
  quantity: number;
  selling_rate: number | null;
};

type OfferRuleRow = {
  id: string;
  code: string;
  name: string;
  offer_type: "percentage" | "flat" | "buy_x_get_y";
  discount_value: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  minimum_order_value: number | null;
  customer_type: string | null;
};

type MutableOrderRow = {
  id: string;
  order_code: string;
  branch_id: string;
  customer_id: string;
  status: string;
  discount_amount: number;
  payable_amount: number;
  paid_amount: number;
};

type OrderAuditAction =
  | "order_updated"
  | "items_updated"
  | "discount_updated"
  | "status_changed"
  | "cancelled"
  | "customer_payment_added"
  | "vendor_assigned"
  | "vendor_updated"
  | "vendor_payment_recorded";

function parseAmount(value: string | undefined) {
  return value ? Number.parseFloat(value) : 0;
}

function normalizeOptional(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function resolveCustomer(client: PoolClient, input: CreateOrderInput): Promise<CustomerRow> {
  if (input.customerMode === "existing") {
    const { rows } = await client.query<CustomerRow>(
      `
        SELECT c.id::text AS id, c.type::text AS type
        FROM customers c
        WHERE c.id = $1::uuid
        LIMIT 1
      `,
      [input.customerId],
    );
    const customer = rows[0];
    if (!customer) {
      throw new OrderMutationError("Select a valid customer.", {
        status: 400,
        fieldErrors: { customerId: "Select a valid customer." },
      });
    }
    return customer;
  }

  const { rows } = await client.query<CustomerRow>(
    `
      INSERT INTO customers
        (
          customer_numeric_id, customer_code, type, name, studio_name,
          phone, alternate_phone, address
        )
      VALUES
        ($1, $2, $3::customer_type, $4, $5, $6, $7, $8)
      RETURNING id::text AS id, type::text AS type
    `,
    [
      input.customerNumericId ? Number.parseInt(input.customerNumericId, 10) : null,
      normalizeOptional(input.customerCode),
      input.customerType,
      input.customerName,
      normalizeOptional(input.studioName),
      input.customerPhone,
      normalizeOptional(input.alternatePhone),
      normalizeOptional(input.customerAddress),
    ],
  );

  return rows[0];
}

async function getPricedInventory(
  client: PoolClient,
  branchId: string,
  inventoryId: string,
  customerType: string,
): Promise<InventoryPricingRow> {
  const { rows } = await client.query<InventoryPricingRow>(
    `
      SELECT
        i.id::text AS inventory_id,
        i.name,
        i.quantity::double precision AS quantity,
        price.selling_rate::double precision AS selling_rate
      FROM inventory i
      LEFT JOIN LATERAL (
        SELECT ip.selling_rate
        FROM inventory_pricing ip
        WHERE ip.branch_id = i.branch_id
          AND ip.inventory_id = i.id
          AND ip.customer_type = $3::customer_type
          AND ip.effective_from <= CURRENT_DATE
          AND (ip.effective_to IS NULL OR ip.effective_to >= CURRENT_DATE)
        ORDER BY ip.effective_from DESC
        LIMIT 1
      ) price ON true
      WHERE i.id = $1::uuid
        AND i.branch_id = $2::uuid
        AND i.is_active = true
        AND i.deleted_at IS NULL
      FOR UPDATE OF i
      LIMIT 1
    `,
    [inventoryId, branchId, customerType],
  );

  const item = rows[0];
  if (!item) {
    throw new OrderMutationError("Select active inventory items for this branch.", {
      status: 400,
      fieldErrors: { items: "One or more selected items are unavailable." },
    });
  }
  if (item.selling_rate === null) {
    throw new OrderMutationError(`No current price found for ${item.name}.`, {
      status: 400,
      fieldErrors: { items: `No current price found for ${item.name}.` },
    });
  }

  return item;
}

async function getOfferRules(
  client: PoolClient,
  branchId: string,
  offerIds: string[],
  customerType: string,
  subtotal: number,
): Promise<OfferRuleRow[]> {
  if (offerIds.length === 0) return [];

  const { rows } = await client.query<OfferRuleRow>(
    `
      SELECT
        o.id::text AS id,
        o.code,
        o.name,
        o.offer_type,
        o.discount_value::double precision AS discount_value,
        o.buy_quantity,
        o.get_quantity,
        o.minimum_order_value::double precision AS minimum_order_value,
        o.customer_type::text AS customer_type
      FROM offers o
      WHERE o.id = ANY($1::uuid[])
        AND o.branch_id = $2::uuid
        AND o.is_active = true
        AND o.starts_at <= CURRENT_DATE
        AND (o.ends_at IS NULL OR o.ends_at >= CURRENT_DATE)
        AND (o.customer_type IS NULL OR o.customer_type = $3::customer_type)
        AND (o.minimum_order_value IS NULL OR o.minimum_order_value <= $4::numeric)
    `,
    [offerIds, branchId, customerType, subtotal],
  );

  if (rows.length !== new Set(offerIds).size) {
    throw new OrderMutationError("One or more selected offers are no longer eligible.", {
      status: 400,
      fieldErrors: { offerIds: "Refresh and choose eligible offers." },
    });
  }

  return rows;
}

function calculateOfferDiscount(offer: OfferRuleRow, remainingSubtotal: number) {
  if (offer.offer_type === "percentage") {
    return roundMoney(remainingSubtotal * ((offer.discount_value ?? 0) / 100));
  }
  if (offer.offer_type === "flat") {
    return Math.min(remainingSubtotal, offer.discount_value ?? 0);
  }
  return 0;
}

async function fetchOrderSnapshot(client: PoolClient, orderId: string) {
  const { rows } = await client.query<{ snapshot: unknown }>(
    `
      SELECT jsonb_build_object(
        'order', to_jsonb(o),
        'items', COALESCE(items.items, '[]'::jsonb),
        'payments', COALESCE(payments.payments, '[]'::jsonb),
        'vendors', COALESCE(vendors.vendors, '[]'::jsonb),
        'offers', COALESCE(offers.offers, '[]'::jsonb)
      ) AS snapshot
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.created_at) AS items
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) items ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at) AS payments
        FROM payments p
        WHERE p.order_id = o.id
      ) payments ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(ov) ORDER BY ov.created_at) AS vendors
        FROM order_vendors ov
        WHERE ov.order_id = o.id
      ) vendors ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(oao) ORDER BY oao.created_at) AS offers
        FROM order_applied_offers oao
        WHERE oao.order_id = o.id
      ) offers ON true
      WHERE o.id = $1::uuid
      LIMIT 1
    `,
    [orderId],
  );

  return rows[0]?.snapshot;
}

async function fetchMutableOrder(client: PoolClient, orderId: string): Promise<MutableOrderRow> {
  const { rows } = await client.query<MutableOrderRow>(
    `
      SELECT
        id::text AS id,
        order_code,
        branch_id::text AS branch_id,
        customer_id::text AS customer_id,
        status::text AS status,
        discount_amount::double precision AS discount_amount,
        payable_amount::double precision AS payable_amount,
        paid_amount::double precision AS paid_amount
      FROM orders
      WHERE id = $1::uuid
      FOR UPDATE
      LIMIT 1
    `,
    [orderId],
  );

  const order = rows[0];
  if (!order) throw new OrderMutationError("Order not found.", { status: 404 });
  return order;
}

type MutableOrderVendorRow = {
  id: string;
  order_id: string;
  branch_id: string;
  order_code: string;
  order_status: string;
  vendor_id: string;
  vendor_status: string;
  vendor_charge_amount: number;
  paid_amount: number;
};

async function fetchMutableOrderVendor(
  client: PoolClient,
  orderVendorId: string,
): Promise<MutableOrderVendorRow> {
  const { rows } = await client.query<MutableOrderVendorRow>(
    `
      SELECT
        ov.id::text AS id,
        ov.order_id::text AS order_id,
        o.branch_id::text AS branch_id,
        o.order_code,
        o.status::text AS order_status,
        ov.vendor_id::text AS vendor_id,
        ov.status AS vendor_status,
        ov.vendor_charge_amount::double precision AS vendor_charge_amount,
        COALESCE(expenses.paid_amount, 0)::double precision AS paid_amount
      FROM order_vendors ov
      JOIN orders o ON o.id = ov.order_id
      LEFT JOIN LATERAL (
        SELECT SUM(be.amount) AS paid_amount
        FROM branch_expenses be
        WHERE be.order_vendor_id = ov.id
      ) expenses ON true
      WHERE ov.id = $1::uuid
      FOR UPDATE OF ov
      LIMIT 1
    `,
    [orderVendorId],
  );

  const orderVendor = rows[0];
  if (!orderVendor) throw new OrderMutationError("Order vendor not found.", { status: 404 });
  return orderVendor;
}

async function getVendorPaymentCategoryId(client: PoolClient): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `
      SELECT id::text AS id
      FROM expense_categories
      WHERE code = 'vendor_payment'
        AND is_active = true
      LIMIT 1
    `,
  );
  const categoryId = rows[0]?.id;
  if (!categoryId) {
    throw new OrderMutationError("Vendor payment category is missing.", { status: 500 });
  }
  return categoryId;
}

async function insertOrderAudit(
  client: PoolClient,
  orderId: string,
  action: OrderAuditAction,
  changedBy: string,
) {
  const snapshot = await fetchOrderSnapshot(client, orderId);
  await client.query(
    `
      INSERT INTO order_audit_logs (order_id, action, snapshot, changed_by)
      VALUES ($1::uuid, $2, $3::jsonb, $4::uuid)
    `,
    [orderId, action, JSON.stringify(snapshot), changedBy],
  );
}

export async function createOrder(
  currentUser: AuthenticatedUser,
  input: CreateOrderInput,
): Promise<{ id: string; orderCode: string; redirectTo: string }> {
  assertPermission(currentUser, "orders:create");

  if (!canAccessBranch(currentUser, input.branchId)) {
    throw new OrderMutationError("You do not have access to this branch.", { status: 403 });
  }

  if (currentUser.role !== "admin" && currentUser.branchId !== input.branchId) {
    throw new OrderMutationError(
      "Orders must be created by a user assigned to the selected branch.",
      {
        status: 403,
        fieldErrors: { branchId: "Select your assigned branch." },
      },
    );
  }

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const customer = await resolveCustomer(client, input);
    const itemInputs = input.items;
    const pricedItems = [];
    let subtotal = 0;

    for (const itemInput of itemInputs) {
      const quantity = Number.parseFloat(itemInput.quantity);
      const item = await getPricedInventory(
        client,
        input.branchId,
        itemInput.inventoryId,
        customer.type,
      );
      if (item.quantity < quantity) {
        throw new OrderMutationError(`Insufficient stock for ${item.name}.`, {
          status: 400,
          fieldErrors: { items: `Insufficient stock for ${item.name}.` },
        });
      }
      const unitPrice = item.selling_rate ?? 0;
      const lineTotal = roundMoney(quantity * unitPrice);
      subtotal = roundMoney(subtotal + lineTotal);
      pricedItems.push({ inventoryId: item.inventory_id, quantity, unitPrice, lineTotal });
    }

    const offers = await getOfferRules(
      client,
      input.branchId,
      input.offerIds,
      customer.type,
      subtotal,
    );
    let discountAmount = 0;
    for (const offer of offers) {
      const remaining = Math.max(0, subtotal - discountAmount);
      discountAmount = roundMoney(discountAmount + calculateOfferDiscount(offer, remaining));
    }
    discountAmount = Math.min(discountAmount, subtotal);
    const payableAmount = roundMoney(subtotal - discountAmount);
    const initialPayment = parseAmount(input.initialPaymentAmount);

    if (initialPayment > payableAmount) {
      throw new OrderMutationError("Initial payment cannot exceed payable amount.", {
        status: 400,
        fieldErrors: { initialPaymentAmount: "Payment cannot exceed payable amount." },
      });
    }

    const { rows: orderRows } = await client.query<{ id: string; orderCode: string }>(
      `
        INSERT INTO orders (branch_id, created_by, customer_id, discount_amount)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 0)
        RETURNING id::text AS id, order_code AS "orderCode"
      `,
      [input.branchId, currentUser.userId, customer.id],
    );
    const order = orderRows[0];

    for (const item of pricedItems) {
      await client.query(
        `
          INSERT INTO order_items (order_id, inventory_id, quantity, unit_price, line_total)
          VALUES ($1::uuid, $2::uuid, $3::numeric(12,3), $4::numeric(14,2), $5::numeric(16,2))
        `,
        [order.id, item.inventoryId, item.quantity, item.unitPrice, item.lineTotal],
      );
    }

    if (discountAmount > 0) {
      await client.query(
        `
          UPDATE orders
          SET discount_amount = $2::numeric(14,2)
          WHERE id = $1::uuid
        `,
        [order.id, discountAmount],
      );
    }

    let appliedDiscount = 0;
    for (const offer of offers) {
      const discount = Math.min(
        subtotal - appliedDiscount,
        calculateOfferDiscount(offer, Math.max(0, subtotal - appliedDiscount)),
      );
      appliedDiscount = roundMoney(appliedDiscount + discount);
      await client.query(
        `
          INSERT INTO order_applied_offers
            (order_id, offer_id, code, name, offer_type, discount_amount, snapshot)
          VALUES
            ($1::uuid, $2::uuid, $3, $4, $5, $6::numeric(14,2), $7::jsonb)
        `,
        [
          order.id,
          offer.id,
          offer.code,
          offer.name,
          offer.offer_type,
          roundMoney(discount),
          JSON.stringify(offer),
        ],
      );
    }

    if (initialPayment > 0) {
      await client.query(
        `
          INSERT INTO payments (order_id, branch_id, received_by, amount, mode, txn_reference)
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric(14,2), $5::payment_mode, $6)
        `,
        [
          order.id,
          input.branchId,
          currentUser.userId,
          initialPayment,
          input.paymentMode,
          normalizeOptional(input.txnReference),
        ],
      );
    }

    if (input.vendorId) {
      const charge = parseAmount(input.vendorChargeAmount);
      const paid = parseAmount(input.vendorPaidAmount);
      const balance = roundMoney(charge - paid);
      const { rows: vendorRows } = await client.query<{ id: string }>(
        `
          INSERT INTO order_vendors
            (
              order_id, vendor_id, vendor_charge_amount, vendor_paid_amount,
              vendor_balance_amount, status, expected_delivery_date, notes, created_by, updated_by
            )
          VALUES
            ($1::uuid, $2::uuid, $3::numeric(14,2), $4::numeric(14,2),
             $5::numeric(14,2), $6, $7::date, $8, $9::uuid, $9::uuid)
          RETURNING id::text AS id
        `,
        [
          order.id,
          input.vendorId,
          charge,
          paid,
          balance,
          "assigned",
          input.vendorExpectedDeliveryDate ?? null,
          normalizeOptional(input.vendorNotes),
          currentUser.userId,
        ],
      );

      if (paid > 0) {
        const { rows: categoryRows } = await client.query<{ id: string }>(
          `
            SELECT id::text AS id
            FROM expense_categories
            WHERE code = 'vendor_payment'
              AND is_active = true
            LIMIT 1
          `,
        );
        const categoryId = categoryRows[0]?.id;
        if (!categoryId) {
          throw new OrderMutationError("Vendor payment category is missing.", { status: 500 });
        }

        await client.query(
          `
            INSERT INTO branch_expenses
              (
                branch_id, title, amount, category_id, expense_date,
                remarks, payment_mode, order_vendor_id, created_by, updated_by
              )
            VALUES
              ($1::uuid, $2, $3::numeric(14,2), $4::uuid, CURRENT_DATE,
               $5, $6::payment_mode, $7::uuid, $8::uuid, $8::uuid)
          `,
          [
            input.branchId,
            `Vendor payment for ${order.orderCode}`,
            paid,
            categoryId,
            normalizeOptional(input.vendorNotes),
            input.paymentMode || "cash",
            vendorRows[0].id,
            currentUser.userId,
          ],
        );
      }
    }

    const snapshot = await fetchOrderSnapshot(client, order.id);
    await client.query(
      `
        INSERT INTO order_audit_logs (order_id, action, snapshot, changed_by)
        VALUES ($1::uuid, 'create', $2::jsonb, $3::uuid)
      `,
      [order.id, JSON.stringify(snapshot), currentUser.userId],
    );

    await client.query("COMMIT");

    return { id: order.id, orderCode: order.orderCode, redirectTo: "/dashboard/orders" };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OrderMutationError) throw error;

    const message = error instanceof Error ? error.message : "";
    if (message.includes("customers_customer_code_key")) {
      throw new OrderMutationError("A customer with this code already exists.", {
        status: 409,
        fieldErrors: { customerCode: "This code is already in use." },
      });
    }
    if (message.includes("customers_customer_numeric_id_key")) {
      throw new OrderMutationError("A customer with this numeric ID already exists.", {
        status: 409,
        fieldErrors: { customerNumericId: "This numeric ID is already in use." },
      });
    }
    if (message.includes("customers_phone")) {
      throw new OrderMutationError("A customer with this phone already exists.", {
        status: 409,
        fieldErrors: { customerPhone: "This phone is already in use." },
      });
    }

    console.error("Order creation failed", error);
    throw new OrderMutationError("Unable to create order right now.", { status: 500 });
  } finally {
    client.release();
  }
}

export async function addOrderPayment(
  currentUser: AuthenticatedUser,
  orderId: string,
  input: AddOrderPaymentInput,
) {
  assertPermission(currentUser, "orders:add_payment");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const order = await fetchMutableOrder(client, orderId);
    if (!canAddCustomerPayment(currentUser, { branchId: order.branch_id, status: order.status })) {
      throw new OrderMutationError("Payments are not allowed for this order.", { status: 403 });
    }

    const amount = Number.parseFloat(input.amount);
    const outstanding = roundMoney(order.payable_amount - order.paid_amount);
    if (amount > outstanding) {
      throw new OrderMutationError("Payment cannot exceed outstanding balance.", {
        status: 400,
        fieldErrors: { amount: "Payment cannot exceed outstanding balance." },
      });
    }

    await client.query(
      `
        INSERT INTO payments (order_id, branch_id, received_by, amount, mode, txn_reference)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric(14,2), $5::payment_mode, $6)
      `,
      [
        order.id,
        order.branch_id,
        currentUser.userId,
        amount,
        input.paymentMode,
        normalizeOptional(input.txnReference),
      ],
    );

    await insertOrderAudit(client, order.id, "customer_payment_added", currentUser.userId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OrderMutationError) throw error;
    console.error("Order payment failed", error);
    throw new OrderMutationError("Unable to record payment right now.", { status: 500 });
  } finally {
    client.release();
  }
}

export async function upsertOrderVendor(
  currentUser: AuthenticatedUser,
  orderId: string,
  input: UpsertOrderVendorInput,
) {
  assertPermission(currentUser, "orders:edit_vendor");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const order = await fetchMutableOrder(client, orderId);
    if (!canEditOrderVendor(currentUser, { branchId: order.branch_id, status: order.status })) {
      throw new OrderMutationError("Vendor details cannot be edited for this order.", {
        status: 403,
      });
    }

    const { rows: vendorRows } = await client.query<{ id: string }>(
      `
        SELECT id::text AS id
        FROM vendors
        WHERE id = $1::uuid
          AND is_active = true
        LIMIT 1
      `,
      [input.vendorId],
    );
    if (!vendorRows[0]) {
      throw new OrderMutationError("Select an active vendor.", {
        status: 400,
        fieldErrors: { vendorId: "Select an active vendor." },
      });
    }

    const charge = parseAmount(input.vendorChargeAmount);
    const { rows: existingRows } = await client.query<{ id: string }>(
      `
        SELECT id::text AS id
        FROM order_vendors
        WHERE order_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [order.id],
    );
    const existing = existingRows[0];

    if (existing) {
      const { rows: paidRows } = await client.query<{ paidAmount: number }>(
        `
          SELECT COALESCE(SUM(amount), 0)::double precision AS "paidAmount"
          FROM branch_expenses
          WHERE order_vendor_id = $1::uuid
        `,
        [existing.id],
      );
      const paidAmount = paidRows[0]?.paidAmount ?? 0;
      if (paidAmount > charge) {
        throw new OrderMutationError("Vendor charge cannot be below amount already paid.", {
          status: 400,
          fieldErrors: { vendorChargeAmount: "Charge cannot be below paid amount." },
        });
      }

      await client.query(
        `
          UPDATE order_vendors
          SET vendor_id = $2::uuid,
              vendor_charge_amount = $3::numeric(14,2),
              vendor_paid_amount = $4::numeric(14,2),
              vendor_balance_amount = $5::numeric(14,2),
              status = $6,
              expected_delivery_date = $7::date,
              notes = $8,
              updated_by = $9::uuid,
              updated_at = now()
          WHERE id = $1::uuid
        `,
        [
          existing.id,
          input.vendorId,
          charge,
          paidAmount,
          roundMoney(charge - paidAmount),
          input.vendorStatus,
          input.expectedDeliveryDate ?? null,
          normalizeOptional(input.notes),
          currentUser.userId,
        ],
      );
      await insertOrderAudit(client, order.id, "vendor_updated", currentUser.userId);
    } else {
      await client.query(
        `
          INSERT INTO order_vendors
            (
              order_id, vendor_id, vendor_charge_amount, vendor_paid_amount,
              vendor_balance_amount, status, expected_delivery_date, notes,
              created_by, updated_by
            )
          VALUES
            (
              $1::uuid, $2::uuid, $3::numeric(14,2), 0,
              $3::numeric(14,2), $4, $5::date, $6,
              $7::uuid, $7::uuid
            )
        `,
        [
          order.id,
          input.vendorId,
          charge,
          input.vendorStatus,
          input.expectedDeliveryDate ?? null,
          normalizeOptional(input.notes),
          currentUser.userId,
        ],
      );
      await insertOrderAudit(client, order.id, "vendor_assigned", currentUser.userId);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OrderMutationError) throw error;
    console.error("Order vendor update failed", error);
    throw new OrderMutationError("Unable to update vendor details right now.", { status: 500 });
  } finally {
    client.release();
  }
}

export async function recordOrderVendorPayment(
  currentUser: AuthenticatedUser,
  orderId: string,
  orderVendorId: string,
  input: RecordOrderVendorPaymentInput,
) {
  assertPermission(currentUser, "orders:add_vendor_payment");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const orderVendor = await fetchMutableOrderVendor(client, orderVendorId);
    if (orderVendor.order_id !== orderId) {
      throw new OrderMutationError("Order vendor does not belong to this order.", { status: 404 });
    }
    if (orderVendor.vendor_status === "cancelled") {
      throw new OrderMutationError("Cancelled vendors cannot receive payments.", { status: 400 });
    }
    if (
      !canAddVendorPayment(currentUser, {
        branchId: orderVendor.branch_id,
        status: orderVendor.order_status,
      })
    ) {
      throw new OrderMutationError("Vendor payments are not allowed for this order.", {
        status: 403,
      });
    }

    const amount = Number.parseFloat(input.amount);
    const balance = roundMoney(orderVendor.vendor_charge_amount - orderVendor.paid_amount);
    if (amount > balance) {
      throw new OrderMutationError("Vendor payment cannot exceed vendor balance.", {
        status: 400,
        fieldErrors: { amount: "Payment cannot exceed vendor balance." },
      });
    }

    const categoryId = await getVendorPaymentCategoryId(client);
    await client.query(
      `
        INSERT INTO branch_expenses
          (
            branch_id, title, amount, category_id, expense_date,
            remarks, payment_mode, order_vendor_id, created_by, updated_by
          )
        VALUES
          ($1::uuid, $2, $3::numeric(14,2), $4::uuid, $5::date,
           $6, $7::payment_mode, $8::uuid, $9::uuid, $9::uuid)
      `,
      [
        orderVendor.branch_id,
        `Vendor payment for ${orderVendor.order_code}`,
        amount,
        categoryId,
        input.expenseDate,
        normalizeOptional(input.remarks),
        input.paymentMode,
        orderVendor.id,
        currentUser.userId,
      ],
    );

    const nextPaid = roundMoney(orderVendor.paid_amount + amount);
    await client.query(
      `
        UPDATE order_vendors
        SET vendor_paid_amount = $2::numeric(14,2),
            vendor_balance_amount = $3::numeric(14,2),
            updated_by = $4::uuid,
            updated_at = now()
        WHERE id = $1::uuid
      `,
      [
        orderVendor.id,
        nextPaid,
        roundMoney(orderVendor.vendor_charge_amount - nextPaid),
        currentUser.userId,
      ],
    );

    await insertOrderAudit(
      client,
      orderVendor.order_id,
      "vendor_payment_recorded",
      currentUser.userId,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OrderMutationError) throw error;
    console.error("Order vendor payment failed", error);
    throw new OrderMutationError("Unable to record vendor payment right now.", { status: 500 });
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(
  currentUser: AuthenticatedUser,
  orderId: string,
  input: UpdateOrderStatusInput,
) {
  assertPermission(currentUser, "orders:update_status");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const order = await fetchMutableOrder(client, orderId);
    if (!canUpdateOrderStatus(currentUser, { branchId: order.branch_id, status: order.status })) {
      throw new OrderMutationError("Cancelled orders cannot be updated.", { status: 400 });
    }

    await client.query(
      `
        UPDATE orders
        SET status = $2::order_status, updated_at = now()
        WHERE id = $1::uuid
      `,
      [order.id, input.status],
    );

    await insertOrderAudit(
      client,
      order.id,
      input.status === "cancelled" ? "cancelled" : "status_changed",
      currentUser.userId,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OrderMutationError) throw error;
    console.error("Order status update failed", error);
    throw new OrderMutationError("Unable to update order status right now.", { status: 500 });
  } finally {
    client.release();
  }
}

export async function cancelOrder(currentUser: AuthenticatedUser, orderId: string) {
  assertPermission(currentUser, "orders:cancel");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const order = await fetchMutableOrder(client, orderId);
    if (!canCancelOrder(currentUser, { branchId: order.branch_id, status: order.status })) {
      throw new OrderMutationError("Order is already cancelled.", { status: 400 });
    }

    await client.query(
      `
        UPDATE orders
        SET status = 'cancelled'::order_status, updated_at = now()
        WHERE id = $1::uuid
      `,
      [order.id],
    );
    await insertOrderAudit(client, order.id, "cancelled", currentUser.userId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OrderMutationError) throw error;
    console.error("Order cancel failed", error);
    throw new OrderMutationError("Unable to cancel order right now.", { status: 500 });
  } finally {
    client.release();
  }
}

export async function updateOrder(
  currentUser: AuthenticatedUser,
  orderId: string,
  input: UpdateOrderInput,
) {
  assertPermission(currentUser, "orders:edit");

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const order = await fetchMutableOrder(client, orderId);
    if (!canEditOrder(currentUser, { branchId: order.branch_id, status: order.status })) {
      throw new OrderMutationError("This order cannot be edited.", { status: 403 });
    }

    const { rows: customerRows } = await client.query<CustomerRow>(
      `
        SELECT id::text AS id, type::text AS type
        FROM customers
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [input.customerId],
    );
    const customer = customerRows[0];
    if (!customer) {
      throw new OrderMutationError("Select a valid customer.", {
        status: 400,
        fieldErrors: { customerId: "Select a valid customer." },
      });
    }

    const canChangeItems = canEditOrderItems(currentUser, {
      branchId: order.branch_id,
      status: order.status,
    });
    const canChangeDiscount = canEditOrderDiscount(currentUser, {
      branchId: order.branch_id,
      status: order.status,
    });

    if (canChangeItems) {
      await client.query(
        `
          UPDATE orders
          SET discount_amount = 0,
              updated_at = now()
          WHERE id = $1::uuid
        `,
        [order.id],
      );
      await client.query("DELETE FROM order_items WHERE order_id = $1::uuid", [order.id]);
    }

    const pricedItems = [];
    let subtotal = 0;
    for (const itemInput of input.items) {
      const quantity = Number.parseFloat(itemInput.quantity);
      const item = await getPricedInventory(
        client,
        order.branch_id,
        itemInput.inventoryId,
        customer.type,
      );
      if (item.quantity < quantity) {
        throw new OrderMutationError(`Insufficient stock for ${item.name}.`, {
          status: 400,
          fieldErrors: { items: `Insufficient stock for ${item.name}.` },
        });
      }
      const unitPrice = item.selling_rate ?? 0;
      const lineTotal = roundMoney(quantity * unitPrice);
      subtotal = roundMoney(subtotal + lineTotal);
      pricedItems.push({ inventoryId: item.inventory_id, quantity, unitPrice, lineTotal });
    }

    const offers = await getOfferRules(
      client,
      order.branch_id,
      input.offerIds,
      customer.type,
      subtotal,
    );
    let discountAmount = 0;
    for (const offer of offers) {
      discountAmount = roundMoney(
        discountAmount + calculateOfferDiscount(offer, Math.max(0, subtotal - discountAmount)),
      );
    }
    discountAmount = Math.min(discountAmount, subtotal);

    if (canChangeItems) {
      for (const item of pricedItems) {
        await client.query(
          `
            INSERT INTO order_items (order_id, inventory_id, quantity, unit_price, line_total)
            VALUES ($1::uuid, $2::uuid, $3::numeric(12,3), $4::numeric(14,2), $5::numeric(16,2))
          `,
          [order.id, item.inventoryId, item.quantity, item.unitPrice, item.lineTotal],
        );
      }
      await client.query("DELETE FROM order_applied_offers WHERE order_id = $1::uuid", [order.id]);
      let appliedDiscount = 0;
      for (const offer of offers) {
        const discount = Math.min(
          subtotal - appliedDiscount,
          calculateOfferDiscount(offer, Math.max(0, subtotal - appliedDiscount)),
        );
        appliedDiscount = roundMoney(appliedDiscount + discount);
        await client.query(
          `
            INSERT INTO order_applied_offers
              (order_id, offer_id, code, name, offer_type, discount_amount, snapshot)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::numeric(14,2), $7::jsonb)
          `,
          [
            order.id,
            offer.id,
            offer.code,
            offer.name,
            offer.offer_type,
            roundMoney(discount),
            JSON.stringify(offer),
          ],
        );
      }
      await insertOrderAudit(client, order.id, "items_updated", currentUser.userId);
    }

    await client.query(
      `
        UPDATE orders
        SET customer_id = $2::uuid,
            discount_amount = $3::numeric(14,2),
            updated_at = now()
        WHERE id = $1::uuid
      `,
      [order.id, customer.id, canChangeDiscount ? discountAmount : order.discount_amount],
    );

    if (canChangeDiscount && order.discount_amount !== discountAmount) {
      await insertOrderAudit(client, order.id, "discount_updated", currentUser.userId);
    }

    await insertOrderAudit(client, order.id, "order_updated", currentUser.userId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof OrderMutationError) throw error;
    console.error("Order update failed", error);
    throw new OrderMutationError("Unable to update order right now.", { status: 500 });
  } finally {
    client.release();
  }
}
