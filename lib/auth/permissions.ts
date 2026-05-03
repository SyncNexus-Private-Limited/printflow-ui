import type { UserRole } from "@/lib/users/types";

// ---------------------------------------------------------------------------
// Permission names
// ---------------------------------------------------------------------------
// Action-based strings, not page-based. Every guarded action has one name.
//
// To add a new permission:
//   1. Add the string literal to the Permission union below.
//   2. Grant it to the appropriate roles in ROLE_PERMISSIONS.
//   3. Add enforcement in the relevant server mutation / API handler / page.

export type Permission =
  | "dashboard:view"
  | "branches:select_all"
  | "users:view"
  | "users:create"
  | "users:edit"
  | "users:deactivate"
  | "users:lock"
  | "users:reset_password"
  | "orders:create"
  | "orders:view"
  | "orders:edit"
  | "orders:add_payment"
  | "orders:update_status"
  | "orders:cancel"
  | "orders:edit_vendor"
  | "orders:add_vendor_payment"
  | "expenses:view"
  | "expenses:create"
  | "expenses:edit"
  | "expenses:delete"
  | "expense-categories:view"
  | "expense-categories:create"
  | "expense-categories:edit"
  | "expense-categories:deactivate"
  | "expense-categories:restore"
  | "vendors:view"
  | "vendors:create"
  | "vendors:edit"
  | "vendors:deactivate"
  | "vendors:restore"
  | "offers:view"
  | "offers:create"
  | "offers:edit"
  | "offers:deactivate"
  | "offers:restore"
  | "inventory:view"
  | "inventory:create"
  | "inventory:edit"
  | "inventory:archive"
  | "inventory:restore"
  | "customers:view"
  | "customers:create"
  | "customers:edit"
  | "customers:deactivate"
  | "customers:restore";

// ---------------------------------------------------------------------------
// Minimal user shapes accepted by the helpers
// ---------------------------------------------------------------------------
// Narrow types keep these helpers usable without the full AuthenticatedUser
// object (e.g. in tests or partial contexts).

// For permission checks — only the role is needed.
export type PermissionUser = { role: string };

// For branch scope checks — also needs branchId.
// Separate from PermissionUser because branch scope is orthogonal to
// permission grants: a user may have expenses:edit but still be restricted
// to their own branch.
export type ScopedUser = PermissionUser & { branchId: string | null };

