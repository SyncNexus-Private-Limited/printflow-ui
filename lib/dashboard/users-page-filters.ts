import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  DASHBOARD_PAGE_SIZE_OPTIONS,
  normalizeDashboardSearchParam,
} from "@/lib/dashboard/page-filters";

export const userManagementSortValues = [
  "name-asc",
  "name-desc",
  "role-asc",
  "role-desc",
  "created-desc",
  "created-asc",
] as const;

export type UserManagementSortValue = (typeof userManagementSortValues)[number];

const DEFAULT_USER_MANAGEMENT_SORT: UserManagementSortValue = "name-asc";

export type UserManagementStatusFilter = "all" | "active" | "inactive";
export type UserManagementLockedFilter = "all" | "locked" | "unlocked";

export type UserManagementPageFilterState = {
  branchId: string | null;
  page: number;
  pageSize: number;
  sort: UserManagementSortValue;
  role: string | null;
  status: UserManagementStatusFilter;
  locked: UserManagementLockedFilter;
  name: string | null;
  username: string | null;
};

function isValidSortValue(value: string | undefined): value is UserManagementSortValue {
  return userManagementSortValues.includes(value as UserManagementSortValue);
}

function isValidStatusFilter(value: string | undefined): value is UserManagementStatusFilter {
  return value === "all" || value === "active" || value === "inactive";
}

function isValidLockedFilter(value: string | undefined): value is UserManagementLockedFilter {
  return value === "all" || value === "locked" || value === "unlocked";
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeSearchString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function parseUsersPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): UserManagementPageFilterState {
  const branchId = normalizeDashboardSearchParam(searchParams?.branchId) ?? null;
  const sortValue = normalizeDashboardSearchParam(searchParams?.sort);
  const parsedPage = parsePositiveInteger(normalizeDashboardSearchParam(searchParams?.page));
  const parsedPageSize = parsePositiveInteger(normalizeDashboardSearchParam(searchParams?.pageSize));
  const pageSize =
    parsedPageSize &&
    DASHBOARD_PAGE_SIZE_OPTIONS.includes(parsedPageSize as (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number])
      ? parsedPageSize
      : DEFAULT_DASHBOARD_PAGE_SIZE;
  const roleValue = normalizeDashboardSearchParam(searchParams?.role);
  const role = roleValue && roleValue.trim().length > 0 ? roleValue.trim() : null;
  const statusValue = normalizeDashboardSearchParam(searchParams?.status);
  const lockedValue = normalizeDashboardSearchParam(searchParams?.locked);
  const name = normalizeSearchString(normalizeDashboardSearchParam(searchParams?.name));
  const username = normalizeSearchString(normalizeDashboardSearchParam(searchParams?.username));

  return {
    branchId,
    page: parsedPage ?? DEFAULT_DASHBOARD_PAGE,
    pageSize,
    sort: isValidSortValue(sortValue) ? sortValue : DEFAULT_USER_MANAGEMENT_SORT,
    role,
    status: isValidStatusFilter(statusValue) ? statusValue : "all",
    locked: isValidLockedFilter(lockedValue) ? lockedValue : "all",
    name,
    username,
  };
}

export function buildUsersPageHref(
  path: string,
  filters: UserManagementPageFilterState,
  overrides?: Partial<UserManagementPageFilterState>,
): string {
  const nextFilters = { ...filters, ...overrides };
  const searchParams = new URLSearchParams();

  if (nextFilters.branchId) searchParams.set("branchId", nextFilters.branchId);
  if (nextFilters.page > DEFAULT_DASHBOARD_PAGE) searchParams.set("page", String(nextFilters.page));
  if (nextFilters.pageSize !== DEFAULT_DASHBOARD_PAGE_SIZE)
    searchParams.set("pageSize", String(nextFilters.pageSize));
  if (nextFilters.sort !== DEFAULT_USER_MANAGEMENT_SORT) searchParams.set("sort", nextFilters.sort);
  if (nextFilters.role) searchParams.set("role", nextFilters.role);
  if (nextFilters.status !== "all") searchParams.set("status", nextFilters.status);
  if (nextFilters.locked !== "all") searchParams.set("locked", nextFilters.locked);
  if (nextFilters.name) searchParams.set("name", nextFilters.name);
  if (nextFilters.username) searchParams.set("username", nextFilters.username);

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildUsersPaginationHref(
  path: string,
  filters: UserManagementPageFilterState,
  pagination: { page?: number; pageSize?: number },
): string {
  return buildUsersPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
