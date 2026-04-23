import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  getCurrentMonthDashboardDateRange,
  normalizeDashboardSearchParam,
  parseDashboardPageFilters,
} from "@/lib/dashboard/page-filters";
import type { DashboardDateRange, DashboardPageFilterState } from "@/lib/dashboard/types";

export const customerTypeValues = ["studio", "amateur", "other", "employee"] as const;

export const customerSortValues = [
  "created-desc",
  "created-asc",
  "updated-desc",
  "updated-asc",
  "name-asc",
  "name-desc",
  "type-asc",
  "type-desc",
  "phone-asc",
  "phone-desc",
  "studio-name-asc",
  "studio-name-desc",
  "customer-code-asc",
  "customer-code-desc",
  "order-count-desc",
  "order-count-asc",
  "total-payable-desc",
  "total-payable-asc",
  "outstanding-desc",
  "outstanding-asc",
  "last-order-date-desc",
  "last-order-date-asc",
] as const;

export const customerDateFieldValues = ["created", "updated"] as const;
export const customerQuickDatePresetValues = ["this-month", "last-month", "custom"] as const;
export const customerPresenceValues = ["all", "with", "without"] as const;
export const customerHasOrdersValues = ["all", "yes", "no"] as const;

export const DEFAULT_CUSTOMER_SORT: CustomerSortValue = "created-desc";

export type CustomerType = (typeof customerTypeValues)[number];
export type CustomerSortValue = (typeof customerSortValues)[number];
export type CustomerDateField = (typeof customerDateFieldValues)[number];
export type CustomerQuickDatePreset = (typeof customerQuickDatePresetValues)[number];
export type CustomerPresenceValue = (typeof customerPresenceValues)[number];
export type CustomerHasOrdersValue = (typeof customerHasOrdersValues)[number];

export type CustomerPageFilterState = DashboardPageFilterState & {
  dateField: CustomerDateField;
  sort: CustomerSortValue;
  type: string | null;
  name: string | null;
  phone: string | null;
  alternatePhone: string | null;
  customerCode: string | null;
  customerNumericId: string | null;
  studioName: string | null;
  address: string | null;
  hasAlternatePhone: CustomerPresenceValue;
  hasStudioName: CustomerPresenceValue;
  hasAddress: CustomerPresenceValue;
  hasAvatar: CustomerPresenceValue;
  hasOrders: CustomerHasOrdersValue;
  orderCountMin: string | null;
  orderCountMax: string | null;
  lastOrderDateFrom: string | null;
  lastOrderDateTo: string | null;
  totalPayableMin: string | null;
  totalPayableMax: string | null;
  outstandingMin: string | null;
  outstandingMax: string | null;
  lastOrderStatus: string | null;
  lastPaymentStatus: string | null;
};

function isValidCustomerType(value: string | undefined): value is CustomerType {
  return customerTypeValues.includes(value as CustomerType);
}

function isValidCustomerSort(value: string | undefined): value is CustomerSortValue {
  return customerSortValues.includes(value as CustomerSortValue);
}

function isValidCustomerDateField(value: string | undefined): value is CustomerDateField {
  return customerDateFieldValues.includes(value as CustomerDateField);
}

function isValidCustomerPresence(value: string | undefined): value is CustomerPresenceValue {
  return customerPresenceValues.includes(value as CustomerPresenceValue);
}

function isValidHasOrders(value: string | undefined): value is CustomerHasOrdersValue {
  return customerHasOrdersValues.includes(value as CustomerHasOrdersValue);
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);

  return !Number.isNaN(timestamp);
}

