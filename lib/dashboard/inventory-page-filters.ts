import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  DASHBOARD_PAGE_SIZE_OPTIONS,
  getCurrentMonthDashboardDateRange,
  normalizeDashboardSearchParam,
} from "@/lib/dashboard/page-filters";
import type { DashboardDateRange, DashboardPageFilterState } from "@/lib/dashboard/types";

// Centralized low-stock threshold — easy to adjust in a future pass
export const INVENTORY_LOW_STOCK_THRESHOLD = 10;

const inventoryDateFieldValues = ["created", "updated"] as const;
const inventoryStockStateValues = ["in-stock", "low-stock", "out-of-stock"] as const;
const inventoryActiveValues = ["all", "active", "inactive"] as const;
const inventoryPresenceValues = ["all", "with", "without"] as const;
const inventorySortValues = [
  "name-asc",
  "name-desc",
  "sku-asc",
  "sku-desc",
  "quantity-asc",
  "quantity-desc",
  "unit-asc",
  "unit-desc",
  "active-asc",
  "active-desc",
  "purchase-rate-asc",
  "purchase-rate-desc",
  "updated-at-asc",
  "updated-at-desc",
  "created-at-asc",
  "created-at-desc",
  "vendor-asc",
  "vendor-desc",
  "stock-state-asc",
  "stock-state-desc",
] as const;

export const inventoryQuickDatePresetValues = ["this-month", "last-month", "custom"] as const;

export type InventoryDateField = (typeof inventoryDateFieldValues)[number];
export type InventoryStockState = (typeof inventoryStockStateValues)[number];
export type InventoryActiveFilter = (typeof inventoryActiveValues)[number];
export type InventoryPresenceFilter = (typeof inventoryPresenceValues)[number];
export type InventorySortValue = (typeof inventorySortValues)[number];
export type InventoryQuickDatePreset = (typeof inventoryQuickDatePresetValues)[number];

export type InventoryPageFilterState = DashboardPageFilterState & {
  dateField: InventoryDateField;
  name: string | null;
  sku: string | null;
  unit: string | null;
  isActive: InventoryActiveFilter;
  stockState: InventoryStockState | null;
  quantityMin: string | null;
  quantityMax: string | null;
  lastVendorId: string | null;
  purchaseRateMin: string | null;
  purchaseRateMax: string | null;
  hasLastPurchaseRate: InventoryPresenceFilter;
  hasImage: InventoryPresenceFilter;
  sort: InventorySortValue;
};

const DEFAULT_INVENTORY_SORT: InventorySortValue = "updated-at-desc";

// Private helpers — duplicated from page-filters internals to avoid tight coupling
function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);

  return !Number.isNaN(timestamp);
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function normalizeInventoryDateRange(from: string | null, to: string | null): DashboardDateRange {
  if (from && to && from > to) {
    return { from: to, to: from };
  }

  return { from, to };
}

function isValidInventoryDateField(value: string | undefined): value is InventoryDateField {
  return inventoryDateFieldValues.includes(value as InventoryDateField);
}

function isValidInventoryStockState(value: string | undefined): value is InventoryStockState {
  return inventoryStockStateValues.includes(value as InventoryStockState);
}

function isValidInventoryActiveFilter(value: string | undefined): value is InventoryActiveFilter {
  return inventoryActiveValues.includes(value as InventoryActiveFilter);
}

function isValidInventoryPresenceFilter(value: string | undefined): value is InventoryPresenceFilter {
  return inventoryPresenceValues.includes(value as InventoryPresenceFilter);
}

function isValidInventorySortValue(value: string | undefined): value is InventorySortValue {
  return inventorySortValues.includes(value as InventorySortValue);
}

function normalizeTextSearch(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeNumericInput(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed.toString();
}

function normalizeNumericRange(
  min: string | null,
  max: string | null,
): { min: string | null; max: string | null } {
  if (!min || !max) {
    return { min, max };
  }

  const parsedMin = Number.parseFloat(min);
  const parsedMax = Number.parseFloat(max);

  if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax) || parsedMin <= parsedMax) {
    return { min, max };
  }

  return { min: parsedMax.toString(), max: parsedMin.toString() };
}

export function getLastMonthInventoryDateRange(referenceDate = new Date()): DashboardDateRange {
  return getCurrentMonthDashboardDateRange(
    new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1),
  );
}

// Returns null when no date filter is active (from and to are both null)
export function getInventoryQuickDatePreset(
  dateRange: DashboardDateRange,
  referenceDate = new Date(),
): InventoryQuickDatePreset | null {
  if (!dateRange.from && !dateRange.to) {
    return null;
  }

  const thisMonth = getCurrentMonthDashboardDateRange(referenceDate);
  const lastMonth = getLastMonthInventoryDateRange(referenceDate);

  if (dateRange.from === thisMonth.from && dateRange.to === thisMonth.to) {
    return "this-month";
  }

  if (dateRange.from === lastMonth.from && dateRange.to === lastMonth.to) {
    return "last-month";
  }

  return "custom";
}

