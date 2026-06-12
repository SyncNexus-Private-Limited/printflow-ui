-- migrate:up

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUM TYPES
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operator', 'staff');

CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'delivered', 'cancelled');

CREATE TYPE payment_mode AS ENUM ('cash', 'upi', 'card', 'credit', 'other');

CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid');

CREATE TYPE inventory_unit AS ENUM ('piece', 'sheet', 'sqft', 'unit');

CREATE TYPE customer_type AS ENUM ('studio', 'amateur', 'other', 'employee');

-- -----------------------------------------------------------------------------
-- FUNCTION: set_updated_at
-- Generic trigger function to maintain updated_at timestamps.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: create_user_with_auth (FINAL version from 20260428 hardening)
-- Creates a user + auth record. Caller must be an active admin.
-- Optional params: alternate_phone, address, is_active.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_user_with_auth (
  p_admin_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_role user_role,
  p_branch_id uuid,
  p_username text,
  p_password text,
  p_alternate_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_is_active boolean DEFAULT TRUE
)
  RETURNS uuid
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_user_id uuid;
  v_caller_role user_role;
  v_caller_active boolean;
BEGIN
  SELECT
    role,
    is_active INTO v_caller_role,
    v_caller_active
  FROM
    users
  WHERE
    id = p_admin_id;
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;
  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;
  IF NOT v_caller_active THEN
    RAISE EXCEPTION 'Inactive admin cannot create users';
  END IF;
  INSERT INTO users (full_name, phone, alternate_phone, email, address, role, branch_id, is_active, created_by, updated_by)
    VALUES (p_full_name, p_phone, p_alternate_phone, p_email, p_address, p_role, p_branch_id, p_is_active, p_admin_id, p_admin_id)
  RETURNING
    id INTO v_user_id;
  INSERT INTO user_auth (user_id, username, password_hash)
    VALUES (v_user_id, lower(btrim(p_username)), crypt(p_password, gen_salt('bf')));
  RETURN v_user_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: authenticate_user
-- Returns user UUID on success, NULL on failure. Handles lockout after 5 fails.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION authenticate_user (p_username text, p_password text)
  RETURNS uuid
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_user_id uuid;
  v_hash text;
  v_locked boolean;
  v_is_active boolean;
BEGIN
  SELECT
    ua.user_id,
    ua.password_hash,
    ua.is_locked,
    u.is_active INTO v_user_id,
    v_hash,
    v_locked,
    v_is_active
  FROM
    user_auth ua
    JOIN users u ON u.id = ua.user_id
  WHERE
    lower(ua.username) = lower(btrim(p_username));
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT v_is_active THEN
    RAISE EXCEPTION 'User is inactive';
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION 'Account locked';
  END IF;
  IF v_hash = crypt(p_password, v_hash) THEN
    UPDATE
      user_auth
    SET
      failed_attempts = 0,
      last_login = now(),
      updated_at = now()
    WHERE
      user_id = v_user_id;
    RETURN v_user_id;
  END IF;
  UPDATE
    user_auth
  SET
    failed_attempts = failed_attempts + 1,
    is_locked = (failed_attempts + 1) >= 5,
    updated_at = now()
  WHERE
    user_id = v_user_id;
  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: generate_order_code
-- Uses order_date year for deterministic imports and backdated orders.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_order_code (p_branch_id uuid, p_order_date timestamptz DEFAULT now())
  RETURNS text
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM p_order_date);
  v_year_prefix text := to_char(p_order_date, 'YY');
  v_next_number bigint;
  v_branch_code text;
BEGIN
  SELECT
    code INTO v_branch_code
  FROM
    branches
  WHERE
    id = p_branch_id;
  IF v_branch_code IS NULL THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;
  INSERT INTO order_sequences (branch_id, year, last_number)
    VALUES (p_branch_id, v_year, 1)
  ON CONFLICT (branch_id, year)
    DO UPDATE SET
      last_number = order_sequences.last_number + 1
    RETURNING
      last_number INTO v_next_number;
  RETURN v_branch_code || '-' || v_year_prefix || '-' || LPAD(v_next_number::text, 5, '0');
