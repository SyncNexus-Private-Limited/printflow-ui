-- migrate:up

-- Code format: 4–10 characters, uppercase letters / digits / hyphens only.
-- The expense_categories table is empty when this migration runs, so the
-- constraint is applied directly (no NOT VALID needed).
ALTER TABLE expense_categories
  ADD CONSTRAINT expense_categories_code_format
    CHECK (code ~ '^[A-Z0-9-]{4,10}$');

-- Description length: max 250 characters (application validates the same limit).
ALTER TABLE expense_categories
  ADD CONSTRAINT expense_categories_description_length
    CHECK (description IS NULL OR char_length(description) <= 250);

-- Name length: 2–120 characters (application validates the same limit).
ALTER TABLE expense_categories
  ADD CONSTRAINT expense_categories_name_length
    CHECK (char_length(btrim(name)) >= 2 AND char_length(name) <= 120);

-- The case-insensitive unique index on lower(code) already exists:
--   uq_expense_categories_code_lower  (lower(code))
-- No new uniqueness index is required.

-- migrate:down

ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS expense_categories_code_format;
ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS expense_categories_description_length;
ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS expense_categories_name_length;
