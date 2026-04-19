import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  getCurrentMonthDashboardDateRange,
  normalizeDashboardSearchParam,
  parseDashboardPageFilters,
} from "@/lib/dashboard/page-filters";
import type { DashboardDateRange, DashboardPageFilterState } from "@/lib/dashboard/types";
import { paymentModeValues } from "@/lib/expenses/types";

export const orderSortValues = [
  "order-date-desc",
  "order-date-asc",
  "created-at-desc",
  "created-at-asc",
  "order-code-asc",
  "order-code-desc",
  "payable-desc",
  "payable-asc",
  "paid-desc",
  "paid-asc",
  "outstanding-desc",
  "outstanding-asc",
  "customer-asc",
  "customer-desc",
  "status-asc",
  "status-desc",
  "payment-status-asc",
  "payment-status-desc",
] as const;

export const orderQuickDatePresetValues = ["this-month", "last-month", "custom"] as const;
export const orderDateFieldValues = ["order", "created"] as const;
export const orderStatusValues = [
  "pending",
  "processing",
  "completed",
  "delivered",
  "cancelled",
] as const;
export const orderPaymentStatusValues = ["pending", "partial", "paid"] as const;

export type OrderSortValue = (typeof orderSortValues)[number];
export type OrderDateField = (typeof orderDateFieldValues)[number];
export type OrderQuickDatePreset = (typeof orderQuickDatePresetValues)[number];
export type OrderStatus = (typeof orderStatusValues)[number];
export type OrderPaymentStatus = (typeof orderPaymentStatusValues)[number];

export type OrderPageFilterState = DashboardPageFilterState & {
  dateField: OrderDateField;
  sort: OrderSortValue;
  status: OrderStatus | null;
  paymentStatus: OrderPaymentStatus | null;
  orderCode: string | null;
  txnReference: string | null;
  customerId: string | null;
  createdBy: string | null;
  vendorId: string | null;
  paymentMode: string | null;
  inventoryId: string | null;
  offerItemId: string | null;
  payableMin: string | null;
  payableMax: string | null;
  paidMin: string | null;
  paidMax: string | null;
  outstandingMin: string | null;
  outstandingMax: string | null;
};

const DEFAULT_ORDER_SORT: OrderSortValue = "order-date-desc";

function isValidOrderSortValue(value: string | undefined): value is OrderSortValue {
  return orderSortValues.includes(value as OrderSortValue);
}

function isValidOrderStatus(value: string | undefined): value is OrderStatus {
  return orderStatusValues.includes(value as OrderStatus);
}

function isValidOrderPaymentStatus(value: string | undefined): value is OrderPaymentStatus {
  return orderPaymentStatusValues.includes(value as OrderPaymentStatus);
}

function isValidOrderDateField(value: string | undefined): value is OrderDateField {
  return orderDateFieldValues.includes(value as OrderDateField);
}

function isValidPaymentModeValue(value: string | undefined): value is (typeof paymentModeValues)[number] {
  return paymentModeValues.includes(value as (typeof paymentModeValues)[number]);
}

function normalizeOrderIdValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeAmountInput(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number.parseFloat(trimmedValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue.toString();
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

export function getLastMonthOrderDateRange(referenceDate = new Date()): DashboardDateRange {
  return getCurrentMonthDashboardDateRange(
    new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1),
  );
}

export function getOrderQuickDatePreset(
  dateRange: DashboardDateRange,
  referenceDate = new Date(),
): OrderQuickDatePreset {
  const thisMonthRange = getCurrentMonthDashboardDateRange(referenceDate);
  const lastMonthRange = getLastMonthOrderDateRange(referenceDate);

  if (dateRange.from === thisMonthRange.from && dateRange.to === thisMonthRange.to) {
    return "this-month";
  }

  if (dateRange.from === lastMonthRange.from && dateRange.to === lastMonthRange.to) {
    return "last-month";
  }

  return "custom";
}

export function parseOrderPageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): OrderPageFilterState {
  const baseFilters = parseDashboardPageFilters(searchParams);

  const sortValue = normalizeDashboardSearchParam(searchParams?.sort);
  const dateFieldValue = normalizeDashboardSearchParam(searchParams?.dateField);
  const statusValue = normalizeDashboardSearchParam(searchParams?.status);
  const paymentStatusValue = normalizeDashboardSearchParam(searchParams?.paymentStatus);
  const paymentModeValue = normalizeDashboardSearchParam(searchParams?.paymentMode);

  const payableMin = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.payableMin));
  const payableMax = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.payableMax));
  const normalizedPayable = normalizeAmountRange(payableMin, payableMax);

  const paidMin = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.paidMin));
  const paidMax = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.paidMax));
  const normalizedPaid = normalizeAmountRange(paidMin, paidMax);

  const outstandingMin = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.outstandingMin));
  const outstandingMax = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.outstandingMax));
  const normalizedOutstanding = normalizeAmountRange(outstandingMin, outstandingMax);

  return {
    ...baseFilters,
    dateField: isValidOrderDateField(dateFieldValue) ? dateFieldValue : "order",
    sort: isValidOrderSortValue(sortValue) ? sortValue : DEFAULT_ORDER_SORT,
    status: isValidOrderStatus(statusValue) ? statusValue : null,
    paymentStatus: isValidOrderPaymentStatus(paymentStatusValue) ? paymentStatusValue : null,
    orderCode: normalizeOrderIdValue(normalizeDashboardSearchParam(searchParams?.orderCode)),
    txnReference: normalizeOrderIdValue(normalizeDashboardSearchParam(searchParams?.txnReference)),
    customerId: normalizeOrderIdValue(normalizeDashboardSearchParam(searchParams?.customerId)),
    createdBy: normalizeOrderIdValue(normalizeDashboardSearchParam(searchParams?.createdBy)),
    vendorId: normalizeOrderIdValue(normalizeDashboardSearchParam(searchParams?.vendorId)),
    paymentMode: isValidPaymentModeValue(paymentModeValue) ? paymentModeValue : null,
    inventoryId: normalizeOrderIdValue(normalizeDashboardSearchParam(searchParams?.inventoryId)),
    offerItemId: normalizeOrderIdValue(normalizeDashboardSearchParam(searchParams?.offerItemId)),
    payableMin: normalizedPayable.min,
    payableMax: normalizedPayable.max,
    paidMin: normalizedPaid.min,
    paidMax: normalizedPaid.max,
    outstandingMin: normalizedOutstanding.min,
    outstandingMax: normalizedOutstanding.max,
  };
}

export function buildOrderPageHref(
  path: string,
  filters: OrderPageFilterState,
  overrides?: Partial<OrderPageFilterState>,
): string {
  const nextFilters: OrderPageFilterState = { ...filters, ...overrides };

  const normalizedPayable = normalizeAmountRange(nextFilters.payableMin, nextFilters.payableMax);
  const normalizedPaid = normalizeAmountRange(nextFilters.paidMin, nextFilters.paidMax);
  const normalizedOutstanding = normalizeAmountRange(nextFilters.outstandingMin, nextFilters.outstandingMax);

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

  if (nextFilters.dateField !== "order") {
    searchParams.set("dateField", nextFilters.dateField);
  }

  if (nextFilters.sort !== DEFAULT_ORDER_SORT) {
    searchParams.set("sort", nextFilters.sort);
  }

  if (nextFilters.status) {
    searchParams.set("status", nextFilters.status);
  }

  if (nextFilters.paymentStatus) {
    searchParams.set("paymentStatus", nextFilters.paymentStatus);
  }

  if (nextFilters.orderCode) {
    searchParams.set("orderCode", nextFilters.orderCode);
  }

  if (nextFilters.txnReference) {
    searchParams.set("txnReference", nextFilters.txnReference);
  }

  if (nextFilters.customerId) {
    searchParams.set("customerId", nextFilters.customerId);
  }

  if (nextFilters.createdBy) {
    searchParams.set("createdBy", nextFilters.createdBy);
  }

  if (nextFilters.vendorId) {
    searchParams.set("vendorId", nextFilters.vendorId);
  }

  if (nextFilters.paymentMode) {
    searchParams.set("paymentMode", nextFilters.paymentMode);
  }

  if (nextFilters.inventoryId) {
    searchParams.set("inventoryId", nextFilters.inventoryId);
  }

  if (nextFilters.offerItemId) {
    searchParams.set("offerItemId", nextFilters.offerItemId);
  }

  if (normalizedPayable.min) {
    searchParams.set("payableMin", normalizedPayable.min);
  }

  if (normalizedPayable.max) {
    searchParams.set("payableMax", normalizedPayable.max);
  }

  if (normalizedPaid.min) {
    searchParams.set("paidMin", normalizedPaid.min);
  }

  if (normalizedPaid.max) {
    searchParams.set("paidMax", normalizedPaid.max);
  }

  if (normalizedOutstanding.min) {
    searchParams.set("outstandingMin", normalizedOutstanding.min);
  }

  if (normalizedOutstanding.max) {
    searchParams.set("outstandingMax", normalizedOutstanding.max);
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildOrderPaginationHref(
  path: string,
  filters: OrderPageFilterState,
  pagination: { page?: number; pageSize?: number },
): string {
  return buildOrderPageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
