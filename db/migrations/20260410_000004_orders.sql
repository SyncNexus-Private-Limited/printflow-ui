-- migrate:up
-- NOTE: order_applied_offers is in migration 7 because it FK-references offers,
-- which is also created in migration 7.

-- -----------------------------------------------------------------------------
-- TABLE: orders
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE,
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  status order_status NOT NULL DEFAULT 'pending',
  total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  payable_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (payable_amount >= 0),
  paid_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  payment_status payment_status NOT NULL DEFAULT 'pending',
  order_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_amount <= payable_amount)
);

CREATE TRIGGER trigger_set_order_code
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_order_code ();

CREATE TRIGGER trg_validate_order_header
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_order_header ();

CREATE TRIGGER trg_restore_inventory_on_cancel
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION restore_inventory_on_cancel ();

CREATE TRIGGER trg_recalculate_order_after_discount
  AFTER UPDATE OF discount_amount ON orders
  FOR EACH ROW
  WHEN (NEW.discount_amount IS DISTINCT FROM OLD.discount_amount)
  EXECUTE FUNCTION trg_recalculate_order_after_discount ();

CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders (branch_id);

CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders (created_by);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders (order_date);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);

-- Composite index for the common branch+date range filter
CREATE INDEX IF NOT EXISTS idx_orders_branch_order_date ON orders (branch_id, order_date DESC);

-- -----------------------------------------------------------------------------
-- TABLE: order_items
-- -----------------------------------------------------------------------------
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES inventory (id) ON DELETE RESTRICT,
  quantity numeric(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(16, 2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_apply_order_item_inventory
  BEFORE INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION trg_apply_order_item_inventory ();

CREATE TRIGGER trg_recalculate_order_after_items
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION trg_recalculate_order_after_items ();

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_inventory_id ON order_items (inventory_id);

-- -----------------------------------------------------------------------------
-- TABLE: payments
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  received_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  mode payment_mode NOT NULL DEFAULT 'cash',
  txn_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_validate_payment
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_payment ();

CREATE TRIGGER trg_recalculate_order_after_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trg_recalculate_order_after_payments ();

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);

CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON payments (branch_id);

CREATE INDEX IF NOT EXISTS idx_payments_received_by ON payments (received_by);

CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at);

-- -----------------------------------------------------------------------------
-- TABLE: order_vendors (FINAL: all columns from 20260501_000003 + 000005)
-- Status values: assigned/in_progress/received/cancelled (default: assigned)
-- -----------------------------------------------------------------------------
CREATE TABLE order_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors (id) ON DELETE RESTRICT,
  vendor_paid_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (vendor_paid_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  vendor_charge_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (vendor_charge_amount >= 0),
  vendor_balance_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (vendor_balance_amount >= 0),
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'received', 'cancelled')),
  expected_delivery_date date,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (order_id, vendor_id),
  CONSTRAINT order_vendors_paid_not_above_charge CHECK (vendor_paid_amount <= vendor_charge_amount)
);

CREATE TRIGGER trg_order_vendors_updated_at
  BEFORE UPDATE ON order_vendors
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_order_vendors_order_id ON order_vendors (order_id);

CREATE INDEX IF NOT EXISTS idx_order_vendors_vendor_id ON order_vendors (vendor_id);

CREATE INDEX IF NOT EXISTS idx_order_vendors_status ON order_vendors (status);

CREATE INDEX IF NOT EXISTS idx_order_vendors_expected_delivery_date ON order_vendors (expected_delivery_date);

-- -----------------------------------------------------------------------------
-- TABLE: offer_items
-- -----------------------------------------------------------------------------
CREATE TABLE offer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  item_name text NOT NULL CHECK (btrim(item_name) <> ''),
  item_image text,
  quantity_in_stock integer NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
  total_ordered_qty integer NOT NULL DEFAULT 0 CHECK (total_ordered_qty >= 0),
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_offer_items_updated_at
  BEFORE UPDATE ON offer_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_offer_items_branch_id ON offer_items (branch_id);

CREATE INDEX IF NOT EXISTS idx_offer_items_is_active ON offer_items (is_active);

