-- migrate:up

-- -----------------------------------------------------------------------------
-- TABLE: inventory (FINAL: includes audit/soft-delete/reorder columns from 20260430)
-- -----------------------------------------------------------------------------
CREATE TABLE inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  sku text NOT NULL CHECK (btrim(sku) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  image text,
  unit inventory_unit NOT NULL DEFAULT 'unit',
  is_active boolean NOT NULL DEFAULT TRUE,
  quantity numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  last_purchase_rate numeric(12, 2) CHECK (last_purchase_rate IS NULL OR last_purchase_rate >= 0),
  last_vendor_id uuid REFERENCES vendors (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users (id) ON DELETE SET NULL,
  reorder_level numeric(12, 3) CHECK (reorder_level IS NULL OR reorder_level >= 0),
  UNIQUE (branch_id, sku)
);

COMMENT ON COLUMN inventory.deleted_at IS 'Set when the item is archived (soft delete). NULL means active.';

COMMENT ON COLUMN inventory.deleted_by IS 'User who archived the item.';

COMMENT ON COLUMN inventory.reorder_level IS 'Item-specific low-stock threshold. NULL means the global default applies.';

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory (branch_id);

CREATE INDEX IF NOT EXISTS idx_inventory_last_vendor_id ON inventory (last_vendor_id);

CREATE INDEX IF NOT EXISTS idx_inventory_is_active ON inventory (is_active);

-- Partial index for active (non-archived) item lookups — the common case
CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory (branch_id, is_active)
WHERE
  deleted_at IS NULL;

-- Functional index for case-insensitive name search
CREATE INDEX IF NOT EXISTS idx_inventory_lower_name ON inventory (lower(name));

-- Low-stock alert query: quantity vs reorder_level per branch
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory (branch_id, quantity, reorder_level)
WHERE
  deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- TABLE: inventory_pricing (FINAL: includes audit columns from 20260430)
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  inventory_id uuid NOT NULL REFERENCES inventory (id) ON DELETE CASCADE,
  customer_type customer_type NOT NULL,
  selling_rate numeric(12, 2) NOT NULL CHECK (selling_rate >= 0),
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (branch_id, inventory_id, customer_type, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TRIGGER set_inventory_pricing_updated_at
  BEFORE UPDATE ON inventory_pricing
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER trg_validate_inventory_pricing
  BEFORE INSERT OR UPDATE ON inventory_pricing
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_inventory_pricing ();

CREATE INDEX IF NOT EXISTS idx_inventory_pricing_lookup ON inventory_pricing (branch_id, inventory_id, customer_type, effective_from, effective_to);

-- -----------------------------------------------------------------------------
-- TABLE: inventory_stock_movements
-- Ledger of all stock quantity changes. Every mutation must produce a row here.
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES inventory (id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('opening_balance', 'manual_adjustment', 'sale', 'sale_reversal', 'correction', 'purchase_receipt', 'damage', 'return')),
  quantity_delta numeric(12, 3) NOT NULL,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_stock_movements IS 'Ledger of all inventory quantity changes. Every quantity mutation must produce a corresponding movement row.';

COMMENT ON COLUMN inventory_stock_movements.quantity_delta IS 'Signed quantity change. Positive = stock increase, negative = decrease.';

COMMENT ON COLUMN inventory_stock_movements.reference_type IS 'Source entity type (e.g. order_item, correction). NULL for manual adjustments.';

COMMENT ON COLUMN inventory_stock_movements.reference_id IS 'UUID of the source record when reference_type is set.';

CREATE INDEX IF NOT EXISTS idx_inventory_stock_movements_inventory_id ON inventory_stock_movements (inventory_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_movements_branch_id ON inventory_stock_movements (branch_id, created_at DESC);

-- migrate:down

DROP TRIGGER IF EXISTS trg_validate_inventory_pricing ON inventory_pricing;

DROP TRIGGER IF EXISTS set_inventory_pricing_updated_at ON inventory_pricing;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;

DROP INDEX IF EXISTS idx_inventory_stock_movements_branch_id;

DROP INDEX IF EXISTS idx_inventory_stock_movements_inventory_id;

DROP INDEX IF EXISTS idx_inventory_pricing_lookup;

DROP INDEX IF EXISTS idx_inventory_low_stock;

DROP INDEX IF EXISTS idx_inventory_lower_name;

DROP INDEX IF EXISTS idx_inventory_active;

DROP INDEX IF EXISTS idx_inventory_is_active;

DROP INDEX IF EXISTS idx_inventory_last_vendor_id;

DROP INDEX IF EXISTS idx_inventory_branch;

DROP TABLE IF EXISTS inventory_stock_movements;

DROP TABLE IF EXISTS inventory_pricing;

DROP TABLE IF EXISTS inventory;
