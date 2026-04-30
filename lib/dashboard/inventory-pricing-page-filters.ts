import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  DASHBOARD_PAGE_SIZE_OPTIONS,
  normalizeDashboardSearchParam,
} from "@/lib/dashboard/page-filters";
import type { DashboardDateRange, DashboardPageFilterState } from "@/lib/dashboard/types";

export const PRICE_EXPIRING_SOON_DAYS = 7;

const customerTypeValues = ["studio", "amateur", "other", "employee"] as const;
const pricingStatusValues = ["all", "current", "upcoming", "expired", "expiring-soon"] as const;
const inventoryPricingSortValues = [
  "item-asc",
  "item-desc",
  "sku-asc",
  "sku-desc",
  "branch-asc",
  "branch-desc",
  "customer-type-asc",
  "customer-type-desc",
  "selling-rate-asc",
  "selling-rate-desc",
  "effective-from-asc",
  "effective-from-desc",
  "effective-to-asc",
  "effective-to-desc",
  "status-asc",
  "status-desc",
  "updated-at-asc",
  "updated-at-desc",
] as const;

export type InventoryPricingCustomerType = (typeof customerTypeValues)[number];
export type InventoryPricingStatus = Exclude<(typeof pricingStatusValues)[number], "all">;
export type InventoryPricingStatusFilter = (typeof pricingStatusValues)[number];
export type InventoryPricingSortValue = (typeof inventoryPricingSortValues)[number];

export type InventoryPricingPageFilterState = DashboardPageFilterState & {
  itemName: string | null;
  sku: string | null;
  customerType: InventoryPricingCustomerType | null;
  status: InventoryPricingStatusFilter;
  sort: InventoryPricingSortValue;
};

const DEFAULT_INVENTORY_PRICING_SORT: InventoryPricingSortValue = "updated-at-desc";

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeDateRange(from: string | null, to: string | null): DashboardDateRange {
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

function normalizeTextSearch(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function isCustomerType(value: string | undefined): value is InventoryPricingCustomerType {
  return customerTypeValues.includes(value as InventoryPricingCustomerType);
}

function isPricingStatus(value: string | undefined): value is InventoryPricingStatusFilter {
  return pricingStatusValues.includes(value as InventoryPricingStatusFilter);
}

function isSortValue(value: string | undefined): value is InventoryPricingSortValue {
  return inventoryPricingSortValues.includes(value as InventoryPricingSortValue);
}

export function parseInventoryPricingPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): InventoryPricingPageFilterState {
  const branchId = normalizeDashboardSearchParam(searchParams?.branchId) ?? null;
  const parsedPage = parsePositiveInt(normalizeDashboardSearchParam(searchParams?.page));
  const parsedPageSize = parsePositiveInt(normalizeDashboardSearchParam(searchParams?.pageSize));
  const pageSize =
    parsedPageSize &&
    DASHBOARD_PAGE_SIZE_OPTIONS.includes(
      parsedPageSize as (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number],
    )
      ? parsedPageSize
      : DEFAULT_DASHBOARD_PAGE_SIZE;
  const fromRaw = normalizeDashboardSearchParam(searchParams?.from);
  const toRaw = normalizeDashboardSearchParam(searchParams?.to);
  const dateRange = normalizeDateRange(
    fromRaw && isValidDateInput(fromRaw) ? fromRaw : null,
    toRaw && isValidDateInput(toRaw) ? toRaw : null,
  );
  const customerType = normalizeDashboardSearchParam(searchParams?.customerType);
  const status = normalizeDashboardSearchParam(searchParams?.status);
  const sort = normalizeDashboardSearchParam(searchParams?.sort);

  return {
    branchId,
    from: dateRange.from,
    to: dateRange.to,
    page: parsedPage ?? DEFAULT_DASHBOARD_PAGE,
    pageSize,
    itemName: normalizeTextSearch(normalizeDashboardSearchParam(searchParams?.itemName)),
    sku: normalizeTextSearch(normalizeDashboardSearchParam(searchParams?.sku)),
    customerType: isCustomerType(customerType) ? customerType : null,
    status: isPricingStatus(status) ? status : "all",
    sort: isSortValue(sort) ? sort : DEFAULT_INVENTORY_PRICING_SORT,
  };
}

export function buildInventoryPricingPageHref(
  path: string,
  filters: InventoryPricingPageFilterState,
  overrides?: Partial<InventoryPricingPageFilterState>,
): string {
  const nextFilters = { ...filters, ...overrides };
  const dateRange = normalizeDateRange(nextFilters.from, nextFilters.to);
  const searchParams = new URLSearchParams();

  if (nextFilters.branchId) searchParams.set("branchId", nextFilters.branchId);
  if (dateRange.from) searchParams.set("from", dateRange.from);
  if (dateRange.to) searchParams.set("to", dateRange.to);
  if (nextFilters.page > DEFAULT_DASHBOARD_PAGE) searchParams.set("page", String(nextFilters.page));
  if (nextFilters.pageSize !== DEFAULT_DASHBOARD_PAGE_SIZE) {
    searchParams.set("pageSize", String(nextFilters.pageSize));
  }
  if (nextFilters.itemName) searchParams.set("itemName", nextFilters.itemName);
  if (nextFilters.sku) searchParams.set("sku", nextFilters.sku);
  if (nextFilters.customerType) searchParams.set("customerType", nextFilters.customerType);
  if (nextFilters.status !== "all") searchParams.set("status", nextFilters.status);
  if (nextFilters.sort !== DEFAULT_INVENTORY_PRICING_SORT) {
    searchParams.set("sort", nextFilters.sort);
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildInventoryPricingPaginationHref(
  path: string,
  filters: InventoryPricingPageFilterState,
  pagination: { page?: number; pageSize?: number },
): string {
  return buildInventoryPricingPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
