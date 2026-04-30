-- migrate:up

ALTER TABLE expense_categories
  ADD COLUMN created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_expense_categories_scope ON expense_categories(scope);
CREATE INDEX idx_expense_categories_is_active ON expense_categories(is_active);
CREATE INDEX idx_expense_categories_is_system ON expense_categories(is_system);
CREATE INDEX idx_expense_categories_updated_by ON expense_categories(updated_by);
CREATE INDEX idx_expense_categories_created_at ON expense_categories(created_at);
CREATE INDEX idx_expense_categories_updated_at ON expense_categories(updated_at);

-- migrate:down

DROP INDEX IF EXISTS idx_expense_categories_updated_at;
DROP INDEX IF EXISTS idx_expense_categories_created_at;
DROP INDEX IF EXISTS idx_expense_categories_updated_by;
DROP INDEX IF EXISTS idx_expense_categories_is_system;
DROP INDEX IF EXISTS idx_expense_categories_is_active;
DROP INDEX IF EXISTS idx_expense_categories_scope;

ALTER TABLE expense_categories
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS created_by;
