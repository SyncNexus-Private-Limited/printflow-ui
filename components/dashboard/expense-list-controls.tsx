"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowUpDown,
  CalendarRange,
  Check,
  Filter,
  IndianRupee,
  ReceiptText,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildExpensePageHref,
  expenseQuickDatePresetValues,
  getExpenseQuickDatePreset,
  getLastMonthExpenseDateRange,
  normalizeExpenseSortForKind,
  type ExpensePageFilterState,
  type ExpensePageKind,
  type ExpenseQuickDatePreset,
  type ExpenseSortValue,
} from "@/lib/dashboard/expense-page-filters";
import { getCurrentMonthDashboardDateRange } from "@/lib/dashboard/page-filters";
import type { ExpenseCategoryOption, ExpenseEmployeeOption, ExpenseVendorOption } from "@/lib/expenses/types";
import { getPaymentModeLabel, paymentModeValues } from "@/lib/expenses/types";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type ExpenseListControlsProps = {
  kind: ExpensePageKind;
  currentPath: string;
  currentFilters: ExpensePageFilterState;
  categoryOptions: ExpenseCategoryOption[];
  employeeOptions?: ExpenseEmployeeOption[];
  vendorOptions?: ExpenseVendorOption[];
};

type ExpenseControlPanel = "sort" | "filter" | null;

type ExpenseSortOption = {
  value: ExpenseSortValue;
  label: string;
  description: string;
};

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

function useIsDesktopViewport() {
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    setIsDesktopViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isDesktopViewport;
}

function getExpenseSortOptions(kind: ExpensePageKind): ExpenseSortOption[] {
  const sharedOptions: ExpenseSortOption[] = [
    { value: "logged-date-desc", label: "Logged date", description: "Newest first" },
    { value: "logged-date-asc", label: "Logged date", description: "Oldest first" },
    { value: "expense-date-desc", label: "Expense date", description: "Newest first" },
    { value: "expense-date-asc", label: "Expense date", description: "Oldest first" },
    { value: "amount-desc", label: "Amount", description: "High to low" },
    { value: "amount-asc", label: "Amount", description: "Low to high" },
    { value: "category-asc", label: "Category", description: "A to Z" },
    { value: "payment-asc", label: "Payment mode", description: "A to Z" },
    { value: "title-asc", label: "Title", description: "A to Z" },
  ];

  if (kind === "employee") {
    return [...sharedOptions, { value: "employee-asc", label: "Employee name", description: "A to Z" }];
  }

  return [...sharedOptions, { value: "vendor-asc", label: "Vendor name", description: "A to Z" }];
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

function buildFilterSummary(filters: ExpensePageFilterState) {
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
    return `${option.fullName} · ${option.branchName}`;
  }

  return option.fullName;
}

function getPanelCardClassName() {
  return suggestCanonicalClasses(
    "overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] shadow-[0_28px_64px_-42px_rgb(var(--shadow)/0.28)] backdrop-blur-xl",
  );
}

