import "server-only";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { getPool } from "@/lib/db/postgres";
import { userRoleValues, type UserBranchOption, type UserFormPageData, type UserRole } from "@/lib/users/types";

export function normalizeUserSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function coerceUserRole(value: string | string[] | undefined): UserRole {
  const normalized = normalizeUserSearchParam(value);
  return (userRoleValues as readonly string[]).includes(normalized ?? "") ? (normalized as UserRole) : "staff";
}

export async function getUserBranchesForCreation(currentUser: AuthenticatedUser): Promise<UserBranchOption[]> {
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
