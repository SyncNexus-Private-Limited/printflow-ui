-- migrate:up

-- Append-only audit trail for employee expense create / update / delete actions.
-- expense_id is NOT a foreign key so audit rows survive expense deletion.
CREATE TABLE employee_expense_audit_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id     uuid        NOT NULL,
  action         text        NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  snapshot       jsonb       NOT NULL,
  changed_fields jsonb,
  changed_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  changed_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE employee_expense_audit_logs IS
  'Append-only audit trail for employee expense create/update/delete actions. '
  'expense_id is not a FK so rows survive expense deletion.';

COMMENT ON COLUMN employee_expense_audit_logs.snapshot IS
  'Full row state at the time of the action. '
  'For update/delete: the before-state. For create: the inserted state.';

COMMENT ON COLUMN employee_expense_audit_logs.changed_fields IS
  'For update actions: a JSON object mapping field names to {from, to} pairs. NULL for create/delete.';

CREATE INDEX idx_employee_expense_audit_logs_expense_id
  ON employee_expense_audit_logs (expense_id, changed_at DESC);

-- migrate:down

DROP INDEX IF EXISTS idx_employee_expense_audit_logs_expense_id;
DROP TABLE IF EXISTS employee_expense_audit_logs;
