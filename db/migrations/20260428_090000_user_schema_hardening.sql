-- migrate:up

-- Enforce case-insensitive username uniqueness.
-- create_user_with_auth already stores usernames lowercase, so a functional
-- index on lower(username) covers both the uniqueness invariant and the
-- lookup path used by authenticate_user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_auth_username_lower ON user_auth (lower(username));

-- Audit columns for users: who created / last modified the record.
ALTER TABLE users
  ADD COLUMN created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Apply the generic updated_at trigger to users (was missing from baseline).
-- DROP first so the statement is idempotent if the trigger was added manually.
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Replace create_user_with_auth to accept the full user profile and populate
-- audit columns. New parameters are optional with sensible defaults so any
-- existing callers continue to work.
CREATE OR REPLACE FUNCTION create_user_with_auth(
  p_admin_id      uuid,
  p_full_name     text,
  p_phone         text,
  p_email         text,
  p_role          user_role,
  p_branch_id     uuid,
  p_username      text,
  p_password      text,
  p_alternate_phone text  DEFAULT NULL,
  p_address         text  DEFAULT NULL,
  p_is_active       boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id   uuid;
  v_caller_role   user_role;
  v_caller_active boolean;
BEGIN
  SELECT role, is_active
  INTO v_caller_role, v_caller_active
  FROM users
  WHERE id = p_admin_id;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  IF NOT v_caller_active THEN
    RAISE EXCEPTION 'Inactive admin cannot create users';
  END IF;

  INSERT INTO users (
    full_name,
    phone,
    alternate_phone,
    email,
    address,
    role,
    branch_id,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    p_full_name,
    p_phone,
    p_alternate_phone,
    p_email,
    p_address,
    p_role,
    p_branch_id,
    p_is_active,
    p_admin_id,
    p_admin_id
  )
  RETURNING id INTO v_user_id;

  INSERT INTO user_auth (user_id, username, password_hash)
  VALUES (
    v_user_id,
    lower(btrim(p_username)),
    crypt(p_password, gen_salt('bf'))
  );

  RETURN v_user_id;
END;
$$;

-- migrate:down

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

ALTER TABLE users
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;

DROP INDEX IF EXISTS uq_user_auth_username_lower;

-- Restore original function signature (no optional params, no audit columns).
CREATE OR REPLACE FUNCTION create_user_with_auth(
  p_admin_id  uuid,
  p_full_name text,
  p_phone     text,
  p_email     text,
  p_role      user_role,
  p_branch_id uuid,
  p_username  text,
  p_password  text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id   uuid;
  v_role      user_role;
  v_is_active boolean;
BEGIN
  SELECT role, is_active
  INTO v_role, v_is_active
  FROM users
  WHERE id = p_admin_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Inactive admin cannot create users';
  END IF;

  INSERT INTO users (full_name, phone, email, role, branch_id)
  VALUES (p_full_name, p_phone, p_email, p_role, p_branch_id)
  RETURNING id INTO v_user_id;

  INSERT INTO user_auth (user_id, username, password_hash)
  VALUES (
    v_user_id,
    lower(btrim(p_username)),
    crypt(p_password, gen_salt('bf'))
  );

  RETURN v_user_id;
END;
$$;
