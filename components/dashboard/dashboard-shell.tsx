"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DashboardChromeProvider } from "@/components/dashboard/dashboard-chrome-context";
import { buildDashboardHref } from "@/components/dashboard/dashboard-navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { TopNavbar } from "@/components/dashboard/top-navbar";
import { cn } from "@/lib/utils/cn";

const DESKTOP_SIDEBAR_STORAGE_KEY = "printflow.dashboard.sidebar-collapsed";
const MOBILE_DRAWER_TRANSITION_MS = 240;

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentBranchId = searchParams.get("branchId");
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const [isMobileSidebarMounted, setIsMobileSidebarMounted] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [hasRestoredDesktopPreference, setHasRestoredDesktopPreference] = useState(false);

  const openMobileSidebar = () => {
    setIsMobileSidebarMounted(true);
    window.requestAnimationFrame(() => {
      setIsMobileSidebarOpen(true);
    });
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY);
    setIsDesktopSidebarCollapsed(savedPreference === "true");
    setHasRestoredDesktopPreference(true);
  }, []);

  useEffect(() => {
    if (!hasRestoredDesktopPreference) {
      return;
    }

    window.localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, String(isDesktopSidebarCollapsed));
  }, [hasRestoredDesktopPreference, isDesktopSidebarCollapsed]);

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
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <TopNavbar
          onOpenMobileMenu={openMobileSidebar}
          homeHref={buildDashboardHref("/dashboard", currentBranchId)}
          isOverviewRoute={pathname === "/dashboard"}
          isMobileMenuOpen={isMobileSidebarOpen}
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
                "absolute inset-0 bg-[rgb(var(--shadow)/0.42)] backdrop-blur-[2px] transition-opacity duration-[220ms] ease-out",
                isMobileSidebarOpen ? "opacity-100" : "opacity-0",
              )}
              onClick={closeMobileSidebar}
              aria-label="Close navigation menu"
              tabIndex={isMobileSidebarOpen ? 0 : -1}
            />
            <div
              className={cn(
                "absolute inset-y-0 left-0 w-[min(22rem,calc(100vw-1rem))] p-3 transition-[transform,opacity] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                "transform-gpu",
                isMobileSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0",
              )}
            >
              <div id="dashboard-mobile-sidebar" role="dialog" aria-modal="true" aria-label="Dashboard navigation" className="h-full">
                <DashboardSidebar
                  pathname={pathname}
                  currentBranchId={currentBranchId}
                  collapsed={false}
                  mobile
                  onCloseMobile={closeMobileSidebar}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-[96rem] gap-4 px-4 pb-6 pt-4 sm:px-6 lg:gap-6 xl:px-8">
          <div className="hidden lg:sticky lg:top-[5.5rem] lg:block lg:h-[calc(100vh-6.5rem)] lg:self-start">
            <DashboardSidebar
              pathname={pathname}
              currentBranchId={currentBranchId}
              collapsed={isDesktopSidebarCollapsed}
              mobile={false}
              onToggleCollapsed={() => setIsDesktopSidebarCollapsed((currentValue) => !currentValue)}
            />
          </div>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </DashboardChromeProvider>
  );
}
