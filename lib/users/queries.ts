import "server-only";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { getPool } from "@/lib/db/postgres";
import {
  userRoleValues,
  type EditUserRow,
  type UserBranchOption,
  type UserFormPageData,
  type UserRole,
} from "@/lib/users/types";

export function normalizeUserSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function coerceUserRole(value: string | string[] | undefined): UserRole {
  const normalized = normalizeUserSearchParam(value);
  return (userRoleValues as readonly string[]).includes(normalized ?? "")
    ? (normalized as UserRole)
    : "staff";
}

export async function getUserBranchesForCreation(
  currentUser: AuthenticatedUser,
): Promise<UserBranchOption[]> {
  if (currentUser.role !== "admin") {
    return currentUser.branchId
      ? [{ id: currentUser.branchId, name: currentUser.branchName ?? "Your branch" }]
      : [];
  }

  const db = getPool();
  const { rows } = await db.query<UserBranchOption>(
    `
      SELECT id::text AS id, name
      FROM branches
      WHERE is_active = true
      ORDER BY name ASC
    `,
  );

  return rows;
}

export async function getUserById(id: string): Promise<EditUserRow | null> {
  const db = getPool();
  const { rows } = await db.query<EditUserRow>(
    `
      SELECT
        u.id::text AS id,
        u.full_name AS "fullName",
        u.phone,
        COALESCE(u.alternate_phone, '') AS "alternatePhone",
        COALESCE(u.email, '') AS email,
        COALESCE(u.address, '') AS address,
        u.role::text AS role,
        COALESCE(u.branch_id::text, '') AS "branchId",
        b.name AS "branchName",
        u.is_active AS "isActive",
        COALESCE(ua.username, '') AS username,
        u.updated_at::text AS "updatedAt",
        updater.full_name AS "updatedByName"
      FROM users u
      LEFT JOIN user_auth ua ON ua.user_id = u.id
      LEFT JOIN branches b ON b.id = u.branch_id
      LEFT JOIN users updater ON updater.id = u.updated_by
      WHERE u.id = $1::uuid
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ?? null;
}

export async function getUserFormPageData(
  currentUser: AuthenticatedUser,
  branchId: string,
  role: UserRole,
): Promise<UserFormPageData> {
  const branchOptions = await getUserBranchesForCreation(currentUser);

  // Admin role: branch is optional — accept empty branchId
  const selectedBranch =
    role === "admin"
      ? (branchOptions.find((b) => b.id === branchId) ?? null)
      : (branchOptions.find((b) => b.id === branchId) ?? branchOptions[0] ?? null);

  return {
    branchOptions,
    selectedBranchId: selectedBranch?.id ?? "",
    selectedBranchName: selectedBranch?.name ?? "Branch",
    selectedRole: role,
    canSelectBranch: currentUser.role === "admin" && branchOptions.length > 1,
  };
}
