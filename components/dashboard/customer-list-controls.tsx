"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, X } from "lucide-react";
import {
  AppliedFilterPills,
  type AppliedFilterSummaryItem,
} from "@/components/dashboard/applied-filter-pills";
import { FilterDrawerShell } from "@/components/dashboard/filter-drawer-shell";
import { FilterTriggerButton } from "@/components/dashboard/filter-trigger-button";
import { useFilterDrawer } from "@/components/dashboard/use-filter-drawer";
import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { getCustomerTypeTone } from "@/components/dashboard/data-pill";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildCustomerPageHref,
  customerQuickDatePresetValues,
  getCustomerQuickDatePreset,
  getLastMonthCustomerDateRange,
  type CustomerPageFilterState,
  type CustomerQuickDatePreset,
} from "@/lib/dashboard/customer-page-filters";
import { FILTER_FIELD_LABEL_CLASS } from "@/lib/dashboard/list-page-classes";
import { orderPaymentStatusValues, orderStatusValues } from "@/lib/dashboard/order-page-filters";
import { getCurrentMonthDashboardDateRange } from "@/lib/dashboard/page-filters";
import { cn } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";

type CustomerListControlsProps = {
  currentPath: string;
  currentFilters: CustomerPageFilterState;
  selectedBranchName: string;
  canCreate?: boolean;
};

const summaryCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const RESET_CUSTOMER_FILTERS: Partial<CustomerPageFilterState> = {
  page: 1,
  from: null,
  to: null,
  dateField: "created",
  status: "all",
  type: null,
  search: null,
  name: null,
  phone: null,
  alternatePhone: null,
  customerCode: null,
  customerNumericId: null,
  studioName: null,
  address: null,
  hasAlternatePhone: "all",
  hasStudioName: "all",
  hasAddress: "all",
  hasAvatar: "all",
  hasOrders: "all",
  orderCountMin: null,
  orderCountMax: null,
  lastOrderDateFrom: null,
  lastOrderDateTo: null,
  totalPayableMin: null,
  totalPayableMax: null,
  outstandingMin: null,
  outstandingMax: null,
  lastOrderStatus: null,
  lastPaymentStatus: null,
};

function toDraftFilters(filters: CustomerPageFilterState): CustomerPageFilterState {
  return filters;
}

function getActiveFilterCount(filters: CustomerPageFilterState) {
  let count = 0;

  if (filters.dateField !== "created") count += 1;
  if (filters.from || filters.to) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.type) count += 1;
  if (filters.search) count += 1;
  if (filters.name) count += 1;
  if (filters.phone) count += 1;
  if (filters.alternatePhone) count += 1;
  if (filters.customerCode) count += 1;
  if (filters.customerNumericId) count += 1;
  if (filters.studioName) count += 1;
  if (filters.address) count += 1;
  if (filters.hasAlternatePhone !== "all") count += 1;
  if (filters.hasStudioName !== "all") count += 1;
  if (filters.hasAddress !== "all") count += 1;
  if (filters.hasAvatar !== "all") count += 1;
  if (filters.hasOrders !== "all") count += 1;
  if (filters.orderCountMin || filters.orderCountMax) count += 1;
  if (filters.lastOrderDateFrom || filters.lastOrderDateTo) count += 1;
  if (filters.totalPayableMin || filters.totalPayableMax) count += 1;
  if (filters.outstandingMin || filters.outstandingMax) count += 1;
  if (filters.lastOrderStatus) count += 1;
  if (filters.lastPaymentStatus) count += 1;

  return count;
}

function getAdvancedFilterCount(filters: CustomerPageFilterState) {
  let count = 0;

  if (filters.hasOrders !== "all") count += 1;
  if (filters.orderCountMin || filters.orderCountMax) count += 1;
  if (filters.lastOrderDateFrom || filters.lastOrderDateTo) count += 1;
  if (filters.totalPayableMin || filters.totalPayableMax) count += 1;
  if (filters.outstandingMin || filters.outstandingMax) count += 1;
  if (filters.lastOrderStatus) count += 1;
  if (filters.lastPaymentStatus) count += 1;

  return count;
}