function getFilterPanelTitle(kind: ExpensePageKind) {
  return kind === "employee" ? "Employee expense filters" : "Business expense filters";
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
  const isDesktopViewport = useIsDesktopViewport();
  const { showBlockingLoader } = useGlobalLoader();
  const baseId = useId();
  const filterPanelId = `${baseId}-filter-panel`;
  const sortPanelId = `${baseId}-sort-panel`;
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [openPanel, setOpenPanel] = useState<ExpenseControlPanel>(null);
  const [draftFilters, setDraftFilters] = useState<ExpensePageFilterState>(currentFilters);
  const currentHref = useMemo(() => buildExpensePageHref(currentPath, currentFilters), [currentFilters, currentPath]);
  const sortOptions = useMemo(() => getExpenseSortOptions(kind), [kind]);
  const currentSortOption = useMemo(
    () => sortOptions.find((option) => option.value === currentFilters.sort) ?? sortOptions[0],
    [currentFilters.sort, sortOptions],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(kind, currentFilters), [currentFilters, kind]);
  const filterSummary = useMemo(() => buildFilterSummary(currentFilters), [currentFilters]);
  const currentDatePreset = getExpenseQuickDatePreset({
    from: draftFilters.from,
    to: draftFilters.to,
  });
  const personOptions = kind === "employee" ? employeeOptions : vendorOptions;
  const filterPanelTitle = getFilterPanelTitle(kind);
  const personFilterLabel = getPersonFilterLabel(kind);
  const personPlaceholder = getPersonPlaceholder(kind, personOptions.length);

  useEffect(() => {
    setDraftFilters(currentFilters);
  }, [currentFilters]);

  useEffect(() => {
    setOpenPanel(null);
  }, [routeSignature]);

  useEffect(() => {
    if (!openPanel || !isDesktopViewport) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (wrapperRef.current?.contains(event.target)) {
        return;
      }

      setOpenPanel(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isDesktopViewport, openPanel]);

  const navigateToHref = (href: string, loaderMessage: string) => {
    if (isSameHref(href, currentHref)) {
      setOpenPanel(null);
      return;
    }

    showBlockingLoader(loaderMessage, {
      autoHideOnRouteChange: true,
    });
    router.push(href);
  };

  const updateDraftFilters = (updater: (currentValue: ExpensePageFilterState) => ExpensePageFilterState) => {
    setDraftFilters((currentValue) => updater(currentValue));
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

    navigateToHref(nextHref, "Applying expense filters...");
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

    navigateToHref(nextHref, "Resetting expense filters...");
  };

  const handleSortSelect = (sortValue: ExpenseSortValue) => {
    const nextHref = buildExpensePageHref(currentPath, currentFilters, {
      page: 1,
      sort: sortValue,
    });

    navigateToHref(nextHref, "Updating expense sort...");
  };

  const filterContent = (
    <div className={cn(getPanelCardClassName(), "w-full md:w-[28rem]")}>
      <div className="border-b border-[rgb(var(--border)/0.62)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">{filterPanelTitle}</p>
            <p className="text-xs text-[rgb(var(--muted-foreground))]">Refine the list without leaving the page.</p>
          </div>
          {!isDesktopViewport ? (
            <button
              type="button"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              )}
              onClick={() => setOpenPanel(null)}
              aria-label="Close filters"
              title="Close filters"
            >
              <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgb(var(--primary-soft)/0.64)] text-[rgb(var(--primary-soft-foreground))]">
              <CalendarRange className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Date range</p>
              <p className="text-xs text-[rgb(var(--muted-foreground))]">Choose the date basis and range.</p>
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">View by</span>
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

          <div className="flex flex-wrap gap-2">
            {expenseQuickDatePresetValues.map((preset) => {
              const isActive = preset === currentDatePreset;

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleDatePresetSelect(preset)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">From</span>
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
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">To</span>
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

        <section className="space-y-3 border-t border-[rgb(var(--border)/0.58)] pt-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgb(var(--metric-amber-soft)/0.8)] text-[rgb(var(--metric-amber-ink))]">
              <ReceiptText className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Spend details</p>
              <p className="text-xs text-[rgb(var(--muted-foreground))]">Category, payment mode, amount, and remarks.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">Category</span>
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
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">Payment mode</span>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">
                <IndianRupee className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />
                Min amount
              </span>
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
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">
                <IndianRupee className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />
                Max amount
              </span>
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

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">Remarks</span>
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
        </section>

        <section className="space-y-3 border-t border-[rgb(var(--border)/0.58)] pt-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgb(var(--metric-blue-soft)/0.82)] text-[rgb(var(--metric-blue-ink))]">
              <UserRound className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">{personFilterLabel}</p>
              <p className="text-xs text-[rgb(var(--muted-foreground))]">
                Narrow the list by {kind === "employee" ? "staff member" : "vendor"} when needed.
              </p>
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">
              {personFilterLabel}
            </span>
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
        </section>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[rgb(var(--border)/0.62)] px-5 py-4 sm:flex-row sm:justify-between">
        <Button type="button" variant="secondary" className="h-11 rounded-2xl px-4 shadow-none" onClick={handleResetFilters}>
          <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
          Reset all
        </Button>
        <Button type="button" className="h-11 rounded-2xl px-5" onClick={handleApplyFilters}>
          Apply filters
        </Button>
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[rgb(var(--muted-foreground))]">{filterSummary}</p>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="relative">
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-2xl px-4"
              aria-haspopup="menu"
              aria-expanded={openPanel === "sort"}
              aria-controls={sortPanelId}
              onClick={() => setOpenPanel((currentValue) => (currentValue === "sort" ? null : "sort"))}
              onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpenPanel("sort");
                }
              }}
            >
              <ArrowUpDown className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              <span className="hidden sm:inline">Sort by</span>
              <span className="text-[rgb(var(--muted-foreground))] sm:ml-2 sm:text-sm">{currentSortOption.label}</span>
            </Button>
            {openPanel === "sort" && isDesktopViewport ? (
              <div id={sortPanelId} role="menu" aria-label="Sort expenses" className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-80">
                <div className={getPanelCardClassName()}>
                  <div className="border-b border-[rgb(var(--border)/0.62)] px-4 py-3">
                    <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Sort expenses</p>
                  </div>
                  <div className="space-y-1 p-2">
                    {sortOptions.map((option) => {
                      const isSelected = option.value === currentFilters.sort;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isSelected}
                          onClick={() => handleSortSelect(option.value)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                            isSelected ? "bg-[rgb(var(--primary-soft)/0.72)]" : "hover:bg-[rgb(var(--muted)/0.72)]",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border",
                              isSelected
                                ? "border-[rgb(var(--primary)/0.34)] bg-[rgb(var(--card))] text-[rgb(var(--primary))]"
                                : "border-[rgb(var(--border)/0.72)] bg-[rgb(var(--background))] text-[rgb(var(--muted-foreground))]",
                            )}
                          >
                            {isSelected ? (
                              <Check className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                            ) : (
                              <ArrowUpDown className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[rgb(var(--card-foreground))]">{option.label}</span>
                            <span className="block text-xs text-[rgb(var(--muted-foreground))]">{option.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-2xl px-4"
              aria-haspopup="dialog"
              aria-expanded={openPanel === "filter"}
              aria-controls={filterPanelId}
              onClick={() => setOpenPanel((currentValue) => (currentValue === "filter" ? null : "filter"))}
            >
              <Filter className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              Filter
              {activeFilterCount > 0 ? (
                <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgb(var(--primary-soft))] px-2 text-xs font-semibold text-[rgb(var(--primary-soft-foreground))]">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            {openPanel === "filter" && isDesktopViewport ? (
              <div id={filterPanelId} className="absolute right-0 top-[calc(100%+0.65rem)] z-50">
                {filterContent}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {openPanel && !isDesktopViewport ? (
        <div className="fixed inset-0 z-70 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgb(var(--shadow)/0.28)] backdrop-blur-[2px]"
            aria-label={`Close ${openPanel === "sort" ? "sort" : "filter"} panel`}
            onClick={() => setOpenPanel(null)}
          />
          <div className="absolute inset-x-3 bottom-3">
            {openPanel === "filter" ? (
              filterContent
            ) : (
              <div id={sortPanelId} className={cn(getPanelCardClassName(), "mx-auto w-full max-w-sm")}>
                <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border)/0.62)] px-5 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Sort expenses</p>
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">Pick the order that helps you scan fastest.</p>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    )}
                    onClick={() => setOpenPanel(null)}
                    aria-label="Close sort panel"
                    title="Close sort panel"
                  >
                    <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                  </button>
                </div>
                <div className="space-y-1 p-2">
                  {sortOptions.map((option) => {
                    const isSelected = option.value === currentFilters.sort;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSortSelect(option.value)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                          isSelected ? "bg-[rgb(var(--primary-soft)/0.72)]" : "hover:bg-[rgb(var(--muted)/0.72)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border",
                            isSelected
                              ? "border-[rgb(var(--primary)/0.34)] bg-[rgb(var(--card))] text-[rgb(var(--primary))]"
                              : "border-[rgb(var(--border)/0.72)] bg-[rgb(var(--background))] text-[rgb(var(--muted-foreground))]",
                          )}
                        >
                          {isSelected ? (
                            <Check className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                          ) : (
                            <ArrowUpDown className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-[rgb(var(--card-foreground))]">{option.label}</span>
                          <span className="block text-xs text-[rgb(var(--muted-foreground))]">{option.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