function normalizeCustomerTextInput(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeAmountInput(value: string | undefined): string | null {
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

function normalizeAmountRange(min: string | null, max: string | null) {
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

export function normalizeCustomerSort(value: string | undefined): CustomerSortValue {
  if (isValidCustomerSort(value)) {
    return value;
  }

  return DEFAULT_CUSTOMER_SORT;
}

export function getLastMonthCustomerDateRange(referenceDate = new Date()): DashboardDateRange {
  return getCurrentMonthDashboardDateRange(
    new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1),
  );
}

export function getCustomerQuickDatePreset(
  dateRange: DashboardDateRange,
  referenceDate = new Date(),
): CustomerQuickDatePreset {
  const thisMonthRange = getCurrentMonthDashboardDateRange(referenceDate);
  const lastMonthRange = getLastMonthCustomerDateRange(referenceDate);

  if (dateRange.from === thisMonthRange.from && dateRange.to === thisMonthRange.to) {
    return "this-month";
  }

  if (dateRange.from === lastMonthRange.from && dateRange.to === lastMonthRange.to) {
    return "last-month";
  }

  return "custom";
}

export function parseCustomerPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): CustomerPageFilterState {
  const baseFilters = parseDashboardPageFilters(searchParams);

  const sortValue = normalizeDashboardSearchParam(searchParams?.sort);
  const dateFieldValue = normalizeDashboardSearchParam(searchParams?.dateField);
  const typeValue = normalizeDashboardSearchParam(searchParams?.type);

  const hasAlternatePhoneValue = normalizeDashboardSearchParam(searchParams?.hasAlternatePhone);
  const hasStudioNameValue = normalizeDashboardSearchParam(searchParams?.hasStudioName);
  const hasAddressValue = normalizeDashboardSearchParam(searchParams?.hasAddress);
  const hasAvatarValue = normalizeDashboardSearchParam(searchParams?.hasAvatar);
  const hasOrdersValue = normalizeDashboardSearchParam(searchParams?.hasOrders);

  const orderCountMin = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.orderCountMin));
  const orderCountMax = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.orderCountMax));
  const normalizedOrderCount = normalizeAmountRange(orderCountMin, orderCountMax);

  const totalPayableMin = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.totalPayableMin));
  const totalPayableMax = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.totalPayableMax));
  const normalizedPayable = normalizeAmountRange(totalPayableMin, totalPayableMax);

  const outstandingMin = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.outstandingMin));
  const outstandingMax = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.outstandingMax));
  const normalizedOutstanding = normalizeAmountRange(outstandingMin, outstandingMax);

  const lastOrderDateFromValue = normalizeDashboardSearchParam(searchParams?.lastOrderDateFrom);
  const lastOrderDateToValue = normalizeDashboardSearchParam(searchParams?.lastOrderDateTo);

  return {
    ...baseFilters,
    dateField: isValidCustomerDateField(dateFieldValue) ? dateFieldValue : "created",
    sort: normalizeCustomerSort(sortValue),
    type: isValidCustomerType(typeValue) ? typeValue : null,
    name: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.name)),
    phone: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.phone)),
    alternatePhone: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.alternatePhone)),
    customerCode: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.customerCode)),
    customerNumericId: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.customerNumericId)),
    studioName: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.studioName)),
    address: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.address)),
    hasAlternatePhone: isValidCustomerPresence(hasAlternatePhoneValue) ? hasAlternatePhoneValue : "all",
    hasStudioName: isValidCustomerPresence(hasStudioNameValue) ? hasStudioNameValue : "all",
    hasAddress: isValidCustomerPresence(hasAddressValue) ? hasAddressValue : "all",
    hasAvatar: isValidCustomerPresence(hasAvatarValue) ? hasAvatarValue : "all",
    hasOrders: isValidHasOrders(hasOrdersValue) ? hasOrdersValue : "all",
    orderCountMin: normalizedOrderCount.min,
    orderCountMax: normalizedOrderCount.max,
    lastOrderDateFrom:
      lastOrderDateFromValue && isValidDateInput(lastOrderDateFromValue) ? lastOrderDateFromValue : null,
    lastOrderDateTo:
      lastOrderDateToValue && isValidDateInput(lastOrderDateToValue) ? lastOrderDateToValue : null,
    totalPayableMin: normalizedPayable.min,
    totalPayableMax: normalizedPayable.max,
    outstandingMin: normalizedOutstanding.min,
    outstandingMax: normalizedOutstanding.max,
    lastOrderStatus: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.lastOrderStatus)),
    lastPaymentStatus: normalizeCustomerTextInput(normalizeDashboardSearchParam(searchParams?.lastPaymentStatus)),
  };
}

