-- migrate:up

-- inventory_audit_logs.action had a CHECK constraint that did not include
-- 'adjust_stock', causing the Adjust Stock flow to fail with a constraint
-- violation. Extend the constraint to allow 'adjust_stock'.

ALTER TABLE inventory_audit_logs
  DROP CONSTRAINT inventory_audit_logs_action_check;

ALTER TABLE inventory_audit_logs
  ADD CONSTRAINT inventory_audit_logs_action_check CHECK (
    action IN (
      'create',
      'update',
      'archive',
      'restore',
      'activate',
      'deactivate',
      'adjust_stock'
    )
  );

-- migrate:down

ALTER TABLE inventory_audit_logs
  DROP CONSTRAINT inventory_audit_logs_action_check;

ALTER TABLE inventory_audit_logs
  ADD CONSTRAINT inventory_audit_logs_action_check CHECK (
    action IN ('create', 'update', 'archive', 'restore', 'activate', 'deactivate')
  );