export function parseInventoryPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): InventoryPageFilterState {
  // Parse pagination + branch separately (no date coercion from base helper)
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

  // Date range: allow null/null (no date filter by default)
  const fromRaw = normalizeDashboardSearchParam(searchParams?.from);
  const toRaw = normalizeDashboardSearchParam(searchParams?.to);
  const dateRange = normalizeInventoryDateRange(
    fromRaw && isValidDateInput(fromRaw) ? fromRaw : null,
    toRaw && isValidDateInput(toRaw) ? toRaw : null,
  );

  // Inventory-specific filters
  const dateFieldValue = normalizeDashboardSearchParam(searchParams?.dateField);
  const name = normalizeTextSearch(normalizeDashboardSearchParam(searchParams?.name));
  const sku = normalizeTextSearch(normalizeDashboardSearchParam(searchParams?.sku));
  const unit = normalizeTextSearch(normalizeDashboardSearchParam(searchParams?.unit));
  const isActiveValue = normalizeDashboardSearchParam(searchParams?.isActive);
  const stockStateValue = normalizeDashboardSearchParam(searchParams?.stockState);
  const quantityMinRaw = normalizeNumericInput(normalizeDashboardSearchParam(searchParams?.quantityMin));
  const quantityMaxRaw = normalizeNumericInput(normalizeDashboardSearchParam(searchParams?.quantityMax));
  const normalizedQty = normalizeNumericRange(quantityMinRaw, quantityMaxRaw);
  const lastVendorId = normalizeTextSearch(normalizeDashboardSearchParam(searchParams?.lastVendorId));
  const purchaseRateMinRaw = normalizeNumericInput(
    normalizeDashboardSearchParam(searchParams?.purchaseRateMin),
  );
  const purchaseRateMaxRaw = normalizeNumericInput(
    normalizeDashboardSearchParam(searchParams?.purchaseRateMax),
  );
  const normalizedRate = normalizeNumericRange(purchaseRateMinRaw, purchaseRateMaxRaw);
  const hasLastPurchaseRateValue = normalizeDashboardSearchParam(searchParams?.hasLastPurchaseRate);
  const hasImageValue = normalizeDashboardSearchParam(searchParams?.hasImage);
  const sortValue = normalizeDashboardSearchParam(searchParams?.sort);

  return {
    branchId,
    from: dateRange.from,
    to: dateRange.to,
    page: parsedPage ?? DEFAULT_DASHBOARD_PAGE,
    pageSize,
    dateField: isValidInventoryDateField(dateFieldValue) ? dateFieldValue : "updated",
    name,
    sku,
    unit,
    isActive: isValidInventoryActiveFilter(isActiveValue) ? isActiveValue : "all",
    stockState: isValidInventoryStockState(stockStateValue) ? stockStateValue : null,
    quantityMin: normalizedQty.min,
    quantityMax: normalizedQty.max,
    lastVendorId,
    purchaseRateMin: normalizedRate.min,
    purchaseRateMax: normalizedRate.max,
    hasLastPurchaseRate: isValidInventoryPresenceFilter(hasLastPurchaseRateValue)
      ? hasLastPurchaseRateValue
      : "all",
    hasImage: isValidInventoryPresenceFilter(hasImageValue) ? hasImageValue : "all",
    sort: isValidInventorySortValue(sortValue) ? sortValue : DEFAULT_INVENTORY_SORT,
  };
}

export function buildInventoryPageHref(
  path: string,
  filters: InventoryPageFilterState,
  overrides?: Partial<InventoryPageFilterState>,
): string {
  const nextFilters = { ...filters, ...overrides };
  const normalizedQty = normalizeNumericRange(nextFilters.quantityMin, nextFilters.quantityMax);
  const normalizedRate = normalizeNumericRange(
    nextFilters.purchaseRateMin,
    nextFilters.purchaseRateMax,
  );
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

  if (nextFilters.dateField !== "updated") {
    searchParams.set("dateField", nextFilters.dateField);
  }

  if (nextFilters.name) {
    searchParams.set("name", nextFilters.name);
  }

  if (nextFilters.sku) {
    searchParams.set("sku", nextFilters.sku);
  }

  if (nextFilters.unit) {
    searchParams.set("unit", nextFilters.unit);
  }

  if (nextFilters.isActive !== "all") {
    searchParams.set("isActive", nextFilters.isActive);
  }

  if (nextFilters.stockState) {
    searchParams.set("stockState", nextFilters.stockState);
  }

  if (normalizedQty.min) {
    searchParams.set("quantityMin", normalizedQty.min);
  }

  if (normalizedQty.max) {
    searchParams.set("quantityMax", normalizedQty.max);
  }

  if (nextFilters.lastVendorId) {
    searchParams.set("lastVendorId", nextFilters.lastVendorId);
  }

  if (normalizedRate.min) {
    searchParams.set("purchaseRateMin", normalizedRate.min);
  }

  if (normalizedRate.max) {
    searchParams.set("purchaseRateMax", normalizedRate.max);
  }

  if (nextFilters.hasLastPurchaseRate !== "all") {
    searchParams.set("hasLastPurchaseRate", nextFilters.hasLastPurchaseRate);
  }

  if (nextFilters.hasImage !== "all") {
    searchParams.set("hasImage", nextFilters.hasImage);
  }

  if (nextFilters.sort !== DEFAULT_INVENTORY_SORT) {
    searchParams.set("sort", nextFilters.sort);
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildInventoryPaginationHref(
  path: string,
  filters: InventoryPageFilterState,
  pagination: { page?: number; pageSize?: number },
): string {
  return buildInventoryPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
