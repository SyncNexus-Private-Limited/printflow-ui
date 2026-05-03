import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  getCurrentMonthDashboardDateRange,
  normalizeDashboardSearchParam,
} from "@/lib/dashboard/page-filters";

export const branchStatusValues = ["all", "active", "inactive"] as const;
export const branchSortFieldValues = [
  "code",
  "name",
  "phone",
  "email",
  "status",
  "created-at",
  "updated-at",
] as const;
export const branchSortDirectionValues = ["asc", "desc"] as const;

export type BranchStatusFilter = (typeof branchStatusValues)[number];
export type BranchSortField = (typeof branchSortFieldValues)[number];
export type BranchSortDirection = (typeof branchSortDirectionValues)[number];

export type BranchesPageFilterState = {
  branchId: string | null;
  page: number;
  pageSize: number;
  search: string | null;
  status: BranchStatusFilter;
  createdFrom: string | null;
  createdTo: string | null;
  updatedFrom: string | null;
  updatedTo: string | null;
  sortField: BranchSortField;
  sortDirection: BranchSortDirection;
};

const DEFAULT_SORT_FIELD: BranchSortField = "updated-at";
const DEFAULT_SORT_DIRECTION: BranchSortDirection = "desc";

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

function isStatus(value: string | undefined): value is BranchStatusFilter {
  return branchStatusValues.includes(value as BranchStatusFilter);
}

function isSortField(value: string | undefined): value is BranchSortField {
  return branchSortFieldValues.includes(value as BranchSortField);
}

function isSortDirection(value: string | undefined): value is BranchSortDirection {
  return branchSortDirectionValues.includes(value as BranchSortDirection);
}

export function parseBranchesPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): BranchesPageFilterState {
  const parsedPage = parsePositiveInt(normalizeDashboardSearchParam(searchParams?.page));
  const parsedPageSize = parsePositiveInt(normalizeDashboardSearchParam(searchParams?.pageSize));
  const pageSize =
    parsedPageSize &&
    DASHBOARD_PAGE_SIZE_OPTIONS.includes(
      parsedPageSize as (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number],
    )
      ? parsedPageSize
      : DEFAULT_DASHBOARD_PAGE_SIZE;
  const currentMonth = getCurrentMonthDashboardDateRange();
  const createdRange = normalizeDateRange(
    isValidDate(normalizeDashboardSearchParam(searchParams?.createdFrom))
      ? normalizeDashboardSearchParam(searchParams?.createdFrom)!
      : currentMonth.from,
    isValidDate(normalizeDashboardSearchParam(searchParams?.createdTo))
      ? normalizeDashboardSearchParam(searchParams?.createdTo)!
      : currentMonth.to,
  );
  const updatedRange = normalizeDateRange(
    isValidDate(normalizeDashboardSearchParam(searchParams?.updatedFrom))
      ? normalizeDashboardSearchParam(searchParams?.updatedFrom)!
      : null,
    isValidDate(normalizeDashboardSearchParam(searchParams?.updatedTo))
      ? normalizeDashboardSearchParam(searchParams?.updatedTo)!
      : null,
  );
  const status = normalizeDashboardSearchParam(searchParams?.status);
  const sortField = normalizeDashboardSearchParam(searchParams?.sortField);
  const sortDirection = normalizeDashboardSearchParam(searchParams?.sortDirection);

  return {
    branchId: null,
    page: parsedPage ?? DEFAULT_DASHBOARD_PAGE,
    pageSize,
    search: normalizeSearch(normalizeDashboardSearchParam(searchParams?.search)),
    status: isStatus(status) ? status : "all",
    createdFrom: createdRange.from,
    createdTo: createdRange.to,
    updatedFrom: updatedRange.from,
    updatedTo: updatedRange.to,
    sortField: isSortField(sortField) ? sortField : DEFAULT_SORT_FIELD,
    sortDirection: isSortDirection(sortDirection) ? sortDirection : DEFAULT_SORT_DIRECTION,
  };
}

export function buildBranchesPageHref(
  path: string,
  filters: BranchesPageFilterState,
  overrides?: Partial<BranchesPageFilterState>,
) {
  const next = { ...filters, ...overrides };
  const createdRange = normalizeDateRange(next.createdFrom, next.createdTo);
  const updatedRange = normalizeDateRange(next.updatedFrom, next.updatedTo);
  const searchParams = new URLSearchParams();

  if (next.page > DEFAULT_DASHBOARD_PAGE) searchParams.set("page", String(next.page));
  if (next.pageSize !== DEFAULT_DASHBOARD_PAGE_SIZE)
    searchParams.set("pageSize", String(next.pageSize));
  if (next.search) searchParams.set("search", next.search);
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

export function buildBranchesPaginationHref(
  path: string,
  filters: BranchesPageFilterState,
  pagination: { page?: number; pageSize?: number },
) {
  return buildBranchesPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
