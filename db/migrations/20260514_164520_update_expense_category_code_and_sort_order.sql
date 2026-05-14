-- migrate:up

-- Widen code max length from 10 to 25 characters.
-- Drop the old format constraint and re-add with the new range.
ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS expense_categories_code_format;

ALTER TABLE expense_categories
  ADD CONSTRAINT expense_categories_code_format
    CHECK (code ~ '^[A-Z0-9-]{4,25}$');

-- Sort order upper bound: must be between 0 (existing constraint) and 10,000.
ALTER TABLE expense_categories
  ADD CONSTRAINT expense_categories_sort_order_max
    CHECK (sort_order <= 10000);

-- migrate:down

ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS expense_categories_sort_order_max;

-- Restore the original 10-character code format constraint.
ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS expense_categories_code_format;

ALTER TABLE expense_categories
  ADD CONSTRAINT expense_categories_code_format
    CHECK (code ~ '^[A-Z0-9-]{4,10}$');
