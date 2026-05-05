-- migrate:up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUM TYPES
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM('admin', 'manager', 'operator', 'staff');

CREATE TYPE order_status AS ENUM(
  'pending',
  'processing',
  'completed',
  'delivered',
  'cancelled'
);

CREATE TYPE payment_mode AS ENUM('cash', 'upi', 'card', 'credit', 'other');

CREATE TYPE payment_status AS ENUM('pending', 'partial', 'paid');

CREATE TYPE inventory_unit AS ENUM('piece', 'sheet', 'sqft', 'unit');

CREATE TYPE customer_type AS ENUM('studio', 'amateur', 'other', 'employee');

-- -----------------------------------------------------------------------------
-- TABLE: branches
-- -----------------------------------------------------------------------------
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  alternate_phone text,
  email text,
  address text,
  logo text,
  banner text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- TABLE: users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (btrim(full_name) <> ''),
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  alternate_phone text,
  email text,
  avatar text,
  address text,
  role user_role NOT NULL DEFAULT 'staff',
  branch_id uuid REFERENCES branches (id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- TABLE: user_auth (REQUIRED FOR CUSTOM AUTH)
-- -----------------------------------------------------------------------------
CREATE TABLE user_auth (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  username text NOT NULL CHECK (btrim(username) <> ''),
  password_hash text NOT NULL CHECK (btrim(password_hash) <> ''),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  is_locked boolean NOT NULL DEFAULT false,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- TABLE: app_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  branch_id uuid REFERENCES branches (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_revoked boolean NOT NULL DEFAULT false
);

-- -----------------------------------------------------------------------------
-- TABLE: customers
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_numeric_id bigint UNIQUE,
  customer_code text UNIQUE,
  type customer_type NOT NULL DEFAULT 'other',
  name text NOT NULL CHECK (btrim(name) <> ''),
  avatar text,
  studio_name text,
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  alternate_phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- TABLE: vendors
-- -----------------------------------------------------------------------------
CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code text UNIQUE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  avatar text,
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  alternate_phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- TABLE: inventory
-- -----------------------------------------------------------------------------
CREATE TABLE inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  sku text NOT NULL CHECK (btrim(sku) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  image text,
  unit inventory_unit NOT NULL DEFAULT 'unit',
  is_active boolean NOT NULL DEFAULT true,
  quantity numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  last_purchase_rate numeric(12, 2) CHECK (
    last_purchase_rate IS NULL
    OR last_purchase_rate >= 0
  ),
  last_vendor_id uuid REFERENCES vendors (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, sku)
);

-- -----------------------------------------------------------------------------
-- TABLE: inventory_pricing
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  inventory_id uuid NOT NULL REFERENCES inventory (id) ON DELETE CASCADE,
  customer_type customer_type NOT NULL,
  selling_rate numeric(12, 2) NOT NULL CHECK (selling_rate >= 0),
  effective_from date NOT NULL,
  effective_to date,
  UNIQUE (
    branch_id,
    inventory_id,
    customer_type,
    effective_from
  ),
  CHECK (
    effective_to IS NULL
    OR effective_to >= effective_from
  )
);

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

-- -----------------------------------------------------------------------------
-- TABLE: order_vendors
-- -----------------------------------------------------------------------------
CREATE TABLE order_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors (id) ON DELETE RESTRICT,
  vendor_paid_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (vendor_paid_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, vendor_id)
);

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
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- -----------------------------------------------------------------------------
-- TABLE: branch_expenses
-- -----------------------------------------------------------------------------
CREATE TABLE branch_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  category text NOT NULL CHECK (btrim(category) <> ''),
  name text,
  remarks text,
  payment_mode payment_mode NOT NULL DEFAULT 'cash',
  order_vendor_id uuid REFERENCES order_vendors (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- TABLE: employee_expenses
-- -----------------------------------------------------------------------------
CREATE TABLE employee_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  category text NOT NULL CHECK (btrim(category) <> ''),
  order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
  payment_mode payment_mode NOT NULL DEFAULT 'cash',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- TABLE: order_sequences (BRANCH + YEAR)
-- -----------------------------------------------------------------------------
CREATE TABLE order_sequences (
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  year int NOT NULL,
  last_number bigint NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (branch_id, year)
);

-- -----------------------------------------------------------------------------
-- GENERIC FUNCTION: set_updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at () RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- AUTH FUNCTION: create_user_with_auth
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_user_with_auth (
  p_admin_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_role user_role,
  p_branch_id uuid,
  p_username text,
  p_password text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_user_id uuid;
  v_role user_role;
  v_is_active boolean;
BEGIN
  SELECT role, is_active
  INTO v_role, v_is_active
  FROM users
  WHERE id = p_admin_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Inactive admin cannot create users';
  END IF;

  INSERT INTO users (full_name, phone, email, role, branch_id)
  VALUES (p_full_name, p_phone, p_email, p_role, p_branch_id)
  RETURNING id INTO v_user_id;

  INSERT INTO user_auth (user_id, username, password_hash)
  VALUES (
    v_user_id,
    lower(btrim(p_username)),
    crypt(p_password, gen_salt('bf'))
  );

  RETURN v_user_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- AUTH FUNCTION: authenticate_user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION authenticate_user (p_username text, p_password text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_user_id uuid;
  v_hash text;
  v_locked boolean;
  v_is_active boolean;
BEGIN
  SELECT ua.user_id, ua.password_hash, ua.is_locked, u.is_active
  INTO v_user_id, v_hash, v_locked, v_is_active
  FROM user_auth ua
  JOIN users u ON u.id = ua.user_id
  WHERE lower(ua.username) = lower(btrim(p_username));

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
    UPDATE user_auth
    SET failed_attempts = 0,
        last_login = now(),
        updated_at = now()
    WHERE user_id = v_user_id;

    RETURN v_user_id;
  END IF;

  UPDATE user_auth
  SET failed_attempts = failed_attempts + 1,
      is_locked = (failed_attempts + 1) >= 5,
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: generate_order_code
-- Uses order_date year for deterministic imports and backdated orders.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_order_code (
  p_branch_id uuid,
  p_order_date timestamptz DEFAULT now()
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM p_order_date);
  v_year_prefix text := to_char(p_order_date, 'YY');
  v_next_number bigint;
  v_branch_code text;
BEGIN
  SELECT code INTO v_branch_code
  FROM branches
  WHERE id = p_branch_id;

  IF v_branch_code IS NULL THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  INSERT INTO order_sequences (branch_id, year, last_number)
  VALUES (p_branch_id, v_year, 1)
  ON CONFLICT (branch_id, year)
  DO UPDATE
  SET last_number = order_sequences.last_number + 1
  RETURNING last_number INTO v_next_number;

  RETURN v_branch_code || '-' || v_year_prefix || '-' || LPAD(v_next_number::text, 5, '0');
END;
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: internal flag helpers for system-managed order totals
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_internal_order_update (p_value boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.internal_order_update', CASE WHEN p_value THEN 'on' ELSE 'off' END, true);
END;
$$;

CREATE OR REPLACE FUNCTION is_internal_order_update () RETURNS boolean LANGUAGE sql AS $$
  SELECT COALESCE(current_setting('app.internal_order_update', true), 'off') = 'on';
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: recalculate_order_financials
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_order_financials (p_order_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_total_amount numeric(14,2);
  v_discount_amount numeric(14,2);
  v_payable_amount numeric(14,2);
  v_paid_amount numeric(14,2);
  v_payment_status payment_status;
BEGIN
  SELECT COALESCE(SUM(line_total), 0)::numeric(14,2)
  INTO v_total_amount
  FROM order_items
  WHERE order_id = p_order_id;

  SELECT discount_amount
  INTO v_discount_amount
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_discount_amount IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_discount_amount > v_total_amount THEN
    RAISE EXCEPTION 'discount_amount cannot exceed total_amount';
  END IF;

  v_payable_amount := (v_total_amount - v_discount_amount)::numeric(14,2);

  SELECT COALESCE(SUM(amount), 0)::numeric(14,2)
  INTO v_paid_amount
  FROM payments
  WHERE order_id = p_order_id;

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

  PERFORM set_internal_order_update(true);

  UPDATE orders
  SET total_amount = v_total_amount,
      payable_amount = v_payable_amount,
      paid_amount = v_paid_amount,
      payment_status = v_payment_status,
      updated_at = now()
  WHERE id = p_order_id;

  PERFORM set_internal_order_update(false);
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: set order_code automatically
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_order_code () RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.order_code IS NOT NULL THEN
      RAISE EXCEPTION 'Manual order_code not allowed';
    END IF;

    NEW.order_code := generate_order_code(NEW.branch_id, COALESCE(NEW.order_date, now()));
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: validate order header + guard derived fields
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validate_order_header () RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_user_branch uuid;
  v_user_active boolean;
BEGIN
  SELECT branch_id, is_active
  INTO v_user_branch, v_user_active
  FROM users
  WHERE id = NEW.created_by;

  IF v_user_branch IS NULL THEN
    RAISE EXCEPTION 'Created by user not found or branch not assigned';
  END IF;

  IF NOT v_user_active THEN
    RAISE EXCEPTION 'Inactive user cannot create or update orders';
  END IF;

  IF v_user_branch <> NEW.branch_id THEN
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

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: restore inventory when order is cancelled
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restore_inventory_on_cancel () RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE inventory i
    SET quantity = i.quantity + oi.quantity,
        updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.inventory_id = i.id
      AND i.branch_id = NEW.branch_id;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: validate inventory pricing date overlaps
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validate_inventory_pricing () RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM inventory i
    WHERE i.id = NEW.inventory_id
      AND i.branch_id = NEW.branch_id
  ) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'inventory_id does not belong to branch_id';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM inventory_pricing ip
    WHERE ip.branch_id = NEW.branch_id
      AND ip.inventory_id = NEW.inventory_id
      AND ip.customer_type = NEW.customer_type
      AND ip.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND daterange(ip.effective_from, COALESCE(ip.effective_to, 'infinity'::date), '[]')
          && daterange(NEW.effective_from, COALESCE(NEW.effective_to, 'infinity'::date), '[]')
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Overlapping inventory pricing range for same branch, inventory and customer_type';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: apply order item inventory changes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_apply_order_item_inventory () RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order_branch uuid;
  v_order_status order_status;
  v_inventory_branch uuid;
  v_available_qty numeric(12,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT branch_id, status
    INTO v_order_branch, v_order_status
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_branch IS NULL THEN
      RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order_status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot add items to a cancelled order';
    END IF;

    IF round((NEW.quantity * NEW.unit_price)::numeric, 2) <> NEW.line_total THEN
      RAISE EXCEPTION 'line_total must equal quantity * unit_price';
    END IF;

    SELECT branch_id, quantity
    INTO v_inventory_branch, v_available_qty
    FROM inventory
    WHERE id = NEW.inventory_id
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

    UPDATE inventory
    SET quantity = quantity - NEW.quantity,
        updated_at = now()
    WHERE id = NEW.inventory_id;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.order_id <> OLD.order_id THEN
      RAISE EXCEPTION 'Changing order_id is not allowed';
    END IF;

    SELECT branch_id, status
    INTO v_order_branch, v_order_status
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot edit items of a cancelled order';
    END IF;

    IF round((NEW.quantity * NEW.unit_price)::numeric, 2) <> NEW.line_total THEN
      RAISE EXCEPTION 'line_total must equal quantity * unit_price';
    END IF;

    UPDATE inventory
    SET quantity = quantity + OLD.quantity,
        updated_at = now()
    WHERE id = OLD.inventory_id;

    SELECT branch_id, quantity
    INTO v_inventory_branch, v_available_qty
    FROM inventory
    WHERE id = NEW.inventory_id
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

    UPDATE inventory
    SET quantity = quantity - NEW.quantity,
        updated_at = now()
    WHERE id = NEW.inventory_id;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT status
    INTO v_order_status
    FROM orders
    WHERE id = OLD.order_id;

    IF v_order_status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot delete items from a cancelled order';
    END IF;

    UPDATE inventory
    SET quantity = quantity + OLD.quantity,
        updated_at = now()
    WHERE id = OLD.inventory_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: recalculate order when items change
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recalculate_order_after_items () RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalculate_order_financials(COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: validate payments
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validate_payment () RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order_branch uuid;
  v_order_status order_status;
  v_user_branch uuid;
  v_user_active boolean;
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

  SELECT branch_id, is_active
  INTO v_user_branch, v_user_active
  FROM users
  WHERE id = NEW.received_by;

  IF v_user_branch IS NULL THEN
    RAISE EXCEPTION 'Received by user not found or branch not assigned';
  END IF;

  IF NOT v_user_active THEN
    RAISE EXCEPTION 'Inactive user cannot receive payment';
  END IF;

  IF v_user_branch <> NEW.branch_id THEN
    RAISE EXCEPTION 'Payment receiver must belong to the same branch';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: recalculate order when payments change
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recalculate_order_after_payments () RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalculate_order_financials(COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: recalculate order when discount changes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recalculate_order_after_discount () RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalculate_order_financials(NEW.id);
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION: update offer item counters
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_update_offer_item_totals () RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order_status order_status;
BEGIN
  SELECT status
  INTO v_order_status
  FROM orders
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change offer items for a cancelled order';
  END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE offer_items
    SET total_ordered_qty = total_ordered_qty + NEW.qty,
        quantity_in_stock = quantity_in_stock - NEW.qty,
        updated_at = now()
    WHERE id = NEW.offer_item_id
      AND quantity_in_stock >= NEW.qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient offer item stock';
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.order_id <> OLD.order_id THEN
      RAISE EXCEPTION 'Changing order_id is not allowed';
    END IF;

    UPDATE offer_items
    SET total_ordered_qty = total_ordered_qty - OLD.qty,
        quantity_in_stock = quantity_in_stock + OLD.qty,
        updated_at = now()
    WHERE id = OLD.offer_item_id;

    UPDATE offer_items
    SET total_ordered_qty = total_ordered_qty + NEW.qty,
        quantity_in_stock = quantity_in_stock - NEW.qty,
        updated_at = now()
    WHERE id = NEW.offer_item_id
      AND quantity_in_stock >= NEW.qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient offer item stock';
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE offer_items
    SET total_ordered_qty = total_ordered_qty - OLD.qty,
        quantity_in_stock = quantity_in_stock + OLD.qty,
        updated_at = now()
    WHERE id = OLD.offer_item_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGERS
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_branches_updated_at BEFORE
UPDATE ON branches FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER trg_users_updated_at BEFORE
UPDATE ON users FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER trg_user_auth_updated_at BEFORE
UPDATE ON user_auth FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER trg_customers_updated_at BEFORE
UPDATE ON customers FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER trg_vendors_updated_at BEFORE
UPDATE ON vendors FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER trg_inventory_updated_at BEFORE
UPDATE ON inventory FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER trg_offer_items_updated_at BEFORE
UPDATE ON offer_items FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER trigger_set_order_code BEFORE INSERT ON orders FOR EACH ROW
EXECUTE FUNCTION trg_set_order_code ();

CREATE TRIGGER trg_validate_order_header BEFORE INSERT
OR
UPDATE ON orders FOR EACH ROW
EXECUTE FUNCTION trg_validate_order_header ();

CREATE TRIGGER trg_restore_inventory_on_cancel
AFTER
UPDATE OF status ON orders FOR EACH ROW
EXECUTE FUNCTION restore_inventory_on_cancel ();

CREATE TRIGGER trg_recalculate_order_after_discount
AFTER
UPDATE OF discount_amount ON orders FOR EACH ROW WHEN (
  NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
)
EXECUTE FUNCTION trg_recalculate_order_after_discount ();

CREATE TRIGGER trg_validate_inventory_pricing BEFORE INSERT
OR
UPDATE ON inventory_pricing FOR EACH ROW
EXECUTE FUNCTION trg_validate_inventory_pricing ();

CREATE TRIGGER trg_apply_order_item_inventory BEFORE INSERT
OR
UPDATE
OR DELETE ON order_items FOR EACH ROW
EXECUTE FUNCTION trg_apply_order_item_inventory ();

CREATE TRIGGER trg_recalculate_order_after_items
AFTER INSERT
OR
UPDATE
OR DELETE ON order_items FOR EACH ROW
EXECUTE FUNCTION trg_recalculate_order_after_items ();

CREATE TRIGGER trg_validate_payment BEFORE INSERT
OR
UPDATE ON payments FOR EACH ROW
EXECUTE FUNCTION trg_validate_payment ();

CREATE TRIGGER trg_recalculate_order_after_payments
AFTER INSERT
OR
UPDATE
OR DELETE ON payments FOR EACH ROW
EXECUTE FUNCTION trg_recalculate_order_after_payments ();

CREATE TRIGGER trg_update_offer_item_totals BEFORE INSERT
OR
UPDATE
OR DELETE ON order_offer_items FOR EACH ROW
EXECUTE FUNCTION trg_update_offer_item_totals ();

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_user_auth_username_lower ON user_auth (lower(username));

CREATE INDEX idx_app_sessions_user_id ON app_sessions (user_id);

CREATE INDEX idx_app_sessions_last_seen_at ON app_sessions (last_seen_at);

CREATE INDEX idx_app_sessions_expires_at ON app_sessions (expires_at);

CREATE INDEX idx_orders_branch_id ON orders (branch_id);

CREATE INDEX idx_orders_created_by ON orders (created_by);

CREATE INDEX idx_orders_customer_id ON orders (customer_id);

CREATE INDEX idx_orders_order_date ON orders (order_date);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);

CREATE INDEX idx_order_items_inventory_id ON order_items (inventory_id);

CREATE INDEX idx_inventory_branch ON inventory (branch_id);

CREATE INDEX idx_inventory_last_vendor_id ON inventory (last_vendor_id);

CREATE INDEX idx_inventory_pricing_lookup ON inventory_pricing (
  branch_id,
  inventory_id,
  customer_type,
  effective_from,
  effective_to
);

CREATE INDEX idx_payments_order_id ON payments (order_id);

CREATE INDEX idx_payments_branch_id ON payments (branch_id);

CREATE INDEX idx_payments_received_by ON payments (received_by);

CREATE INDEX idx_order_vendors_order_id ON order_vendors (order_id);

CREATE INDEX idx_order_offer_items_order_id ON order_offer_items (order_id);

-- migrate:down
DROP TRIGGER IF EXISTS trg_update_offer_item_totals ON order_offer_items;

DROP TRIGGER IF EXISTS trg_recalculate_order_after_payments ON payments;

DROP TRIGGER IF EXISTS trg_validate_payment ON payments;

DROP TRIGGER IF EXISTS trg_recalculate_order_after_items ON order_items;

DROP TRIGGER IF EXISTS trg_apply_order_item_inventory ON order_items;

DROP TRIGGER IF EXISTS trg_validate_inventory_pricing ON inventory_pricing;

DROP TRIGGER IF EXISTS trg_recalculate_order_after_discount ON orders;

DROP TRIGGER IF EXISTS trg_restore_inventory_on_cancel ON orders;

DROP TRIGGER IF EXISTS trg_validate_order_header ON orders;

DROP TRIGGER IF EXISTS trigger_set_order_code ON orders;

DROP TRIGGER IF EXISTS trg_offer_items_updated_at ON offer_items;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;

DROP TRIGGER IF EXISTS trg_user_auth_updated_at ON user_auth;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;

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

DROP FUNCTION IF EXISTS create_user_with_auth (
  uuid,
  text,
  text,
  text,
  user_role,
  uuid,
  text,
  text
);

DROP FUNCTION IF EXISTS set_updated_at ();

DROP TABLE IF EXISTS employee_expenses;

DROP TABLE IF EXISTS branch_expenses;

DROP TABLE IF EXISTS order_offer_items;

DROP TABLE IF EXISTS offer_items;

DROP TABLE IF EXISTS order_vendors;

DROP TABLE IF EXISTS payments;

DROP TABLE IF EXISTS order_items;

DROP TABLE IF EXISTS app_sessions;

DROP TABLE IF EXISTS orders;

DROP TABLE IF EXISTS inventory_pricing;

DROP TABLE IF EXISTS inventory;

DROP TABLE IF EXISTS vendors;

DROP TABLE IF EXISTS customers;

DROP TABLE IF EXISTS user_auth;

DROP TABLE IF EXISTS users;

DROP TABLE IF EXISTS order_sequences;

DROP TABLE IF EXISTS branches;

DROP TYPE IF EXISTS customer_type;

DROP TYPE IF EXISTS inventory_unit;

DROP TYPE IF EXISTS payment_status;

DROP TYPE IF EXISTS payment_mode;

DROP TYPE IF EXISTS order_status;

DROP TYPE IF EXISTS user_role;
