-- migrate:up
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_vendor_code ON vendors (vendor_code);

CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors (phone);

CREATE INDEX IF NOT EXISTS idx_vendors_lower_name ON vendors (lower(name));

CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors (is_active);

CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON vendors (created_at);

CREATE INDEX IF NOT EXISTS idx_vendors_updated_at ON vendors (updated_at);

CREATE INDEX IF NOT EXISTS idx_vendors_created_by ON vendors (created_by);

CREATE INDEX IF NOT EXISTS idx_vendors_updated_by ON vendors (updated_by);

CREATE TABLE IF NOT EXISTS vendor_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN ('create', 'update', 'deactivate', 'restore')
  ),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE vendor_audit_logs IS 'Append-only audit trail for vendor management actions.';

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_vendor_id ON vendor_audit_logs (vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_action ON vendor_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_changed_by ON vendor_audit_logs (changed_by);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_created_at ON vendor_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_vendor_created_at ON vendor_audit_logs (vendor_id, created_at DESC);

-- migrate:down
DROP INDEX IF EXISTS idx_vendor_audit_logs_vendor_created_at;

DROP INDEX IF EXISTS idx_vendor_audit_logs_created_at;

DROP INDEX IF EXISTS idx_vendor_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_vendor_audit_logs_action;

DROP INDEX IF EXISTS idx_vendor_audit_logs_vendor_id;

DROP TABLE IF EXISTS vendor_audit_logs;

DROP INDEX IF EXISTS idx_vendors_updated_by;

DROP INDEX IF EXISTS idx_vendors_created_by;

DROP INDEX IF EXISTS idx_vendors_updated_at;

DROP INDEX IF EXISTS idx_vendors_created_at;

DROP INDEX IF EXISTS idx_vendors_is_active;

DROP INDEX IF EXISTS idx_vendors_lower_name;

DROP INDEX IF EXISTS idx_vendors_phone;

DROP INDEX IF EXISTS idx_vendors_vendor_code;

ALTER TABLE vendors
DROP COLUMN IF EXISTS updated_by,
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS is_active;
