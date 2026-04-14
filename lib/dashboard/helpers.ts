import type { BranchFilterState, DashboardSummary } from "@/lib/dashboard/types";
import type { LowStockRow, RecentExpenseRow, RecentOrderRow } from "@/lib/dashboard/types";

export function buildBranchFilterOptions(context: BranchFilterState) {
  const branchOptions = context.branches.map((branch) => ({
    label: branch.name,
    value: branch.id,
  }));

  if (context.canSelectAll) {
    return [{ label: "All branches", value: "all" }, ...branchOptions];
  }

  if (branchOptions.length > 0) {
    return branchOptions;
  }

  return [{ label: context.selectedBranchName, value: context.selectedBranchValue }];
}

export function buildBranchHref(path: string, branchValue: string) {
  return `${path}?branchId=${encodeURIComponent(branchValue)}`;
}

export function buildBranchScopedHref(
  path: string,
  branchValue: string,
  extraSearchParams?: Record<string, string | null | undefined>,
) {
  const searchParams = new URLSearchParams();

  if (branchValue) {
    searchParams.set("branchId", branchValue);
  }

  if (extraSearchParams) {
    for (const [key, value] of Object.entries(extraSearchParams)) {
      if (!value) {
        continue;
      }

      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function hasDashboardData(
  summary: DashboardSummary,
  recentOrders: RecentOrderRow[],
  lowStockItems: LowStockRow[],
  recentExpenses: RecentExpenseRow[],
) {
  return (
    summary.orders.totalOrders > 0 ||
    summary.customers.totalCustomers > 0 ||
    summary.inventory.totalInventoryItems > 0 ||
    summary.activeUsers.totalActiveStaffAccounts > 0 ||
    summary.employeeExpenses.entryCountThisMonth > 0 ||
    summary.businessExpenses.entryCountThisMonth > 0 ||
    recentOrders.length > 0 ||
    lowStockItems.length > 0 ||
    recentExpenses.length > 0
  );
}
