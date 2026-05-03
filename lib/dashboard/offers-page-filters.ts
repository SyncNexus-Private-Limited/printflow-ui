import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  DASHBOARD_PAGE_SIZE_OPTIONS,
  normalizeDashboardSearchParam,
} from "@/lib/dashboard/page-filters";

export const offerStatusValues = ["all", "active", "inactive"] as const;
export const offerTypeFilterValues = ["all", "percentage", "flat", "buy_x_get_y"] as const;
export const offerTimingValues = ["all", "current", "upcoming", "expired"] as const;
export const offerSortFieldValues = [
  "code",
  "name",
  "type",
  "status",
  "starts-at",
  "ends-at",
  "updated-at",
] as const;
export const offerSortDirectionValues = ["asc", "desc"] as const;

export type OfferStatusFilter = (typeof offerStatusValues)[number];
export type OfferTypeFilter = (typeof offerTypeFilterValues)[number];
export type OfferTimingFilter = (typeof offerTimingValues)[number];
export type OfferSortField = (typeof offerSortFieldValues)[number];
export type OfferSortDirection = (typeof offerSortDirectionValues)[number];

export type OffersPageFilterState = {
  branchId: string | null;
  page: number;
  pageSize: number;
  search: string | null;
  status: OfferStatusFilter;
  offerType: OfferTypeFilter;
  timing: OfferTimingFilter;
  startsFrom: string | null;
  startsTo: string | null;
  sortField: OfferSortField;
  sortDirection: OfferSortDirection;
};

const DEFAULT_SORT_FIELD: OfferSortField = "updated-at";
const DEFAULT_SORT_DIRECTION: OfferSortDirection = "desc";

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

function isStatus(value: string | undefined): value is OfferStatusFilter {
  return offerStatusValues.includes(value as OfferStatusFilter);
}

function isOfferType(value: string | undefined): value is OfferTypeFilter {
  return offerTypeFilterValues.includes(value as OfferTypeFilter);
}

function isTiming(value: string | undefined): value is OfferTimingFilter {
  return offerTimingValues.includes(value as OfferTimingFilter);
}

function isSortField(value: string | undefined): value is OfferSortField {
  return offerSortFieldValues.includes(value as OfferSortField);
}

function isSortDirection(value: string | undefined): value is OfferSortDirection {
  return offerSortDirectionValues.includes(value as OfferSortDirection);
}

export function parseOffersPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): OffersPageFilterState {
  const parsedPage = parsePositiveInt(normalizeDashboardSearchParam(searchParams?.page));
  const parsedPageSize = parsePositiveInt(normalizeDashboardSearchParam(searchParams?.pageSize));
  const pageSize =
    parsedPageSize &&
    DASHBOARD_PAGE_SIZE_OPTIONS.includes(
      parsedPageSize as (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number],
    )
      ? parsedPageSize
      : DEFAULT_DASHBOARD_PAGE_SIZE;
  const startsRange = normalizeDateRange(
    isValidDate(normalizeDashboardSearchParam(searchParams?.startsFrom))
      ? normalizeDashboardSearchParam(searchParams?.startsFrom)!
      : null,
    isValidDate(normalizeDashboardSearchParam(searchParams?.startsTo))
      ? normalizeDashboardSearchParam(searchParams?.startsTo)!
      : null,
  );
  const status = normalizeDashboardSearchParam(searchParams?.status);
  const offerType = normalizeDashboardSearchParam(searchParams?.offerType);
  const timing = normalizeDashboardSearchParam(searchParams?.timing);
  const sortField = normalizeDashboardSearchParam(searchParams?.sortField);
  const sortDirection = normalizeDashboardSearchParam(searchParams?.sortDirection);

  return {
    branchId: normalizeDashboardSearchParam(searchParams?.branchId) ?? null,
    page: parsedPage ?? DEFAULT_DASHBOARD_PAGE,
    pageSize,
    search: normalizeSearch(normalizeDashboardSearchParam(searchParams?.search)),
    status: isStatus(status) ? status : "all",
    offerType: isOfferType(offerType) ? offerType : "all",
    timing: isTiming(timing) ? timing : "all",
    startsFrom: startsRange.from,
    startsTo: startsRange.to,
    sortField: isSortField(sortField) ? sortField : DEFAULT_SORT_FIELD,
    sortDirection: isSortDirection(sortDirection) ? sortDirection : DEFAULT_SORT_DIRECTION,
  };
}

export function buildOffersPageHref(
  path: string,
  filters: OffersPageFilterState,
  overrides?: Partial<OffersPageFilterState>,
) {
  const next = { ...filters, ...overrides };
  const startsRange = normalizeDateRange(next.startsFrom, next.startsTo);
  const searchParams = new URLSearchParams();

  if (next.branchId && next.branchId !== "all") searchParams.set("branchId", next.branchId);
  if (next.page > DEFAULT_DASHBOARD_PAGE) searchParams.set("page", String(next.page));
  if (next.pageSize !== DEFAULT_DASHBOARD_PAGE_SIZE)
    searchParams.set("pageSize", String(next.pageSize));
  if (next.search) searchParams.set("search", next.search);
  if (next.status !== "all") searchParams.set("status", next.status);
  if (next.offerType !== "all") searchParams.set("offerType", next.offerType);
  if (next.timing !== "all") searchParams.set("timing", next.timing);
  if (startsRange.from) searchParams.set("startsFrom", startsRange.from);
  if (startsRange.to) searchParams.set("startsTo", startsRange.to);
  if (next.sortField !== DEFAULT_SORT_FIELD) searchParams.set("sortField", next.sortField);
  if (next.sortDirection !== DEFAULT_SORT_DIRECTION)
    searchParams.set("sortDirection", next.sortDirection);

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildOffersPaginationHref(
  path: string,
  filters: OffersPageFilterState,
  pagination: { page?: number; pageSize?: number },
) {
  return buildOffersPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