function formatSummaryAmount(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return summaryCurrencyFormatter.format(parsed);
}

function buildPrimaryFilterSummary(filters: CustomerPageFilterState) {
  const dateFieldLabel = filters.dateField === "updated" ? "Updated date" : "Created date";

  if (!filters.from && !filters.to) {
    return `${dateFieldLabel} · All customers`;
  }

  const preset = getCustomerQuickDatePreset({ from: filters.from, to: filters.to });
  const rangeLabel =
    preset === "this-month"
      ? "This month"
      : preset === "last-month"
        ? "Last month"
        : formatDateRangeLabel(filters.from, filters.to);

  return `${dateFieldLabel} · ${rangeLabel}`;
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildAppliedFilterSummaryItems(
  filters: CustomerPageFilterState,
  branchName: string,
): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [{ key: "branch", label: `Branch: ${branchName}` }];

  if (filters.status !== "all") {
    items.push({ key: "status", label: `Status: ${capitalizeFirst(filters.status)}` });
  }

  if (filters.type) {
    items.push({
      key: "type",
      label: `Type: ${capitalizeFirst(filters.type)}`,
      tone: getCustomerTypeTone(filters.type),
    });
  }

  if (filters.search) items.push({ key: "search", label: `Search: ${filters.search}` });
  if (filters.name) items.push({ key: "name", label: `Name: ${filters.name}` });
  if (filters.phone) items.push({ key: "phone", label: `Phone: ${filters.phone}` });
  if (filters.alternatePhone)
    items.push({ key: "alt-phone", label: `Alt. phone: ${filters.alternatePhone}` });
  if (filters.customerCode)
    items.push({ key: "customer-code", label: `Code: ${filters.customerCode}` });
  if (filters.customerNumericId)
    items.push({ key: "customer-id", label: `ID: ${filters.customerNumericId}` });
  if (filters.studioName)
    items.push({ key: "studio-name", label: `Studio: ${filters.studioName}` });
  if (filters.address) items.push({ key: "address", label: `Address: ${filters.address}` });

  if (filters.hasAvatar === "with") items.push({ key: "has-avatar", label: "Has avatar" });
  else if (filters.hasAvatar === "without") items.push({ key: "no-avatar", label: "No avatar" });

  if (filters.hasAlternatePhone === "with")
    items.push({ key: "has-alt-phone", label: "Has alt. phone" });
  else if (filters.hasAlternatePhone === "without")
    items.push({ key: "no-alt-phone", label: "No alt. phone" });

  if (filters.hasStudioName === "with") items.push({ key: "has-studio", label: "Has studio" });
  else if (filters.hasStudioName === "without")
    items.push({ key: "no-studio", label: "No studio" });

  if (filters.hasAddress === "with") items.push({ key: "has-address", label: "Has address" });
  else if (filters.hasAddress === "without") items.push({ key: "no-address", label: "No address" });

  if (filters.hasOrders !== "all") {
    items.push({
      key: "has-orders",
      label: filters.hasOrders === "yes" ? "Has orders" : "No orders",
    });
  }

  const orderCountMin = filters.orderCountMin;
  const orderCountMax = filters.orderCountMax;

  if (orderCountMin || orderCountMax) {
    if (orderCountMin && orderCountMax)
      items.push({ key: "order-count", label: `Orders: ${orderCountMin}–${orderCountMax}` });
    else if (orderCountMin)
      items.push({ key: "order-count", label: `Min ${orderCountMin} orders` });
    else items.push({ key: "order-count", label: `Max ${orderCountMax} orders` });
  }

  if (filters.lastOrderDateFrom || filters.lastOrderDateTo) {
    items.push({
      key: "last-order-date",
      label: `Last order: ${formatDateRangeLabel(filters.lastOrderDateFrom, filters.lastOrderDateTo)}`,
    });
  }

  const payableMin = formatSummaryAmount(filters.totalPayableMin);
  const payableMax = formatSummaryAmount(filters.totalPayableMax);

  if (payableMin || payableMax) {
    if (payableMin && payableMax)
      items.push({ key: "payable", label: `Payable: ${payableMin}–${payableMax}` });
    else if (payableMin) items.push({ key: "payable", label: `Min payable ${payableMin}` });
    else items.push({ key: "payable", label: `Max payable ${payableMax}` });
  }

  const outstandingMin = formatSummaryAmount(filters.outstandingMin);
  const outstandingMax = formatSummaryAmount(filters.outstandingMax);

  if (outstandingMin || outstandingMax) {
    if (outstandingMin && outstandingMax)
      items.push({ key: "outstanding", label: `Outstanding: ${outstandingMin}–${outstandingMax}` });
    else if (outstandingMin)
      items.push({ key: "outstanding", label: `Min outstanding ${outstandingMin}` });
    else items.push({ key: "outstanding", label: `Max outstanding ${outstandingMax}` });
  }

  if (filters.lastOrderStatus) {
    items.push({
      key: "last-order-status",
      label: `Last status: ${capitalizeFirst(filters.lastOrderStatus)}`,
    });
  }

  if (filters.lastPaymentStatus) {
    items.push({
      key: "last-payment-status",
      label: `Last payment: ${capitalizeFirst(filters.lastPaymentStatus)}`,
    });
  }

  return items;
}

