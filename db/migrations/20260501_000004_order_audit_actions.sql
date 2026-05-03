-- migrate:up

ALTER TABLE order_audit_logs
  DROP CONSTRAINT IF EXISTS order_audit_logs_action_check;

ALTER TABLE order_audit_logs
  ADD CONSTRAINT order_audit_logs_action_check
    CHECK (
      action IN (
        'create',
        'update',
        'status_change',
        'cancel',
        'payment_added',
        'vendor_updated',
        'items_updated',
        'restore'
      )
    );

-- migrate:down

UPDATE order_audit_logs
SET action = 'update'
WHERE action IN ('status_change', 'payment_added', 'vendor_updated', 'items_updated');

ALTER TABLE order_audit_logs
  DROP CONSTRAINT IF EXISTS order_audit_logs_action_check;

ALTER TABLE order_audit_logs
  ADD CONSTRAINT order_audit_logs_action_check
    CHECK (action IN ('create', 'update', 'cancel', 'restore'));
