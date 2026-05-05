-- migrate:up
CREATE TABLE expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  scope text NOT NULL CHECK (scope IN ('branch', 'employee', 'both')),
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_expense_categories_code_lower ON expense_categories (lower(code));

CREATE TRIGGER trg_expense_categories_updated_at BEFORE
UPDATE ON expense_categories FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

INSERT INTO
  expense_categories (
    id,
    code,
    name,
    description,
    scope,
    is_active,
    is_system,
    sort_order
  )
VALUES
  (
    'f1111111-1111-4111-8111-111111111111',
    'vendor_payment',
    'Vendor Payment',
    'Payments made to vendors for branch operations.',
    'branch',
    true,
    true,
    10
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    'electricity',
    'Electricity',
    'Branch electricity and utility payments.',
    'branch',
    true,
    true,
    20
  ),
  (
    'f3333333-3333-4333-8333-333333333333',
    'maintenance',
    'Maintenance',
    'Maintenance and repair costs for branch equipment and facilities.',
    'branch',
    true,
    true,
    30
  ),
  (
    'f4444444-4444-4444-8444-444444444444',
    'rent',
    'Rent',
    'Branch rent and lease payments.',
    'branch',
    true,
    true,
    40
  ),
  (
    'f5555555-5555-4555-8555-555555555555',
    'internet',
    'Internet',
    'Internet and connectivity expenses.',
    'branch',
    true,
    true,
    50
  ),
  (
    'f6666666-6666-4666-8666-666666666666',
    'stationery',
    'Stationery',
    'Office and printing stationery expenses.',
    'branch',
    true,
    true,
    60
  ),
  (
    'f7777777-7777-4777-8777-777777777777',
    'logistics',
    'Logistics',
    'Shared shipping, packing, courier, and transport support expenses.',
    'both',
    true,
    true,
    70
  ),
  (
    'f8888888-8888-4888-8888-888888888888',
    'travel',
    'Travel',
    'Employee travel and local transit expenses.',
    'employee',
    true,
    true,
    80
  ),
  (
    'f9999999-9999-4999-8999-999999999999',
    'food',
    'Food',
    'Employee meals and refreshments.',
    'employee',
    true,
    true,
    90
  ),
  (
    'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'fuel',
    'Fuel',
    'Employee fuel and vehicle running costs.',
    'employee',
    true,
    true,
    100
  ),
  (
    'fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'misc',
    'Miscellaneous',
    'Other uncategorized business or employee expenses.',
    'both',
    true,
    true,
    110
  )
ON CONFLICT DO NOTHING;

WITH
  legacy_categories AS (
    SELECT
      normalized_code AS code,
      initcap(replace(normalized_code, '_', ' ')) AS name,
      CASE
        WHEN bool_or(source = 'branch')
        AND bool_or(source = 'employee') THEN 'both'
        WHEN bool_or(source = 'branch') THEN 'branch'
        ELSE 'employee'
      END AS scope
    FROM
      (
        SELECT
          regexp_replace(
            regexp_replace(lower(btrim(category)), '[^a-z0-9]+', '_', 'g'),
            '^_+|_+$',
            '',
            'g'
          ) AS normalized_code,
          'branch'::text AS source
        FROM
          branch_expenses
        WHERE
          btrim(category) <> ''
        UNION ALL
        SELECT
          regexp_replace(
            regexp_replace(lower(btrim(category)), '[^a-z0-9]+', '_', 'g'),
            '^_+|_+$',
            '',
            'g'
          ) AS normalized_code,
          'employee'::text AS source
        FROM
          employee_expenses
        WHERE
          btrim(category) <> ''
      ) AS source_categories
    WHERE
      normalized_code <> ''
    GROUP BY
      normalized_code
  )
INSERT INTO
  expense_categories (
    id,
    code,
    name,
    description,
    scope,
    is_active,
    is_system,
    sort_order
  )
SELECT
  gen_random_uuid(),
  legacy_categories.code,
  legacy_categories.name,
  NULL,
  legacy_categories.scope,
  true,
  false,
  200
