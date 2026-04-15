import {
  DEFAULT_DASHBOARD_PAGE,
  DEFAULT_DASHBOARD_PAGE_SIZE,
  getCurrentMonthDashboardDateRange,
  normalizeDashboardSearchParam,
  parseDashboardPageFilters,
} from "@/lib/dashboard/page-filters";
import type { DashboardDateRange, DashboardPageFilterState } from "@/lib/dashboard/types";
import { paymentModeValues } from "@/lib/expenses/types";

const expenseDateFieldValues = ["expense", "logged"] as const;
const expenseRemarksValues = ["all", "with", "without"] as const;
const expenseSortValues = [
  "expense-date-desc",
  "expense-date-asc",
  "logged-date-desc",
  "logged-date-asc",
  "amount-desc",
  "amount-asc",
  "category-asc",
  "category-desc",
  "payment-asc",
  "payment-desc",
  "title-asc",
  "title-desc",
  "employee-asc",
  "employee-desc",
  "vendor-asc",
  "vendor-desc",
] as const;

export const expenseQuickDatePresetValues = ["this-month", "last-month", "custom"] as const;
export const expensePageKinds = ["employee", "business"] as const;

export type ExpenseDateField = (typeof expenseDateFieldValues)[number];
export type ExpenseRemarksFilter = (typeof expenseRemarksValues)[number];
export type ExpenseSortValue = (typeof expenseSortValues)[number];
export type ExpenseQuickDatePreset = (typeof expenseQuickDatePresetValues)[number];
export type ExpensePageKind = (typeof expensePageKinds)[number];

export type ExpensePageFilterState = DashboardPageFilterState & {
  dateField: ExpenseDateField;
  categoryId: string | null;
  paymentMode: string | null;
  amountMin: string | null;
  amountMax: string | null;
  remarks: ExpenseRemarksFilter;
  employeeId: string | null;
  vendorId: string | null;
  sort: ExpenseSortValue;
};

const defaultExpenseSortByKind: Record<ExpensePageKind, ExpenseSortValue> = {
  employee: "expense-date-desc",
  business: "expense-date-desc",
};

function isValidExpenseDateField(value: string | undefined): value is ExpenseDateField {
  return expenseDateFieldValues.includes(value as ExpenseDateField);
}

function isValidExpenseRemarksFilter(value: string | undefined): value is ExpenseRemarksFilter {
  return expenseRemarksValues.includes(value as ExpenseRemarksFilter);
}

function isValidExpenseSortValue(value: string | undefined): value is ExpenseSortValue {
  return expenseSortValues.includes(value as ExpenseSortValue);
}

function isValidPaymentModeValue(
  value: string | undefined,
): value is (typeof paymentModeValues)[number] {
  return paymentModeValues.includes(value as (typeof paymentModeValues)[number]);
}

function normalizeExpenseIdValue(value: string | undefined) {
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

function normalizeAmountRange(amountMin: string | null, amountMax: string | null) {
  if (!amountMin || !amountMax) {
    return {
      amountMin,
      amountMax,
    };
  }

  const parsedMin = Number.parseFloat(amountMin);
  const parsedMax = Number.parseFloat(amountMax);

  if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax) || parsedMin <= parsedMax) {
    return {
      amountMin,
      amountMax,
    };
  }

  return {
    amountMin: parsedMax.toString(),
    amountMax: parsedMin.toString(),
  };
}

export function getExpensePagePath(kind: ExpensePageKind) {
  return kind === "employee" ? "/dashboard/employee-expenses" : "/dashboard/business-expenses";
}

export function isExpenseSortSupported(kind: ExpensePageKind, sort: ExpenseSortValue) {
  if (sort === "employee-asc" || sort === "employee-desc") {
    return kind === "employee";
  }

  if (sort === "vendor-asc" || sort === "vendor-desc") {
    return kind === "business";
  }

  return true;
}

export function normalizeExpenseSortForKind(kind: ExpensePageKind, sort: string | undefined) {
  if (!sort || !isValidExpenseSortValue(sort) || !isExpenseSortSupported(kind, sort)) {
    return defaultExpenseSortByKind[kind];
  }

  return sort;
}

export function coerceExpensePageFiltersForKind(kind: ExpensePageKind, filters: ExpensePageFilterState): ExpensePageFilterState {
  return {
    ...filters,
    categoryId: null,
    employeeId: kind === "employee" ? filters.employeeId : null,
    vendorId: kind === "business" ? filters.vendorId : null,
    sort: normalizeExpenseSortForKind(kind, filters.sort),
  };
}

