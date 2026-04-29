import type { DashboardPageFilterState } from "@/lib/dashboard/types";
import { DEFAULT_DASHBOARD_PAGE_SIZE, buildDashboardNavigationHref } from "@/lib/dashboard/page-filters";
import type { LucideIcon } from "lucide-react";
import { Boxes, Home, Receipt, ShoppingBag, Users } from "lucide-react";

export type DashboardNavLinkItem = {
  label: string;
  href: string;
  breadcrumbLabel?: string;
};

export type DashboardNavItem =
  | {
      type: "link";
      label: string;
      href: string;
      icon: LucideIcon;
      breadcrumbLabel?: string;
    }
  | {
      type: "group";
      label: string;
      icon: LucideIcon;
      children: DashboardNavLinkItem[];
    };

export type DashboardBreadcrumb = {
  label: string;
  href?: string;
};

type DashboardNavigationFilters = Pick<DashboardPageFilterState, "branchId" | "from" | "to" | "pageSize">;

export const dashboardNavigation: DashboardNavItem[] = [
  {
    type: "link",
    label: "Overview",
    href: "/dashboard",
    icon: Home,
    breadcrumbLabel: "Home",
  },
  {
    type: "group",
    label: "Sales",
    icon: ShoppingBag,
    children: [
      { label: "Orders", href: "/dashboard/orders" },
      { label: "Customers", href: "/dashboard/customers" },
    ],
  },
  {
    type: "link",
    label: "Inventory",
    href: "/dashboard/inventory",
    icon: Boxes,
  },
  {
    type: "group",
    label: "Expenses",
    icon: Receipt,
    children: [
      { label: "Employee Expenses", href: "/dashboard/employee-expenses" },
      { label: "Business Expenses", href: "/dashboard/business-expenses" },
      { label: "Add Expense", href: "/dashboard/expenses/new", breadcrumbLabel: "Add Expense" },
    ],
  },
  {
    type: "group",
    label: "Users",
    icon: Users,
    children: [
      { label: "All Users", href: "/dashboard/users" },
      { label: "Active Users", href: "/dashboard/active-users" },
      { label: "Add User", href: "/dashboard/users/new", breadcrumbLabel: "Add User" },
    ],
  },
];

export function buildDashboardHref(href: string, branchIdOrFilters: string | DashboardNavigationFilters | null) {
  const filters =
    typeof branchIdOrFilters === "string" || branchIdOrFilters === null
      ? {
          branchId: branchIdOrFilters,
          from: null,
          to: null,
          pageSize: DEFAULT_DASHBOARD_PAGE_SIZE,
        }
      : branchIdOrFilters;

  return buildDashboardNavigationHref(href, filters);
}

export function isDashboardRouteActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getDashboardGroupFallback(item: Extract<DashboardNavItem, { type: "group" }>) {
  return item.children[0];
}

export function getDashboardBreadcrumbs(pathname: string, filters: DashboardNavigationFilters): DashboardBreadcrumb[] {
  const homeHref = buildDashboardHref("/dashboard", filters);

  if (pathname === "/dashboard") {
    return [{ label: "Home", href: homeHref }];
  }

  for (const item of dashboardNavigation) {
    if (item.type === "link" && isDashboardRouteActive(pathname, item.href)) {
      return [
        { label: "Home", href: homeHref },
        { label: item.breadcrumbLabel ?? item.label },
      ];
    }

    if (item.type === "group") {
      const activeChild = item.children.find((child) => isDashboardRouteActive(pathname, child.href));

      if (activeChild) {
        return [
          { label: "Home", href: homeHref },
          { label: item.label },
          { label: activeChild.breadcrumbLabel ?? activeChild.label },
        ];
      }
    }
  }

  return [{ label: "Home", href: homeHref }];
}
