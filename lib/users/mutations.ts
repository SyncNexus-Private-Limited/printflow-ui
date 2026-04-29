import "server-only";
import type { PoolClient } from "pg";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import { requiresBranch } from "@/lib/users/role-rules";
import type { CreateUserInput, UpdateUserInput } from "@/lib/users/schema";

type MutationFieldErrors = Partial<Record<string, string>>;

export class UserMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "UserMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

// ---------- Audit helpers ----------

type UserAuditSnapshot = {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  role: string;
  branchId: string | null;
  isActive: boolean;
  isLocked: boolean;
  failedAttempts: number;
};

type UserAuditSnapshotRow = {
  id: string;
  full_name: string;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  address: string | null;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  is_locked: boolean;
  failed_attempts: number;
};

async function fetchUserSnapshotForAudit(
  client: PoolClient,
  userId: string,
): Promise<UserAuditSnapshot | null> {
  const { rows } = await client.query<UserAuditSnapshotRow>(
    `SELECT
       u.id::text            AS id,
       u.full_name,
       u.phone,
       u.alternate_phone,
       u.email,
       u.address,
       u.role::text          AS role,
       u.branch_id::text     AS branch_id,
       u.is_active,
       COALESCE(ua.is_locked, false)       AS is_locked,
       COALESCE(ua.failed_attempts, 0)     AS failed_attempts
     FROM users u
     LEFT JOIN user_auth ua ON ua.user_id = u.id
     WHERE u.id = $1::uuid
     FOR UPDATE OF u
     LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    alternatePhone: row.alternate_phone,
    email: row.email,
    address: row.address,
    role: row.role,
    branchId: row.branch_id,
    isActive: row.is_active,
    isLocked: row.is_locked,
    failedAttempts: row.failed_attempts,
  };
}

async function logUserAudit(
  client: PoolClient,
  userId: string,
  action: string,
  snapshot: UserAuditSnapshot,
  changedBy: string,
  changedFields?: Record<string, { from: unknown; to: unknown }> | null,
): Promise<void> {
  await client.query(
    `INSERT INTO user_audit_logs (user_id, action, snapshot, changed_fields, changed_by)
     VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::uuid)`,
    [
      userId,
      action,
      JSON.stringify(snapshot),
      changedFields && Object.keys(changedFields).length > 0
        ? JSON.stringify(changedFields)
        : null,
      changedBy,
    ],
  );
}

// ---------- Branch validation helper ----------

async function assertBranchIsActive(client: PoolClient, branchId: string): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM branches WHERE id = $1::uuid AND is_active = true LIMIT 1`,
    [branchId],
  );
  if (!rows[0]) {
    throw new UserMutationError("The selected branch is not available.", {
      status: 400,
      fieldErrors: { branchId: "Select a valid, active branch." },
    });
  }
}

// ---------- createUser ----------

type CreatedUserRow = {
  id: string;
};

export async function createUser(
  currentUser: AuthenticatedUser,
  input: CreateUserInput,
): Promise<{ id: string; redirectTo: string }> {
  if (!hasPermission(currentUser, "users:create")) {
    throw new UserMutationError("Only administrators can create user accounts.", { status: 403 });
  }

  const db = getPool();
  const branchId = input.branchId || null;

  if (requiresBranch(input.role) && !branchId) {
    throw new UserMutationError("A branch is required for this role.", {
      status: 400,
      fieldErrors: { branchId: "Select a valid, active branch." },
    });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (branchId) {
      await assertBranchIsActive(client, branchId);
    }

    const { rows } = await client.query<CreatedUserRow>(
      `
        SELECT create_user_with_auth(
          $1::uuid,            -- p_admin_id
          $2::text,            -- p_full_name
          $3::text,            -- p_phone
          $4::text,            -- p_email
          $5::text::user_role, -- p_role
          $6::uuid,            -- p_branch_id
          $7::text,            -- p_username
          $8::text,            -- p_password
          $9::text,            -- p_alternate_phone
          $10::text,           -- p_address
          $11::boolean         -- p_is_active
        )::text AS id
      `,
      [
        currentUser.userId,
        input.fullName,
        input.phone,
        input.email ?? null,
        input.role,
        branchId,
        input.username,
        input.password,
        input.alternatePhone ?? null,
        input.address ?? null,
        input.isActive,
      ],
    );

    const createdId = rows[0]?.id;

    if (!createdId) {
      throw new UserMutationError("Unable to create the user account right now.", { status: 500 });
    }

    const createSnapshot: UserAuditSnapshot = {
      id: createdId,
      fullName: input.fullName,
      phone: input.phone,
      alternatePhone: input.alternatePhone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      role: input.role,
      branchId,
      isActive: input.isActive,
      isLocked: false,
      failedAttempts: 0,
    };

    await logUserAudit(client, createdId, "create", createSnapshot, currentUser.userId);

    await client.query("COMMIT");

    const redirectParams = new URLSearchParams({ created: "1", role: input.role });
    if (branchId) redirectParams.set("branchId", branchId);

    return {
      id: createdId,
      redirectTo: `/dashboard/users/new?${redirectParams.toString()}`,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof UserMutationError) throw error;

    const message = error instanceof Error ? error.message : "";

    if (
      message.includes("uq_user_auth_username_lower") ||
      (message.includes("duplicate key value") && message.includes("username"))
    ) {
      throw new UserMutationError("This username is already taken. Please choose another.", {
        status: 409,
        fieldErrors: { username: "This username is already taken." },
      });
    }

    if (message.includes("Only admin can create users")) {
      throw new UserMutationError("Only administrators can create user accounts.", { status: 403 });
    }

    if (message.includes("Inactive admin")) {
      throw new UserMutationError("Your account must be active to create user accounts.", {
        status: 403,
      });
    }

    console.error("User account creation failed", error);
    throw new UserMutationError("Unable to create the user account right now.", { status: 500 });
  } finally {
    client.release();
  }
}

