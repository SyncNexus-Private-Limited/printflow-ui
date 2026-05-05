-- migrate:up
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  offer_type text NOT NULL CHECK (
    offer_type IN ('percentage', 'flat', 'buy_x_get_y')
  ),
  discount_value numeric(14, 2),
  buy_quantity integer,
  get_quantity integer,
  minimum_order_value numeric(14, 2),
  customer_type customer_type,
  starts_at date NOT NULL,
  ends_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    discount_value IS NULL
    OR discount_value >= 0
  ),
  CHECK (
    buy_quantity IS NULL
    OR buy_quantity > 0
  ),
  CHECK (
    get_quantity IS NULL
    OR get_quantity > 0
  ),
  CHECK (
    minimum_order_value IS NULL
    OR minimum_order_value >= 0
  ),
  CHECK (
    ends_at IS NULL
    OR ends_at >= starts_at
  ),
  CHECK (
    (
      offer_type IN ('percentage', 'flat')
      AND discount_value IS NOT NULL
      AND buy_quantity IS NULL
      AND get_quantity IS NULL
    )
    OR (
      offer_type = 'buy_x_get_y'
      AND discount_value IS NULL
      AND buy_quantity IS NOT NULL
      AND get_quantity IS NOT NULL
    )
  )
);

CREATE TRIGGER trg_offers_updated_at BEFORE
UPDATE ON offers FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TABLE offer_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offers (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN ('create', 'update', 'deactivate', 'restore')
  ),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_offers_branch_id ON offers (branch_id);

CREATE INDEX idx_offers_code ON offers (code);

CREATE INDEX idx_offers_lower_name ON offers (lower(name));

CREATE INDEX idx_offers_offer_type ON offers (offer_type);

CREATE INDEX idx_offers_customer_type ON offers (customer_type);

CREATE INDEX idx_offers_is_active ON offers (is_active);

CREATE INDEX idx_offers_starts_at ON offers (starts_at);

CREATE INDEX idx_offers_ends_at ON offers (ends_at);

CREATE INDEX idx_offers_created_at ON offers (created_at);

CREATE INDEX idx_offers_updated_at ON offers (updated_at);

CREATE INDEX idx_offer_audit_logs_offer_id ON offer_audit_logs (offer_id);

CREATE INDEX idx_offer_audit_logs_action ON offer_audit_logs (action);

CREATE INDEX idx_offer_audit_logs_changed_by ON offer_audit_logs (changed_by);

CREATE INDEX idx_offer_audit_logs_created_at ON offer_audit_logs (created_at DESC);

CREATE INDEX idx_offer_audit_logs_offer_created_at ON offer_audit_logs (offer_id, created_at DESC);

-- migrate:down
DROP INDEX IF EXISTS idx_offer_audit_logs_offer_created_at;

DROP INDEX IF EXISTS idx_offer_audit_logs_created_at;

DROP INDEX IF EXISTS idx_offer_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_offer_audit_logs_action;

DROP INDEX IF EXISTS idx_offer_audit_logs_offer_id;

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

DROP TRIGGER IF EXISTS trg_offers_updated_at ON offers;

DROP TABLE IF EXISTS offers;
