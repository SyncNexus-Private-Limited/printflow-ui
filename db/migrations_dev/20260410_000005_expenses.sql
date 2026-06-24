-- migrate:up

-- -----------------------------------------------------------------------------
-- TABLE: expense_categories (FINAL: created_by/updated_by from 20260430_132802)
-- No seed data — admin creates categories via API after first login.
-- -----------------------------------------------------------------------------
CREATE TABLE expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  scope text NOT NULL CHECK (scope IN ('branch', 'employee', 'both')),
  is_active boolean NOT NULL DEFAULT TRUE,
  is_system boolean NOT NULL DEFAULT FALSE,
  sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL
);

CREATE TRIGGER trg_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_categories_code_lower ON expense_categories (lower(code));

CREATE INDEX IF NOT EXISTS idx_expense_categories_scope ON expense_categories (scope);

CREATE INDEX IF NOT EXISTS idx_expense_categories_is_active ON expense_categories (is_active);

CREATE INDEX IF NOT EXISTS idx_expense_categories_is_system ON expense_categories (is_system);

CREATE INDEX IF NOT EXISTS idx_expense_categories_updated_by ON expense_categories (updated_by);

CREATE INDEX IF NOT EXISTS idx_expense_categories_created_at ON expense_categories (created_at);

CREATE INDEX IF NOT EXISTS idx_expense_categories_updated_at ON expense_categories (updated_at);

-- Partial index: active category lookups are the norm
CREATE INDEX IF NOT EXISTS idx_expense_categories_active_scope ON expense_categories (scope, sort_order)
WHERE
  is_active = TRUE;

-- -----------------------------------------------------------------------------
-- TABLE: branch_expenses (FINAL: title column (not name), category_id, expense_date)
-- 'name' was renamed to 'title' in 20260414. Written here with the final column name.
-- 'category' TEXT column from the baseline was dropped in 20260414 — not included.
-- -----------------------------------------------------------------------------
CREATE TABLE branch_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  title text,
  remarks text,
  payment_mode payment_mode NOT NULL DEFAULT 'cash',
  order_vendor_id uuid REFERENCES order_vendors (id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES expense_categories (id) ON DELETE RESTRICT,
  expense_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT branch_expenses_title_not_blank CHECK (title IS NULL OR btrim(title) <> '')
);

CREATE TRIGGER trg_branch_expenses_updated_at
  BEFORE UPDATE ON branch_expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_branch_expenses_branch_id_expense_date ON branch_expenses (branch_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_branch_expenses_category_id ON branch_expenses (category_id);

CREATE INDEX IF NOT EXISTS idx_branch_expenses_order_vendor_id ON branch_expenses (order_vendor_id);

-- -----------------------------------------------------------------------------
-- TABLE: employee_expenses (FINAL: title/branch_id/category_id/expense_date)
-- 'category' TEXT and lack of branch_id from baseline were fixed in 20260414.
-- 'remarks' column is kept (was not dropped).
-- -----------------------------------------------------------------------------
CREATE TABLE employee_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
  payment_mode payment_mode NOT NULL DEFAULT 'cash',
  remarks text,
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  title text NOT NULL,
  category_id uuid NOT NULL REFERENCES expense_categories (id) ON DELETE RESTRICT,
  expense_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT employee_expenses_title_not_blank CHECK (btrim(title) <> '')
);

CREATE TRIGGER trg_employee_expenses_updated_at
  BEFORE UPDATE ON employee_expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_employee_expenses_branch_id_expense_date ON employee_expenses (branch_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_employee_expenses_user_id_expense_date ON employee_expenses (user_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_employee_expenses_category_id ON employee_expenses (category_id);

-- -----------------------------------------------------------------------------
-- TABLE: expense_attachments
-- -----------------------------------------------------------------------------
CREATE TABLE expense_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_expense_id uuid REFERENCES branch_expenses (id) ON DELETE CASCADE,
  employee_expense_id uuid REFERENCES employee_expenses (id) ON DELETE CASCADE,
  storage_key text NOT NULL CHECK (btrim(storage_key) <> ''),
  file_name text NOT NULL CHECK (btrim(file_name) <> ''),
  mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_attachments_exactly_one_owner CHECK (num_nonnulls(branch_expense_id, employee_expense_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_expense_attachments_branch_expense_id ON expense_attachments (branch_expense_id);

CREATE INDEX IF NOT EXISTS idx_expense_attachments_employee_expense_id ON expense_attachments (employee_expense_id);

-- migrate:down

DROP INDEX IF EXISTS idx_expense_attachments_employee_expense_id;

DROP INDEX IF EXISTS idx_expense_attachments_branch_expense_id;

DROP TRIGGER IF EXISTS trg_employee_expenses_updated_at ON employee_expenses;

DROP INDEX IF EXISTS idx_employee_expenses_category_id;

DROP INDEX IF EXISTS idx_employee_expenses_user_id_expense_date;

DROP INDEX IF EXISTS idx_employee_expenses_branch_id_expense_date;

DROP TRIGGER IF EXISTS trg_branch_expenses_updated_at ON branch_expenses;

DROP INDEX IF EXISTS idx_branch_expenses_order_vendor_id;

DROP INDEX IF EXISTS idx_branch_expenses_category_id;

DROP INDEX IF EXISTS idx_branch_expenses_branch_id_expense_date;

DROP TRIGGER IF EXISTS trg_expense_categories_updated_at ON expense_categories;

DROP INDEX IF EXISTS idx_expense_categories_active_scope;

DROP INDEX IF EXISTS idx_expense_categories_updated_at;

DROP INDEX IF EXISTS idx_expense_categories_created_at;

DROP INDEX IF EXISTS idx_expense_categories_updated_by;

DROP INDEX IF EXISTS idx_expense_categories_is_system;

DROP INDEX IF EXISTS idx_expense_categories_is_active;

DROP INDEX IF EXISTS idx_expense_categories_scope;

DROP INDEX IF EXISTS uq_expense_categories_code_lower;

DROP TABLE IF EXISTS expense_attachments;

DROP TABLE IF EXISTS employee_expenses;

DROP TABLE IF EXISTS branch_expenses;

DROP TABLE IF EXISTS expense_categories;
