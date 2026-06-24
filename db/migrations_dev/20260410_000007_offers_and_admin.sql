-- migrate:up
-- NOTE: offers and order_applied_offers are together here because
-- order_applied_offers FK-references offers(id).
-- offer_audit_logs is also here for the same FK reason.

-- -----------------------------------------------------------------------------
-- TABLE: offers
-- -----------------------------------------------------------------------------
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  offer_type text NOT NULL CHECK (offer_type IN ('percentage', 'flat', 'buy_x_get_y')),
  discount_value numeric(14, 2),
  buy_quantity integer,
  get_quantity integer,
  minimum_order_value numeric(14, 2),
  customer_type customer_type,
  starts_at date NOT NULL,
  ends_at date,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_value IS NULL OR discount_value >= 0),
  CHECK (buy_quantity IS NULL OR buy_quantity > 0),
  CHECK (get_quantity IS NULL OR get_quantity > 0),
  CHECK (minimum_order_value IS NULL OR minimum_order_value >= 0),
  CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CHECK (
    (offer_type IN ('percentage', 'flat') AND discount_value IS NOT NULL AND buy_quantity IS NULL AND get_quantity IS NULL)
    OR (offer_type = 'buy_x_get_y' AND discount_value IS NULL AND buy_quantity IS NOT NULL AND get_quantity IS NOT NULL)
  )
);

CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_offers_branch_id ON offers (branch_id);

CREATE INDEX IF NOT EXISTS idx_offers_code ON offers (code);

CREATE INDEX IF NOT EXISTS idx_offers_lower_name ON offers (lower(name));

CREATE INDEX IF NOT EXISTS idx_offers_offer_type ON offers (offer_type);

CREATE INDEX IF NOT EXISTS idx_offers_customer_type ON offers (customer_type);

CREATE INDEX IF NOT EXISTS idx_offers_is_active ON offers (is_active);

CREATE INDEX IF NOT EXISTS idx_offers_starts_at ON offers (starts_at);

CREATE INDEX IF NOT EXISTS idx_offers_ends_at ON offers (ends_at);

CREATE INDEX IF NOT EXISTS idx_offers_created_at ON offers (created_at);

CREATE INDEX IF NOT EXISTS idx_offers_updated_at ON offers (updated_at);

-- Composite index for the active-offer lookup in order form
-- WHERE branch_id = $1 AND is_active = true AND starts_at <= CURRENT_DATE AND (ends_at IS NULL OR ends_at >= CURRENT_DATE)
CREATE INDEX IF NOT EXISTS idx_offers_branch_active_dates ON offers (branch_id, starts_at, ends_at)
WHERE
  is_active = TRUE;

-- -----------------------------------------------------------------------------
-- TABLE: order_applied_offers (references offers — must come after offers)
-- -----------------------------------------------------------------------------
CREATE TABLE order_applied_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  offer_id uuid REFERENCES offers (id) ON DELETE SET NULL,
  code text NOT NULL CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  offer_type text NOT NULL CHECK (offer_type IN ('percentage', 'flat', 'buy_x_get_y')),
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_applied_offers_order_id ON order_applied_offers (order_id);

CREATE INDEX IF NOT EXISTS idx_order_applied_offers_offer_id ON order_applied_offers (offer_id);

-- -----------------------------------------------------------------------------
-- TABLE: offer_audit_logs (references offers — must come after offers)
-- -----------------------------------------------------------------------------
CREATE TABLE offer_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offers (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'deactivate', 'restore')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE offer_audit_logs IS 'Append-only audit trail for offer management actions. offer_id is nullable so rows survive offer deletion.';

CREATE INDEX IF NOT EXISTS idx_offer_audit_logs_offer_id ON offer_audit_logs (offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_audit_logs_action ON offer_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_offer_audit_logs_changed_by ON offer_audit_logs (changed_by);

CREATE INDEX IF NOT EXISTS idx_offer_audit_logs_created_at ON offer_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offer_audit_logs_offer_created_at ON offer_audit_logs (offer_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- BOOTSTRAP: admin user (admin / admin123)
-- Uses a DO block because there is no prior admin to pass as p_admin_id.
-- IMPORTANT: Change this password immediately after first login.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO users (id, full_name, phone, role, is_active, created_at, updated_at)
    VALUES (v_admin_id, 'System Administrator', '0000000000', 'admin', TRUE, now(), now());
  INSERT INTO user_auth (user_id, username, password_hash, failed_attempts, is_locked, created_at, updated_at)
    VALUES (v_admin_id, 'admin', crypt('admin123', gen_salt('bf')), 0, FALSE, now(), now());
END;
$$;

-- migrate:down

DROP INDEX IF EXISTS idx_offer_audit_logs_offer_created_at;

DROP INDEX IF EXISTS idx_offer_audit_logs_created_at;

DROP INDEX IF EXISTS idx_offer_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_offer_audit_logs_action;

DROP INDEX IF EXISTS idx_offer_audit_logs_offer_id;

DROP INDEX IF EXISTS idx_order_applied_offers_offer_id;

DROP INDEX IF EXISTS idx_order_applied_offers_order_id;

DROP TRIGGER IF EXISTS trg_offers_updated_at ON offers;

DROP INDEX IF EXISTS idx_offers_branch_active_dates;

DROP INDEX IF EXISTS idx_offers_updated_at;

DROP INDEX IF EXISTS idx_offers_created_at;

DROP INDEX IF EXISTS idx_offers_ends_at;

DROP INDEX IF EXISTS idx_offers_starts_at;

DROP INDEX IF EXISTS idx_offers_is_active;

DROP INDEX IF EXISTS idx_offers_customer_type;

DROP INDEX IF EXISTS idx_offers_offer_type;

DROP INDEX IF EXISTS idx_offers_lower_name;

DROP INDEX IF EXISTS idx_offers_code;

DROP INDEX IF EXISTS idx_offers_branch_id;

DROP TABLE IF EXISTS offer_audit_logs;

DROP TABLE IF EXISTS order_applied_offers;

DROP TABLE IF EXISTS offers;

-- Remove bootstrap admin (cascade handles user_auth via ON DELETE CASCADE)
DELETE FROM users
WHERE role = 'admin'
  AND id IN (
    SELECT user_id FROM user_auth WHERE username = 'admin'
  );
