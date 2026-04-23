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
import { DataPill, type DataPillTone } from "@/components/dashboard/data-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  buildCustomerPageHref,
  customerQuickDatePresetValues,
  getCustomerQuickDatePreset,
  getLastMonthCustomerDateRange,
  type CustomerPageFilterState,
  type CustomerQuickDatePreset,
} from "@/lib/dashboard/customer-page-filters";
import { orderPaymentStatusValues, orderStatusValues } from "@/lib/dashboard/order-page-filters";
import { getCurrentMonthDashboardDateRange } from "@/lib/dashboard/page-filters";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";

type CustomerListControlsProps = {
  currentPath: string;
  currentFilters: CustomerPageFilterState;
};

type CustomerControlPanel = "filter" | null;

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

function getActiveFilterCount(filters: CustomerPageFilterState) {
  let count = 0;

  if (filters.dateField !== "created") count += 1;
  if (getCustomerQuickDatePreset({ from: filters.from, to: filters.to }) !== "this-month") count += 1;
  if (filters.type) count += 1;
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
  const preset = getCustomerQuickDatePreset({ from: filters.from, to: filters.to });
  const rangeLabel =
    preset === "this-month"
      ? "This month"
      : preset === "last-month"
        ? "Last month"
        : formatDateRangeLabel(filters.from, filters.to);

  return `${filters.dateField === "updated" ? "Updated date" : "Created date"} · ${rangeLabel}`;
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildAppliedFilterSummaryItems(filters: CustomerPageFilterState): AppliedFilterSummaryItem[] {
  const items: AppliedFilterSummaryItem[] = [];

  if (filters.type) {
    const tone: DataPillTone =
      filters.type === "studio" ? "blue"
      : filters.type === "amateur" ? "emerald"
      : filters.type === "employee" ? "violet"
      : "neutral";
    items.push({ key: "type", label: `Type: ${capitalizeFirst(filters.type)}`, tone });
  }

  if (filters.name) {
    items.push({ key: "name", label: `Name: ${filters.name}` });
  }

  if (filters.phone) {
    items.push({ key: "phone", label: `Phone: ${filters.phone}` });
  }

  if (filters.alternatePhone) {
    items.push({ key: "alt-phone", label: `Alt. phone: ${filters.alternatePhone}` });
  }

  if (filters.customerCode) {
    items.push({ key: "customer-code", label: `Code: ${filters.customerCode}` });
  }

  if (filters.customerNumericId) {
    items.push({ key: "customer-id", label: `ID: ${filters.customerNumericId}` });
  }

  if (filters.studioName) {
    items.push({ key: "studio-name", label: `Studio: ${filters.studioName}` });
  }

  if (filters.address) {
    items.push({ key: "address", label: `Address: ${filters.address}` });
  }

  if (filters.hasAvatar === "with") {
    items.push({ key: "has-avatar", label: "Has avatar" });
  } else if (filters.hasAvatar === "without") {
    items.push({ key: "no-avatar", label: "No avatar" });
  }

  if (filters.hasAlternatePhone === "with") {
    items.push({ key: "has-alt-phone", label: "Has alt. phone" });
  } else if (filters.hasAlternatePhone === "without") {
    items.push({ key: "no-alt-phone", label: "No alt. phone" });
  }

  if (filters.hasStudioName === "with") {
    items.push({ key: "has-studio", label: "Has studio" });
  } else if (filters.hasStudioName === "without") {
    items.push({ key: "no-studio", label: "No studio" });
  }

  if (filters.hasAddress === "with") {
    items.push({ key: "has-address", label: "Has address" });
  } else if (filters.hasAddress === "without") {
    items.push({ key: "no-address", label: "No address" });
  }

  if (filters.hasOrders !== "all") {
    items.push({ key: "has-orders", label: filters.hasOrders === "yes" ? "Has orders" : "No orders" });
  }

  const orderCountMin = filters.orderCountMin;
  const orderCountMax = filters.orderCountMax;

  if (orderCountMin || orderCountMax) {
    if (orderCountMin && orderCountMax) {
      items.push({ key: "order-count", label: `Orders: ${orderCountMin}–${orderCountMax}` });
    } else if (orderCountMin) {
      items.push({ key: "order-count", label: `Min ${orderCountMin} orders` });
    } else {
      items.push({ key: "order-count", label: `Max ${orderCountMax} orders` });
    }
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
    if (payableMin && payableMax) {
      items.push({ key: "payable", label: `Payable: ${payableMin}–${payableMax}` });
    } else if (payableMin) {
      items.push({ key: "payable", label: `Min payable ${payableMin}` });
    } else {
      items.push({ key: "payable", label: `Max payable ${payableMax}` });
    }
  }

  const outstandingMin = formatSummaryAmount(filters.outstandingMin);
  const outstandingMax = formatSummaryAmount(filters.outstandingMax);

  if (outstandingMin || outstandingMax) {
    if (outstandingMin && outstandingMax) {
      items.push({ key: "outstanding", label: `Outstanding: ${outstandingMin}–${outstandingMax}` });
    } else if (outstandingMin) {
      items.push({ key: "outstanding", label: `Min outstanding ${outstandingMin}` });
    } else {
      items.push({ key: "outstanding", label: `Max outstanding ${outstandingMax}` });
    }
  }

  if (filters.lastOrderStatus) {
    items.push({ key: "last-order-status", label: `Last status: ${capitalizeFirst(filters.lastOrderStatus)}` });
  }

  if (filters.lastPaymentStatus) {
    items.push({ key: "last-payment-status", label: `Last payment: ${capitalizeFirst(filters.lastPaymentStatus)}` });
  }

  return items;
}

function getPanelCardClassName() {
  return suggestCanonicalClasses(
    "overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] shadow-[0_28px_64px_-42px_rgb(var(--shadow)/0.28)] backdrop-blur-xl",
  );
}

const RESET_CUSTOMER_FILTERS: Partial<CustomerPageFilterState> = {
  page: 1,
  dateField: "created",
  type: null,
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

export function CustomerListControls({
  currentPath,
  currentFilters,
}: CustomerListControlsProps) {
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
  const previousOpenPanelRef = useRef<CustomerControlPanel>(null);
  const [openPanel, setOpenPanel] = useState<CustomerControlPanel>(null);
  const [draftFilters, setDraftFilters] = useState<CustomerPageFilterState>(currentFilters);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"apply" | null>(null);
  const [isPending, startTransition] = useTransition();
  const currentHref = useMemo(() => buildCustomerPageHref(currentPath, currentFilters), [currentFilters, currentPath]);
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const primaryFilterSummary = useMemo(() => buildPrimaryFilterSummary(currentFilters), [currentFilters]);
  const currentDatePreset = getCustomerQuickDatePreset({ from: draftFilters.from, to: draftFilters.to });
  const advancedFilterCount = useMemo(() => getAdvancedFilterCount(draftFilters), [draftFilters]);
  const appliedFilterSummaryItems = useMemo(() => buildAppliedFilterSummaryItems(currentFilters), [currentFilters]);
  const visibleAppliedFilterSummaryItems = appliedFilterSummaryItems.slice(0, 3);
  const remainingAppliedFilterCount = Math.max(appliedFilterSummaryItems.length - visibleAppliedFilterSummaryItems.length, 0);
  const fieldLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]";

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

  const updateDraftFilters = (updater: (currentValue: CustomerPageFilterState) => CustomerPageFilterState) => {
    setDraftFilters((currentValue) => updater(currentValue));
  };

  const handleFilterToggle = () => {
    if (openPanel !== "filter") {
      setIsAdvancedOpen(getAdvancedFilterCount(draftFilters) > 0);
    }

    setOpenPanel((currentValue) => (currentValue === "filter" ? null : "filter"));
  };

  const handleDatePresetSelect = (preset: CustomerQuickDatePreset) => {
    if (preset === "custom") {
      return;
    }

    const nextDateRange = preset === "last-month" ? getLastMonthCustomerDateRange() : getCurrentMonthDashboardDateRange();

    updateDraftFilters((currentValue) => ({
      ...currentValue,
      from: nextDateRange.from,
      to: nextDateRange.to,
    }));
  };

  const handleApplyFilters = () => {
    const nextHref = buildCustomerPageHref(currentPath, currentFilters, {
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
    const resetOverrides = {
      ...RESET_CUSTOMER_FILTERS,
      from: currentMonthDateRange.from,
      to: currentMonthDateRange.to,
    };
    const nextHref = buildCustomerPageHref(currentPath, currentFilters, resetOverrides);

    setDraftFilters((currentValue) => ({ ...currentValue, ...resetOverrides }));
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
                Filter customers
              </p>
              <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                {activeFilterCount > 0 ? `${activeFilterCount} active filters` : "Filter by type, date, and activity"}
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
                  {customerQuickDatePresetValues.map((preset) => {
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

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Date field</span>
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

                <label className="space-y-2">
                  <span className={fieldLabelClassName}>Type</span>
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
                  </Select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={fieldLabelClassName}>Name</span>
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
                    <span className={fieldLabelClassName}>Customer code</span>
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
                  <span className={fieldLabelClassName}>Numeric ID</span>
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
                    <span className={fieldLabelClassName}>Phone</span>
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
                    <span className={fieldLabelClassName}>Alt. phone</span>
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
                    <span className={fieldLabelClassName}>Studio name</span>
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
                    <span className={fieldLabelClassName}>Avatar</span>
                    <Select
                      value={draftFilters.hasAvatar}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          hasAvatar: event.target.value === "with" || event.target.value === "without" ? event.target.value : "all",
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
                    <span className={fieldLabelClassName}>Alt. phone</span>
                    <Select
                      value={draftFilters.hasAlternatePhone}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          hasAlternatePhone: event.target.value === "with" || event.target.value === "without" ? event.target.value : "all",
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
                    <span className={fieldLabelClassName}>Studio name</span>
                    <Select
                      value={draftFilters.hasStudioName}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          hasStudioName: event.target.value === "with" || event.target.value === "without" ? event.target.value : "all",
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
                    <span className={fieldLabelClassName}>Address</span>
                    <Select
                      value={draftFilters.hasAddress}
                      onChange={(event) =>
                        updateDraftFilters((currentValue) => ({
                          ...currentValue,
                          hasAddress: event.target.value === "with" || event.target.value === "without" ? event.target.value : "all",
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
                    <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Activity filters</p>
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">
                      {advancedFilterCount > 0 ? `${advancedFilterCount} selected` : "Orders, payable, and outstanding"}
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
                  <div id={advancedPanelId} className="space-y-3 border-t border-[rgb(var(--border)/0.62)] px-4 py-4">
                    <label className="space-y-2">
                      <span className={fieldLabelClassName}>Has orders</span>
                      <Select
                        value={draftFilters.hasOrders}
                        onChange={(event) =>
                          updateDraftFilters((currentValue) => ({
                            ...currentValue,
                            hasOrders: event.target.value === "yes" || event.target.value === "no" ? event.target.value : "all",
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
                        <span className={fieldLabelClassName}>Min orders</span>
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
                        <span className={fieldLabelClassName}>Max orders</span>
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
                        <span className={fieldLabelClassName}>Last order from</span>
                        <Input
                          type="date"
                          value={draftFilters.lastOrderDateFrom ?? ""}
                          onChange={(event) =>
                            updateDraftFilters((currentValue) => ({
                              ...currentValue,
                              lastOrderDateFrom: event.target.value.length > 0 ? event.target.value : null,
                            }))
                          }
                          className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className={fieldLabelClassName}>Last order to</span>
                        <Input
                          type="date"
                          value={draftFilters.lastOrderDateTo ?? ""}
                          onChange={(event) =>
                            updateDraftFilters((currentValue) => ({
                              ...currentValue,
                              lastOrderDateTo: event.target.value.length > 0 ? event.target.value : null,
                            }))
                          }
                          className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-2">
                        <span className={fieldLabelClassName}>Min payable</span>
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
                              totalPayableMin: event.target.value.length > 0 ? event.target.value : null,
                            }))
                          }
                          className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className={fieldLabelClassName}>Max payable</span>
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
                              totalPayableMax: event.target.value.length > 0 ? event.target.value : null,
                            }))
                          }
                          className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-2">
                        <span className={fieldLabelClassName}>Min outstanding</span>
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
                        <span className={fieldLabelClassName}>Max outstanding</span>
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
                        <span className={fieldLabelClassName}>Last order status</span>
                        <Select
                          value={draftFilters.lastOrderStatus ?? ""}
                          onChange={(event) =>
                            updateDraftFilters((currentValue) => ({
                              ...currentValue,
                              lastOrderStatus: event.target.value.length > 0 ? event.target.value : null,
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
                        <span className={fieldLabelClassName}>Last payment status</span>
                        <Select
                          value={draftFilters.lastPaymentStatus ?? ""}
                          onChange={(event) =>
                            updateDraftFilters((currentValue) => ({
                              ...currentValue,
                              lastPaymentStatus: event.target.value.length > 0 ? event.target.value : null,
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
