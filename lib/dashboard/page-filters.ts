import type { DashboardDateRange, DashboardPageFilterState } from "@/lib/dashboard/types";

export const DEFAULT_DASHBOARD_PAGE = 1;
export const DEFAULT_DASHBOARD_PAGE_SIZE = 10;
export const DASHBOARD_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const FILTER_AWARE_DASHBOARD_PATHS = [
  "/dashboard/orders",
  "/dashboard/customers",
  "/dashboard/employee-expenses",
  "/dashboard/business-expenses",
  "/dashboard/inventory",
] as const;

type DashboardSearchParam = string | string[] | undefined;
type DashboardNavigationFilterState = Pick<DashboardPageFilterState, "branchId" | "from" | "to" | "pageSize">;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInputValue(value: Date) {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
}

function getMonthDateRangeForDate(value: Date): DashboardDateRange {
  return {
    from: formatDateInputValue(new Date(value.getFullYear(), value.getMonth(), 1)),
    to: formatDateInputValue(new Date(value.getFullYear(), value.getMonth() + 1, 0)),
  };
}

function getMonthDateRangeForValue(value: string) {
  const parsedDate = new Date(`${value}T00:00:00`);

  return getMonthDateRangeForDate(parsedDate);
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);

  return !Number.isNaN(timestamp);
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return parsedValue;
}

function normalizeDateRange(from: string | null, to: string | null): DashboardDateRange {
  if (!from && !to) {
    return getCurrentMonthDashboardDateRange();
  }

  if (from && !to) {
    return normalizeDateRange(from, getMonthDateRangeForValue(from).to);
  }

  if (!from && to) {
    return normalizeDateRange(getMonthDateRangeForValue(to).from, to);
  }

  if (from && to && from > to) {
    return {
      from: to,
      to: from,
    };
  }

  return {
    from,
    to,
  };
}

function normalizeExplicitDateRange(from: string | null, to: string | null): DashboardDateRange {
  if (from && to && from > to) {
    return {
      from: to,
      to: from,
    };
  }

  return {
    from,
    to,
  };
}

export function normalizeDashboardSearchParam(value: DashboardSearchParam) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getCurrentMonthDashboardDateRange(referenceDate = new Date()) {
  return getMonthDateRangeForDate(referenceDate);
}

export function isCurrentMonthDashboardDateRange(dateRange: DashboardDateRange, referenceDate = new Date()) {
  const currentMonth = getCurrentMonthDashboardDateRange(referenceDate);

  return dateRange.from === currentMonth.from && dateRange.to === currentMonth.to;
}

export function isDashboardFilterAwarePath(path: string) {
  const normalizedPath = path.split("?")[0];

  return FILTER_AWARE_DASHBOARD_PATHS.includes(normalizedPath as (typeof FILTER_AWARE_DASHBOARD_PATHS)[number]);
}

export function parseDashboardPageFilters(searchParams?: {
  branchId?: DashboardSearchParam;
  from?: DashboardSearchParam;
  to?: DashboardSearchParam;
  page?: DashboardSearchParam;
  pageSize?: DashboardSearchParam;
}): DashboardPageFilterState {
  const branchId = normalizeDashboardSearchParam(searchParams?.branchId) ?? null;
  const fromValue = normalizeDashboardSearchParam(searchParams?.from);
  const toValue = normalizeDashboardSearchParam(searchParams?.to);
  const normalizedDateRange = normalizeDateRange(
    fromValue && isValidDateInput(fromValue) ? fromValue : null,
    toValue && isValidDateInput(toValue) ? toValue : null,
  );
  const parsedPage = parsePositiveInteger(normalizeDashboardSearchParam(searchParams?.page));
  const parsedPageSize = parsePositiveInteger(normalizeDashboardSearchParam(searchParams?.pageSize));
  const pageSize =
    parsedPageSize && DASHBOARD_PAGE_SIZE_OPTIONS.includes(parsedPageSize as (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number])
      ? parsedPageSize
      : DEFAULT_DASHBOARD_PAGE_SIZE;

  return {
    branchId,
    from: normalizedDateRange.from,
    to: normalizedDateRange.to,
    page: parsedPage ?? DEFAULT_DASHBOARD_PAGE,
    pageSize,
  };
}

