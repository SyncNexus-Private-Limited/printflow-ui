-- migrate:up

-- Append-only audit trail for expense category create/update/deactivate/restore actions.
CREATE TABLE expense_category_audit_logs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_category_id uuid        REFERENCES expense_categories (id) ON DELETE SET NULL,
  action              text        NOT NULL CHECK (
    action IN ('create', 'update', 'deactivate', 'restore')
  ),
  snapshot            jsonb       NOT NULL,
  changed_fields      jsonb,
  changed_by          uuid        REFERENCES users (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE expense_category_audit_logs IS
  'Append-only audit trail for expense category management actions.';

COMMENT ON COLUMN expense_category_audit_logs.snapshot IS
  'Expense category row state at the time of the action. For update/deactivate/restore: the before-state. For create: the inserted state.';

COMMENT ON COLUMN expense_category_audit_logs.changed_fields IS
  'JSON object mapping changed field names to {from, to} pairs. NULL for create actions.';

CREATE INDEX idx_expense_category_audit_logs_expense_category_id
  ON expense_category_audit_logs (expense_category_id);

CREATE INDEX idx_expense_category_audit_logs_action
  ON expense_category_audit_logs (action);

CREATE INDEX idx_expense_category_audit_logs_changed_by
  ON expense_category_audit_logs (changed_by);

CREATE INDEX idx_expense_category_audit_logs_created_at
  ON expense_category_audit_logs (created_at DESC);

CREATE INDEX idx_expense_category_audit_logs_category_created_at
  ON expense_category_audit_logs (expense_category_id, created_at DESC);

-- migrate:down

DROP INDEX IF EXISTS idx_expense_category_audit_logs_category_created_at;
DROP INDEX IF EXISTS idx_expense_category_audit_logs_created_at;
DROP INDEX IF EXISTS idx_expense_category_audit_logs_changed_by;
DROP INDEX IF EXISTS idx_expense_category_audit_logs_action;
DROP INDEX IF EXISTS idx_expense_category_audit_logs_expense_category_id;

DROP TABLE IF EXISTS expense_category_audit_logs;
