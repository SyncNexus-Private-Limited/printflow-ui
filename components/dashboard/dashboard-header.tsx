"use client";

import { useLayoutEffect } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDashboardChrome } from "@/components/dashboard/dashboard-chrome-context";
import { getDashboardBreadcrumbs } from "@/components/dashboard/dashboard-navigation";
import { getDashboardNavigationFilterState } from "@/lib/dashboard/page-filters";

type DashboardHeaderProps = {
  title: string;
  branchOptions: Array<{
    label: string;
    value: string;
  }>;
  selectedBranchValue: string;
  branchFilterDisabled?: boolean;
  /** Shown only on the overview page (/dashboard). Replaces the static title with a time-aware greeting. */
  greetingName?: string;
  greetingBranchName?: string;
};

function getGreetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({
  title,
  branchOptions,
  selectedBranchValue,
  branchFilterDisabled = false,
  greetingName,
  greetingBranchName,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setBranchControl } = useDashboardChrome();
  const isOverviewHeader = pathname === "/dashboard";
  const navigationFilters = getDashboardNavigationFilterState({
    branchId: selectedBranchValue,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  const breadcrumbs = getDashboardBreadcrumbs(pathname, navigationFilters, searchParams);

  useLayoutEffect(() => {
    setBranchControl({
      options: branchOptions,
      value: selectedBranchValue,
      disabled: branchFilterDisabled || branchOptions.length <= 1,
    });
  }, [branchFilterDisabled, branchOptions, selectedBranchValue, setBranchControl]);

  return (
    <header className="space-y-2 px-1">
      {!isOverviewHeader ? (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-xs font-medium text-[rgb(var(--muted-foreground))]"
        >
          {breadcrumbs.map((breadcrumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <div key={`${breadcrumb.label}-${index}`} className="flex items-center gap-1">
                {breadcrumb.href && !isLast ? (
                  <Link
                    href={breadcrumb.href}
                    className="rounded-md px-1 py-0.5 transition-colors hover:text-[rgb(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none"
                  >
                    {breadcrumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={isLast ? "text-[rgb(var(--foreground))]" : undefined}
                  >
                    {breadcrumb.label}
                  </span>
                )}
                {!isLast ? (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} />
                ) : null}
              </div>
            );
          })}
        </nav>
      ) : null}

      {isOverviewHeader && greetingName ? (
        <div className="space-y-1">
          <h1
            className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))] sm:text-3xl"
            suppressHydrationWarning
          >
            {getGreetingWord()}, {greetingName}.
          </h1>
          {greetingBranchName ? (
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Here&apos;s what&apos;s happening at {greetingBranchName} today.
            </p>
          ) : null}
        </div>
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))] sm:text-3xl">
          {title}
        </h1>
      )}
    </header>
  );
}
