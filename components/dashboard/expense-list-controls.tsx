"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { flushSync } from "react-dom";
import {
  ChevronDown,
  Filter,
  Undo2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataPill, getExpenseCategoryTone, getExpensePaymentModeTone, type DataPillTone } from "@/components/dashboard/data-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  buildExpensePageHref,
  expenseQuickDatePresetValues,
  getExpenseQuickDatePreset,
  getLastMonthExpenseDateRange,
  normalizeExpenseSortForKind,
  type ExpensePageFilterState,
  type ExpensePageKind,
  type ExpenseQuickDatePreset,
} from "@/lib/dashboard/expense-page-filters";
import { getCurrentMonthDashboardDateRange } from "@/lib/dashboard/page-filters";
import type { ExpenseCategoryOption, ExpenseEmployeeOption, ExpenseVendorOption } from "@/lib/expenses/types";
import { getPaymentModeLabel, paymentModeValues } from "@/lib/expenses/types";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";

type ExpenseListControlsProps = {
  kind: ExpensePageKind;
  currentPath: string;
  currentFilters: ExpensePageFilterState;
  categoryOptions: ExpenseCategoryOption[];
  employeeOptions?: ExpenseEmployeeOption[];
  vendorOptions?: ExpenseVendorOption[];
};

type ExpenseControlPanel = "filter" | null;

type AppliedFilterSummaryItem = {
  key: string;
  label: string;
  tone?: DataPillTone;
};

const summaryCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function normalizeHref(href: string) {
  const url = new URL(href, "https://printflow.local");
  const normalizedSearchParams = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) {
      return leftValue.localeCompare(rightValue);
    }

    return leftKey.localeCompare(rightKey);
  });
  const normalizedQuery = new URLSearchParams(normalizedSearchParams).toString();

  return normalizedQuery ? `${url.pathname}?${normalizedQuery}` : url.pathname;
}

function isSameHref(leftHref: string, rightHref: string) {
  return normalizeHref(leftHref) === normalizeHref(rightHref);
}

function getActiveFilterCount(kind: ExpensePageKind, filters: ExpensePageFilterState) {
  let count = 0;

  if (filters.dateField !== "expense") {
    count += 1;
  }

  if (getExpenseQuickDatePreset({ from: filters.from, to: filters.to }) !== "this-month") {
    count += 1;
  }

  if (filters.categoryId) {
    count += 1;
  }

  if (filters.paymentMode) {
    count += 1;
  }

  if (filters.amountMin || filters.amountMax) {
    count += 1;
  }

  if (filters.remarks !== "all") {
    count += 1;
  }

  if (kind === "employee" && filters.employeeId) {
    count += 1;
  }

  if (kind === "business" && filters.vendorId) {
    count += 1;
  }

  return count;
}

function getAdvancedFilterCount(filters: ExpensePageFilterState) {
  let count = 0;

  if (filters.dateField !== "expense") {
    count += 1;
  }

  if (filters.remarks !== "all") {
    count += 1;
  }

  return count;
}

function formatSummaryCurrency(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return summaryCurrencyFormatter.format(parsedValue);
}

function buildPrimaryFilterSummary(filters: ExpensePageFilterState) {
  const preset = getExpenseQuickDatePreset({
    from: filters.from,
    to: filters.to,
  });
  const rangeLabel =
    preset === "this-month"
      ? "This month"
      : preset === "last-month"
        ? "Last month"
        : formatDateRangeLabel(filters.from, filters.to);

  return `${filters.dateField === "logged" ? "Logged date" : "Expense date"} · ${rangeLabel}`;
}

function getOptionLabelForEmployee(option: ExpenseEmployeeOption, branchValue: string | null) {
  if (branchValue === "all" && option.branchName) {
    return `${option.fullName} - ${option.branchName}`;
  }

  return option.fullName;
}