export function getDashboardNavigationFilterState(searchParams?: {
  branchId?: DashboardSearchParam;
  from?: DashboardSearchParam;
  to?: DashboardSearchParam;
  pageSize?: DashboardSearchParam;
}, options?: { applyDefaultDateRange?: boolean }): DashboardNavigationFilterState {
  if (options?.applyDefaultDateRange) {
    const filters = parseDashboardPageFilters({
      branchId: searchParams?.branchId,
      from: searchParams?.from,
      to: searchParams?.to,
      pageSize: searchParams?.pageSize,
    });

    return {
      branchId: filters.branchId,
      from: filters.from,
      to: filters.to,
      pageSize: filters.pageSize,
    };
  }

  const branchId = normalizeDashboardSearchParam(searchParams?.branchId) ?? null;
  const fromValue = normalizeDashboardSearchParam(searchParams?.from);
  const toValue = normalizeDashboardSearchParam(searchParams?.to);
  const normalizedDateRange = normalizeExplicitDateRange(
    fromValue && isValidDateInput(fromValue) ? fromValue : null,
    toValue && isValidDateInput(toValue) ? toValue : null,
  );
  const parsedPageSize = parsePositiveInteger(normalizeDashboardSearchParam(searchParams?.pageSize));
  const pageSize =
    parsedPageSize && DASHBOARD_PAGE_SIZE_OPTIONS.includes(parsedPageSize as (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number])
      ? parsedPageSize
      : DEFAULT_DASHBOARD_PAGE_SIZE;

  return {
    branchId,
    from: normalizedDateRange.from,
    to: normalizedDateRange.to,
    pageSize,
  };
}

export function buildDashboardPageHref(
  path: string,
  filters: DashboardPageFilterState,
  overrides?: Partial<DashboardPageFilterState>,
) {
  const nextFilters = {
    ...filters,
    ...overrides,
  };
  const searchParams = new URLSearchParams();

  if (nextFilters.branchId) {
    searchParams.set("branchId", nextFilters.branchId);
  }

  if (nextFilters.from) {
    searchParams.set("from", nextFilters.from);
  }

  if (nextFilters.to) {
    searchParams.set("to", nextFilters.to);
  }

  if (nextFilters.page > DEFAULT_DASHBOARD_PAGE) {
    searchParams.set("page", String(nextFilters.page));
  }

  if (nextFilters.pageSize !== DEFAULT_DASHBOARD_PAGE_SIZE) {
    searchParams.set("pageSize", String(nextFilters.pageSize));
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildDashboardNavigationHref(path: string, filters: DashboardNavigationFilterState) {
  const searchParams = new URLSearchParams();

  if (filters.branchId) {
    searchParams.set("branchId", filters.branchId);
  }

  if (isDashboardFilterAwarePath(path)) {
    if (filters.from) {
      searchParams.set("from", filters.from);
    }

    if (filters.to) {
      searchParams.set("to", filters.to);
    }

    if (filters.pageSize !== DEFAULT_DASHBOARD_PAGE_SIZE) {
      searchParams.set("pageSize", String(filters.pageSize));
    }
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildDashboardDateRangeHref(
  path: string,
  filters: DashboardPageFilterState,
  dateRange: DashboardDateRange,
) {
  return buildDashboardPageHref(path, filters, {
    from: dateRange.from,
    to: dateRange.to,
    page: DEFAULT_DASHBOARD_PAGE,
  });
}

export function buildDashboardPaginationHref(
  path: string,
  filters: DashboardPageFilterState,
  pagination: {
    page?: number;
    pageSize?: number;
  },
) {
  return buildDashboardPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