// ---------------------------------------------------------------------------
// Role → permission mapping
// ---------------------------------------------------------------------------
// Uses ReadonlySet<Permission> per role so .has() is O(1) average —
// no array scans at call time regardless of how many permissions are defined.
//
// To add a new role:
//   1. Add the role value to UserRole in lib/users/types.ts.
//   2. Add an entry here with the appropriate permission set.
//
// Roles are ordered from most- to least-privileged for readability.
const ROLE_PERMISSIONS: Readonly<Record<UserRole, ReadonlySet<Permission>>> = {
  // Full access — can administer users and select across all branches.
  admin: new Set<Permission>([
    "dashboard:view",
    "branches:select_all",
    "users:view",
    "users:create",
    "users:edit",
    "users:deactivate",
    "users:lock",
    "users:reset_password",
    "orders:create",
    "orders:view",
    "orders:edit",
    "orders:add_payment",
    "orders:update_status",
    "orders:cancel",
    "orders:edit_vendor",
    "orders:add_vendor_payment",
    "expenses:view",
    "expenses:create",
    "expenses:edit",
    "expenses:delete",
    "expense-categories:view",
    "expense-categories:create",
    "expense-categories:edit",
    "expense-categories:deactivate",
    "expense-categories:restore",
    "vendors:view",
    "vendors:create",
    "vendors:edit",
    "vendors:deactivate",
    "vendors:restore",
    "offers:view",
    "offers:create",
    "offers:edit",
    "offers:deactivate",
    "offers:restore",
    "inventory:view",
    "inventory:create",
    "inventory:edit",
    "inventory:archive",
    "inventory:restore",
    "customers:view",
    "customers:create",
    "customers:edit",
    "customers:deactivate",
    "customers:restore",
  ]),

  // Branch-level management: full expense access + can view (not administer) users.
  manager: new Set<Permission>([
    "dashboard:view",
    "users:view",
    "orders:create",
    "orders:view",
    "orders:edit",
    "orders:add_payment",
    "orders:update_status",
    "orders:cancel",
    "orders:edit_vendor",
    "orders:add_vendor_payment",
    "expenses:view",
    "expenses:create",
    "expenses:edit",
    "expenses:delete",
    "expense-categories:view",
    "expense-categories:create",
    "expense-categories:edit",
    "expense-categories:deactivate",
    "expense-categories:restore",
    "vendors:view",
    "vendors:create",
    "vendors:edit",
    "vendors:deactivate",
    "vendors:restore",
    "offers:view",
    "offers:create",
    "offers:edit",
    "offers:deactivate",
    "offers:restore",
    "inventory:view",
    "inventory:create",
    "inventory:edit",
    "inventory:archive",
    "inventory:restore",
    "customers:view",
    "customers:create",
    "customers:edit",
    "customers:deactivate",
    "customers:restore",
  ]),

  // Day-to-day operations: full expense CRUD, no user management.
  operator: new Set<Permission>([
    "dashboard:view",
    "orders:create",
    "orders:view",
    "orders:edit",
    "orders:add_payment",
    "orders:update_status",
    "orders:cancel",
    "orders:edit_vendor",
    "orders:add_vendor_payment",
    "expenses:view",
    "expenses:create",
    "expenses:edit",
    "expenses:delete",
    "expense-categories:view",
    "vendors:view",
    "offers:view",
    "inventory:view",
    "inventory:create",
    "inventory:edit",
    "customers:view",
    "customers:create",
    "customers:edit",
  ]),

  // Limited access: can record and edit expenses, but cannot delete them.
  staff: new Set<Permission>([
    "dashboard:view",
    "orders:create",
    "orders:view",
    "orders:add_payment",
    "expenses:view",
    "expenses:create",
    "expenses:edit",
    "expense-categories:view",
    "vendors:view",
    "offers:view",
    "inventory:view",
    "customers:view",
  ]),
};

// Unknown / future roles get no permissions — fail-closed.
const EMPTY: ReadonlySet<Permission> = new Set();

function getPermissions(user: PermissionUser): ReadonlySet<Permission> {
  return ROLE_PERMISSIONS[user.role as UserRole] ?? EMPTY;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the user's role grants the given permission.
 *
 * Use this for conditional rendering and non-throwing checks.
 * For server-side enforcement, prefer assertPermission.
 */
export function hasPermission(user: PermissionUser, permission: Permission): boolean {
  return getPermissions(user).has(permission);
}

/**
 * Throws PermissionError (status 403) when the user lacks the permission.
 *
 * Use this in server mutations, API route handlers, and page data loaders.
 * Keeping enforcement here (not scattered inline) makes it easy to swap the
 * lookup to DB-driven rules later — only this file needs to change.
 */
export function assertPermission(user: PermissionUser, permission: Permission): void {
  if (!hasPermission(user, permission)) {
    throw new PermissionError(`Permission denied: ${permission}`);
  }
}

/**
 * Structured 403 error thrown by assertPermission.
 * Catch in API route handlers to return a Forbidden JSON response.
 */
export class PermissionError extends Error {
  readonly status = 403 as const;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * Returns true if the user may access records belonging to the given branch.
 *
 * This is a data-scope check, not a permission check. A user may have
 * expenses:edit but still be restricted to their own branch. Keep these
 * concerns separate so each can evolve independently.
 *
 * Users with branches:select_all (admins) may access any branch.
 */
export function canAccessBranch(user: ScopedUser, branchId: string | null): boolean {
  if (hasPermission(user, "branches:select_all")) return true;
  return user.branchId === branchId;
}
