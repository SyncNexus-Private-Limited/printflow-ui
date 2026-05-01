import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { assertPermission, canAccessBranch } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import {
  type AddOrderPaymentInput,
  type CreateOrderInput,
  type UpdateOrderInput,
  type UpdateOrderStatusInput,
} from "@/lib/orders/schema";
import {
  canEditOrder,
  canEditOrderItems,
  canEditOrderPayment,
  canEditOrderVendor,
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
  payable_amount: number;
  paid_amount: number;
};

function parseAmount(value: string | undefined) {
  return value ? Number.parseFloat(value) : 0;
}

function normalizeOptional(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildVendorStatus(charge: number, paid: number) {
  if (paid <= 0) return "pending";
  if (paid < charge) return "partial";
  return "paid";
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

async function insertOrderAudit(
  client: PoolClient,
  orderId: string,
  action: string,
  changedBy: string,
) {
  const checkedAction = action === "order_cancelled" || action === "cancel" ? "cancel" : "update";
  const snapshot = await fetchOrderSnapshot(client, orderId);
  await client.query(
    `
      INSERT INTO order_audit_logs (order_id, action, snapshot, changed_fields, changed_by)
      VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid)
    `,
    [orderId, checkedAction, JSON.stringify(snapshot), JSON.stringify({ action }), changedBy],
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
      const status = buildVendorStatus(charge, paid);
      const { rows: vendorRows } = await client.query<{ id: string }>(
        `
          INSERT INTO order_vendors
            (
              order_id, vendor_id, vendor_charge_amount, vendor_paid_amount,
              vendor_balance_amount, status, expected_delivery_date, notes, updated_by
            )
          VALUES
            ($1::uuid, $2::uuid, $3::numeric(14,2), $4::numeric(14,2),
             $5::numeric(14,2), $6, $7::date, $8, $9::uuid)
          RETURNING id::text AS id
        `,
        [
          order.id,
          input.vendorId,
          charge,
          paid,
          balance,
          status,
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
    if (!canEditOrderPayment(currentUser, { branchId: order.branch_id, status: order.status })) {
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

    await insertOrderAudit(client, order.id, "payment_added", currentUser.userId);
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
    if (!canAccessBranch(currentUser, order.branch_id)) {
      throw new OrderMutationError("You do not have access to this branch.", { status: 403 });
    }
    if (order.status === "cancelled") {
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
      input.status === "cancelled" ? "order_cancelled" : "status_changed",
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
    if (!canAccessBranch(currentUser, order.branch_id)) {
      throw new OrderMutationError("You do not have access to this branch.", { status: 403 });
    }
    if (order.status === "cancelled") {
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
    await insertOrderAudit(client, order.id, "order_cancelled", currentUser.userId);
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
    if (canChangeItems) {
      await client.query("DELETE FROM order_items WHERE order_id = $1::uuid", [order.id]);
    }

    const pricedItems = [];
    let subtotal = 0;
    for (const itemInput of input.items) {
      const quantity = Number.parseFloat(itemInput.quantity);
      const item = await getPricedInventory(client, order.branch_id, itemInput.inventoryId, customer.type);
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

    await client.query(
      `
        UPDATE orders
        SET customer_id = $2::uuid,
            status = $3::order_status,
            discount_amount = $4::numeric(14,2),
            updated_at = now()
        WHERE id = $1::uuid
      `,
      [order.id, customer.id, input.status, discountAmount],
    );

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

    if (input.vendorId && canEditOrderVendor(currentUser, { branchId: order.branch_id, status: order.status })) {
      const charge = parseAmount(input.vendorChargeAmount);
      const paid = parseAmount(input.vendorPaidAmount);
      const balance = roundMoney(charge - paid);
      const status = buildVendorStatus(charge, paid);
      const { rows: existingVendorRows } = await client.query<{ id: string; paid: number }>(
        `
          SELECT id::text AS id, vendor_paid_amount::double precision AS paid
          FROM order_vendors
          WHERE order_id = $1::uuid
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [order.id],
      );
      const existingVendor = existingVendorRows[0];
      const { rows: vendorRows } = await client.query<{ id: string }>(
        existingVendor
          ? `
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
              RETURNING id::text AS id
            `
          : `
              INSERT INTO order_vendors
                (order_id, vendor_id, vendor_charge_amount, vendor_paid_amount,
                 vendor_balance_amount, status, expected_delivery_date, notes, updated_by)
              VALUES
                ($1::uuid, $2::uuid, $3::numeric(14,2), $4::numeric(14,2),
                 $5::numeric(14,2), $6, $7::date, $8, $9::uuid)
              RETURNING id::text AS id
            `,
        existingVendor
          ? [
              existingVendor.id,
              input.vendorId,
              charge,
              paid,
              balance,
              status,
              input.vendorExpectedDeliveryDate ?? null,
              normalizeOptional(input.vendorNotes),
              currentUser.userId,
            ]
          : [
              order.id,
              input.vendorId,
              charge,
              paid,
              balance,
              status,
              input.vendorExpectedDeliveryDate ?? null,
              normalizeOptional(input.vendorNotes),
              currentUser.userId,
            ],
      );

      const paidDelta = roundMoney(paid - (existingVendor?.paid ?? 0));
      if (paidDelta > 0) {
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
        if (!categoryId) throw new OrderMutationError("Vendor payment category is missing.", { status: 500 });
        await client.query(
          `
            INSERT INTO branch_expenses
              (branch_id, title, amount, category_id, expense_date, remarks,
               payment_mode, order_vendor_id, created_by, updated_by)
            VALUES
              ($1::uuid, $2, $3::numeric(14,2), $4::uuid, CURRENT_DATE, $5,
               $6::payment_mode, $7::uuid, $8::uuid, $8::uuid)
          `,
          [
            order.branch_id,
            `Vendor payment for ${order.order_code}`,
            paidDelta,
            categoryId,
            normalizeOptional(input.vendorNotes),
            input.paymentMode || "cash",
            vendorRows[0].id,
            currentUser.userId,
          ],
        );
      }
      await insertOrderAudit(client, order.id, "vendor_updated", currentUser.userId);
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
