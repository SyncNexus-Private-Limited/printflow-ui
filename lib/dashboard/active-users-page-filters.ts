import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  DASHBOARD_PAGE_SIZE_OPTIONS,
  normalizeDashboardSearchParam,
} from "@/lib/dashboard/page-filters";

export const activeUserSortValues = [
  "last-seen-desc",
  "last-seen-asc",
  "session-created-desc",
  "session-created-asc",
  "name-asc",
  "name-desc",
  "role-asc",
  "role-desc",
] as const;

export type ActiveUserSortValue = (typeof activeUserSortValues)[number];

const DEFAULT_ACTIVE_USER_SORT: ActiveUserSortValue = "last-seen-desc";

export type ActiveUserPageFilterState = {
  branchId: string | null;
  page: number;
  pageSize: number;
  sort: ActiveUserSortValue;
  role: string | null;
};

function isValidActiveUserSortValue(value: string | undefined): value is ActiveUserSortValue {
  return activeUserSortValues.includes(value as ActiveUserSortValue);
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseActiveUserPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): ActiveUserPageFilterState {
  const branchId = normalizeDashboardSearchParam(searchParams?.branchId) ?? null;
  const sortValue = normalizeDashboardSearchParam(searchParams?.sort);
  const parsedPage = parsePositiveInteger(normalizeDashboardSearchParam(searchParams?.page));
  const parsedPageSize = parsePositiveInteger(normalizeDashboardSearchParam(searchParams?.pageSize));
  const pageSize =
    parsedPageSize && DASHBOARD_PAGE_SIZE_OPTIONS.includes(parsedPageSize as (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number])
      ? parsedPageSize
      : DEFAULT_DASHBOARD_PAGE_SIZE;

  const roleValue = normalizeDashboardSearchParam(searchParams?.role);
  const role = roleValue && roleValue.trim().length > 0 ? roleValue.trim() : null;

  return {
    branchId,
    page: parsedPage ?? DEFAULT_DASHBOARD_PAGE,
    pageSize,
    sort: isValidActiveUserSortValue(sortValue) ? sortValue : DEFAULT_ACTIVE_USER_SORT,
    role,
  };
}

export function buildActiveUsersPageHref(
  path: string,
  filters: ActiveUserPageFilterState,
  overrides?: Partial<ActiveUserPageFilterState>,
): string {
  const nextFilters = { ...filters, ...overrides };
  const searchParams = new URLSearchParams();

  if (nextFilters.branchId) {
    searchParams.set("branchId", nextFilters.branchId);
  }

  if (nextFilters.page > DEFAULT_DASHBOARD_PAGE) {
    searchParams.set("page", String(nextFilters.page));
  }

  if (nextFilters.pageSize !== DEFAULT_DASHBOARD_PAGE_SIZE) {
    searchParams.set("pageSize", String(nextFilters.pageSize));
  }

  if (nextFilters.sort !== DEFAULT_ACTIVE_USER_SORT) {
    searchParams.set("sort", nextFilters.sort);
  }

  if (nextFilters.role) {
    searchParams.set("role", nextFilters.role);
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildActiveUsersPaginationHref(
  path: string,
  filters: ActiveUserPageFilterState,
  pagination: { page?: number; pageSize?: number },
): string {
  return buildActiveUsersPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
