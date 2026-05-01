import type { DashboardPageFilterState } from "@/lib/dashboard/types";
import {
  DEFAULT_DASHBOARD_PAGE_SIZE,
  buildDashboardNavigationHref,
} from "@/lib/dashboard/page-filters";
import type { LucideIcon } from "lucide-react";
import { Boxes, Home, Receipt, ShoppingBag, Truck, Users } from "lucide-react";

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

type DashboardNavigationFilters = Pick<
  DashboardPageFilterState,
  "branchId" | "from" | "to" | "pageSize"
>;

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
      { label: "Offers", href: "/dashboard/offers" },
    ],
  },
  {
    type: "group",
    label: "Inventory",
    icon: Boxes,
    children: [
      { label: "Inventory", href: "/dashboard/inventory" },
      { label: "Inventory Pricing", href: "/dashboard/inventory/pricing" },
    ],
  },
  {
    type: "link",
    label: "Vendors",
    href: "/dashboard/vendors",
    icon: Truck,
  },
  {
    type: "group",
    label: "Expenses",
    icon: Receipt,
    children: [
      { label: "Employee Expenses", href: "/dashboard/employee-expenses" },
      { label: "Business Expenses", href: "/dashboard/business-expenses" },
      { label: "Expense Categories", href: "/dashboard/expenses/categories" },
    ],
  },
  {
    type: "group",
    label: "Users",
    icon: Users,
    children: [
      { label: "Users", href: "/dashboard/users" },
      { label: "Active Users", href: "/dashboard/active-users" },
    ],
  },
];

export function buildDashboardHref(
  href: string,
  branchIdOrFilters: string | DashboardNavigationFilters | null,
) {
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

export function getDashboardBreadcrumbs(
  pathname: string,
  filters: DashboardNavigationFilters,
  searchParams?: Pick<URLSearchParams, "get">,
): DashboardBreadcrumb[] {
  const homeHref = buildDashboardHref("/dashboard", filters);
  const ordersHref = buildDashboardHref("/dashboard/orders", filters);
  const inventoryHref = buildDashboardHref("/dashboard/inventory", filters);
  const offersHref = buildDashboardHref("/dashboard/offers", filters);
  const vendorsHref = buildDashboardHref("/dashboard/vendors", filters);
  const usersHref = buildDashboardHref("/dashboard/users", filters);
  const employeeExpensesHref = buildDashboardHref("/dashboard/employee-expenses", filters);
  const businessExpensesHref = buildDashboardHref("/dashboard/business-expenses", filters);
  const expenseCategoriesHref = buildDashboardHref("/dashboard/expenses/categories", filters);
  const expensesHref = employeeExpensesHref;

  if (pathname === "/dashboard") {
    return [{ label: "Home", href: homeHref }];
  }

  if (pathname === "/dashboard/users/new") {
    return [
      { label: "Home", href: homeHref },
      { label: "Users", href: usersHref },
      { label: "Add User" },
    ];
  }

  if (pathname === "/dashboard/orders/new") {
    return [
      { label: "Home", href: homeHref },
      { label: "Orders", href: ordersHref },
      { label: "Add Order" },
    ];
  }

  if (pathname.startsWith("/dashboard/orders/") && pathname.endsWith("/edit")) {
    return [
      { label: "Home", href: homeHref },
      { label: "Orders", href: ordersHref },
      { label: "Order Details", href: pathname.replace(/\/edit$/, "") },
      { label: "Edit Order" },
    ];
  }

  if (pathname.startsWith("/dashboard/orders/")) {
    return [
      { label: "Home", href: homeHref },
      { label: "Orders", href: ordersHref },
      { label: "Order Details" },
    ];
  }

  if (pathname === "/dashboard/inventory/new") {
    return [
      { label: "Home", href: homeHref },
      { label: "Inventory", href: inventoryHref },
      { label: "Add Inventory" },
    ];
  }

  if (pathname === "/dashboard/inventory/pricing/new") {
    const inventoryPricingHref = buildDashboardHref("/dashboard/inventory/pricing", filters);
    return [
      { label: "Home", href: homeHref },
      { label: "Inventory", href: inventoryHref },
      { label: "Inventory Pricing", href: inventoryPricingHref },
      { label: "Add Pricing" },
    ];
  }

  if (pathname === "/dashboard/vendors/new") {
    return [
      { label: "Home", href: homeHref },
      { label: "Vendors", href: vendorsHref },
      { label: "Add Vendor" },
    ];
  }

  if (pathname === "/dashboard/vendors") {
    return [{ label: "Home", href: homeHref }, { label: "Vendors" }];
  }

  if (pathname === "/dashboard/offers/new") {
    return [
      { label: "Home", href: homeHref },
      { label: "Offers", href: offersHref },
      { label: "Add Offer" },
    ];
  }

  if (pathname === "/dashboard/offers") {
    return [{ label: "Home", href: homeHref }, { label: "Offers" }];
  }

  if (pathname === "/dashboard/expenses/categories/new") {
    return [
      { label: "Home", href: homeHref },
      { label: "Expenses", href: expensesHref },
      { label: "Expense Categories", href: expenseCategoriesHref },
      { label: "Add Expense Category" },
    ];
  }

  if (pathname === "/dashboard/employee-expenses" || pathname === "/dashboard/expenses/employee") {
    return [
      { label: "Home", href: homeHref },
      { label: "Expenses", href: expensesHref },
      { label: "Employee Expenses" },
    ];
  }

  if (pathname === "/dashboard/business-expenses" || pathname === "/dashboard/expenses/business") {
    return [
      { label: "Home", href: homeHref },
      { label: "Expenses", href: expensesHref },
      { label: "Business Expenses" },
    ];
  }

  if (pathname === "/dashboard/expenses/categories") {
    return [
      { label: "Home", href: homeHref },
      { label: "Expenses", href: expensesHref },
      { label: "Expense Categories" },
    ];
  }

  if (pathname === "/dashboard/expenses/new") {
    const expenseType = searchParams?.get("type");
    const isEmployeeExpense = expenseType === "employee";
    const listingLabel = isEmployeeExpense ? "Employee Expenses" : "Business Expenses";
    const listingHref = isEmployeeExpense ? employeeExpensesHref : businessExpensesHref;
    const addLabel = isEmployeeExpense ? "Add Employee Expense" : "Add Business Expense";

    return [
      { label: "Home", href: homeHref },
      { label: "Expenses", href: expensesHref },
      { label: listingLabel, href: listingHref },
      { label: addLabel },
    ];
  }

  for (const item of dashboardNavigation) {
    if (item.type === "link" && isDashboardRouteActive(pathname, item.href)) {
      return [{ label: "Home", href: homeHref }, { label: item.breadcrumbLabel ?? item.label }];
    }

    if (item.type === "group") {
      const activeChild = item.children.reduce<(typeof item.children)[number] | null>(
        (best, child) => {
          if (!isDashboardRouteActive(pathname, child.href)) return best;
          if (!best) return child;
          return child.href.length > best.href.length ? child : best;
        },
        null,
      );

      if (activeChild) {
        if (activeChild.label === item.label) {
          return [{ label: "Home", href: homeHref }, { label: item.label }];
        }

        const fallbackChild = getDashboardGroupFallback(item);

        return [
          { label: "Home", href: homeHref },
          { label: item.label, href: buildDashboardHref(fallbackChild.href, filters) },
          { label: activeChild.breadcrumbLabel ?? activeChild.label },
        ];
      }
    }
  }

  return [{ label: "Home", href: homeHref }];
}
