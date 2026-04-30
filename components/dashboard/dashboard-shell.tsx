"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DashboardChromeProvider } from "@/components/dashboard/dashboard-chrome-context";
import { buildDashboardHref } from "@/components/dashboard/dashboard-navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { ForbiddenToast } from "@/components/dashboard/forbidden-toast";
import { TopNavbar } from "@/components/dashboard/top-navbar";
import { getDashboardNavigationFilterState } from "@/lib/dashboard/page-filters";
import { cn } from "@/lib/utils/cn";
import { DESKTOP_SIDEBAR_STORAGE_KEY } from "@/lib/ui/client-preferences";

const MOBILE_DRAWER_TRANSITION_MS = 240;

type DashboardShellProps = {
  children: ReactNode;
  initialBranchId: string | null;
  initialBranchName: string | null;
  canSelectAllBranches: boolean;
  canManageUsers: boolean;
  canViewExpenseCategories: boolean;
};

function readDesktopSidebarPreference() {
  if (typeof document !== "undefined") {
    const resolvedPreference = document.documentElement.dataset.dashboardSidebarCollapsed;

    if (resolvedPreference === "true" || resolvedPreference === "false") {
      return resolvedPreference === "true";
    }
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function applyDesktopSidebarPreference(isCollapsed: boolean) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.dashboardSidebarCollapsed = String(isCollapsed);
  }

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, String(isCollapsed));
  } catch {
    // Ignore storage failures and keep the in-memory UI state.
  }
}

export function DashboardShell({
  children,
  initialBranchId,
  initialBranchName,
  canSelectAllBranches,
  canManageUsers,
  canViewExpenseCategories,
}: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigationFilters = getDashboardNavigationFilterState({
    branchId: searchParams.get("branchId") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  const currentBranchId = navigationFilters.branchId;
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const [isMobileSidebarMounted, setIsMobileSidebarMounted] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const openMobileSidebar = () => {
    setIsMobileSidebarMounted(true);
    window.requestAnimationFrame(() => {
      setIsMobileSidebarOpen(true);
    });
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  useLayoutEffect(() => {
    const resolvedPreference = readDesktopSidebarPreference();

    setIsDesktopSidebarCollapsed(resolvedPreference);
    applyDesktopSidebarPreference(resolvedPreference);
  }, []);

  useEffect(() => {
    closeMobileSidebar();
  }, [routeSignature]);

  useEffect(() => {
    if (!isMobileSidebarMounted) {
      return;
    }

    if (isMobileSidebarOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsMobileSidebarMounted(false);
    }, MOBILE_DRAWER_TRANSITION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isMobileSidebarMounted, isMobileSidebarOpen]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeMobileSidebar();
      }
    };

    if (mediaQuery.matches) {
      closeMobileSidebar();
    }

    mediaQuery.addEventListener("change", handleMediaQueryChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
    };
  }, []);

  return (
    <DashboardChromeProvider>
      <ForbiddenToast />
      <div className="min-h-screen bg-[rgb(var(--background))]" data-dashboard-shell>
        <TopNavbar
          onOpenMobileMenu={openMobileSidebar}
          homeHref={buildDashboardHref("/dashboard", navigationFilters)}
          isOverviewRoute={pathname === "/dashboard"}
          isMobileMenuOpen={isMobileSidebarOpen}
          initialBranchId={initialBranchId}
          initialBranchName={initialBranchName}
          canSelectAllBranches={canSelectAllBranches}
        />

        {isMobileSidebarMounted ? (
          <div
            className={cn(
              "fixed inset-0 z-50 lg:hidden",
              isMobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none",
            )}
            aria-hidden={!isMobileSidebarOpen}
          >
            <button
              type="button"
              className={cn(
                "absolute inset-0 bg-[rgb(var(--shadow)/0.42)] backdrop-blur-[2px] transition-opacity duration-220 ease-out",
                isMobileSidebarOpen ? "opacity-100" : "opacity-0",
              )}
              onClick={closeMobileSidebar}
              aria-label="Close navigation menu"
              tabIndex={isMobileSidebarOpen ? 0 : -1}
            />
            <div
              className={cn(
                "absolute inset-y-0 left-0 w-[min(22rem,calc(100vw-1rem))] p-3 transition-[transform,opacity] duration-240 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                "transform-gpu",
                isMobileSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0",
              )}
            >
              <div
                id="dashboard-mobile-sidebar"
                role="dialog"
                aria-modal="true"
                aria-label="Dashboard navigation"
                className="h-full"
              >
                <DashboardSidebar
                  pathname={pathname}
                  currentBranchId={currentBranchId}
                  initialBranchId={initialBranchId}
                  collapsed={false}
                  mobile
                  onCloseMobile={closeMobileSidebar}
                  canManageUsers={canManageUsers}
                  canViewExpenseCategories={canViewExpenseCategories}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-384 gap-4 px-4 pt-4 pb-6 sm:px-6 lg:gap-6 xl:px-8">
          <div className="hidden lg:sticky lg:top-22 lg:block lg:h-[calc(100vh-6.5rem)] lg:self-start">
            <DashboardSidebar
              pathname={pathname}
              currentBranchId={currentBranchId}
              initialBranchId={initialBranchId}
              collapsed={isDesktopSidebarCollapsed}
              mobile={false}
              onToggleCollapsed={() =>
                setIsDesktopSidebarCollapsed((currentValue) => {
                  const nextValue = !currentValue;

                  applyDesktopSidebarPreference(nextValue);

                  return nextValue;
                })
              }
              canManageUsers={canManageUsers}
              canViewExpenseCategories={canViewExpenseCategories}
            />
          </div>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </DashboardChromeProvider>
  );
}
