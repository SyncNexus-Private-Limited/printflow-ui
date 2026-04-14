"use client";

import { House, Menu, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { ThemeToggleButton } from "@/components/dashboard/theme-toggle-button";
import { Button } from "@/components/ui/button";
import { useDashboardChrome } from "@/components/dashboard/dashboard-chrome-context";
import { cn } from "@/lib/utils/cn";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type TopNavbarProps = {
  onOpenMobileMenu: () => void;
  homeHref: string;
  isOverviewRoute: boolean;
  isMobileMenuOpen: boolean;
};

export function TopNavbar({ onOpenMobileMenu, homeHref, isOverviewRoute, isMobileMenuOpen }: TopNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showBlockingLoader } = useGlobalLoader();
  const { branchControl } = useDashboardChrome();
  const currentBranchValue =
    branchControl?.value && branchControl.value !== "__branch-placeholder__" ? branchControl.value : searchParams.get("branchId");
  const createSearchParams = new URLSearchParams();

  if (currentBranchValue) {
    createSearchParams.set("branchId", currentBranchValue);
  }

  createSearchParams.set("type", "business");

  const createHref = `/dashboard/expenses/new?${createSearchParams.toString()}`;
  const currentHref = `${pathname}?${searchParams.toString()}`;

  const handleHomeClick = () => {
    if (isOverviewRoute) {
      return;
    }

    showBlockingLoader("Loading dashboard...", {
      autoHideOnRouteChange: true,
    });
    router.push(homeHref);
  };

  const handleCreateClick = () => {
    if (currentHref === createHref) {
      return;
    }

    showBlockingLoader("Opening add expense...", {
      autoHideOnRouteChange: true,
    });
    router.push(createHref);
  };

  return (
    <div className="sticky top-0 z-40 px-4 pt-4 sm:px-6 xl:px-8">
      <nav className="mx-auto flex w-full max-w-384 flex-wrap items-start justify-between gap-2.5 rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.86)] px-3 py-2.5 shadow-[0_20px_48px_-42px_rgb(var(--shadow)/0.18)] backdrop-blur supports-backdrop-filter:bg-[rgb(var(--card)/0.82)] sm:flex-nowrap sm:items-center sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="shrink-0 rounded-xl lg:hidden"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            aria-controls="dashboard-mobile-sidebar"
            aria-expanded={isMobileMenuOpen}
            title="Open navigation menu"
          >
            <Menu className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={1.9} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            className={cn(
              "h-10 w-auto rounded-2xl px-3 shadow-[0_16px_40px_-32px_rgb(var(--shadow)/0.4)] sm:px-4",
              isOverviewRoute && "cursor-default",
            )}
            onClick={handleHomeClick}
            aria-label="Go to dashboard overview"
            title="Go to dashboard overview"
          >
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--primary-soft))] text-[rgb(var(--primary-soft-foreground))]">
                <House className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
              </span>
              <span className="hidden truncate text-sm font-semibold sm:inline">PrintFlow</span>
            </span>
          </Button>
        </div>

        <div className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-none sm:justify-end sm:gap-3">
          <BranchFilter
            options={branchControl?.options ?? []}
            value={branchControl?.value ?? "__branch-placeholder__"}
            disabled={branchControl?.disabled ?? true}
            placeholderLabel="All branches"
            className="min-w-0 flex-1 sm:flex-none sm:w-72 sm:min-w-72 lg:w-80 lg:min-w-80"
            selectClassName="rounded-2xl border-[rgb(var(--border))] bg-[rgb(var(--background))] pr-10"
            hideLabel
            id="dashboard-navbar-branch-filter"
          />
          <Button
            type="button"
            className="h-10 rounded-2xl px-3 shadow-[0_16px_40px_-32px_rgb(var(--shadow)/0.4)] sm:px-4"
            onClick={handleCreateClick}
            aria-label="Add expense"
            title="Add expense"
          >
            <Plus className="h-4.5 w-4.5 shrink-0" aria-hidden="true" strokeWidth={1.9} />
            <span className="hidden sm:inline">Create</span>
            <span className="sr-only sm:hidden">Add expense</span>
          </Button>
          <ThemeToggleButton />
          <LogoutButton iconOnly title="Sign out" />
        </div>
      </nav>
    </div>
  );
}