function getPanelCardClassName() {
  return suggestCanonicalClasses(
    "overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] shadow-[0_28px_64px_-42px_rgb(var(--shadow)/0.28)] backdrop-blur-xl",
  );
}

function getPersonFilterLabel(kind: ExpensePageKind) {
  return kind === "employee" ? "Employee" : "Vendor";
}

function getPersonPlaceholder(kind: ExpensePageKind, optionCount: number) {
  if (optionCount === 0) {
    return kind === "employee" ? "No employees found" : "No vendors found";
  }

  return kind === "employee" ? "All employees" : "All vendors";
}

function buildAppliedFilterSummaryItems({
  kind,
  filters,
  categoryOptions,
  employeeOptions,
  vendorOptions,
  branchValue,
}: {
  kind: ExpensePageKind;
  filters: ExpensePageFilterState;
  categoryOptions: ExpenseCategoryOption[];
  employeeOptions: ExpenseEmployeeOption[];
  vendorOptions: ExpenseVendorOption[];
  branchValue: string | null;
}): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [];

  if (filters.categoryId) {
    const category = categoryOptions.find((option) => option.id === filters.categoryId);

    if (category) {
      items.push({
        key: "category",
        label: `Category: ${category.name}`,
        tone: getExpenseCategoryTone(category.code || category.name),
      });
    }
  }

  if (kind === "employee" && filters.employeeId) {
    const employee = employeeOptions.find((option) => option.id === filters.employeeId);

    if (employee) {
      items.push({
        key: "employee",
        label: `Employee: ${getOptionLabelForEmployee(employee, branchValue)}`,
      });
    }
  }

  if (kind === "business" && filters.vendorId) {
    const vendor = vendorOptions.find((option) => option.id === filters.vendorId);

    if (vendor) {
      items.push({
        key: "vendor",
        label: `Vendor: ${vendor.name}`,
      });
    }
  }

  if (filters.paymentMode) {
    items.push({
      key: "payment",
      label: `Payment: ${getPaymentModeLabel(filters.paymentMode)}`,
      tone: getExpensePaymentModeTone(filters.paymentMode),
    });
  }

  const minAmountLabel = formatSummaryCurrency(filters.amountMin);
  const maxAmountLabel = formatSummaryCurrency(filters.amountMax);

  if (minAmountLabel || maxAmountLabel) {
    let label = "";

    if (minAmountLabel && maxAmountLabel) {
      label = `Amount: ${minAmountLabel}-${maxAmountLabel}`;
    } else if (minAmountLabel) {
      label = `Min ${minAmountLabel}`;
    } else {
      label = `Max ${maxAmountLabel}`;
    }

    items.push({
      key: "amount",
      label,
    });
  }

  if (filters.remarks === "with") {
    items.push({
      key: "remarks-with",
      label: "Has remarks",
    });
  } else if (filters.remarks === "without") {
    items.push({
      key: "remarks-without",
      label: "No remarks",
    });
  }

  return items;
}

