-- migrate:up

ALTER TABLE order_vendors
  ADD COLUMN vendor_charge_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (vendor_charge_amount >= 0),
  ADD COLUMN vendor_balance_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (vendor_balance_amount >= 0),
  ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  ADD COLUMN expected_delivery_date date,
  ADD COLUMN notes text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

UPDATE order_vendors
SET
  vendor_charge_amount = vendor_paid_amount,
  vendor_balance_amount = 0,
  status = CASE WHEN vendor_paid_amount > 0 THEN 'paid' ELSE 'pending' END;

ALTER TABLE order_vendors
  ADD CONSTRAINT order_vendors_paid_not_above_charge
    CHECK (vendor_paid_amount <= vendor_charge_amount);

CREATE TRIGGER trg_order_vendors_updated_at
BEFORE UPDATE ON order_vendors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_applied_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  code text NOT NULL CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  offer_type text NOT NULL CHECK (offer_type IN ('percentage', 'flat', 'buy_x_get_y')),
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'cancel', 'restore')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_vendors_status ON order_vendors(status);
CREATE INDEX idx_order_vendors_expected_delivery_date ON order_vendors(expected_delivery_date);
CREATE INDEX idx_order_applied_offers_order_id ON order_applied_offers(order_id);
CREATE INDEX idx_order_applied_offers_offer_id ON order_applied_offers(offer_id);
CREATE INDEX idx_order_audit_logs_order_id ON order_audit_logs(order_id);
CREATE INDEX idx_order_audit_logs_action ON order_audit_logs(action);
CREATE INDEX idx_order_audit_logs_changed_by ON order_audit_logs(changed_by);
CREATE INDEX idx_order_audit_logs_created_at ON order_audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION trg_validate_order_header()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_branch uuid;
  v_user_active boolean;
  v_user_role user_role;
BEGIN
  SELECT branch_id, is_active, role
  INTO v_user_branch, v_user_active, v_user_role
  FROM users
  WHERE id = NEW.created_by;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Created by user not found';
  END IF;

  IF NOT v_user_active THEN
    RAISE EXCEPTION 'Inactive user cannot create or update orders';
  END IF;

  IF v_user_role <> 'admin' AND (v_user_branch IS NULL OR v_user_branch <> NEW.branch_id) THEN
    RAISE EXCEPTION 'Order branch must match creator branch';
  END IF;

  IF NEW.discount_amount < 0 THEN
    RAISE EXCEPTION 'discount_amount cannot be negative';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.order_code IS DISTINCT FROM NEW.order_code THEN
      RAISE EXCEPTION 'order_code is immutable';
    END IF;

    IF OLD.branch_id IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'branch_id cannot be changed after order creation';
    END IF;

    IF OLD.order_date IS DISTINCT FROM NEW.order_date THEN
      RAISE EXCEPTION 'order_date cannot be changed after order creation';
    END IF;

    IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Cancelled order cannot be reopened';
    END IF;

    IF NOT is_internal_order_update() AND (
      OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
      OLD.payable_amount IS DISTINCT FROM NEW.payable_amount OR
      OLD.paid_amount IS DISTINCT FROM NEW.paid_amount OR
      OLD.payment_status IS DISTINCT FROM NEW.payment_status
    ) THEN
      RAISE EXCEPTION 'Derived order fields are managed by the database';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_validate_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_branch uuid;
  v_order_status order_status;
  v_user_branch uuid;
  v_user_active boolean;
  v_user_role user_role;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.order_id <> OLD.order_id THEN
    RAISE EXCEPTION 'Changing order_id is not allowed';
  END IF;

  SELECT branch_id, status
  INTO v_order_branch, v_order_status
  FROM orders
  WHERE id = NEW.order_id;

  IF v_order_branch IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot add or edit payment for a cancelled order';
  END IF;

  IF NEW.branch_id <> v_order_branch THEN
    RAISE EXCEPTION 'Payment branch must match order branch';
  END IF;

  SELECT branch_id, is_active, role
  INTO v_user_branch, v_user_active, v_user_role
  FROM users
  WHERE id = NEW.received_by;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Received by user not found';
  END IF;

  IF NOT v_user_active THEN
    RAISE EXCEPTION 'Inactive user cannot receive payment';
  END IF;

  IF v_user_role <> 'admin' AND (v_user_branch IS NULL OR v_user_branch <> NEW.branch_id) THEN
    RAISE EXCEPTION 'Payment receiver must belong to the same branch';
  END IF;

  RETURN NEW;
END;
$$;

-- migrate:down

DROP INDEX IF EXISTS idx_order_audit_logs_created_at;
DROP INDEX IF EXISTS idx_order_audit_logs_changed_by;
DROP INDEX IF EXISTS idx_order_audit_logs_action;
DROP INDEX IF EXISTS idx_order_audit_logs_order_id;
DROP INDEX IF EXISTS idx_order_applied_offers_offer_id;
DROP INDEX IF EXISTS idx_order_applied_offers_order_id;
DROP INDEX IF EXISTS idx_order_vendors_expected_delivery_date;
DROP INDEX IF EXISTS idx_order_vendors_status;

DROP TABLE IF EXISTS order_audit_logs;
DROP TABLE IF EXISTS order_applied_offers;

DROP TRIGGER IF EXISTS trg_order_vendors_updated_at ON order_vendors;

ALTER TABLE order_vendors
  DROP CONSTRAINT IF EXISTS order_vendors_paid_not_above_charge,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS expected_delivery_date,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS vendor_balance_amount,
  DROP COLUMN IF EXISTS vendor_charge_amount;
