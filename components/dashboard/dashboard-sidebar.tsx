"use client";

import Link from "next/link";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildCanonicalExpenseCreateHref } from "@/lib/dashboard/helpers";
import {
  buildDashboardHref,
  dashboardNavigation,
  getDashboardGroupFallback,
  isDashboardRouteActive,
} from "@/components/dashboard/dashboard-navigation";
import { Button } from "@/components/ui/button";
import {
  getDashboardNavigationFilterState,
  isDashboardFilterAwarePath,
} from "@/lib/dashboard/page-filters";
import { type DashboardPermissions } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";

type DashboardSidebarProps = {
  pathname: string;
  currentBranchId: string | null;
  initialBranchId: string | null;
  collapsed: boolean;
  mobile: boolean;
  onToggleCollapsed?: () => void;
  onCloseMobile?: () => void;
  permissions: DashboardPermissions;
};

type SidebarLinkProps = {
  label: string;
  href: string;
  pathname: string;
  collapsed: boolean;
  active: boolean;
  title?: string;
  icon: LucideIcon;
  navigationFilters: ReturnType<typeof getDashboardNavigationFilterState>;
};

function getActiveGroupLabels(pathname: string) {
  return dashboardNavigation
    .filter(
      (item): item is Extract<(typeof dashboardNavigation)[number], { type: "group" }> =>
        item.type === "group",
    )
    .filter((item) => item.children.some((child) => isDashboardRouteActive(pathname, child.href)))
    .map((item) => item.label);
}

function SidebarLink({
  label,
  href,
  pathname,
  collapsed,
  active,
  title,
  icon: Icon,
  navigationFilters,
}: SidebarLinkProps) {
  const resolvedHref = href.includes("?") ? href : buildDashboardHref(href, navigationFilters);
  const isCurrentTarget = pathname === href;
  const accessibleLabel = collapsed ? (title ?? label) : undefined;

  return (
    <Link
      href={resolvedHref}
      data-dashboard-sidebar-link
      aria-current={active ? "page" : undefined}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={(event) => {
        if (isCurrentTarget) {
          event.preventDefault();
        }
      }}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
        active
          ? "bg-[rgb(var(--primary-soft))] text-[rgb(var(--card-foreground))] shadow-[0_18px_36px_-34px_rgb(var(--shadow)/0.3)]"
          : "text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted)/0.74)] hover:text-[rgb(var(--foreground))]",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.9} />
      {!collapsed ? (
        <span data-dashboard-sidebar-link-label className="min-w-0 truncate">
          {label}
        </span>
      ) : (
        <span data-dashboard-sidebar-link-label className="sr-only">
          {label}
        </span>
      )}
    </Link>
  );
}

