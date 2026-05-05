-- migrate:up
ALTER TABLE order_vendors
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE order_vendors
DROP CONSTRAINT IF EXISTS order_vendors_status_check;

UPDATE order_vendors
SET
  status = CASE status
    WHEN 'pending' THEN 'assigned'
    WHEN 'partial' THEN 'in_progress'
    WHEN 'paid' THEN 'received'
    ELSE status
  END;

ALTER TABLE order_vendors
ALTER COLUMN status
SET DEFAULT 'assigned';

ALTER TABLE order_vendors
ADD CONSTRAINT order_vendors_status_check CHECK (
  status IN (
    'assigned',
    'in_progress',
    'received',
    'cancelled'
  )
);

ALTER TABLE order_audit_logs
DROP CONSTRAINT IF EXISTS order_audit_logs_action_check;

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

-- migrate:down
UPDATE order_audit_logs
SET
  action = 'update'
WHERE
  action IN ('vendor_assigned', 'vendor_payment_recorded');

ALTER TABLE order_audit_logs
DROP CONSTRAINT IF EXISTS order_audit_logs_action_check;

ALTER TABLE order_audit_logs
ADD CONSTRAINT order_audit_logs_action_check CHECK (
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

ALTER TABLE order_vendors
DROP CONSTRAINT IF EXISTS order_vendors_status_check;

UPDATE order_vendors
SET
  status = CASE status
    WHEN 'assigned' THEN 'pending'
    WHEN 'in_progress' THEN 'partial'
    WHEN 'received' THEN 'paid'
    WHEN 'cancelled' THEN 'pending'
    ELSE status
  END;

ALTER TABLE order_vendors
ALTER COLUMN status
SET DEFAULT 'pending';

ALTER TABLE order_vendors
ADD CONSTRAINT order_vendors_status_check CHECK (status IN ('pending', 'partial', 'paid'));

ALTER TABLE order_vendors
DROP COLUMN IF EXISTS created_by;
