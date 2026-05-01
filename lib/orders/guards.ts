import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { canAccessBranch } from "@/lib/auth/permissions";

export function canEditOrder(user: AuthenticatedUser, order: { branchId: string; status: string }) {
  return order.status !== "cancelled" && canAccessBranch(user, order.branchId);
}

export function canEditOrderItems(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return canEditOrder(user, order);
}

export function canEditOrderVendor(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return canEditOrder(user, order);
}

export function canEditOrderPayment(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return canEditOrder(user, order);
}
