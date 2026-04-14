"use client";

import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  buildDashboardPageHref,
  buildDashboardPaginationHref,
} from "@/lib/dashboard/page-filters";
import type { DashboardPageFilterState, DashboardPaginationState } from "@/lib/dashboard/types";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type DashboardPaginationProps = {
  currentPath: string;
  currentFilters: DashboardPageFilterState;
  pagination: DashboardPaginationState;
  variant?: "default" | "expense";
};

function normalizeHref(href: string) {
  const url = new URL(href, "https://printflow.local");
  const normalizedSearchParams = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) {
      return leftValue.localeCompare(rightValue);
    }

    return leftKey.localeCompare(rightKey);
  });
  const normalizedQuery = new URLSearchParams(normalizedSearchParams).toString();

  return normalizedQuery ? `${url.pathname}?${normalizedQuery}` : url.pathname;
}

function isSameHref(leftHref: string, rightHref: string) {
  return normalizeHref(leftHref) === normalizeHref(rightHref);
}

function getVisiblePageNumbers(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 4, totalPages];
  }

  if (page >= totalPages - 2) {
    return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, page - 1, page, page + 1, totalPages];
}

export function DashboardPagination({
  currentPath,
  currentFilters,
  pagination,
  variant = "default",
}: DashboardPaginationProps) {
  const router = useRouter();
  const { showBlockingLoader } = useGlobalLoader();
  const currentHref = useMemo(() => buildDashboardPageHref(currentPath, currentFilters), [currentFilters, currentPath]);
  const visiblePageNumbers = useMemo(
    () => getVisiblePageNumbers(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );
  const hasMultiplePages = pagination.totalPages > 1;
  const isExpenseVariant = variant === "expense";

  if (pagination.totalItems === 0) {
    return null;
  }

  const startItem = (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  const navigateToPagination = (href: string, loaderMessage: string) => {
    if (isSameHref(href, currentHref)) {
      return;
    }

    showBlockingLoader(loaderMessage, {
      autoHideOnRouteChange: true,
    });
    router.push(href);
  };

  if (isExpenseVariant) {
    return (
      <div className="border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--muted)/0.42)] px-4 py-4 backdrop-blur-lg sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Showing <span className="font-semibold text-[rgb(var(--foreground))]">{startItem}</span>-
              <span className="font-semibold text-[rgb(var(--foreground))]">{endItem}</span> of{" "}
              <span className="font-semibold text-[rgb(var(--foreground))]">{pagination.totalItems}</span>
            </p>

            <label className="inline-flex items-center gap-3 text-sm text-[rgb(var(--muted-foreground))]">
              <span className="whitespace-nowrap">Rows per page</span>
              <div className="relative">
                <Select
                  className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                  value={String(pagination.pageSize)}
                  aria-label={`Rows per page, currently ${pagination.pageSize}`}
                  title={`Rows per page: ${pagination.pageSize}`}
                  onChange={(event) => {
                    const nextPageSize = Number.parseInt(event.target.value, 10);
                    const nextHref = buildDashboardPaginationHref(currentPath, currentFilters, {
                      page: 1,
                      pageSize: nextPageSize,
                    });

                    navigateToPagination(nextHref, "Updating page size...");
                  }}
                >
                  {DASHBOARD_PAGE_SIZE_OPTIONS.map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}
                    </option>
                  ))}
                </Select>
                <div
                  aria-hidden="true"
                  className={suggestCanonicalClasses(
                    "flex h-10 min-w-18 items-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-4 pr-10 shadow-[0_16px_40px_-34px_rgb(var(--shadow)/0.18)] transition-colors",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(var(--primary)/0.35)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-transparent",
                    "peer-hover:border-[rgb(var(--border)/1)] peer-hover:bg-[rgb(var(--card))]",
                  )}
                >
                  <span className="w-full text-center text-base font-semibold text-[rgb(var(--foreground))]">
                    {pagination.pageSize}
                  </span>
                </div>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[rgb(var(--muted-foreground))]">
                  <ChevronsUpDown className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                </span>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-2xl px-3 shadow-none sm:px-4"
              disabled={pagination.page <= 1}
              onClick={() =>
                navigateToPagination(
                  buildDashboardPaginationHref(currentPath, currentFilters, {
                    page: pagination.page - 1,
                  }),
                  "Loading previous page...",
                )
              }
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              <span className="sr-only sm:ml-1.5 sm:not-sr-only">Previous</span>
            </Button>

            <div className="inline-flex items-center rounded-full border border-[rgb(var(--border)/0.74)] bg-[rgb(var(--card)/0.92)] px-3.5 py-2 text-sm font-medium text-[rgb(var(--foreground)/0.76)] shadow-[0_18px_36px_-30px_rgb(var(--shadow)/0.12)]">
              Page <span className="mx-1.5 font-semibold text-[rgb(var(--card-foreground))]">{pagination.page}</span> of{" "}
              <span className="ml-1.5 font-semibold text-[rgb(var(--card-foreground))]">{pagination.totalPages}</span>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-2xl px-3 shadow-none sm:px-4"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                navigateToPagination(
                  buildDashboardPaginationHref(currentPath, currentFilters, {
                    page: pagination.page + 1,
                  }),
                  "Loading next page...",
                )
              }
              title="Next page"
            >
              <span className="sr-only sm:mr-1.5 sm:not-sr-only">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={suggestCanonicalClasses(
        cn(
          "flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between",
          isExpenseVariant
            ? "border-t border-[rgb(var(--border)/0.68)] bg-[rgb(var(--background)/0.48)] px-5 py-3 backdrop-blur-lg"
            : "rounded-[22px] border border-[rgb(var(--border)/0.68)] bg-[rgb(var(--card)/0.9)] shadow-[0_18px_44px_-40px_rgb(var(--shadow)/0.12)] backdrop-blur-lg",
        ),
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-start">
        <p className={cn("text-sm text-[rgb(var(--muted-foreground))]", isExpenseVariant && "text-[13px]")}>
          Showing <span className="font-semibold text-[rgb(var(--foreground))]">{startItem}</span>-
          <span className="font-semibold text-[rgb(var(--foreground))]">{endItem}</span> of{" "}
          <span className="font-semibold text-[rgb(var(--foreground))]">{pagination.totalItems}</span>
        </p>

        <label
          className={cn(
            "flex items-center gap-2 text-sm text-[rgb(var(--muted-foreground))]",
            isExpenseVariant && "gap-2.5 text-[13px]",
          )}
        >
          <span className="whitespace-nowrap">Rows per page</span>
          <Select
            className={cn(
              "w-24",
              isExpenseVariant ? "h-9 rounded-xl bg-[rgb(var(--card)/0.82)] shadow-none" : "h-10 rounded-2xl",
            )}
            value={String(pagination.pageSize)}
            onChange={(event) => {
              const nextPageSize = Number.parseInt(event.target.value, 10);
              const nextHref = buildDashboardPaginationHref(currentPath, currentFilters, {
                page: 1,
                pageSize: nextPageSize,
              });

              navigateToPagination(nextHref, "Updating page size...");
            }}
          >
            {DASHBOARD_PAGE_SIZE_OPTIONS.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          className={cn(isExpenseVariant ? "h-9 rounded-xl px-3.5 shadow-none" : "h-10 rounded-2xl px-3")}
          disabled={pagination.page <= 1}
          onClick={() =>
            navigateToPagination(
              buildDashboardPaginationHref(currentPath, currentFilters, {
                page: pagination.page - 1,
              }),
              "Loading previous page...",
            )
          }
          title="Previous page"
        >
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
          Previous
        </Button>

        {hasMultiplePages && !isExpenseVariant ? (
          <div className="flex flex-wrap items-center gap-2">
            {visiblePageNumbers.map((pageNumber, index) => {
              const previousPageNumber = visiblePageNumbers[index - 1];
              const shouldShowEllipsis = previousPageNumber !== undefined && pageNumber - previousPageNumber > 1;

              return (
                <div key={pageNumber} className="flex items-center gap-2">
                  {shouldShowEllipsis ? (
                    <span className="px-1 text-sm text-[rgb(var(--muted-foreground))]" aria-hidden="true">
                      ...
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant={pageNumber === pagination.page ? "primary" : "secondary"}
                    className="h-10 min-w-10 rounded-2xl px-3"
                    onClick={() =>
                      navigateToPagination(
                        buildDashboardPaginationHref(currentPath, currentFilters, {
                          page: pageNumber,
                        }),
                        `Loading page ${pageNumber}...`,
                      )
                    }
                    aria-current={pageNumber === pagination.page ? "page" : undefined}
                    title={pageNumber === pagination.page ? `Current page, ${pageNumber}` : `Go to page ${pageNumber}`}
                  >
                    {pageNumber}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}

        {isExpenseVariant ? (
          <div className="inline-flex items-center rounded-full border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.82)] px-3 py-1.5 text-sm font-medium text-[rgb(var(--foreground)/0.78)] shadow-[0_14px_28px_-24px_rgb(var(--shadow)/0.12)] backdrop-blur-lg">
            Page <span className="mx-1 font-semibold text-[rgb(var(--card-foreground))]">{pagination.page}</span> of{" "}
            <span className="ml-1 font-semibold text-[rgb(var(--card-foreground))]">{pagination.totalPages}</span>
          </div>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className={cn(isExpenseVariant ? "h-9 rounded-xl px-3.5 shadow-none" : "h-10 rounded-2xl px-3")}
          disabled={pagination.page >= pagination.totalPages}
          onClick={() =>
            navigateToPagination(
              buildDashboardPaginationHref(currentPath, currentFilters, {
                page: pagination.page + 1,
              }),
              "Loading next page...",
            )
          }
          title="Next page"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
        </Button>
      </div>
    </div>
  );
}
