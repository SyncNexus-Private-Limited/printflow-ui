-- migrate:up
ALTER TABLE order_audit_logs
DROP CONSTRAINT IF EXISTS order_audit_logs_action_check;

UPDATE order_audit_logs
SET
  action = CASE action
    WHEN 'update' THEN 'order_updated'
    WHEN 'status_change' THEN 'status_changed'
    WHEN 'cancel' THEN 'cancelled'
    WHEN 'payment_added' THEN 'customer_payment_added'
    ELSE action
  END
WHERE
  action IN (
    'update',
    'status_change',
    'cancel',
    'payment_added'
  );

ALTER TABLE order_audit_logs
ADD CONSTRAINT order_audit_logs_action_check CHECK (
  action IN (
    'create',
    'order_updated',
    'items_updated',
    'discount_updated',
    'status_changed',
    'cancelled',
    'customer_payment_added',
    'vendor_assigned',
    'vendor_updated',
    'vendor_payment_recorded',
    'restore'
  )
);

-- migrate:down
ALTER TABLE order_audit_logs
DROP CONSTRAINT IF EXISTS order_audit_logs_action_check;

UPDATE order_audit_logs
SET
  action = CASE action
    WHEN 'order_updated' THEN 'update'
    WHEN 'discount_updated' THEN 'update'
    WHEN 'status_changed' THEN 'status_change'
    WHEN 'cancelled' THEN 'cancel'
    WHEN 'customer_payment_added' THEN 'payment_added'
    ELSE action
  END;

ALTER TABLE order_audit_logs
ADD CONSTRAINT order_audit_logs_action_check CHECK (
  action IN (
    'create',
    'update',
    'status_change',
    'cancel',
    'payment_added',
    'vendor_assigned',
    'vendor_updated',
    'vendor_payment_recorded',
    'items_updated',
    'restore'
  )
);