export function DashboardSidebar({
  pathname,
  currentBranchId,
  initialBranchId,
  collapsed,
  mobile,
  onToggleCollapsed,
  onCloseMobile,
  permissions,
}: DashboardSidebarProps) {
  const searchParams = useSearchParams();
  const isDesktopCollapsed = collapsed && !mobile;
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    getActiveGroupLabels(pathname),
  );
  const navigationFilters = getDashboardNavigationFilterState(
    {
      branchId: currentBranchId ?? searchParams.get("branchId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    },
    {
      applyDefaultDateRange: isDashboardFilterAwarePath(pathname),
    },
  );

  // Build the visible navigation based on permission flags passed from the server.
  // Filtering here (not in dashboardNavigation) keeps the source array role-agnostic.
  const visibleNavigation = dashboardNavigation.flatMap((item) => {
    if (item.type === "group" && item.label === "Users") {
      // Hide the entire Users group for roles without users:view.
      if (!permissions.canManageUsers) return [];
    }
    if (item.type === "group" && item.label === "Expenses") {
      let children = item.children;
      if (!permissions.canViewExpenseCategories) {
        children = children.filter((child) => child.href !== "/dashboard/expenses/categories");
      }
      return [{ ...item, children }];
    }
    return [item];
  });

  useEffect(() => {
    const activeGroupLabels = getActiveGroupLabels(pathname);

    if (activeGroupLabels.length === 0) {
      return;
    }

    setExpandedGroups((currentGroups) => {
      const nextGroups = new Set(currentGroups);
      let hasChanges = false;

      for (const label of activeGroupLabels) {
        if (!nextGroups.has(label)) {
          nextGroups.add(label);
          hasChanges = true;
        }
      }

      return hasChanges ? Array.from(nextGroups) : currentGroups;
    });
  }, [pathname]);

  return (
    <aside
      data-dashboard-sidebar-surface
      data-mobile={mobile ? "true" : "false"}
      className={cn(
        "flex h-full flex-col rounded-[28px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.94)] shadow-[0_22px_52px_-48px_rgb(var(--shadow)/0.18)] backdrop-blur-[10px] transition-[width,padding] duration-200",
        mobile ? "p-4" : cn("hidden lg:flex", isDesktopCollapsed ? "w-20 p-3" : "w-72 p-4"),
      )}
    >
      <div
        data-dashboard-sidebar-header
        className={cn(
          "flex items-start gap-3",
          isDesktopCollapsed ? "justify-center" : "justify-between",
        )}
      >
        <div
          data-dashboard-sidebar-heading
          className={cn("min-w-0", isDesktopCollapsed && "sr-only")}
        >
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[rgb(var(--muted-foreground))] uppercase">
            Workspace
          </p>
          <p className="mt-1 text-sm font-semibold text-[rgb(var(--card-foreground))]">
            {mobile ? "Navigation" : "Modules"}
          </p>
        </div>
        {mobile ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-xl border-[rgb(var(--border)/0.7)] bg-transparent text-[rgb(var(--muted-foreground))] shadow-none hover:bg-[rgb(var(--muted)/0.74)] hover:text-[rgb(var(--foreground))]"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            title="Close navigation menu"
          >
            <X className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={1.9} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-xl border-[rgb(var(--border)/0.7)] bg-transparent text-[rgb(var(--muted-foreground))] shadow-none hover:bg-[rgb(var(--muted)/0.74)] hover:text-[rgb(var(--foreground))]"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={1.9} />
            ) : (
              <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={1.9} />
            )}
          </Button>
        )}
      </div>

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto" aria-label="Dashboard modules">
        {visibleNavigation.map((item) => {
          if (item.type === "link") {
            const resolvedItemHref =
              item.href === "/dashboard/expenses/new"
                ? buildCanonicalExpenseCreateHref({
                    currentBranchId,
                    initialBranchId,
                    type: "business",
                  })
                : item.href;

            return (
              <SidebarLink
                key={item.label}
                label={item.label}
                href={resolvedItemHref}
                pathname={pathname}
                collapsed={isDesktopCollapsed}
                active={isDashboardRouteActive(pathname, item.href)}
                icon={item.icon}
                navigationFilters={navigationFilters}
              />
            );
          }

          const fallbackItem = getDashboardGroupFallback(item);
          const isGroupActive = item.children.some((child) =>
            isDashboardRouteActive(pathname, child.href),
          );

          if (isDesktopCollapsed) {
            return (
              <SidebarLink
                key={item.label}
                label={item.label}
                href={fallbackItem.href}
                pathname={pathname}
                collapsed
                active={isGroupActive}
                title={`${item.label} (${fallbackItem.label})`}
                icon={item.icon}
                navigationFilters={navigationFilters}
              />
            );
          }

          const groupPanelId = `dashboard-sidebar-group-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          const isExpanded = expandedGroups.includes(item.label);

          return (
            <section key={item.label} className="space-y-1">
              <button
                type="button"
                data-dashboard-sidebar-group-toggle
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
                  isGroupActive
                    ? "bg-[rgb(var(--primary-soft))] text-[rgb(var(--card-foreground))] shadow-[0_18px_36px_-34px_rgb(var(--shadow)/0.3)]"
                    : "text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted)/0.74)] hover:text-[rgb(var(--foreground))]",
                )}
                onClick={() =>
                  setExpandedGroups((currentGroups) =>
                    currentGroups.includes(item.label)
                      ? currentGroups.filter((label) => label !== item.label)
                      : [...currentGroups, item.label],
                  )
                }
                aria-expanded={isExpanded}
                aria-controls={groupPanelId}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" strokeWidth={1.9} />
                <span data-dashboard-sidebar-group-label className="min-w-0 flex-1 truncate">
                  {item.label}
                </span>
                <ChevronDown
                  data-dashboard-sidebar-group-chevron
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    !isExpanded && "-rotate-90",
                  )}
                  aria-hidden="true"
                  strokeWidth={1.9}
                />
              </button>

              {isExpanded ? (
                <ul
                  id={groupPanelId}
                  data-dashboard-sidebar-group-panel
                  className="ml-4 list-none space-y-1 border-l border-[rgb(var(--border)/0.7)] pl-3"
                  role="list"
                >
                  {(() => {
                    const activeChild = item.children.reduce<(typeof item.children)[number] | null>(
                      (best, child) => {
                        if (!isDashboardRouteActive(pathname, child.href)) return best;
                        if (!best) return child;
                        return child.href.length > best.href.length ? child : best;
                      },
                      null,
                    );
                    return item.children.map((child) => {
                      const childIsActive = child === activeChild;
                      const [childPath, childQueryString] = child.href.split("?", 2);
                      const baseResolvedHref = buildDashboardHref(childPath, navigationFilters);
                      const resolvedChildHref =
                        childQueryString && childQueryString.length > 0
                          ? `${baseResolvedHref}${baseResolvedHref.includes("?") ? "&" : "?"}${childQueryString}`
                          : baseResolvedHref;
                      const resolvedHref =
                        child.href === "/dashboard/expenses/new"
                          ? buildCanonicalExpenseCreateHref({
                              currentBranchId,
                              initialBranchId,
                              type: "business",
                            })
                          : resolvedChildHref;

                      return (
                        <li key={child.label} className="list-none">
                          <Link
                            href={resolvedHref}
                            aria-current={childIsActive ? "page" : undefined}
                            onClick={(event) => {
                              if (pathname === childPath && !childQueryString) {
                                event.preventDefault();
                              }
                            }}
                            className={cn(
                              "flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                              "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
                              childIsActive
                                ? "bg-[rgb(var(--primary-soft)/0.88)] text-[rgb(var(--card-foreground))]"
                                : "text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted)/0.72)] hover:text-[rgb(var(--foreground))]",
                            )}
                          >
                            <span className="min-w-0 truncate">{child.label}</span>
                          </Link>
                        </li>
                      );
                    });
                  })()}
                </ul>
              ) : null}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
