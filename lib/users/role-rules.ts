import type { UserRole } from "@/lib/users/types";

/**
 * Admin accounts may operate without a branch assignment.
 * All other roles (manager, operator, staff) must be assigned to a branch.
 */
export function requiresBranch(role: UserRole): boolean {
  return role !== "admin";
}
