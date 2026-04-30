-- migrate:up

-- Password lifecycle columns on user_auth.
ALTER TABLE user_auth
  ADD COLUMN password_changed_at timestamptz,
  ADD COLUMN must_reset_password  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_auth.password_changed_at IS
  'Timestamp of the last password change (admin reset or self-service). '
  'NULL means the password has not been changed since account creation.';

COMMENT ON COLUMN user_auth.must_reset_password IS
  'When true the user must choose a new password on their next login.';

-- Append-only audit trail for user management actions.
-- user_id is NOT a foreign key so audit rows survive user deletion.
CREATE TABLE user_audit_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL,
  action         text        NOT NULL
                             CHECK (action IN (
                               'create', 'update',
                               'deactivate', 'reactivate',
                               'reset-password', 'lock', 'unlock'
                             )),
  snapshot       jsonb       NOT NULL,
  changed_fields jsonb,
  changed_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  changed_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_audit_logs IS
  'Append-only audit trail for user management actions. '
  'user_id is not a FK so audit rows survive user deletion.';

COMMENT ON COLUMN user_audit_logs.snapshot IS
  'User row state at the time of the action. '
  'For update: the before-state. For create: the inserted state.';

COMMENT ON COLUMN user_audit_logs.changed_fields IS
  'For update actions: JSON object mapping field names to {from, to} pairs. '
  'NULL for all other action types.';

CREATE INDEX idx_user_audit_logs_user_id
  ON user_audit_logs (user_id, changed_at DESC);

-- migrate:down

DROP INDEX IF EXISTS idx_user_audit_logs_user_id;
DROP TABLE IF EXISTS user_audit_logs;

ALTER TABLE user_auth
  DROP COLUMN IF EXISTS must_reset_password,
  DROP COLUMN IF EXISTS password_changed_at;
