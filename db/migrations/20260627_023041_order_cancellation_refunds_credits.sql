-- migrate:up

-- -----------------------------------------------------------------------------
-- orders: cancellation / soft-delete metadata
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN cancellation_reason text,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN deletion_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_is_deleted ON orders (is_deleted);

-- -----------------------------------------------------------------------------
-- TYPE: refund_status_value
-- -----------------------------------------------------------------------------
CREATE TYPE refund_status_value AS ENUM ('pending', 'processing', 'completed', 'failed');

-- -----------------------------------------------------------------------------
-- TABLE: order_refunds
-- One row per refund decision made when an order is cancelled or (soft-)deleted.
-- -----------------------------------------------------------------------------
CREATE TABLE order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  trigger_action text NOT NULL CHECK (trigger_action IN ('cancel', 'delete')),
  reason text NOT NULL,
  refund_basis_amount numeric(14, 2) NOT NULL CHECK (refund_basis_amount >= 0),
  refund_percent numeric(5, 2) NOT NULL CHECK (refund_percent >= 0 AND refund_percent <= 100),
  refund_amount numeric(14, 2) NOT NULL CHECK (refund_amount >= 0),
  refund_mode payment_mode NOT NULL,
  refund_status refund_status_value NOT NULL DEFAULT 'pending',
  txn_reference text,
  created_by uuid NOT NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (refund_amount <= refund_basis_amount)
);

COMMENT ON TABLE order_refunds IS 'Refund decision recorded when an order is cancelled or soft-deleted. refund_amount is the authoritative value; refund_percent is derived for display.';

CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id ON order_refunds (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_refunds_customer_id ON order_refunds (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_refunds_refund_status ON order_refunds (refund_status);

CREATE TRIGGER trg_order_refunds_updated_at
  BEFORE UPDATE ON order_refunds
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

-- -----------------------------------------------------------------------------
-- TABLE: customer_credit_transactions
-- Ledger of customer store-credit movements (1 credit = 1 INR). Balance is
-- always SUM(amount) per customer - no denormalized balance column.
-- -----------------------------------------------------------------------------
CREATE TABLE customer_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN ('refund_credit', 'applied_to_order', 'manual_adjustment')),
  amount numeric(14, 2) NOT NULL,
  related_order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
  order_refund_id uuid REFERENCES order_refunds (id) ON DELETE SET NULL,
  note text,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN customer_credit_transactions.amount IS 'Signed amount. Positive = credit added (refund), negative = credit spent (applied to a new order).';

CREATE INDEX IF NOT EXISTS idx_customer_credit_transactions_customer_id ON customer_credit_transactions (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_credit_transactions_related_order_id ON customer_credit_transactions (related_order_id);

-- -----------------------------------------------------------------------------
-- order_audit_logs: extend allowed actions for delete + refund status updates.
-- Constraint name is discovered dynamically since migrations were consolidated
-- once already and the live name may not match the default-generated one.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'order_audit_logs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%action%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE order_audit_logs DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE order_audit_logs
  ADD CONSTRAINT order_audit_logs_action_check
  CHECK (action IN ('create', 'order_updated', 'items_updated', 'discount_updated', 'status_changed', 'cancelled', 'customer_payment_added', 'vendor_assigned', 'vendor_updated', 'vendor_payment_recorded', 'restore', 'deleted', 'refund_status_updated'));

-- migrate:down

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'order_audit_logs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%action%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE order_audit_logs DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE order_audit_logs
  ADD CONSTRAINT order_audit_logs_action_check
  CHECK (action IN ('create', 'order_updated', 'items_updated', 'discount_updated', 'status_changed', 'cancelled', 'customer_payment_added', 'vendor_assigned', 'vendor_updated', 'vendor_payment_recorded', 'restore'));

DROP INDEX IF EXISTS idx_customer_credit_transactions_related_order_id;

DROP INDEX IF EXISTS idx_customer_credit_transactions_customer_id;

DROP TABLE IF EXISTS customer_credit_transactions;

DROP TRIGGER IF EXISTS trg_order_refunds_updated_at ON order_refunds;

DROP INDEX IF EXISTS idx_order_refunds_refund_status;

DROP INDEX IF EXISTS idx_order_refunds_customer_id;

DROP INDEX IF EXISTS idx_order_refunds_order_id;

DROP TABLE IF EXISTS order_refunds;

DROP TYPE IF EXISTS refund_status_value;

DROP INDEX IF EXISTS idx_orders_is_deleted;

ALTER TABLE orders
  DROP COLUMN IF EXISTS deletion_reason,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS is_deleted,
  DROP COLUMN IF EXISTS cancelled_by,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancellation_reason;
