-- migrate:up
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_branches_code ON branches (code);

CREATE INDEX IF NOT EXISTS idx_branches_lower_name ON branches (lower(name));

CREATE INDEX IF NOT EXISTS idx_branches_phone ON branches (phone);

CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches (is_active);

CREATE INDEX IF NOT EXISTS idx_branches_created_at ON branches (created_at);

CREATE INDEX IF NOT EXISTS idx_branches_updated_at ON branches (updated_at);

CREATE INDEX IF NOT EXISTS idx_branches_created_by ON branches (created_by);

CREATE INDEX IF NOT EXISTS idx_branches_updated_by ON branches (updated_by);

CREATE TABLE IF NOT EXISTS branch_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN ('create', 'update', 'deactivate', 'restore')
  ),
  snapshot jsonb NOT NULL,
  changed_fields jsonb,
  changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE branch_audit_logs IS 'Append-only audit trail for branch management actions.';

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_branch_id ON branch_audit_logs (branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_action ON branch_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_changed_by ON branch_audit_logs (changed_by);

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_created_at ON branch_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branch_audit_logs_branch_created_at ON branch_audit_logs (branch_id, created_at DESC);

-- migrate:down
DROP INDEX IF EXISTS idx_branch_audit_logs_branch_created_at;

DROP INDEX IF EXISTS idx_branch_audit_logs_created_at;

DROP INDEX IF EXISTS idx_branch_audit_logs_changed_by;

DROP INDEX IF EXISTS idx_branch_audit_logs_action;

DROP INDEX IF EXISTS idx_branch_audit_logs_branch_id;

DROP TABLE IF EXISTS branch_audit_logs;

DROP INDEX IF EXISTS idx_branches_updated_by;

DROP INDEX IF EXISTS idx_branches_created_by;

DROP INDEX IF EXISTS idx_branches_updated_at;

DROP INDEX IF EXISTS idx_branches_created_at;

DROP INDEX IF EXISTS idx_branches_is_active;

DROP INDEX IF EXISTS idx_branches_phone;

DROP INDEX IF EXISTS idx_branches_lower_name;

DROP INDEX IF EXISTS idx_branches_code;

ALTER TABLE branches
DROP COLUMN IF EXISTS updated_by,
DROP COLUMN IF EXISTS created_by;