export function getLastMonthExpenseDateRange(referenceDate = new Date()): DashboardDateRange {
  return getCurrentMonthDashboardDateRange(new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1));
}

export function getExpenseQuickDatePreset(dateRange: DashboardDateRange, referenceDate = new Date()): ExpenseQuickDatePreset {
  const thisMonthDateRange = getCurrentMonthDashboardDateRange(referenceDate);
  const lastMonthDateRange = getLastMonthExpenseDateRange(referenceDate);

  if (dateRange.from === thisMonthDateRange.from && dateRange.to === thisMonthDateRange.to) {
    return "this-month";
  }

  if (dateRange.from === lastMonthDateRange.from && dateRange.to === lastMonthDateRange.to) {
    return "last-month";
  }

  return "custom";
}

export function parseExpensePageFilters(
  searchParams?: Record<string, string | string[] | undefined>,
  kind: ExpensePageKind = "employee",
): ExpensePageFilterState {
  const baseFilters = parseDashboardPageFilters(searchParams);
  const categoryId = normalizeExpenseIdValue(normalizeDashboardSearchParam(searchParams?.categoryId));
  const paymentModeValue = normalizeDashboardSearchParam(searchParams?.paymentMode);
  const amountMinValue = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.amountMin));
  const amountMaxValue = normalizeAmountInput(normalizeDashboardSearchParam(searchParams?.amountMax));
  const normalizedAmounts = normalizeAmountRange(amountMinValue, amountMaxValue);
  const dateFieldValue = normalizeDashboardSearchParam(searchParams?.dateField);
  const remarksValue = normalizeDashboardSearchParam(searchParams?.remarks);
  const employeeId =
    kind === "employee" ? normalizeExpenseIdValue(normalizeDashboardSearchParam(searchParams?.employeeId)) : null;
  const vendorId =
    kind === "business" ? normalizeExpenseIdValue(normalizeDashboardSearchParam(searchParams?.vendorId)) : null;
  const sortValue = normalizeExpenseSortForKind(kind, normalizeDashboardSearchParam(searchParams?.sort));

  return {
    ...baseFilters,
    dateField: isValidExpenseDateField(dateFieldValue) ? dateFieldValue : "expense",
    categoryId,
    paymentMode: isValidPaymentModeValue(paymentModeValue) ? paymentModeValue : null,
    amountMin: normalizedAmounts.amountMin,
    amountMax: normalizedAmounts.amountMax,
    remarks: isValidExpenseRemarksFilter(remarksValue) ? remarksValue : "all",
    employeeId,
    vendorId,
    sort: sortValue,
  };
}

export function buildExpensePageHref(
  path: string,
  filters: ExpensePageFilterState,
  overrides?: Partial<ExpensePageFilterState>,
) {
  const nextFilters = {
    ...filters,
    ...overrides,
  };
  const normalizedAmounts = normalizeAmountRange(nextFilters.amountMin, nextFilters.amountMax);
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

  if (nextFilters.dateField !== "expense") {
    searchParams.set("dateField", nextFilters.dateField);
  }

  if (nextFilters.categoryId) {
    searchParams.set("categoryId", nextFilters.categoryId);
  }

  if (nextFilters.paymentMode) {
    searchParams.set("paymentMode", nextFilters.paymentMode);
  }

  if (normalizedAmounts.amountMin) {
    searchParams.set("amountMin", normalizedAmounts.amountMin);
  }

  if (normalizedAmounts.amountMax) {
    searchParams.set("amountMax", normalizedAmounts.amountMax);
  }

  if (nextFilters.remarks !== "all") {
    searchParams.set("remarks", nextFilters.remarks);
  }

  if (nextFilters.employeeId) {
    searchParams.set("employeeId", nextFilters.employeeId);
  }

  if (nextFilters.vendorId) {
    searchParams.set("vendorId", nextFilters.vendorId);
  }

  if (nextFilters.sort !== defaultExpenseSortByKind.employee) {
    searchParams.set("sort", nextFilters.sort);
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

export function buildExpensePaginationHref(
  path: string,
  filters: ExpensePageFilterState,
  pagination: {
    page?: number;
    pageSize?: number;
  },
) {
  return buildExpensePageHref(path, filters, {
    page: pagination.page ?? filters.page,
    pageSize: pagination.pageSize ?? filters.pageSize,
  });
}
