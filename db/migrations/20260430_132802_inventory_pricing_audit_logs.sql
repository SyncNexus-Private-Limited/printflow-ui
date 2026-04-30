-- migrate:up

-- ---------------------------------------------------------------------------
-- Audit log for inventory_pricing changes.
-- All FK columns are nullable with ON DELETE SET NULL so that audit rows
-- survive deletion of the referenced pricing row, branch, item, or user.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_pricing_audit_logs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_pricing_id uuid        REFERENCES inventory_pricing (id) ON DELETE SET NULL,
  branch_id            uuid        REFERENCES branches (id) ON DELETE SET NULL,
  inventory_id         uuid        REFERENCES inventory (id) ON DELETE SET NULL,
  action               text        NOT NULL CHECK (action IN ('create', 'update', 'close')),
  snapshot             jsonb       NOT NULL,
  changed_fields       jsonb,
  changed_by           uuid        REFERENCES users (id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_pricing_audit_logs IS
  'Append-only audit trail for inventory pricing create, update, and close actions.';

COMMENT ON COLUMN inventory_pricing_audit_logs.snapshot IS
  'Inventory pricing row state at the time of the action. '
  'For update/close: the before-state. For create: the inserted state.';

COMMENT ON COLUMN inventory_pricing_audit_logs.changed_fields IS
  'For update and close actions: JSON object mapping field names to {from, to} pairs. '
  'NULL for create actions.';

CREATE INDEX idx_inv_pricing_audit_pricing_id
  ON inventory_pricing_audit_logs (inventory_pricing_id);

CREATE INDEX idx_inv_pricing_audit_branch_id
  ON inventory_pricing_audit_logs (branch_id);

CREATE INDEX idx_inv_pricing_audit_inventory_id
  ON inventory_pricing_audit_logs (inventory_id);

CREATE INDEX idx_inv_pricing_audit_changed_by
  ON inventory_pricing_audit_logs (changed_by);

CREATE INDEX idx_inv_pricing_audit_created_at
  ON inventory_pricing_audit_logs (created_at);

CREATE INDEX idx_inv_pricing_audit_pricing_id_created_at
  ON inventory_pricing_audit_logs (inventory_pricing_id, created_at DESC);

-- migrate:down

DROP INDEX IF EXISTS idx_inv_pricing_audit_pricing_id_created_at;
DROP INDEX IF EXISTS idx_inv_pricing_audit_created_at;
DROP INDEX IF EXISTS idx_inv_pricing_audit_changed_by;
DROP INDEX IF EXISTS idx_inv_pricing_audit_inventory_id;
DROP INDEX IF EXISTS idx_inv_pricing_audit_branch_id;
DROP INDEX IF EXISTS idx_inv_pricing_audit_pricing_id;
DROP TABLE IF EXISTS inventory_pricing_audit_logs;
