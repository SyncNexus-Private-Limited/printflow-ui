import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  DASHBOARD_PAGE_SIZE_OPTIONS,
  normalizeDashboardSearchParam,
} from "@/lib/dashboard/page-filters";

export const expenseCategoryScopeValues = ["branch", "employee", "both"] as const;
export const expenseCategoryStatusValues = ["all", "active", "inactive"] as const;
export const expenseCategorySortFieldValues = [
  "code",
  "name",
  "scope",
  "status",
  "sort-order",
  "updated-at",
] as const;
export const expenseCategorySortDirectionValues = ["asc", "desc"] as const;

export type ExpenseCategoryScope = (typeof expenseCategoryScopeValues)[number];
export type ExpenseCategoryStatusFilter = (typeof expenseCategoryStatusValues)[number];
export type ExpenseCategorySortField = (typeof expenseCategorySortFieldValues)[number];
export type ExpenseCategorySortDirection = (typeof expenseCategorySortDirectionValues)[number];

export type ExpenseCategoriesPageFilterState = {
  branchId: string | null;
  page: number;
  pageSize: number;
  search: string | null;
  scope: ExpenseCategoryScope | null;
  status: ExpenseCategoryStatusFilter;
  createdFrom: string | null;
  createdTo: string | null;
  updatedFrom: string | null;
  updatedTo: string | null;
  sortField: ExpenseCategorySortField;
  sortDirection: ExpenseCategorySortDirection;
};

const DEFAULT_SORT_FIELD: ExpenseCategorySortField = "sort-order";
const DEFAULT_SORT_DIRECTION: ExpenseCategorySortDirection = "asc";

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isValidDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function normalizeDateRange(from: string | null, to: string | null) {
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

function normalizeSearch(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function isScope(value: string | undefined): value is ExpenseCategoryScope {
  return expenseCategoryScopeValues.includes(value as ExpenseCategoryScope);
}

function isStatus(value: string | undefined): value is ExpenseCategoryStatusFilter {
  return expenseCategoryStatusValues.includes(value as ExpenseCategoryStatusFilter);
}

function isSortField(value: string | undefined): value is ExpenseCategorySortField {
  return expenseCategorySortFieldValues.includes(value as ExpenseCategorySortField);
}

function isSortDirection(value: string | undefined): value is ExpenseCategorySortDirection {
  return expenseCategorySortDirectionValues.includes(value as ExpenseCategorySortDirection);
}

export function parseExpenseCategoriesPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): ExpenseCategoriesPageFilterState {
  const parsedPage = parsePositiveInt(normalizeDashboardSearchParam(searchParams?.page));
  const parsedPageSize = parsePositiveInt(normalizeDashboardSearchParam(searchParams?.pageSize));
  const pageSize =
    parsedPageSize &&
    DASHBOARD_PAGE_SIZE_OPTIONS.includes(
      parsedPageSize as (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number],
    )
      ? parsedPageSize
      : DEFAULT_DASHBOARD_PAGE_SIZE;
  const createdRange = normalizeDateRange(
    isValidDate(normalizeDashboardSearchParam(searchParams?.createdFrom))
      ? normalizeDashboardSearchParam(searchParams?.createdFrom)!
      : null,
    isValidDate(normalizeDashboardSearchParam(searchParams?.createdTo))
      ? normalizeDashboardSearchParam(searchParams?.createdTo)!
      : null,
  );
  const updatedRange = normalizeDateRange(
    isValidDate(normalizeDashboardSearchParam(searchParams?.updatedFrom))
      ? normalizeDashboardSearchParam(searchParams?.updatedFrom)!
      : null,
    isValidDate(normalizeDashboardSearchParam(searchParams?.updatedTo))
      ? normalizeDashboardSearchParam(searchParams?.updatedTo)!
      : null,
  );
  const scope = normalizeDashboardSearchParam(searchParams?.scope);
  const status = normalizeDashboardSearchParam(searchParams?.status);
  const sortField = normalizeDashboardSearchParam(searchParams?.sortField);
  const sortDirection = normalizeDashboardSearchParam(searchParams?.sortDirection);

  return {
    branchId: null,
    page: parsedPage ?? DEFAULT_DASHBOARD_PAGE,
    pageSize,
    search: normalizeSearch(normalizeDashboardSearchParam(searchParams?.search)),
    scope: isScope(scope) ? scope : null,
    status: isStatus(status) ? status : "all",
    createdFrom: createdRange.from,
    createdTo: createdRange.to,
    updatedFrom: updatedRange.from,
    updatedTo: updatedRange.to,
    sortField: isSortField(sortField) ? sortField : DEFAULT_SORT_FIELD,
    sortDirection: isSortDirection(sortDirection) ? sortDirection : DEFAULT_SORT_DIRECTION,
  };
}

export function buildExpenseCategoriesPageHref(
  path: string,
  filters: ExpenseCategoriesPageFilterState,
  overrides?: Partial<ExpenseCategoriesPageFilterState>,
) {
  const next = { ...filters, ...overrides };
  const createdRange = normalizeDateRange(next.createdFrom, next.createdTo);
  const updatedRange = normalizeDateRange(next.updatedFrom, next.updatedTo);
  const searchParams = new URLSearchParams();

  if (next.page > DEFAULT_DASHBOARD_PAGE) searchParams.set("page", String(next.page));
  if (next.pageSize !== DEFAULT_DASHBOARD_PAGE_SIZE)
    searchParams.set("pageSize", String(next.pageSize));
  if (next.search) searchParams.set("search", next.search);
  if (next.scope) searchParams.set("scope", next.scope);
  if (next.status !== "all") searchParams.set("status", next.status);
  if (createdRange.from) searchParams.set("createdFrom", createdRange.from);
  if (createdRange.to) searchParams.set("createdTo", createdRange.to);
  if (updatedRange.from) searchParams.set("updatedFrom", updatedRange.from);
  if (updatedRange.to) searchParams.set("updatedTo", updatedRange.to);
  if (next.sortField !== DEFAULT_SORT_FIELD) searchParams.set("sortField", next.sortField);
  if (next.sortDirection !== DEFAULT_SORT_DIRECTION)
    searchParams.set("sortDirection", next.sortDirection);

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildExpenseCategoriesPaginationHref(
  path: string,
  filters: ExpenseCategoriesPageFilterState,
  pagination: { page?: number; pageSize?: number },
) {
  return buildExpenseCategoriesPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