// ---------- updateUser ----------

export async function updateUser(
  currentUser: AuthenticatedUser,
  targetUserId: string,
  input: UpdateUserInput,
): Promise<void> {
  if (!hasPermission(currentUser, "users:edit")) {
    throw new UserMutationError("Only administrators can edit user accounts.", { status: 403 });
  }

  // Self-protection: prevent admins from accidentally locking themselves out.
  if (currentUser.userId === targetUserId) {
    if (!input.isActive) {
      throw new UserMutationError("You cannot deactivate your own account.", { status: 400 });
    }
    if (currentUser.role === "admin" && input.role !== "admin") {
      throw new UserMutationError("You cannot change your own role.", { status: 400 });
    }
  }

  const branchId = input.branchId || null;

  if (requiresBranch(input.role) && !branchId) {
    throw new UserMutationError("A branch is required for this role.", {
      status: 400,
      fieldErrors: { branchId: "Select a valid, active branch." },
    });
  }

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (branchId) {
      await assertBranchIsActive(client, branchId);
    }

    // Fetch current row state before mutation (also locks the row).
    const snapshot = await fetchUserSnapshotForAudit(client, targetUserId);
    if (!snapshot) {
      throw new UserMutationError("User not found.", { status: 404 });
    }

    // Compute changed_fields for the audit log.
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    if (snapshot.fullName !== input.fullName)
      changedFields.fullName = { from: snapshot.fullName, to: input.fullName };
    if (snapshot.phone !== input.phone)
      changedFields.phone = { from: snapshot.phone, to: input.phone };
    if ((snapshot.alternatePhone ?? null) !== (input.alternatePhone ?? null))
      changedFields.alternatePhone = { from: snapshot.alternatePhone, to: input.alternatePhone ?? null };
    if ((snapshot.email ?? null) !== (input.email ?? null))
      changedFields.email = { from: snapshot.email, to: input.email ?? null };
    if ((snapshot.address ?? null) !== (input.address ?? null))
      changedFields.address = { from: snapshot.address, to: input.address ?? null };
    if (snapshot.role !== input.role)
      changedFields.role = { from: snapshot.role, to: input.role };
    if ((snapshot.branchId ?? null) !== (branchId ?? null))
      changedFields.branchId = { from: snapshot.branchId, to: branchId };
    if (snapshot.isActive !== input.isActive)
      changedFields.isActive = { from: snapshot.isActive, to: input.isActive };

    const { rowCount } = await client.query(
      `UPDATE users
       SET
         full_name       = $2,
         phone           = $3,
         alternate_phone = $4,
         email           = $5,
         address         = $6,
         role            = $7::user_role,
         branch_id       = $8::uuid,
         is_active       = $9,
         updated_by      = $10::uuid
       WHERE id = $1::uuid`,
      [
        targetUserId,
        input.fullName,
        input.phone,
        input.alternatePhone ?? null,
        input.email ?? null,
        input.address ?? null,
        input.role,
        branchId,
        input.isActive,
        currentUser.userId,
      ],
    );

    if (!rowCount) {
      throw new UserMutationError("User not found.", { status: 404 });
    }

    // Revoke active sessions if the account was just deactivated.
    if (!input.isActive) {
      await client.query(
        `UPDATE app_sessions SET is_revoked = true WHERE user_id = $1::uuid AND is_revoked = false`,
        [targetUserId],
      );
    }

    await logUserAudit(client, targetUserId, "update", snapshot, currentUser.userId, changedFields);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof UserMutationError) throw error;
    console.error("User update failed", error);
    throw new UserMutationError("Unable to save changes right now.", { status: 500 });
  } finally {
    client.release();
  }
}

