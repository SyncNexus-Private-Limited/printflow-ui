"use client";

import { useEffect, useRef, useState } from "react";
import { House, Menu, MoreHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { CreateMenu } from "@/components/dashboard/create-menu";
import { ThemeToggleButton } from "@/components/dashboard/theme-toggle-button";
import { Button } from "@/components/ui/button";
import { useDashboardChrome } from "@/components/dashboard/dashboard-chrome-context";
import { cn } from "@/lib/utils/cn";

type TopNavbarProps = {
  onOpenMobileMenu: () => void;
  homeHref: string;
  isOverviewRoute: boolean;
  isMobileMenuOpen: boolean;
  initialBranchId: string | null;
  initialBranchName: string | null;
  canSelectAllBranches: boolean;
  canCreateUser: boolean;
};

function getFallbackBranchControl({
  branchIdFromSearchParams,
  initialBranchId,
  initialBranchName,
  canSelectAllBranches,
}: {
  branchIdFromSearchParams: string | null;
  initialBranchId: string | null;
  initialBranchName: string | null;
  canSelectAllBranches: boolean;
}) {
  if (canSelectAllBranches) {
    const resolvedValue = branchIdFromSearchParams ?? "all";

    return {
      options: [
        {
          label: resolvedValue === "all" ? "All branches" : "Selected branch",
          value: resolvedValue,
        },
      ],
      value: resolvedValue,
      disabled: false,
    };
  }

  const resolvedValue = initialBranchId ?? branchIdFromSearchParams ?? "all";

  return {
    options: [
      {
        label: initialBranchName ?? "Your branch",
        value: resolvedValue,
      },
    ],
    value: resolvedValue,
    disabled: true,
  };
}

// Compact dropdown containing Theme + Logout — visible only below md breakpoint.
// Keeps the primary nav row uncluttered on mobile/small tablet.
function NavActionsOverflow() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && wrapperRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className="relative md:hidden">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="rounded-xl shadow-[0_16px_40px_-32px_rgb(var(--shadow)/0.4)]"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="More actions"
        title="More actions"
        aria-expanded={isOpen}
      >
        <MoreHorizontal className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={1.8} />
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 flex items-center gap-1.5 rounded-2xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] p-1.5 shadow-[0_20px_44px_-32px_rgb(var(--shadow)/0.22)] backdrop-blur-[14px]">
          <ThemeToggleButton />
          <LogoutButton iconOnly title="Sign out" />
        </div>
      ) : null}
    </div>
  );
}

export function TopNavbar({
  onOpenMobileMenu,
  homeHref,
  isOverviewRoute,
  isMobileMenuOpen,
  initialBranchId,
  initialBranchName,
  canSelectAllBranches,
  canCreateUser,
}: TopNavbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branchControl } = useDashboardChrome();
  const branchIdFromSearchParams = searchParams.get("branchId");
  const resolvedBranchControl =
    branchControl ??
    getFallbackBranchControl({
      branchIdFromSearchParams,
      initialBranchId,
      initialBranchName,
      canSelectAllBranches,
    });
  const currentBranchValue =
    resolvedBranchControl.value && resolvedBranchControl.value !== "__branch-placeholder__"
      ? resolvedBranchControl.value
      : branchIdFromSearchParams;

  const handleHomeClick = () => {
    if (isOverviewRoute) {
      return;
    }

    router.push(homeHref);
  };

  return (
    <div className="sticky top-0 z-40 px-4 pt-4 sm:px-6 xl:px-8">
      <nav className="mx-auto flex w-full max-w-384 flex-wrap items-center gap-2.5 rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.86)] px-3 py-2.5 shadow-[0_20px_48px_-42px_rgb(var(--shadow)/0.18)] backdrop-blur supports-backdrop-filter:bg-[rgb(var(--card)/0.82)] sm:px-4 md:flex-nowrap md:gap-3">

        {/* Left: hamburger + brand — anchors row 1 left at all breakpoints */}
        <div className="order-1 flex shrink-0 items-center gap-2">
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

        {/*
         * Branch selector:
         * - Mobile/sm: order-3 + w-full → wraps to its own full-width second row
         * - md+: order-2 + ml-auto + fixed width → inline in the single row, right-aligned from brand
         */}
        <BranchFilter
          options={resolvedBranchControl.options}
          value={resolvedBranchControl.value}
          disabled={resolvedBranchControl.disabled}
          placeholderLabel="All branches"
          className="order-3 w-full md:order-2 md:ml-auto md:w-60 md:flex-none lg:w-72"
          selectClassName="rounded-2xl border-[rgb(var(--border))] bg-[rgb(var(--background))] pr-10"
          hideLabel
          id="dashboard-navbar-branch-filter"
        />

        {/*
         * Action controls:
         * - Mobile/sm: order-2 + ml-auto → right side of row 1; shows Create (icon) + Overflow
         * - md+: order-3 + ml-0 → rightmost in single row; shows Create (text) + Theme + Logout directly
         */}
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 md:order-3 md:ml-0">
          <CreateMenu
            currentBranchValue={currentBranchValue}
            initialBranchId={initialBranchId}
            branchOptions={resolvedBranchControl.options}
            canCreateUser={canCreateUser}
          />
          {/* Theme + Logout: visible directly on md+ (tablet/desktop) */}
          <div className="hidden md:flex md:items-center md:gap-2">
            <ThemeToggleButton />
            <LogoutButton iconOnly title="Sign out" />
          </div>
          {/* Overflow menu: visible on mobile/sm only — contains Theme + Logout */}
          <NavActionsOverflow />
        </div>
      </nav>
    </div>
  );
}
