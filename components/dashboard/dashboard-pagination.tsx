"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  buildActiveUsersPageHref,
  buildActiveUsersPaginationHref,
  type ActiveUserPageFilterState,
} from "@/lib/dashboard/active-users-page-filters";
import {
  buildCustomerPageHref,
  buildCustomerPaginationHref,
  type CustomerPageFilterState,
} from "@/lib/dashboard/customer-page-filters";
import {
  buildExpensePageHref,
  buildExpensePaginationHref,
  type ExpensePageFilterState,
} from "@/lib/dashboard/expense-page-filters";
import { isSameHref } from "@/lib/dashboard/href-utils";
import {
  buildInventoryPageHref,
  buildInventoryPaginationHref,
  type InventoryPageFilterState,
} from "@/lib/dashboard/inventory-page-filters";
import {
  buildOrderPageHref,
  buildOrderPaginationHref,
  type OrderPageFilterState,
} from "@/lib/dashboard/order-page-filters";
import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  buildDashboardPageHref,
  buildDashboardPaginationHref,
} from "@/lib/dashboard/page-filters";
import type {
  DashboardBaseFilterState,
  DashboardPageFilterState,
  DashboardPaginationState,
} from "@/lib/dashboard/types";
import {
  buildUsersPageHref,
  buildUsersPaginationHref,
  type UserManagementPageFilterState,
} from "@/lib/dashboard/users-page-filters";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

type DashboardPaginationProps<
  TFilters extends DashboardBaseFilterState = DashboardPageFilterState,
> = {
  currentPath: string;
  currentFilters: TFilters;
  pagination: DashboardPaginationState;
  variant?: "default" | "expense" | "customer" | "inventory" | "order" | "active-users" | "users";
};

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

export function DashboardPagination<
  TFilters extends DashboardBaseFilterState = DashboardPageFilterState,