export function buildCustomerPageHref(
  path: string,
  filters: CustomerPageFilterState,
  overrides?: Partial<CustomerPageFilterState>,
): string {
  const nextFilters = { ...filters, ...overrides };
  const normalizedPayable = normalizeAmountRange(nextFilters.totalPayableMin, nextFilters.totalPayableMax);
  const normalizedOutstanding = normalizeAmountRange(nextFilters.outstandingMin, nextFilters.outstandingMax);
  const normalizedOrderCount = normalizeAmountRange(nextFilters.orderCountMin, nextFilters.orderCountMax);
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

  if (nextFilters.dateField !== "created") {
    searchParams.set("dateField", nextFilters.dateField);
  }

  if (nextFilters.sort !== DEFAULT_CUSTOMER_SORT) {
    searchParams.set("sort", nextFilters.sort);
  }

  if (nextFilters.type) {
    searchParams.set("type", nextFilters.type);
  }

  if (nextFilters.name) {
    searchParams.set("name", nextFilters.name);
  }

  if (nextFilters.phone) {
    searchParams.set("phone", nextFilters.phone);
  }

  if (nextFilters.alternatePhone) {
    searchParams.set("alternatePhone", nextFilters.alternatePhone);
  }

  if (nextFilters.customerCode) {
    searchParams.set("customerCode", nextFilters.customerCode);
  }

  if (nextFilters.customerNumericId) {
    searchParams.set("customerNumericId", nextFilters.customerNumericId);
  }

  if (nextFilters.studioName) {
    searchParams.set("studioName", nextFilters.studioName);
  }

  if (nextFilters.address) {
    searchParams.set("address", nextFilters.address);
  }

  if (nextFilters.hasAlternatePhone !== "all") {
    searchParams.set("hasAlternatePhone", nextFilters.hasAlternatePhone);
  }

  if (nextFilters.hasStudioName !== "all") {
    searchParams.set("hasStudioName", nextFilters.hasStudioName);
  }

  if (nextFilters.hasAddress !== "all") {
    searchParams.set("hasAddress", nextFilters.hasAddress);
  }

  if (nextFilters.hasAvatar !== "all") {
    searchParams.set("hasAvatar", nextFilters.hasAvatar);
  }

  if (nextFilters.hasOrders !== "all") {
    searchParams.set("hasOrders", nextFilters.hasOrders);
  }

  if (normalizedOrderCount.min) {
    searchParams.set("orderCountMin", normalizedOrderCount.min);
  }

  if (normalizedOrderCount.max) {
    searchParams.set("orderCountMax", normalizedOrderCount.max);
  }

  if (nextFilters.lastOrderDateFrom) {
    searchParams.set("lastOrderDateFrom", nextFilters.lastOrderDateFrom);
  }

  if (nextFilters.lastOrderDateTo) {
    searchParams.set("lastOrderDateTo", nextFilters.lastOrderDateTo);
  }

  if (normalizedPayable.min) {
    searchParams.set("totalPayableMin", normalizedPayable.min);
  }

  if (normalizedPayable.max) {
    searchParams.set("totalPayableMax", normalizedPayable.max);
  }

  if (normalizedOutstanding.min) {
    searchParams.set("outstandingMin", normalizedOutstanding.min);
  }

  if (normalizedOutstanding.max) {
    searchParams.set("outstandingMax", normalizedOutstanding.max);
  }

  if (nextFilters.lastOrderStatus) {
    searchParams.set("lastOrderStatus", nextFilters.lastOrderStatus);
  }

  if (nextFilters.lastPaymentStatus) {
    searchParams.set("lastPaymentStatus", nextFilters.lastPaymentStatus);
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildCustomerPaginationHref(
  path: string,
  filters: CustomerPageFilterState,
  pagination: { page?: number; pageSize?: number },
): string {
  return buildCustomerPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
