-- migrate:up
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers (is_active);

CREATE INDEX IF NOT EXISTS idx_customers_type ON customers (type);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

CREATE INDEX IF NOT EXISTS idx_customers_name_lower ON customers (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_customers_studio_name_lower ON customers (LOWER(studio_name))
WHERE
  studio_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers (created_at);

CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers (updated_at);

CREATE TABLE customer_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (
    action IN ('create', 'update', 'deactivate', 'restore')
  ),
  snapshot JSONB NOT NULL,
  changed_fields JSONB,
  changed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_audit_logs_customer_id ON customer_audit_logs (customer_id);

CREATE INDEX idx_customer_audit_logs_customer_id_created_at ON customer_audit_logs (customer_id, created_at DESC);

CREATE INDEX idx_customer_audit_logs_changed_by ON customer_audit_logs (changed_by);

-- migrate:down
DROP TABLE IF EXISTS customer_audit_logs;

DROP INDEX IF EXISTS idx_customers_updated_at;

DROP INDEX IF EXISTS idx_customers_created_at;

DROP INDEX IF EXISTS idx_customers_studio_name_lower;

DROP INDEX IF EXISTS idx_customers_name_lower;

DROP INDEX IF EXISTS idx_customers_phone;

DROP INDEX IF EXISTS idx_customers_type;

DROP INDEX IF EXISTS idx_customers_is_active;

ALTER TABLE customers
DROP COLUMN IF EXISTS updated_by,
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS is_active;