FROM
  legacy_categories
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      expense_categories expense_categories_existing
    WHERE
      lower(expense_categories_existing.code) = lower(legacy_categories.code)
  );

ALTER TABLE branch_expenses
RENAME COLUMN name TO title;

ALTER TABLE branch_expenses
ADD COLUMN category_id uuid REFERENCES expense_categories (id) ON DELETE RESTRICT,
ADD COLUMN expense_date date,
ADD COLUMN created_by uuid REFERENCES users (id) ON DELETE SET NULL,
ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN updated_by uuid REFERENCES users (id) ON DELETE SET NULL;

UPDATE branch_expenses AS branch_expense
SET
  expense_date = branch_expense.created_at::date,
  category_id = expense_category.id
FROM
  expense_categories AS expense_category
WHERE
  lower(expense_category.code) = regexp_replace(
    regexp_replace(
      lower(btrim(branch_expense.category)),
      '[^a-z0-9]+',
      '_',
      'g'
    ),
    '^_+|_+$',
    '',
    'g'
  );

ALTER TABLE branch_expenses
ADD CONSTRAINT branch_expenses_title_not_blank CHECK (
  title IS NULL
  OR btrim(title) <> ''
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM branch_expenses
    WHERE category_id IS NULL
      OR expense_date IS NULL
  ) THEN
    RAISE EXCEPTION 'Unable to backfill branch_expenses.category_id or branch_expenses.expense_date.';
  END IF;
END;
$$;

ALTER TABLE branch_expenses
ALTER COLUMN category_id
SET NOT NULL,
ALTER COLUMN expense_date
SET NOT NULL,
DROP COLUMN category;

CREATE TRIGGER trg_branch_expenses_updated_at BEFORE
UPDATE ON branch_expenses FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE employee_expenses
ADD COLUMN branch_id uuid REFERENCES branches (id) ON DELETE RESTRICT,
ADD COLUMN title text,
ADD COLUMN category_id uuid REFERENCES expense_categories (id) ON DELETE RESTRICT,
ADD COLUMN expense_date date,
ADD COLUMN created_by uuid REFERENCES users (id) ON DELETE SET NULL,
ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN updated_by uuid REFERENCES users (id) ON DELETE SET NULL;

UPDATE employee_expenses AS employee_expense
SET
  branch_id = user_record.branch_id,
  title = COALESCE(
    NULLIF(btrim(employee_expense.remarks), ''),
    'Employee Expense'
  ),
  expense_date = employee_expense.created_at::date,
  category_id = expense_category.id
FROM
  users AS user_record,
  expense_categories AS expense_category
WHERE
  user_record.id = employee_expense.user_id
  AND lower(expense_category.code) = regexp_replace(
    regexp_replace(
      lower(btrim(employee_expense.category)),
      '[^a-z0-9]+',
      '_',
      'g'
    ),
    '^_+|_+$',
    '',
    'g'
  );

ALTER TABLE employee_expenses
ADD CONSTRAINT employee_expenses_title_not_blank CHECK (btrim(title) <> '');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM employee_expenses
    WHERE branch_id IS NULL
      OR title IS NULL
      OR btrim(title) = ''
      OR category_id IS NULL
      OR expense_date IS NULL
  ) THEN
    RAISE EXCEPTION 'Unable to backfill employee_expenses.branch_id, title, category_id, or expense_date.';
  END IF;
END;
$$;

ALTER TABLE employee_expenses
ALTER COLUMN branch_id
SET NOT NULL,
ALTER COLUMN title
SET NOT NULL,
ALTER COLUMN category_id
SET NOT NULL,
ALTER COLUMN expense_date
SET NOT NULL,
DROP COLUMN category;

