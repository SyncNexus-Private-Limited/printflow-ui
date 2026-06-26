import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { canAccessBranch, hasPermission } from "@/lib/auth/permissions";

export function canEditOrder(user: AuthenticatedUser, order: { branchId: string; status: string }) {
  return (
    hasPermission(user, "orders:edit") &&
    order.status !== "cancelled" &&
    canAccessBranch(user, order.branchId)
  );
}

export function canEditOrderItems(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return canEditOrder(user, order);
}

export function canEditOrderDiscount(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return canEditOrder(user, order);
}

export function canUpdateOrderStatus(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return (
    hasPermission(user, "orders:update_status") &&
    order.status !== "cancelled" &&
    canAccessBranch(user, order.branchId)
  );
}

export function canCancelOrder(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return (
    hasPermission(user, "orders:cancel") &&
    order.status !== "cancelled" &&
    canAccessBranch(user, order.branchId)
  );
}

export function canDeleteOrder(
  user: AuthenticatedUser,
  order: { branchId: string; status: string; isDeleted: boolean },
) {
  return (
    hasPermission(user, "orders:delete") &&
    order.status === "cancelled" &&
    !order.isDeleted &&
    canAccessBranch(user, order.branchId)
  );
}

export function canAddCustomerPayment(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return (
    hasPermission(user, "orders:add_payment") &&
    order.status !== "cancelled" &&
    canAccessBranch(user, order.branchId)
  );
}

export function canEditOrderVendor(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return (
    hasPermission(user, "orders:edit_vendor") &&
    order.status !== "cancelled" &&
    canAccessBranch(user, order.branchId)
  );
}

export function canAddVendorPayment(
  user: AuthenticatedUser,
  order: { branchId: string; status: string },
) {
  return (
    hasPermission(user, "orders:add_vendor_payment") &&
    order.status !== "cancelled" &&
    canAccessBranch(user, order.branchId)
  );
}