export function ExpenseListControls({
  kind,
  currentPath,
  currentFilters,
  categoryOptions,
  employeeOptions = [],
  vendorOptions = [],
}: ExpenseListControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseId = useId();
  const filterPanelId = `${baseId}-filter-panel`;
  const filterTitleId = `${baseId}-filter-title`;
  const advancedPanelId = `${baseId}-advanced-filters`;
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousOpenPanelRef = useRef<ExpenseControlPanel>(null);
  const [openPanel, setOpenPanel] = useState<ExpenseControlPanel>(null);
  const [draftFilters, setDraftFilters] = useState<ExpensePageFilterState>(currentFilters);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"apply" | null>(null);
  const [isPending, startTransition] = useTransition();
  const currentHref = useMemo(() => buildExpensePageHref(currentPath, currentFilters), [currentFilters, currentPath]);
  const activeFilterCount = useMemo(() => getActiveFilterCount(kind, currentFilters), [currentFilters, kind]);
  const primaryFilterSummary = useMemo(() => buildPrimaryFilterSummary(currentFilters), [currentFilters]);
  const currentDatePreset = getExpenseQuickDatePreset({
    from: draftFilters.from,
    to: draftFilters.to,
  });
  const advancedFilterCount = useMemo(() => getAdvancedFilterCount(draftFilters), [draftFilters]);
  const personOptions = kind === "employee" ? employeeOptions : vendorOptions;
  const appliedFilterSummaryItems = useMemo(
    () =>
      buildAppliedFilterSummaryItems({
        kind,
        filters: currentFilters,
        categoryOptions,
        employeeOptions,
        vendorOptions,
        branchValue: currentFilters.branchId,
      }),
    [categoryOptions, currentFilters, employeeOptions, kind, vendorOptions],
  );
  const visibleAppliedFilterSummaryItems = appliedFilterSummaryItems.slice(0, 3);
  const remainingAppliedFilterCount = Math.max(appliedFilterSummaryItems.length - visibleAppliedFilterSummaryItems.length, 0);
  const personFilterLabel = getPersonFilterLabel(kind);
  const personPlaceholder = getPersonPlaceholder(kind, personOptions.length);
  const fieldLabelClassName =
    "text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]";

  useEffect(() => {
    setDraftFilters(currentFilters);
  }, [currentFilters]);

  useEffect(() => {
    setOpenPanel(null);
  }, [routeSignature]);

  useEffect(() => {
    if (!isPending) {
      setPendingAction(null);
    }
  }, [isPending]);

  useEffect(() => {
    if (openPanel !== "filter") {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    const focusTimeout = window.setTimeout(() => {
      filterCloseButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimeout);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openPanel]);

  useEffect(() => {
    if (previousOpenPanelRef.current === "filter" && openPanel !== "filter") {
      filterButtonRef.current?.focus();
    }

    previousOpenPanelRef.current = openPanel;
  }, [openPanel]);

  const navigateToHref = (href: string) => {
    if (isSameHref(href, currentHref)) {
      setOpenPanel(null);
      return false;
    }

    if (openPanel === "filter") {
      flushSync(() => {
        setOpenPanel(null);
      });
    }

    router.push(href);
    return true;
  };

  const updateDraftFilters = (updater: (currentValue: ExpensePageFilterState) => ExpensePageFilterState) => {
    setDraftFilters((currentValue) => updater(currentValue));
  };

  const handleFilterToggle = () => {
    if (openPanel !== "filter") {
      setIsAdvancedOpen(getAdvancedFilterCount(draftFilters) > 0);
    }

    setOpenPanel((currentValue) => (currentValue === "filter" ? null : "filter"));
  };

  const handleDatePresetSelect = (preset: ExpenseQuickDatePreset) => {
    if (preset === "custom") {
      return;
    }

    const nextDateRange = preset === "last-month" ? getLastMonthExpenseDateRange() : getCurrentMonthDashboardDateRange();

    updateDraftFilters((currentValue) => ({
      ...currentValue,
      from: nextDateRange.from,
      to: nextDateRange.to,
    }));
  };

  const handleApplyFilters = () => {
    const nextHref = buildExpensePageHref(currentPath, currentFilters, {
      ...draftFilters,
      page: 1,
    });

    setPendingAction("apply");
    startTransition(() => {
      const didNavigate = navigateToHref(nextHref);

      if (!didNavigate) {
        setPendingAction(null);
      }
    });
  };

  const handleResetFilters = () => {
    const currentMonthDateRange = getCurrentMonthDashboardDateRange();
    const nextHref = buildExpensePageHref(currentPath, currentFilters, {
      from: null,
      to: null,
      page: 1,
      dateField: "expense",
      categoryId: null,
      paymentMode: null,
      amountMin: null,
      amountMax: null,
      remarks: "all",
      employeeId: null,
      vendorId: null,
      sort: normalizeExpenseSortForKind(kind, "expense-date-desc"),
    });

    setDraftFilters((currentValue) => ({
      ...currentValue,
      from: currentMonthDateRange.from,
      to: currentMonthDateRange.to,
      page: 1,
      dateField: "expense",
      categoryId: null,
      paymentMode: null,
      amountMin: null,
      amountMax: null,
      remarks: "all",
      employeeId: null,
      vendorId: null,
      sort: normalizeExpenseSortForKind(kind, "expense-date-desc"),
    }));

    navigateToHref(nextHref);
  };

  const isApplyPending = isPending && pendingAction === "apply";

  const filterSheet = openPanel === "filter" ? (
    <div id={filterPanelId} role="dialog" aria-modal="true" aria-labelledby={filterTitleId} className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(var(--shadow)/0.28)] backdrop-blur-sm"
        aria-label="Close filters"
        onClick={() => setOpenPanel(null)}
      />

      <div className="absolute inset-y-0 right-0 w-full md:max-w-md">
        <div className={cn(getPanelCardClassName(), "flex h-full flex-col")}>
          <div className="flex items-center justify-between gap-4 border-b border-[rgb(var(--border)/0.62)] px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p id={filterTitleId} className="text-base font-semibold text-[rgb(var(--card-foreground))]">
                Filter expenses
              </p>
              <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                {activeFilterCount > 0 ? `${activeFilterCount} active filters` : "Filter by date, person, and spend details"}
              </p>
            </div>

            <button
              ref={filterCloseButtonRef}
              type="button"
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              )}
              onClick={() => setOpenPanel(null)}
              aria-label="Close filters"
              title="Close filters"
            >
              <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <section className="space-y-3">
                <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Date range</p>

                <div className="grid grid-cols-3 gap-2">
                  {expenseQuickDatePresetValues.map((preset) => {
                    const isActive = preset === currentDatePreset;

                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleDatePresetSelect(preset)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-semibold capitalize transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                          isActive
                            ? "border-[rgb(var(--primary)/0.38)] bg-[rgb(var(--primary-soft))] text-[rgb(var(--primary-soft-foreground))]"
                            : "border-[rgb(var(--border))] bg-[rgb(var(--background))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]",
                        )}
                      >
                        {preset.replace("-", " ")}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>From</span>
                    <Input
                      type="date"
                      value={draftFilters.from ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          from: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>To</span>
                    <Input
                      type="date"
                      value={draftFilters.to ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          to: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Category</span>
                  <Select
                    value={draftFilters.categoryId ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        categoryId: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  >
                    <option value="">All categories</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Payment mode</span>
                  <Select
                    value={draftFilters.paymentMode ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        paymentMode: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  >
                    <option value="">All payment modes</option>
                    {paymentModeValues.map((mode) => (
                      <option key={mode} value={mode}>
                        {getPaymentModeLabel(mode)}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <label className="space-y-2">
                <span className={fieldLabelClassName}>{personFilterLabel}</span>
                <Select
                  value={kind === "employee" ? draftFilters.employeeId ?? "" : draftFilters.vendorId ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      employeeId: kind === "employee" && event.target.value.length > 0 ? event.target.value : null,
                      vendorId: kind === "business" && event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  disabled={personOptions.length === 0}
                >
                  <option value="">{personPlaceholder}</option>
                  {kind === "employee"
                    ? employeeOptions.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {getOptionLabelForEmployee(employee, currentFilters.branchId)}
                        </option>
                      ))
                    : vendorOptions.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                </Select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Min amount</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={draftFilters.amountMin ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        amountMin: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  />
                </label>

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Max amount</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={draftFilters.amountMax ?? ""}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        amountMax: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  />
                </label>
              </div>

              <section className="overflow-hidden rounded-2xl border border-[rgb(var(--border)/0.62)] bg-[rgb(var(--background)/0.42)]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isAdvancedOpen}
                  aria-controls={advancedPanelId}
                  onClick={() => setIsAdvancedOpen((currentValue) => !currentValue)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Advanced filters</p>
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">
                      {advancedFilterCount > 0 ? `${advancedFilterCount} selected` : "View by and remarks"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {advancedFilterCount > 0 ? (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgb(var(--primary-soft))] px-2 text-xs font-semibold text-[rgb(var(--primary-soft-foreground))]">
                        {advancedFilterCount}
                      </span>
                    ) : null}
                    <ChevronDown
                      className={cn("h-4 w-4 text-[rgb(var(--muted-foreground))] transition-transform", isAdvancedOpen ? "rotate-180" : "")}
                      aria-hidden="true"
                      strokeWidth={1.9}
                    />
                  </div>
                </button>

                {isAdvancedOpen ? (
                  <div id={advancedPanelId} className="grid gap-3 border-t border-[rgb(var(--border)/0.62)] px-4 py-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className={fieldLabelClassName}>View by</span>
                      <Select
                        value={draftFilters.dateField}
                        onChange={(event) =>
                          updateDraftFilters((currentValue) => ({
                            ...currentValue,
                            dateField: event.target.value === "logged" ? "logged" : "expense",
                          }))
                        }
                        className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                      >
                        <option value="expense">Expense date</option>
                        <option value="logged">Logged date</option>
                      </Select>
                    </label>

                    <label className="space-y-2">
                      <span className={fieldLabelClassName}>Remarks</span>
                      <Select
                        value={draftFilters.remarks}
                        onChange={(event) =>
                          updateDraftFilters((currentValue) => ({
                            ...currentValue,
                            remarks:
                              event.target.value === "with" || event.target.value === "without" ? event.target.value : "all",
                          }))
                        }
                        className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                      >
                        <option value="all">All entries</option>
                        <option value="with">Has remarks</option>
                        <option value="without">No remarks</option>
                      </Select>
                    </label>
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          <div className="border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-4 py-4 sm:px-5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                className="h-11 rounded-2xl px-4 shadow-none"
                onClick={handleResetFilters}
                disabled={isApplyPending}
              >
                <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                Reset all
              </Button>
              <Button
                type="button"
                className="h-11 min-w-34 rounded-2xl px-5"
                onClick={handleApplyFilters}
                disabled={isApplyPending}
                aria-busy={isApplyPending}
              >
                {isApplyPending ? (
                  <>
                    <Spinner size="xs" ariaHidden className="mr-2" />
                    Applying...
                  </>
                ) : (
                  "Apply filters"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">{primaryFilterSummary}</p>

            {visibleAppliedFilterSummaryItems.length > 0 ? (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                {visibleAppliedFilterSummaryItems.map((item) => (
                  <DataPill key={item.key} tone={item.tone ?? "neutral"} appearance="outline">
                    {item.label}
                  </DataPill>
                ))}

                {remainingAppliedFilterCount > 0 ? (
                  <DataPill tone="neutral" appearance="outline">
                    +{remainingAppliedFilterCount} more
                  </DataPill>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start">
            <Button
              ref={filterButtonRef}
              type="button"
              variant="secondary"
              className="h-11 min-w-28 rounded-2xl px-4"
              aria-haspopup="dialog"
              aria-expanded={openPanel === "filter"}
              aria-controls={filterPanelId}
              onClick={handleFilterToggle}
              disabled={isApplyPending}
              aria-busy={isApplyPending}
            >
              {isApplyPending ? (
                <Spinner size="xs" ariaHidden className="mr-2" />
              ) : (
                <Filter className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              )}
              Filter
              {activeFilterCount > 0 ? (
                <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgb(var(--primary-soft))] px-2 text-xs font-semibold text-[rgb(var(--primary-soft-foreground))]">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

      </div>

      {filterSheet}
    </div>
  );
}
