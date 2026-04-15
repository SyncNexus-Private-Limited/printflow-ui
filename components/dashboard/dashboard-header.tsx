"use client";

import { useEffect, useLayoutEffect } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardChrome } from "@/components/dashboard/dashboard-chrome-context";
import { getDashboardBreadcrumbs } from "@/components/dashboard/dashboard-navigation";

type DashboardHeaderProps = {
  title: string;
  branchOptions: Array<{
    label: string;
    value: string;
  }>;
  selectedBranchValue: string;
  branchFilterDisabled?: boolean;
};

export function DashboardHeader({
  title,
  branchOptions,
  selectedBranchValue,
  branchFilterDisabled = false,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const { setBranchControl } = useDashboardChrome();
  const isOverviewHeader = pathname === "/dashboard";
  const breadcrumbs = getDashboardBreadcrumbs(pathname, selectedBranchValue);

  useLayoutEffect(() => {
    setBranchControl({
      options: branchOptions,
      value: selectedBranchValue,
      disabled: branchFilterDisabled || branchOptions.length <= 1,
    });
  }, [branchFilterDisabled, branchOptions, selectedBranchValue, setBranchControl]);

  useEffect(() => {
    return () => {
      setBranchControl(null);
    };
  }, [setBranchControl]);

  return (
    <header className="space-y-2 px-1">
      {!isOverviewHeader ? (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs font-medium text-[rgb(var(--muted-foreground))]">
          {breadcrumbs.map((breadcrumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <div key={`${breadcrumb.label}-${index}`} className="flex items-center gap-1">
                {breadcrumb.href && !isLast ? (
                  <Link
                    href={breadcrumb.href}
                    className="rounded-md px-1 py-0.5 transition-colors hover:text-[rgb(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
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
                {!isLast ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} /> : null}
              </div>
            );
          })}
        </nav>
      ) : null}

      <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))] sm:text-3xl">{title}</h1>
    </header>
  );
}
