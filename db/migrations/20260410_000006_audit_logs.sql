-- migrate:up
-- All append-only audit log tables. offer_audit_logs is in migration 7
-- because it FK-references offers, which is also created in migration 7.

-- -----------------------------------------------------------------------------
-- TABLE: vendor_audit_logs
-- Tracks vendor create/update/deactivate/restore actions.
-- vendor_id survives vendor deletion (ON DELETE SET NULL).
-- -----------------------------------------------------------------------------
CREATE TABLE vendor_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'deactivate', 'restore')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE vendor_audit_logs IS 'Append-only audit trail for vendor management actions. vendor_id is nullable so rows survive vendor deletion.';

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_vendor_id ON vendor_audit_logs (vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_action ON vendor_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_changed_by ON vendor_audit_logs (changed_by);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_created_at ON vendor_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_logs_vendor_created_at ON vendor_audit_logs (vendor_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE: customer_audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE customer_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'deactivate', 'restore')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE customer_audit_logs IS 'Append-only audit trail for customer management actions. customer_id is nullable so rows survive customer deletion.';

CREATE INDEX IF NOT EXISTS idx_customer_audit_logs_customer_id ON customer_audit_logs (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_audit_logs_customer_created_at ON customer_audit_logs (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_audit_logs_changed_by ON customer_audit_logs (changed_by);

-- -----------------------------------------------------------------------------
-- TABLE: branch_audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE branch_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'deactivate', 'restore')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE branch_audit_logs IS 'Append-only audit trail for branch management actions. branch_id is nullable so rows survive branch deletion.';

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_branch_id ON branch_audit_logs (branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_action ON branch_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_changed_by ON branch_audit_logs (changed_by);

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_created_at ON branch_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_branch_created_at ON branch_audit_logs (branch_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE: user_audit_logs
-- user_id is NOT a FK — rows intentionally survive user deletion.
-- -----------------------------------------------------------------------------
CREATE TABLE user_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'deactivate', 'reactivate', 'reset-password', 'lock', 'unlock')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_audit_logs IS 'Append-only audit trail for user management actions. user_id is not a FK so audit rows survive user deletion.';

COMMENT ON COLUMN user_audit_logs.snapshot IS 'User row state at the time of the action. For update: the before-state. For create: the inserted state.';

COMMENT ON COLUMN user_audit_logs.changed_fields IS 'For update actions: JSON object mapping field names to {from, to} pairs. NULL for all other action types.';

CREATE INDEX IF NOT EXISTS idx_user_audit_logs_user_id ON user_audit_logs (user_id, changed_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE: employee_expense_audit_logs
-- expense_id is NOT a FK — rows intentionally survive expense deletion.
-- -----------------------------------------------------------------------------
CREATE TABLE employee_expense_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE employee_expense_audit_logs IS 'Append-only audit trail for employee expense create/update/delete actions. expense_id is not a FK so rows survive expense deletion.';

COMMENT ON COLUMN employee_expense_audit_logs.snapshot IS 'Full row state at the time of the action. For update/delete: the before-state. For create: the inserted state.';

COMMENT ON COLUMN employee_expense_audit_logs.changed_fields IS 'For update actions: a JSON object mapping field names to {from, to} pairs. NULL for create/delete.';

CREATE INDEX IF NOT EXISTS idx_employee_expense_audit_logs_expense_id ON employee_expense_audit_logs (expense_id, changed_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE: business_expense_audit_logs
-- expense_id is NOT a FK — rows intentionally survive expense deletion.
-- -----------------------------------------------------------------------------
CREATE TABLE business_expense_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE business_expense_audit_logs IS 'Append-only audit trail for business expense create/update/delete actions. expense_id is not a FK so rows survive expense deletion.';

COMMENT ON COLUMN business_expense_audit_logs.snapshot IS 'Full row state at the time of the action. For update/delete: the before-state. For create: the inserted state.';

COMMENT ON COLUMN business_expense_audit_logs.changed_fields IS 'For update actions: a JSON object mapping field names to {from, to} pairs. NULL for create/delete.';

CREATE INDEX IF NOT EXISTS idx_business_expense_audit_logs_expense_id ON business_expense_audit_logs (expense_id, changed_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE: inventory_audit_logs
-- inventory_id is NOT a FK — rows intentionally survive item deletion.
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'archive', 'restore', 'activate', 'deactivate')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_audit_logs IS 'Append-only audit trail for inventory management actions. inventory_id is not a FK so audit rows survive item deletion.';

COMMENT ON COLUMN inventory_audit_logs.snapshot IS 'Inventory row state at the time of the action. For update: the before-state. For create: the inserted state.';

COMMENT ON COLUMN inventory_audit_logs.changed_fields IS 'For update actions: JSON object mapping field names to {from, to} pairs. NULL for all other action types.';

CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_inventory_id ON inventory_audit_logs (inventory_id, changed_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE: inventory_pricing_audit_logs
-- All FK columns are nullable so audit rows survive deletion of referenced rows.
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_pricing_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_pricing_id uuid REFERENCES inventory_pricing (id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches (id) ON DELETE SET NULL,
  inventory_id uuid REFERENCES inventory (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'close')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_pricing_audit_logs IS 'Append-only audit trail for inventory pricing create, update, and close actions.';

COMMENT ON COLUMN inventory_pricing_audit_logs.snapshot IS 'Inventory pricing row state at the time of the action. For update/close: the before-state. For create: the inserted state.';

COMMENT ON COLUMN inventory_pricing_audit_logs.changed_fields IS 'For update and close actions: JSON object mapping field names to {from, to} pairs. NULL for create actions.';

CREATE INDEX IF NOT EXISTS idx_inv_pricing_audit_pricing_id ON inventory_pricing_audit_logs (inventory_pricing_id);

CREATE INDEX IF NOT EXISTS idx_inv_pricing_audit_branch_id ON inventory_pricing_audit_logs (branch_id);

CREATE INDEX IF NOT EXISTS idx_inv_pricing_audit_inventory_id ON inventory_pricing_audit_logs (inventory_id);

CREATE INDEX IF NOT EXISTS idx_inv_pricing_audit_changed_by ON inventory_pricing_audit_logs (changed_by);

CREATE INDEX IF NOT EXISTS idx_inv_pricing_audit_created_at ON inventory_pricing_audit_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_inv_pricing_audit_pricing_id_created_at ON inventory_pricing_audit_logs (inventory_pricing_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE: expense_category_audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE expense_category_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_category_id uuid REFERENCES expense_categories (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'deactivate', 'restore')),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE expense_category_audit_logs IS 'Append-only audit trail for expense category management actions.';

COMMENT ON COLUMN expense_category_audit_logs.snapshot IS 'Expense category row state at the time of the action. For update/deactivate/restore: the before-state. For create: the inserted state.';

COMMENT ON COLUMN expense_category_audit_logs.changed_fields IS 'JSON object mapping changed field names to {from, to} pairs. NULL for create actions.';

CREATE INDEX IF NOT EXISTS idx_expense_category_audit_logs_expense_category_id ON expense_category_audit_logs (expense_category_id);

CREATE INDEX IF NOT EXISTS idx_expense_category_audit_logs_action ON expense_category_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_expense_category_audit_logs_changed_by ON expense_category_audit_logs (changed_by);

CREATE INDEX IF NOT EXISTS idx_expense_category_audit_logs_created_at ON expense_category_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expense_category_audit_logs_category_created_at ON expense_category_audit_logs (expense_category_id, created_at DESC);

-- migrate:down

DROP INDEX IF EXISTS idx_expense_category_audit_logs_category_created_at;

DROP INDEX IF EXISTS idx_expense_category_audit_logs_created_at;

DROP INDEX IF EXISTS idx_expense_category_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_expense_category_audit_logs_action;

DROP INDEX IF EXISTS idx_expense_category_audit_logs_expense_category_id;

DROP INDEX IF EXISTS idx_inv_pricing_audit_pricing_id_created_at;

DROP INDEX IF EXISTS idx_inv_pricing_audit_created_at;

DROP INDEX IF EXISTS idx_inv_pricing_audit_changed_by;

DROP INDEX IF EXISTS idx_inv_pricing_audit_inventory_id;

DROP INDEX IF EXISTS idx_inv_pricing_audit_branch_id;

DROP INDEX IF EXISTS idx_inv_pricing_audit_pricing_id;

DROP INDEX IF EXISTS idx_inventory_audit_logs_inventory_id;

DROP INDEX IF EXISTS idx_business_expense_audit_logs_expense_id;

DROP INDEX IF EXISTS idx_employee_expense_audit_logs_expense_id;

DROP INDEX IF EXISTS idx_user_audit_logs_user_id;

DROP INDEX IF EXISTS idx_branch_audit_logs_branch_created_at;

DROP INDEX IF EXISTS idx_branch_audit_logs_created_at;

DROP INDEX IF EXISTS idx_branch_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_branch_audit_logs_action;

DROP INDEX IF EXISTS idx_branch_audit_logs_branch_id;

DROP INDEX IF EXISTS idx_customer_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_customer_audit_logs_customer_created_at;

DROP INDEX IF EXISTS idx_customer_audit_logs_customer_id;

DROP INDEX IF EXISTS idx_vendor_audit_logs_vendor_created_at;

DROP INDEX IF EXISTS idx_vendor_audit_logs_created_at;

DROP INDEX IF EXISTS idx_vendor_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_vendor_audit_logs_action;

DROP INDEX IF EXISTS idx_vendor_audit_logs_vendor_id;

DROP TABLE IF EXISTS expense_category_audit_logs;

DROP TABLE IF EXISTS inventory_pricing_audit_logs;

DROP TABLE IF EXISTS inventory_audit_logs;

DROP TABLE IF EXISTS business_expense_audit_logs;

DROP TABLE IF EXISTS employee_expense_audit_logs;

DROP TABLE IF EXISTS user_audit_logs;

DROP TABLE IF EXISTS branch_audit_logs;

DROP TABLE IF EXISTS customer_audit_logs;

DROP TABLE IF EXISTS vendor_audit_logs;