CREATE TRIGGER trg_employee_expenses_updated_at BEFORE
UPDATE ON employee_expenses FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TABLE expense_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_expense_id uuid REFERENCES branch_expenses (id) ON DELETE CASCADE,
  employee_expense_id uuid REFERENCES employee_expenses (id) ON DELETE CASCADE,
  storage_key text NOT NULL CHECK (btrim(storage_key) <> ''),
  file_name text NOT NULL CHECK (btrim(file_name) <> ''),
  mime_type text,
  file_size_bytes bigint CHECK (
    file_size_bytes IS NULL
    OR file_size_bytes >= 0
  ),
  uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_attachments_exactly_one_owner CHECK (
    num_nonnulls (branch_expense_id, employee_expense_id) = 1
  )
);

CREATE INDEX idx_branch_expenses_branch_id_expense_date ON branch_expenses (branch_id, expense_date DESC);

CREATE INDEX idx_branch_expenses_category_id ON branch_expenses (category_id);

CREATE INDEX idx_branch_expenses_order_vendor_id ON branch_expenses (order_vendor_id);

CREATE INDEX idx_employee_expenses_branch_id_expense_date ON employee_expenses (branch_id, expense_date DESC);

CREATE INDEX idx_employee_expenses_user_id_expense_date ON employee_expenses (user_id, expense_date DESC);

CREATE INDEX idx_employee_expenses_category_id ON employee_expenses (category_id);

CREATE INDEX idx_expense_attachments_branch_expense_id ON expense_attachments (branch_expense_id);

CREATE INDEX idx_expense_attachments_employee_expense_id ON expense_attachments (employee_expense_id);

-- migrate:down
DROP INDEX IF EXISTS idx_expense_attachments_employee_expense_id;

DROP INDEX IF EXISTS idx_expense_attachments_branch_expense_id;

DROP INDEX IF EXISTS idx_employee_expenses_category_id;

DROP INDEX IF EXISTS idx_employee_expenses_user_id_expense_date;

DROP INDEX IF EXISTS idx_employee_expenses_branch_id_expense_date;

DROP INDEX IF EXISTS idx_branch_expenses_order_vendor_id;

DROP INDEX IF EXISTS idx_branch_expenses_category_id;

DROP INDEX IF EXISTS idx_branch_expenses_branch_id_expense_date;

DROP TABLE IF EXISTS expense_attachments;

DROP TRIGGER IF EXISTS trg_employee_expenses_updated_at ON employee_expenses;

DROP TRIGGER IF EXISTS trg_branch_expenses_updated_at ON branch_expenses;

DROP TRIGGER IF EXISTS trg_expense_categories_updated_at ON expense_categories;

ALTER TABLE branch_expenses
ADD COLUMN category text CHECK (btrim(category) <> '');

UPDATE branch_expenses AS branch_expense
SET
  category = expense_category.code
FROM
  expense_categories AS expense_category
WHERE
  expense_category.id = branch_expense.category_id;

ALTER TABLE branch_expenses
DROP CONSTRAINT IF EXISTS branch_expenses_title_not_blank;

ALTER TABLE branch_expenses
ALTER COLUMN category
SET NOT NULL,
DROP COLUMN category_id,
DROP COLUMN expense_date,
DROP COLUMN created_by,
DROP COLUMN updated_at,
DROP COLUMN updated_by;

ALTER TABLE branch_expenses
RENAME COLUMN title TO name;

ALTER TABLE employee_expenses
ADD COLUMN category text CHECK (btrim(category) <> '');

UPDATE employee_expenses AS employee_expense
SET
  category = expense_category.code
FROM
  expense_categories AS expense_category
WHERE
  expense_category.id = employee_expense.category_id;

ALTER TABLE employee_expenses
DROP CONSTRAINT IF EXISTS employee_expenses_title_not_blank;

ALTER TABLE employee_expenses
ALTER COLUMN category
SET NOT NULL,
DROP COLUMN branch_id,
DROP COLUMN title,
DROP COLUMN category_id,
DROP COLUMN expense_date,
DROP COLUMN created_by,
DROP COLUMN updated_at,
DROP COLUMN updated_by;

DROP TABLE IF EXISTS expense_categories;
