-- migrate:up

-- ---------------------------------------------------------------------------
-- 1. Audit, soft-delete, and reorder columns on inventory
-- ---------------------------------------------------------------------------
ALTER TABLE inventory
  ADD COLUMN created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN reorder_level numeric(12, 3) CHECK (
    reorder_level IS NULL OR reorder_level >= 0
  );

COMMENT ON COLUMN inventory.created_by IS 'User who created this inventory record.';
COMMENT ON COLUMN inventory.updated_by IS 'User who last updated this inventory record.';
COMMENT ON COLUMN inventory.deleted_at IS 'Set when the item is archived (soft delete). NULL means the item is not archived.';
COMMENT ON COLUMN inventory.deleted_by IS 'The user who archived the item.';
COMMENT ON COLUMN inventory.reorder_level IS 'Item-specific low-stock threshold. When quantity falls to or below this value the item is considered low-stock. NULL means the global default applies.';

-- ---------------------------------------------------------------------------
-- 2. Audit columns on inventory_pricing
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_pricing
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN updated_by uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE TRIGGER set_inventory_pricing_updated_at
  BEFORE UPDATE ON inventory_pricing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Inventory audit log
-- inventory_id is intentionally NOT a FK so audit rows survive item deletion.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_audit_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id   uuid        NOT NULL,
  action         text        NOT NULL CHECK (
    action IN ('create', 'update', 'archive', 'restore', 'activate', 'deactivate')
  ),
  snapshot       jsonb       NOT NULL,
  changed_fields jsonb,
  changed_by     uuid        REFERENCES users (id) ON DELETE SET NULL,
  changed_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_audit_logs IS
  'Append-only audit trail for inventory management actions. '
  'inventory_id is not a FK so audit rows survive item deletion.';

COMMENT ON COLUMN inventory_audit_logs.snapshot IS
  'Inventory row state at the time of the action. '
  'For update: the before-state. For create: the inserted state.';

COMMENT ON COLUMN inventory_audit_logs.changed_fields IS
  'For update actions: JSON object mapping field names to {from, to} pairs. '
  'NULL for all other action types.';

CREATE INDEX idx_inventory_audit_logs_inventory_id
  ON inventory_audit_logs (inventory_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Inventory stock movement ledger
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_stock_movements (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id   uuid          NOT NULL REFERENCES inventory (id) ON DELETE RESTRICT,
  branch_id      uuid          NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  movement_type  text          NOT NULL CHECK (
    movement_type IN (
      'opening_balance',
      'manual_adjustment',
      'sale',
      'sale_reversal',
      'correction',
      'purchase_receipt',
      'damage',
      'return'
    )
  ),
  quantity_delta numeric(12, 3) NOT NULL,
  reference_type text,
  reference_id   uuid,
  note           text,
  created_by     uuid          REFERENCES users (id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_stock_movements IS
  'Ledger of all inventory quantity changes. '
  'Every quantity mutation must produce a corresponding movement row.';

COMMENT ON COLUMN inventory_stock_movements.quantity_delta IS
  'Signed quantity change. Positive = stock increase, negative = decrease.';

COMMENT ON COLUMN inventory_stock_movements.reference_type IS
  'Source entity type (e.g. order_item, correction). NULL for manual adjustments.';

COMMENT ON COLUMN inventory_stock_movements.reference_id IS
  'UUID of the source record when reference_type is set.';

CREATE INDEX idx_inventory_stock_movements_inventory_id
  ON inventory_stock_movements (inventory_id, created_at DESC);

CREATE INDEX idx_inventory_stock_movements_branch_id
  ON inventory_stock_movements (branch_id, created_at DESC);

-- migrate:down
DROP TRIGGER IF EXISTS set_inventory_pricing_updated_at ON inventory_pricing;

DROP INDEX IF EXISTS idx_inventory_stock_movements_branch_id;
DROP INDEX IF EXISTS idx_inventory_stock_movements_inventory_id;
DROP INDEX IF EXISTS idx_inventory_audit_logs_inventory_id;

DROP TABLE IF EXISTS inventory_stock_movements;
DROP TABLE IF EXISTS inventory_audit_logs;

ALTER TABLE inventory_pricing
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS created_at;

ALTER TABLE inventory
  DROP COLUMN IF EXISTS reorder_level,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS created_by;