>({
  currentPath,
  currentFilters,
  pagination,
  variant = "default",
}: DashboardPaginationProps<TFilters>) {
  const router = useRouter();
  const isExpenseVariant = variant === "expense";
  const isCustomerVariant = variant === "customer";
  const isInventoryVariant = variant === "inventory";
  const isOrderVariant = variant === "order";
  const isActiveUsersVariant = variant === "active-users";
  const isUsersVariant = variant === "users";
  const isInlineVariant =
    isExpenseVariant ||
    isCustomerVariant ||
    isInventoryVariant ||
    isOrderVariant ||
    isActiveUsersVariant ||
    isUsersVariant;
  const resolvePageHref = useCallback(
    (path: string, filters: TFilters) => {
      if (isExpenseVariant)
        return buildExpensePageHref(path, filters as unknown as ExpensePageFilterState);
      if (isCustomerVariant)
        return buildCustomerPageHref(path, filters as unknown as CustomerPageFilterState);
      if (isInventoryVariant)
        return buildInventoryPageHref(path, filters as unknown as InventoryPageFilterState);
      if (isOrderVariant)
        return buildOrderPageHref(path, filters as unknown as OrderPageFilterState);
      if (isActiveUsersVariant)
        return buildActiveUsersPageHref(path, filters as unknown as ActiveUserPageFilterState);
      if (isUsersVariant)
        return buildUsersPageHref(path, filters as unknown as UserManagementPageFilterState);
      return buildDashboardPageHref(path, filters as unknown as DashboardPageFilterState);
    },
    [
      isActiveUsersVariant,
      isCustomerVariant,
      isExpenseVariant,
      isInventoryVariant,
      isOrderVariant,
      isUsersVariant,
    ],
  );
  const resolvePaginationHref = (
    path: string,
    filters: TFilters,
    nextPagination: {
      page?: number;
      pageSize?: number;
    },
  ) => {
    if (isExpenseVariant)
      return buildExpensePaginationHref(
        path,
        filters as unknown as ExpensePageFilterState,
        nextPagination,
      );
    if (isCustomerVariant)
      return buildCustomerPaginationHref(
        path,
        filters as unknown as CustomerPageFilterState,
        nextPagination,
      );
    if (isInventoryVariant)
      return buildInventoryPaginationHref(
        path,
        filters as unknown as InventoryPageFilterState,
        nextPagination,
      );
    if (isOrderVariant)
      return buildOrderPaginationHref(
        path,
        filters as unknown as OrderPageFilterState,
        nextPagination,
      );
    if (isActiveUsersVariant)
      return buildActiveUsersPaginationHref(
        path,
        filters as unknown as ActiveUserPageFilterState,
        nextPagination,
      );
    if (isUsersVariant)
      return buildUsersPaginationHref(
        path,
        filters as unknown as UserManagementPageFilterState,
        nextPagination,
      );
    return buildDashboardPaginationHref(
      path,
      filters as unknown as DashboardPageFilterState,
      nextPagination,
    );
  };
  const currentHref = useMemo(
    () => resolvePageHref(currentPath, currentFilters),
    [currentFilters, currentPath, resolvePageHref],
  );
  const visiblePageNumbers = useMemo(
    () => getVisiblePageNumbers(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );
  const hasMultiplePages = pagination.totalPages > 1;

  if (pagination.totalItems === 0) {
    return null;
  }

  const startItem = (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  const navigateToPagination = (href: string) => {
    if (isSameHref(href, currentHref)) {
      return;
    }

    router.replace(href, { scroll: false });
  };

  if (isInlineVariant) {
    return (
      <div className="border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--muted)/0.42)] px-4 py-4 backdrop-blur-lg sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Showing{" "}
              <span className="font-semibold text-[rgb(var(--foreground))]">{startItem}</span>-
              <span className="font-semibold text-[rgb(var(--foreground))]">{endItem}</span> of{" "}
              <span className="font-semibold text-[rgb(var(--foreground))]">
                {pagination.totalItems}
              </span>
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
                    const nextHref = resolvePaginationHref(currentPath, currentFilters, {
                      page: 1,
                      pageSize: nextPageSize,
                    });

                    navigateToPagination(nextHref);
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
                  resolvePaginationHref(currentPath, currentFilters, {
                    page: pagination.page - 1,
                  }),
                )
              }
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              <span className="sr-only sm:not-sr-only sm:ml-1.5">Previous</span>
            </Button>

            <div className="inline-flex items-center rounded-full border border-[rgb(var(--border)/0.74)] bg-[rgb(var(--card)/0.92)] px-3.5 py-2 text-sm font-medium text-[rgb(var(--foreground)/0.76)] shadow-[0_18px_36px_-30px_rgb(var(--shadow)/0.12)]">
              Page{" "}
              <span className="mx-1.5 font-semibold text-[rgb(var(--card-foreground))]">
                {pagination.page}
              </span>{" "}
              of{" "}
              <span className="ml-1.5 font-semibold text-[rgb(var(--card-foreground))]">
                {pagination.totalPages}
              </span>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-2xl px-3 shadow-none sm:px-4"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                navigateToPagination(
                  resolvePaginationHref(currentPath, currentFilters, {
                    page: pagination.page + 1,
                  }),
                )
              }
              title="Next page"
            >
              <span className="sr-only sm:not-sr-only sm:mr-1.5">Next</span>
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
          isInlineVariant
            ? "border-t border-[rgb(var(--border)/0.68)] bg-[rgb(var(--background)/0.48)] px-5 py-3 backdrop-blur-lg"
            : "rounded-[22px] border border-[rgb(var(--border)/0.68)] bg-[rgb(var(--card)/0.9)] shadow-[0_18px_44px_-40px_rgb(var(--shadow)/0.12)] backdrop-blur-lg",
        ),
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-start">
        <p
          className={cn(
            "text-sm text-[rgb(var(--muted-foreground))]",
            isInlineVariant && "text-[13px]",
          )}
        >
          Showing <span className="font-semibold text-[rgb(var(--foreground))]">{startItem}</span>-
          <span className="font-semibold text-[rgb(var(--foreground))]">{endItem}</span> of{" "}
          <span className="font-semibold text-[rgb(var(--foreground))]">
            {pagination.totalItems}
          </span>
        </p>

        <label
          className={cn(
            "flex items-center gap-2 text-sm text-[rgb(var(--muted-foreground))]",
            isInlineVariant && "gap-2.5 text-[13px]",
          )}
        >
          <span className="whitespace-nowrap">Rows per page</span>
          <Select
            className={cn(
              "w-24",
              isInlineVariant
                ? "h-9 rounded-xl bg-[rgb(var(--card)/0.82)] shadow-none"
                : "h-10 rounded-2xl",
            )}
            value={String(pagination.pageSize)}
            onChange={(event) => {
              const nextPageSize = Number.parseInt(event.target.value, 10);
              const nextHref = resolvePaginationHref(currentPath, currentFilters, {
                page: 1,
                pageSize: nextPageSize,
              });

              navigateToPagination(nextHref);
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
          className={cn(
            isInlineVariant ? "h-9 rounded-xl px-3.5 shadow-none" : "h-10 rounded-2xl px-3",
          )}
          disabled={pagination.page <= 1}
          onClick={() =>
            navigateToPagination(
              resolvePaginationHref(currentPath, currentFilters, {
                page: pagination.page - 1,
              }),
            )
          }
          title="Previous page"
        >
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
          Previous
        </Button>

        {hasMultiplePages && !isInlineVariant ? (
          <div className="flex flex-wrap items-center gap-2">
            {visiblePageNumbers.map((pageNumber, index) => {
              const previousPageNumber = visiblePageNumbers[index - 1];
              const shouldShowEllipsis =
                previousPageNumber !== undefined && pageNumber - previousPageNumber > 1;

              return (
                <div key={pageNumber} className="flex items-center gap-2">
                  {shouldShowEllipsis ? (
                    <span
                      className="px-1 text-sm text-[rgb(var(--muted-foreground))]"
                      aria-hidden="true"
                    >
                      ...
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant={pageNumber === pagination.page ? "primary" : "secondary"}
                    className="h-10 min-w-10 rounded-2xl px-3"
                    onClick={() =>
                      navigateToPagination(
                        resolvePaginationHref(currentPath, currentFilters, {
                          page: pageNumber,
                        }),
                      )
                    }
                    aria-current={pageNumber === pagination.page ? "page" : undefined}
                    title={
                      pageNumber === pagination.page
                        ? `Current page, ${pageNumber}`
                        : `Go to page ${pageNumber}`
                    }
                  >
                    {pageNumber}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}

        {isInlineVariant ? (
          <div className="inline-flex items-center rounded-full border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.82)] px-3 py-1.5 text-sm font-medium text-[rgb(var(--foreground)/0.78)] shadow-[0_14px_28px_-24px_rgb(var(--shadow)/0.12)] backdrop-blur-lg">
            Page{" "}
            <span className="mx-1 font-semibold text-[rgb(var(--card-foreground))]">
              {pagination.page}
            </span>{" "}
            of{" "}
            <span className="ml-1 font-semibold text-[rgb(var(--card-foreground))]">
              {pagination.totalPages}
            </span>
          </div>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className={cn(
            isInlineVariant ? "h-9 rounded-xl px-3.5 shadow-none" : "h-10 rounded-2xl px-3",
          )}
          disabled={pagination.page >= pagination.totalPages}
          onClick={() =>
            navigateToPagination(
              resolvePaginationHref(currentPath, currentFilters, {
                page: pagination.page + 1,
              }),
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