END;
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: set_internal_order_update / is_internal_order_update
-- Session-local flag used to allow DB-managed fields to be updated by triggers.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_internal_order_update (p_value boolean)
  RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM
    set_config('app.internal_order_update', CASE WHEN p_value THEN
        'on'
      ELSE
        'off'
      END, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION is_internal_order_update ()
  RETURNS boolean
  LANGUAGE sql
  AS $$
  SELECT
    COALESCE(current_setting('app.internal_order_update', TRUE), 'off') = 'on';
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: recalculate_order_financials
-- Recomputes total_amount, payable_amount, paid_amount, payment_status for an order.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_order_financials (p_order_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_total_amount numeric(14, 2);
  v_discount_amount numeric(14, 2);
  v_payable_amount numeric(14, 2);
  v_paid_amount numeric(14, 2);
  v_payment_status payment_status;
BEGIN
  SELECT
    COALESCE(SUM(line_total), 0)::numeric(14, 2) INTO v_total_amount
  FROM
    order_items
  WHERE
    order_id = p_order_id;
  SELECT
    discount_amount INTO v_discount_amount
  FROM
    orders
  WHERE
    id = p_order_id
  FOR UPDATE;
  IF v_discount_amount IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_discount_amount > v_total_amount THEN
    RAISE EXCEPTION 'discount_amount cannot exceed total_amount';
  END IF;
  v_payable_amount := (v_total_amount - v_discount_amount)::numeric(14, 2);
  SELECT
    COALESCE(SUM(amount), 0)::numeric(14, 2) INTO v_paid_amount
  FROM
    payments
  WHERE
    order_id = p_order_id;
  IF v_paid_amount > v_payable_amount THEN
    RAISE EXCEPTION 'Paid amount cannot exceed payable amount';
  END IF;
  IF v_total_amount = 0 AND v_payable_amount = 0 AND v_paid_amount = 0 THEN
    v_payment_status := 'pending';
  ELSIF v_paid_amount = 0 THEN
    v_payment_status := 'pending';
  ELSIF v_paid_amount < v_payable_amount THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'paid';
  END IF;
  PERFORM
    set_internal_order_update (TRUE);
  UPDATE
    orders
  SET
    total_amount = v_total_amount,
    payable_amount = v_payable_amount,
    paid_amount = v_paid_amount,
    payment_status = v_payment_status,
    updated_at = now()
  WHERE
    id = p_order_id;
  PERFORM
    set_internal_order_update (FALSE);
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_set_order_code
-- Auto-generates order_code on INSERT; blocks manual assignment.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_order_code ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.order_code IS NOT NULL THEN
      RAISE EXCEPTION 'Manual order_code not allowed';
    END IF;
    NEW.order_code := generate_order_code (NEW.branch_id, COALESCE(NEW.order_date, now()));
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_validate_order_header (FINAL version from 20260501_000003)
-- Validates creator branch match (admin bypasses). Guards derived/immutable fields.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validate_order_header ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_user_branch uuid;
  v_user_active boolean;
  v_user_role user_role;
BEGIN
  SELECT
    branch_id,
    is_active,
    role INTO v_user_branch,
    v_user_active,
    v_user_role
  FROM
    users
  WHERE
    id = NEW.created_by;
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
    IF NOT is_internal_order_update () AND (OLD.total_amount IS DISTINCT FROM NEW.total_amount
      OR OLD.payable_amount IS DISTINCT FROM NEW.payable_amount
      OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount
      OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
      RAISE EXCEPTION 'Derived order fields are managed by the database';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: restore_inventory_on_cancel
-- Restores inventory quantities when an order is cancelled.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restore_inventory_on_cancel ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE
      inventory i
    SET
      quantity = i.quantity + oi.quantity,
      updated_at = now()
    FROM
      order_items oi
    WHERE
      oi.order_id = NEW.id
      AND oi.inventory_id = i.id
      AND i.branch_id = NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_validate_inventory_pricing
-- Prevents overlapping date ranges for same branch/inventory/customer_type.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validate_inventory_pricing ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF EXISTS (
    SELECT
      1
    FROM
      inventory i
    WHERE
      i.id = NEW.inventory_id
      AND i.branch_id = NEW.branch_id) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'inventory_id does not belong to branch_id';
  END IF;
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        inventory_pricing ip
      WHERE
        ip.branch_id = NEW.branch_id
        AND ip.inventory_id = NEW.inventory_id
        AND ip.customer_type = NEW.customer_type
        AND ip.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND daterange(ip.effective_from, COALESCE(ip.effective_to, 'infinity'::date), '[]') && daterange(NEW.effective_from, COALESCE(NEW.effective_to, 'infinity'::date), '[]')) INTO v_exists;
  IF v_exists THEN
    RAISE EXCEPTION 'Overlapping inventory pricing range for same branch, inventory and customer_type';
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_apply_order_item_inventory
-- Deducts/restores inventory on order_items INSERT/UPDATE/DELETE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_apply_order_item_inventory ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_order_branch uuid;
  v_order_status order_status;
  v_inventory_branch uuid;
  v_available_qty numeric(12, 3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT
      branch_id,
      status INTO v_order_branch,
      v_order_status
    FROM
      orders
    WHERE
      id = NEW.order_id;
    IF v_order_branch IS NULL THEN
      RAISE EXCEPTION 'Order not found';
    END IF;
    IF v_order_status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot add items to a cancelled order';
    END IF;
    IF round((NEW.quantity * NEW.unit_price)::numeric, 2) <> NEW.line_total THEN
      RAISE EXCEPTION 'line_total must equal quantity * unit_price';
    END IF;
    SELECT
      branch_id,
      quantity INTO v_inventory_branch,
      v_available_qty
    FROM
      inventory
    WHERE
      id = NEW.inventory_id
    FOR UPDATE;
    IF v_inventory_branch IS NULL THEN
      RAISE EXCEPTION 'Inventory not found';
    END IF;
    IF v_inventory_branch <> v_order_branch THEN
      RAISE EXCEPTION 'Inventory branch does not match order branch';
    END IF;
    IF v_available_qty < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient inventory';
    END IF;
    UPDATE
      inventory
    SET
      quantity = quantity - NEW.quantity,
      updated_at = now()
    WHERE
      id = NEW.inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.order_id <> OLD.order_id THEN
      RAISE EXCEPTION 'Changing order_id is not allowed';
    END IF;
    SELECT
      branch_id,
      status INTO v_order_branch,
      v_order_status
    FROM
      orders
    WHERE
      id = NEW.order_id;
    IF v_order_status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot edit items of a cancelled order';
    END IF;
    IF round((NEW.quantity * NEW.unit_price)::numeric, 2) <> NEW.line_total THEN
      RAISE EXCEPTION 'line_total must equal quantity * unit_price';
    END IF;
    UPDATE
      inventory
    SET
      quantity = quantity + OLD.quantity,
      updated_at = now()
    WHERE
      id = OLD.inventory_id;
    SELECT
      branch_id,
      quantity INTO v_inventory_branch,
      v_available_qty
    FROM
      inventory
    WHERE
      id = NEW.inventory_id
    FOR UPDATE;
    IF v_inventory_branch IS NULL THEN
      RAISE EXCEPTION 'Inventory not found';
    END IF;
    IF v_inventory_branch <> v_order_branch THEN
      RAISE EXCEPTION 'Inventory branch does not match order branch';
    END IF;
    IF v_available_qty < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient inventory';
    END IF;
    UPDATE
      inventory
    SET
      quantity = quantity - NEW.quantity,
      updated_at = now()
    WHERE
      id = NEW.inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT
      status INTO v_order_status
    FROM
      orders
    WHERE
      id = OLD.order_id;
    IF v_order_status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot delete items from a cancelled order';
    END IF;
    UPDATE
      inventory
    SET
      quantity = quantity + OLD.quantity,
      updated_at = now()
    WHERE
      id = OLD.inventory_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_recalculate_order_after_items
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recalculate_order_after_items ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM
    recalculate_order_financials (COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_validate_payment (FINAL version from 20260501_000003)
-- Validates payment branch/user match. Admin bypasses branch restriction.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validate_payment ()
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
  SELECT
    branch_id,
    status INTO v_order_branch,
    v_order_status
  FROM
    orders
  WHERE
    id = NEW.order_id;
  IF v_order_branch IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot add or edit payment for a cancelled order';
  END IF;
  IF NEW.branch_id <> v_order_branch THEN
    RAISE EXCEPTION 'Payment branch must match order branch';
  END IF;
  SELECT
    branch_id,
    is_active,
    role INTO v_user_branch,
    v_user_active,
    v_user_role
  FROM
    users
  WHERE
    id = NEW.received_by;
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

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_recalculate_order_after_payments
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recalculate_order_after_payments ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM
    recalculate_order_financials (COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_recalculate_order_after_discount
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recalculate_order_after_discount ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM
    recalculate_order_financials (NEW.id);
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: trg_update_offer_item_totals
-- Maintains offer_items stock counters on order_offer_items changes.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_update_offer_item_totals ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_order_status order_status;
BEGIN
  SELECT
    status INTO v_order_status
  FROM
    orders
  WHERE
    id = COALESCE(NEW.order_id, OLD.order_id);
  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change offer items for a cancelled order';
  END IF;
  IF TG_OP = 'INSERT' THEN
    UPDATE
      offer_items
    SET
      total_ordered_qty = total_ordered_qty + NEW.qty,
      quantity_in_stock = quantity_in_stock - NEW.qty,
      updated_at = now()
    WHERE
      id = NEW.offer_item_id
      AND quantity_in_stock >= NEW.qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient offer item stock';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.order_id <> OLD.order_id THEN
      RAISE EXCEPTION 'Changing order_id is not allowed';
    END IF;
    UPDATE
      offer_items
    SET
      total_ordered_qty = total_ordered_qty - OLD.qty,
      quantity_in_stock = quantity_in_stock + OLD.qty,
      updated_at = now()
    WHERE
      id = OLD.offer_item_id;
    UPDATE
      offer_items
    SET
      total_ordered_qty = total_ordered_qty + NEW.qty,
      quantity_in_stock = quantity_in_stock - NEW.qty,
      updated_at = now()
    WHERE
      id = NEW.offer_item_id
      AND quantity_in_stock >= NEW.qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient offer item stock';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE
      offer_items
    SET
      total_ordered_qty = total_ordered_qty - OLD.qty,
      quantity_in_stock = quantity_in_stock + OLD.qty,
      updated_at = now()
    WHERE
      id = OLD.offer_item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- migrate:down

DROP FUNCTION IF EXISTS trg_update_offer_item_totals ();

DROP FUNCTION IF EXISTS trg_recalculate_order_after_discount ();

DROP FUNCTION IF EXISTS trg_recalculate_order_after_payments ();

DROP FUNCTION IF EXISTS trg_validate_payment ();

DROP FUNCTION IF EXISTS trg_recalculate_order_after_items ();

DROP FUNCTION IF EXISTS trg_apply_order_item_inventory ();

DROP FUNCTION IF EXISTS trg_validate_inventory_pricing ();

DROP FUNCTION IF EXISTS restore_inventory_on_cancel ();

DROP FUNCTION IF EXISTS trg_validate_order_header ();

DROP FUNCTION IF EXISTS trg_set_order_code ();

DROP FUNCTION IF EXISTS recalculate_order_financials (uuid);

DROP FUNCTION IF EXISTS is_internal_order_update ();

DROP FUNCTION IF EXISTS set_internal_order_update (boolean);

DROP FUNCTION IF EXISTS generate_order_code (uuid, timestamptz);

DROP FUNCTION IF EXISTS authenticate_user (text, text);

DROP FUNCTION IF EXISTS create_user_with_auth (uuid, text, text, text, user_role, uuid, text, text, text, text, boolean);

DROP FUNCTION IF EXISTS set_updated_at ();

DROP TYPE IF EXISTS customer_type;

DROP TYPE IF EXISTS inventory_unit;

DROP TYPE IF EXISTS payment_status;

DROP TYPE IF EXISTS payment_mode;

DROP TYPE IF EXISTS order_status;

DROP TYPE IF EXISTS user_role;

DROP EXTENSION IF EXISTS "pgcrypto";
