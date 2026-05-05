-- migrate:up

-- -----------------------------------------------------------------------------
-- TABLE: branches (FINAL: created_by/updated_by FKs added after users exists)
-- -----------------------------------------------------------------------------
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  alternate_phone text,
  email text,
  address text,
  logo text,
  banner text,
  description text,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_branches_code ON branches (code);

CREATE INDEX IF NOT EXISTS idx_branches_lower_name ON branches (lower(name));

CREATE INDEX IF NOT EXISTS idx_branches_phone ON branches (phone);

CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches (is_active);

CREATE INDEX IF NOT EXISTS idx_branches_created_at ON branches (created_at);

CREATE INDEX IF NOT EXISTS idx_branches_updated_at ON branches (updated_at);

CREATE INDEX IF NOT EXISTS idx_branches_created_by ON branches (created_by);

CREATE INDEX IF NOT EXISTS idx_branches_updated_by ON branches (updated_by);

-- -----------------------------------------------------------------------------
-- TABLE: order_sequences (FK to branches — must come before users)
-- -----------------------------------------------------------------------------
CREATE TABLE order_sequences (
  branch_id uuid NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  year int NOT NULL,
  last_number bigint NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (branch_id, year)
);

-- -----------------------------------------------------------------------------
-- TABLE: users (FINAL: self-referential created_by/updated_by)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (btrim(full_name) <> ''),
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  alternate_phone text,
  email text,
  avatar text,
  address text,
  role user_role NOT NULL DEFAULT 'staff',
  branch_id uuid REFERENCES branches (id),
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL
);

-- Now that users exists, wire up the branches audit FK columns
ALTER TABLE branches
  ADD CONSTRAINT fk_branches_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_branches_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users (branch_id);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

-- -----------------------------------------------------------------------------
-- TABLE: user_auth (FINAL: includes password_changed_at/must_reset_password from 20260429)
-- -----------------------------------------------------------------------------
CREATE TABLE user_auth (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  username text NOT NULL CHECK (btrim(username) <> ''),
  password_hash text NOT NULL CHECK (btrim(password_hash) <> ''),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  is_locked boolean NOT NULL DEFAULT FALSE,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  password_changed_at timestamptz,
  must_reset_password boolean NOT NULL DEFAULT FALSE
);

COMMENT ON COLUMN user_auth.password_changed_at IS 'Timestamp of the last password change. NULL means never changed since account creation.';

COMMENT ON COLUMN user_auth.must_reset_password IS 'When true the user must choose a new password on their next login.';

CREATE TRIGGER trg_user_auth_updated_at
  BEFORE UPDATE ON user_auth
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_auth_username_lower ON user_auth (lower(username));

-- -----------------------------------------------------------------------------
-- TABLE: app_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  branch_id uuid REFERENCES branches (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_revoked boolean NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_app_sessions_last_seen_at ON app_sessions (last_seen_at);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions (expires_at);

-- Partial index for the active-session lookup in getCurrentUser()
CREATE INDEX IF NOT EXISTS idx_app_sessions_active ON app_sessions (user_id, last_seen_at)
WHERE
  is_revoked = FALSE;

-- -----------------------------------------------------------------------------
-- TABLE: vendors (FINAL: includes is_active/created_by/updated_by from 20260501)
-- -----------------------------------------------------------------------------
CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code text UNIQUE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  avatar text,
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  alternate_phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT TRUE,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL
);

CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_vendors_vendor_code ON vendors (vendor_code);

CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors (phone);

CREATE INDEX IF NOT EXISTS idx_vendors_lower_name ON vendors (lower(name));

CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors (is_active);

CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON vendors (created_at);

CREATE INDEX IF NOT EXISTS idx_vendors_updated_at ON vendors (updated_at);

CREATE INDEX IF NOT EXISTS idx_vendors_created_by ON vendors (created_by);

CREATE INDEX IF NOT EXISTS idx_vendors_updated_by ON vendors (updated_by);

-- -----------------------------------------------------------------------------
-- TABLE: customers (FINAL: includes is_active/created_by/updated_by from 20260501_100000)
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_numeric_id bigint UNIQUE,
  customer_code text UNIQUE,
  type customer_type NOT NULL DEFAULT 'other',
  name text NOT NULL CHECK (btrim(name) <> ''),
  avatar text,
  studio_name text,
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  alternate_phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT TRUE,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at ();

CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers (is_active);

CREATE INDEX IF NOT EXISTS idx_customers_type ON customers (type);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

CREATE INDEX IF NOT EXISTS idx_customers_name_lower ON customers (lower(name));

CREATE INDEX IF NOT EXISTS idx_customers_studio_name_lower ON customers (lower(studio_name))
WHERE
  studio_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers (created_at);

CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers (updated_at);

-- migrate:down

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;

DROP TRIGGER IF EXISTS trg_user_auth_updated_at ON user_auth;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;

DROP INDEX IF EXISTS idx_customers_updated_at;

DROP INDEX IF EXISTS idx_customers_created_at;

DROP INDEX IF EXISTS idx_customers_studio_name_lower;

DROP INDEX IF EXISTS idx_customers_name_lower;

DROP INDEX IF EXISTS idx_customers_phone;

DROP INDEX IF EXISTS idx_customers_type;

DROP INDEX IF EXISTS idx_customers_is_active;

DROP INDEX IF EXISTS idx_vendors_updated_by;

DROP INDEX IF EXISTS idx_vendors_created_by;

DROP INDEX IF EXISTS idx_vendors_updated_at;

DROP INDEX IF EXISTS idx_vendors_created_at;

DROP INDEX IF EXISTS idx_vendors_is_active;

DROP INDEX IF EXISTS idx_vendors_lower_name;

DROP INDEX IF EXISTS idx_vendors_phone;

DROP INDEX IF EXISTS idx_vendors_vendor_code;

DROP INDEX IF EXISTS idx_app_sessions_active;

DROP INDEX IF EXISTS idx_app_sessions_expires_at;

DROP INDEX IF EXISTS idx_app_sessions_last_seen_at;

DROP INDEX IF EXISTS idx_app_sessions_user_id;

DROP INDEX IF EXISTS uq_user_auth_username_lower;

DROP INDEX IF EXISTS idx_users_created_at;

DROP INDEX IF EXISTS idx_users_is_active;

DROP INDEX IF EXISTS idx_users_role;

DROP INDEX IF EXISTS idx_users_branch_id;

DROP INDEX IF EXISTS idx_branches_updated_by;

DROP INDEX IF EXISTS idx_branches_created_by;

DROP INDEX IF EXISTS idx_branches_updated_at;

DROP INDEX IF EXISTS idx_branches_created_at;

DROP INDEX IF EXISTS idx_branches_is_active;

DROP INDEX IF EXISTS idx_branches_phone;

DROP INDEX IF EXISTS idx_branches_lower_name;

DROP INDEX IF EXISTS idx_branches_code;

DROP TABLE IF EXISTS customers;

DROP TABLE IF EXISTS vendors;

DROP TABLE IF EXISTS app_sessions;

DROP TABLE IF EXISTS user_auth;

DROP TABLE IF EXISTS users;

DROP TABLE IF EXISTS order_sequences;

DROP TABLE IF EXISTS branches;