export function CustomerListControls({
  currentPath,
  currentFilters,
  selectedBranchName,
  canCreate = false,
}: CustomerListControlsProps) {
  const router = useRouter();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(!!currentFilters.search);
  const [searchValue, setSearchValue] = useState(currentFilters.search ?? "");
  const [, startSearchTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentHref = useMemo(
    () => buildCustomerPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const primaryFilterSummary = useMemo(
    () => buildPrimaryFilterSummary(currentFilters),
    [currentFilters],
  );
  const appliedFilterItems = useMemo(
    () => buildAppliedFilterSummaryItems(currentFilters, selectedBranchName),
    [currentFilters, selectedBranchName],
  );

  const {
    filterPanelId,
    filterTitleId,
    filterButtonRef,
    filterCloseButtonRef,
    isOpen,
    draftFilters,
    setDraftFilters,
    isApplyPending,
    handleFilterToggle: toggleFilterDrawer,
    closeDrawer,
    navigateToHref,
    startTransition,
    setPendingAction,
  } = useFilterDrawer({ currentHref, currentFilters, toDraftFilters });

  const baseId = filterPanelId.split("-filter-panel")[0];
  const advancedPanelId = `${baseId}-advanced-filters`;

  const currentDatePreset = getCustomerQuickDatePreset({
    from: draftFilters.from,
    to: draftFilters.to,
  });
  const advancedFilterCount = useMemo(() => getAdvancedFilterCount(draftFilters), [draftFilters]);

  const drawerSubtitle =
    activeFilterCount > 0
      ? `${activeFilterCount} active filters`
      : "Filter by type, date, and activity";

  const handleFilterToggle = () => {
    if (!isOpen) {
      setIsAdvancedOpen(getAdvancedFilterCount(draftFilters) > 0);
    }
    toggleFilterDrawer();
  };

  const updateDraftFilters = (
    updater: (currentValue: CustomerPageFilterState) => CustomerPageFilterState,
  ) => {
    setDraftFilters((currentValue) => updater(currentValue));
  };

  const handleDatePresetSelect = (preset: CustomerQuickDatePreset) => {
    if (preset === "custom") return;
    const nextDateRange =
      preset === "last-month"
        ? getLastMonthCustomerDateRange()
        : getCurrentMonthDashboardDateRange();
    updateDraftFilters((currentValue) => ({
      ...currentValue,
      from: nextDateRange.from,
      to: nextDateRange.to,
    }));
  };

  const handleClearDates = () => {
    updateDraftFilters((currentValue) => ({ ...currentValue, from: null, to: null }));
  };

  const handleApplyFilters = () => {
    const nextHref = buildCustomerPageHref(currentPath, currentFilters, {
      ...draftFilters,
      page: 1,
    });

    setPendingAction("apply");
    startTransition(() => {
      const didNavigate = navigateToHref(nextHref);
      if (!didNavigate) setPendingAction(null);
    });
  };

  const handleResetFilters = () => {
    const nextHref = buildCustomerPageHref(currentPath, currentFilters, RESET_CUSTOMER_FILTERS);

    setDraftFilters((currentValue) => ({ ...currentValue, ...RESET_CUSTOMER_FILTERS }));
    setSearchValue("");
    navigateToHref(nextHref);
  };

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = searchValue.trim();
    const current = currentFilters.search ?? "";
    if (trimmed === current) return;
    searchDebounceRef.current = setTimeout(() => {
      const nextHref = buildCustomerPageHref(currentPath, currentFilters, {
        search: trimmed.length > 0 ? trimmed : null,
        page: 1,
      });
      startSearchTransition(() => {
        router.push(nextHref, { scroll: false });
      });
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const handleSearchOpen = () => {
    setIsSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleSearchClear = () => {
    setSearchValue("");
    setIsSearchOpen(false);
    if (currentFilters.search) {
      const nextHref = buildCustomerPageHref(currentPath, currentFilters, {
        search: null,
        page: 1,
      });
      startSearchTransition(() => {
        router.push(nextHref, { scroll: false });
      });
    }
  };

  return (
    <div className="relative" aria-busy={isApplyPending}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
              {primaryFilterSummary}
            </p>

            <AppliedFilterPills items={appliedFilterItems} />
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 shadow-sm focus-within:ring-2 focus-within:ring-[rgb(var(--primary)/0.35)]">
                <Search
                  className="h-4 w-4 shrink-0 text-[rgb(var(--muted-foreground))]"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search by name, ID, mobile, or studio name"
                  className="h-10 w-48 min-w-0 bg-transparent text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--muted-foreground))] focus:outline-none sm:w-56"
                  aria-label="Search customers"
                />
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] focus-visible:outline-none"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSearchOpen}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--muted-foreground))] shadow-sm transition-colors hover:bg-[rgb(var(--muted)/0.5)] hover:text-[rgb(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label="Search customers"
              >
                <Search className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              </button>
            )}
            {canCreate ? (
              <Link
                href="/dashboard/customers/new"
                className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[rgb(var(--primary))] text-sm font-semibold text-[rgb(var(--primary-foreground))] shadow-[0_16px_40px_-32px_rgb(var(--shadow)/0.4)] transition-colors hover:bg-[rgb(var(--primary)/0.9)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:outline-none lg:w-auto lg:px-4"
              >
                <UserRoundPlus className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                <span className="hidden lg:inline">Add Customer</span>
              </Link>
            ) : null}
            <FilterTriggerButton
              ref={filterButtonRef}
              activeCount={activeFilterCount}
              isOpen={isOpen}
              isPending={isApplyPending}
              panelId={filterPanelId}
              onClick={handleFilterToggle}
            />
          </div>
        </div>
      </div>

      <FilterDrawerShell
        panelId={filterPanelId}
        titleId={filterTitleId}
        title="Filter customers"
        subtitle={drawerSubtitle}
        isOpen={isOpen}
        onClose={closeDrawer}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isPending={isApplyPending}
        closeButtonRef={filterCloseButtonRef}
      >
        <div className="space-y-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Date range</p>
              {(draftFilters.from || draftFilters.to) && (
                <button
                  type="button"
                  onClick={handleClearDates}
                  className="text-xs text-[rgb(var(--muted-foreground))] underline-offset-2 hover:underline"
                >
                  Clear dates
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {customerQuickDatePresetValues.map((preset) => {
                const isActive = preset === currentDatePreset;
                const label =
                  preset === "this-month"
                    ? "This month"
                    : preset === "last-month"
                      ? "Last month"
                      : "Custom";
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleDatePresetSelect(preset)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
                      isActive
                        ? "border-[rgb(var(--primary)/0.38)] bg-[rgb(var(--primary-soft))] text-[rgb(var(--primary-soft-foreground))]"
                        : "border-[rgb(var(--border))] bg-[rgb(var(--background))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>From</span>
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
                <span className={FILTER_FIELD_LABEL_CLASS}>To</span>
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

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Date field</span>
              <Select
                value={draftFilters.dateField}
                onChange={(event) =>
                  updateDraftFilters((currentValue) => ({
                    ...currentValue,
                    dateField: event.target.value === "updated" ? "updated" : "created",
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              >
                <option value="created">Created date</option>
                <option value="updated">Updated date</option>
              </Select>
            </label>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Customer</p>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Type</span>
                <Select
                  value={draftFilters.type ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      type: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                >
                  <option value="">All types</option>
                  <option value="studio">Studio</option>
                  <option value="amateur">Amateur</option>
                  <option value="other">Other</option>
                  <option value="employee">Employee</option>
                  <option value="lab">Lab</option>
                </Select>
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Status</span>
                <Select
                  value={draftFilters.status}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      status:
                        event.target.value === "active" || event.target.value === "inactive"
                          ? event.target.value
                          : "all",
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Name</span>
                <Input
                  type="text"
                  placeholder="Search name"
                  value={draftFilters.name ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      name: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Customer code</span>
                <Input
                  type="text"
                  placeholder="e.g. C-001"
                  value={draftFilters.customerCode ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      customerCode: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className={FILTER_FIELD_LABEL_CLASS}>Numeric ID</span>
              <Input
                type="text"
                placeholder="Search by numeric ID"
                value={draftFilters.customerNumericId ?? ""}
                onChange={(event) =>
                  updateDraftFilters((currentValue) => ({
                    ...currentValue,
                    customerNumericId: event.target.value.length > 0 ? event.target.value : null,
                  }))
                }
                className="h-11 rounded-2xl bg-[rgb(var(--background))]"
              />
            </label>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Contact</p>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Phone</span>
                <Input
                  type="text"
                  placeholder="Search phone"
                  value={draftFilters.phone ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      phone: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Alt. phone</span>
                <Input
                  type="text"
                  placeholder="Search alt. phone"
                  value={draftFilters.alternatePhone ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      alternatePhone: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Studio</p>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 space-y-2 sm:col-span-1">
                <span className={FILTER_FIELD_LABEL_CLASS}>Studio name</span>
                <Input
                  type="text"
                  placeholder="Search studio"
                  value={draftFilters.studioName ?? ""}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      studioName: event.target.value.length > 0 ? event.target.value : null,
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                />
              </label>

              <label className="col-span-2 space-y-2 sm:col-span-1">
                <span className={FILTER_FIELD_LABEL_CLASS}>Avatar</span>
                <Select
                  value={draftFilters.hasAvatar}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      hasAvatar:
                        event.target.value === "with" || event.target.value === "without"
                          ? event.target.value
                          : "all",
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                >
                  <option value="all">All</option>
                  <option value="with">Has avatar</option>
                  <option value="without">No avatar</option>
                </Select>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Presence</p>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Alt. phone</span>
                <Select
                  value={draftFilters.hasAlternatePhone}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      hasAlternatePhone:
                        event.target.value === "with" || event.target.value === "without"
                          ? event.target.value
                          : "all",
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                >
                  <option value="all">All</option>
                  <option value="with">Has alt. phone</option>
                  <option value="without">No alt. phone</option>
                </Select>
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Studio name</span>
                <Select
                  value={draftFilters.hasStudioName}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      hasStudioName:
                        event.target.value === "with" || event.target.value === "without"
                          ? event.target.value
                          : "all",
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                >
                  <option value="all">All</option>
                  <option value="with">Has studio</option>
                  <option value="without">No studio</option>
                </Select>
              </label>

              <label className="space-y-2">
                <span className={FILTER_FIELD_LABEL_CLASS}>Address</span>
                <Select
                  value={draftFilters.hasAddress}
                  onChange={(event) =>
                    updateDraftFilters((currentValue) => ({
                      ...currentValue,
                      hasAddress:
                        event.target.value === "with" || event.target.value === "without"
                          ? event.target.value
                          : "all",
                    }))
                  }
                  className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                >
                  <option value="all">All</option>
                  <option value="with">Has address</option>
                  <option value="without">No address</option>
                </Select>
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[rgb(var(--border)/0.62)] bg-[rgb(var(--background)/0.42)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={isAdvancedOpen}
              aria-controls={advancedPanelId}
              onClick={() => setIsAdvancedOpen((currentValue) => !currentValue)}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                  Activity filters
                </p>
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  {advancedFilterCount > 0
                    ? `${advancedFilterCount} selected`
                    : "Orders, payable, and outstanding"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {advancedFilterCount > 0 ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgb(var(--primary-soft))] px-2 text-xs font-semibold text-[rgb(var(--primary-soft-foreground))]">
                    {advancedFilterCount}
                  </span>
                ) : null}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-[rgb(var(--muted-foreground))] transition-transform",
                    isAdvancedOpen ? "rotate-180" : "",
                  )}
                  aria-hidden="true"
                  strokeWidth={1.9}
                />
              </div>
            </button>

            {isAdvancedOpen ? (
              <div
                id={advancedPanelId}
                className="space-y-3 border-t border-[rgb(var(--border)/0.62)] px-4 py-4"
              >
                <label className="space-y-2">
                  <span className={FILTER_FIELD_LABEL_CLASS}>Has orders</span>
                  <Select
                    value={draftFilters.hasOrders}
                    onChange={(event) =>
                      updateDraftFilters((currentValue) => ({
                        ...currentValue,
                        hasOrders:
                          event.target.value === "yes" || event.target.value === "no"
                            ? event.target.value
                            : "all",
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                  >
                    <option value="all">All customers</option>
                    <option value="yes">Has orders</option>
                    <option value="no">No orders</option>
                  </Select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Min orders</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={draftFilters.orderCountMin ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          orderCountMin: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Max orders</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="—"
                      value={draftFilters.orderCountMax ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          orderCountMax: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Last order from</span>
                    <Input
                      type="date"
                      value={draftFilters.lastOrderDateFrom ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          lastOrderDateFrom:
                            event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Last order to</span>
                    <Input
                      type="date"
                      value={draftFilters.lastOrderDateTo ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          lastOrderDateTo:
                            event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Min payable</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftFilters.totalPayableMin ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          totalPayableMin:
                            event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Max payable</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="—"
                      value={draftFilters.totalPayableMax ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          totalPayableMax:
                            event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Min outstanding</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftFilters.outstandingMin ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          outstandingMin: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Max outstanding</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="—"
                      value={draftFilters.outstandingMax ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          outstandingMax: event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Last order status</span>
                    <Select
                      value={draftFilters.lastOrderStatus ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          lastOrderStatus:
                            event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    >
                      <option value="">Any status</option>
                      {orderStatusValues.map((status) => (
                        <option key={status} value={status}>
                          {capitalizeFirst(status)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="space-y-2">
                    <span className={FILTER_FIELD_LABEL_CLASS}>Last payment status</span>
                    <Select
                      value={draftFilters.lastPaymentStatus ?? ""}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          lastPaymentStatus:
                            event.target.value.length > 0 ? event.target.value : null,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    >
                      <option value="">Any status</option>
                      {orderPaymentStatusValues.map((status) => (
                        <option key={status} value={status}>
                          {capitalizeFirst(status)}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </FilterDrawerShell>
    </div>
  );
}