-- -----------------------------------------------------------------------------
-- TABLE: order_offer_items
-- -----------------------------------------------------------------------------
CREATE TABLE order_offer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  offer_item_id uuid NOT NULL REFERENCES offer_items (id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_update_offer_item_totals
  BEFORE INSERT OR UPDATE OR DELETE ON order_offer_items
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_offer_item_totals ();

CREATE INDEX IF NOT EXISTS idx_order_offer_items_order_id ON order_offer_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_offer_items_offer_item_id ON order_offer_items (offer_item_id);

-- -----------------------------------------------------------------------------
-- TABLE: order_audit_logs (FINAL action CHECK from 20260501_000006)
-- -----------------------------------------------------------------------------
CREATE TABLE order_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'order_updated', 'items_updated', 'discount_updated', 'status_changed', 'cancelled', 'customer_payment_added', 'vendor_assigned', 'vendor_updated', 'vendor_payment_recorded', 'restore')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_audit_logs_order_id ON order_audit_logs (order_id);

CREATE INDEX IF NOT EXISTS idx_order_audit_logs_action ON order_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_order_audit_logs_changed_by ON order_audit_logs (changed_by);

CREATE INDEX IF NOT EXISTS idx_order_audit_logs_created_at ON order_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_audit_logs_order_created_at ON order_audit_logs (order_id, created_at DESC);

-- migrate:down

DROP TRIGGER IF EXISTS trg_update_offer_item_totals ON order_offer_items;

DROP TRIGGER IF EXISTS trg_offer_items_updated_at ON offer_items;

DROP TRIGGER IF EXISTS trg_order_vendors_updated_at ON order_vendors;

DROP TRIGGER IF EXISTS trg_recalculate_order_after_payments ON payments;

DROP TRIGGER IF EXISTS trg_validate_payment ON payments;

DROP TRIGGER IF EXISTS trg_recalculate_order_after_items ON order_items;

DROP TRIGGER IF EXISTS trg_apply_order_item_inventory ON order_items;

DROP TRIGGER IF EXISTS trg_recalculate_order_after_discount ON orders;

DROP TRIGGER IF EXISTS trg_restore_inventory_on_cancel ON orders;

DROP TRIGGER IF EXISTS trg_validate_order_header ON orders;

DROP TRIGGER IF EXISTS trigger_set_order_code ON orders;

DROP INDEX IF EXISTS idx_order_audit_logs_order_created_at;

DROP INDEX IF EXISTS idx_order_audit_logs_created_at;

DROP INDEX IF EXISTS idx_order_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_order_audit_logs_action;

DROP INDEX IF EXISTS idx_order_audit_logs_order_id;

DROP INDEX IF EXISTS idx_order_offer_items_offer_item_id;

DROP INDEX IF EXISTS idx_order_offer_items_order_id;

DROP INDEX IF EXISTS idx_offer_items_is_active;

DROP INDEX IF EXISTS idx_offer_items_branch_id;

DROP INDEX IF EXISTS idx_order_vendors_expected_delivery_date;

DROP INDEX IF EXISTS idx_order_vendors_status;

DROP INDEX IF EXISTS idx_order_vendors_vendor_id;

DROP INDEX IF EXISTS idx_order_vendors_order_id;

DROP INDEX IF EXISTS idx_payments_created_at;

DROP INDEX IF EXISTS idx_payments_received_by;

DROP INDEX IF EXISTS idx_payments_branch_id;

DROP INDEX IF EXISTS idx_payments_order_id;

DROP INDEX IF EXISTS idx_order_items_inventory_id;

DROP INDEX IF EXISTS idx_order_items_order_id;

DROP INDEX IF EXISTS idx_orders_branch_order_date;

DROP INDEX IF EXISTS idx_orders_payment_status;

DROP INDEX IF EXISTS idx_orders_status;

DROP INDEX IF EXISTS idx_orders_order_date;

DROP INDEX IF EXISTS idx_orders_customer_id;

DROP INDEX IF EXISTS idx_orders_created_by;

DROP INDEX IF EXISTS idx_orders_branch_id;

DROP TABLE IF EXISTS order_audit_logs;

DROP TABLE IF EXISTS order_offer_items;

DROP TABLE IF EXISTS offer_items;

DROP TABLE IF EXISTS order_vendors;

DROP TABLE IF EXISTS payments;

DROP TABLE IF EXISTS order_items;

DROP TABLE IF EXISTS orders;