// ---------- updateUserStatus ----------

export async function updateUserStatus(
  currentUser: AuthenticatedUser,
  targetUserId: string,
  isActive: boolean,
): Promise<void> {
  if (!hasPermission(currentUser, "users:deactivate")) {
    throw new UserMutationError("Only administrators can change account status.", { status: 403 });
  }

  if (currentUser.userId === targetUserId) {
    throw new UserMutationError("You cannot change your own account status.", { status: 400 });
  }

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchUserSnapshotForAudit(client, targetUserId);
    if (!snapshot) {
      throw new UserMutationError("User not found.", { status: 404 });
    }

    const { rowCount } = await client.query(
      `UPDATE users SET is_active = $2, updated_by = $3::uuid WHERE id = $1::uuid`,
      [targetUserId, isActive, currentUser.userId],
    );

    if (!rowCount) {
      throw new UserMutationError("User not found.", { status: 404 });
    }

    if (!isActive) {
      await client.query(
        `UPDATE app_sessions SET is_revoked = true WHERE user_id = $1::uuid AND is_revoked = false`,
        [targetUserId],
      );
    }

    await logUserAudit(
      client,
      targetUserId,
      isActive ? "reactivate" : "deactivate",
      snapshot,
      currentUser.userId,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof UserMutationError) throw error;
    console.error("User status update failed", error);
    throw new UserMutationError("Unable to update account status right now.", { status: 500 });
  } finally {
    client.release();
  }
}

// ---------- toggleUserLock ----------

export async function toggleUserLock(
  currentUser: AuthenticatedUser,
  targetUserId: string,
  isLocked: boolean,
): Promise<void> {
  if (!hasPermission(currentUser, "users:lock")) {
    throw new UserMutationError("Only administrators can lock or unlock accounts.", { status: 403 });
  }

  if (currentUser.userId === targetUserId) {
    throw new UserMutationError("You cannot lock or unlock your own account.", { status: 400 });
  }

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchUserSnapshotForAudit(client, targetUserId);
    if (!snapshot) {
      throw new UserMutationError("User not found.", { status: 404 });
    }

    const { rowCount } = await client.query(
      `UPDATE user_auth
       SET is_locked = $2${!isLocked ? ", failed_attempts = 0" : ""},
           updated_at = now()
       WHERE user_id = $1::uuid`,
      [targetUserId, isLocked],
    );

    if (!rowCount) {
      throw new UserMutationError("User not found.", { status: 404 });
    }

    if (isLocked) {
      await client.query(
        `UPDATE app_sessions SET is_revoked = true WHERE user_id = $1::uuid AND is_revoked = false`,
        [targetUserId],
      );
    }

    await logUserAudit(
      client,
      targetUserId,
      isLocked ? "lock" : "unlock",
      snapshot,
      currentUser.userId,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof UserMutationError) throw error;
    console.error("User lock toggle failed", error);
    throw new UserMutationError("Unable to update account lock right now.", { status: 500 });
  } finally {
    client.release();
  }
}

// ---------- resetUserPassword ----------

export async function resetUserPassword(
  currentUser: AuthenticatedUser,
  targetUserId: string,
  newPassword: string,
  mustResetPassword = false,
): Promise<void> {
  if (!hasPermission(currentUser, "users:reset_password")) {
    throw new UserMutationError("Only administrators can reset passwords.", { status: 403 });
  }

  if (!newPassword || newPassword.length < 8) {
    throw new UserMutationError("Password must be at least 8 characters.", {
      status: 400,
      fieldErrors: { password: "Password must be at least 8 characters." },
    });
  }

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const snapshot = await fetchUserSnapshotForAudit(client, targetUserId);
    if (!snapshot) {
      throw new UserMutationError("User not found.", { status: 404 });
    }

    const { rowCount } = await client.query(
      `UPDATE user_auth
       SET password_hash        = crypt($2, gen_salt('bf', 10)),
           failed_attempts      = 0,
           is_locked            = false,
           password_changed_at  = now(),
           must_reset_password  = $3,
           updated_at           = now()
       WHERE user_id = $1::uuid`,
      [targetUserId, newPassword, mustResetPassword],
    );

    if (!rowCount) {
      throw new UserMutationError("User not found.", { status: 404 });
    }

    await logUserAudit(client, targetUserId, "reset-password", snapshot, currentUser.userId);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof UserMutationError) throw error;
    console.error("Password reset failed", error);
    throw new UserMutationError("Unable to reset the password right now.", { status: 500 });
  } finally {
    client.release();
  }
}
