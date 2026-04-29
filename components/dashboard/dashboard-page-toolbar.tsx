"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CalendarRange, ChevronDown, Download, MoreHorizontal, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isCurrentMonthDashboardDateRange,
  buildDashboardDateRangeHref,
  buildDashboardPageHref,
} from "@/lib/dashboard/page-filters";
import type {
  DashboardDateRange,
  DashboardPageFilterState,
  DashboardPageToolbarAction,
  DashboardPageToolbarMenuAction,
} from "@/lib/dashboard/types";
import { suggestCanonicalClasses, cn } from "@/lib/utils/cn";
import { formatDateRangeLabel } from "@/lib/utils/format";

type DashboardPageToolbarProps = {
  currentPath: string;
  currentFilters: DashboardPageFilterState;
  selectedFrom: string | null;
  selectedTo: string | null;
  variant?: "default" | "expense";
  exportAction?: DashboardPageToolbarAction;
  moreActions?: DashboardPageToolbarMenuAction[];
  createAction?: DashboardPageToolbarAction;
  createLabel?: string;
};

const DEFAULT_MORE_ACTIONS: DashboardPageToolbarMenuAction[] = [
  {
    key: "coming-soon",
    label: "More actions coming soon",
    disabled: true,
    disabledReason: "Coming soon",
  },
];

function normalizeDateRangeForNavigation(dateRange: DashboardDateRange) {
  if (dateRange.from && dateRange.to && dateRange.from > dateRange.to) {
    return {
      from: dateRange.to,
      to: dateRange.from,
    };
  }

  return dateRange;
}

function normalizeHref(href: string) {
  const url = new URL(href, "https://printflow.local");
  const normalizedSearchParams = Array.from(url.searchParams.entries()).sort(
    ([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }

      return leftKey.localeCompare(rightKey);
    },
  );
  const normalizedQuery = new URLSearchParams(normalizedSearchParams).toString();

  return normalizedQuery ? `${url.pathname}?${normalizedQuery}` : url.pathname;
}

function isSameHref(leftHref: string, rightHref: string) {
  return normalizeHref(leftHref) === normalizeHref(rightHref);
}

function buildActionButtonLabel(
  createAction: DashboardPageToolbarAction | undefined,
  createLabel?: string,
) {
  if (createLabel) {
    return createLabel;
  }

  return createAction?.label ?? "Create";
}

export function DashboardPageToolbar({
  currentPath,
  currentFilters,
  selectedFrom,
  selectedTo,
  variant = "default",
  exportAction,
  moreActions,
  createAction,
  createLabel,
}: DashboardPageToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const moreActionsButtonId = useId();
  const moreActionsMenuId = `${moreActionsButtonId}-menu`;
  const moreActionsRef = useRef<HTMLDivElement | null>(null);
  const [draftFrom, setDraftFrom] = useState(selectedFrom ?? "");
  const [draftTo, setDraftTo] = useState(selectedTo ?? "");
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const currentHref = useMemo(
    () => buildDashboardPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const resolvedMoreActions =
    moreActions && moreActions.length > 0 ? moreActions : DEFAULT_MORE_ACTIONS;
  const appliedDateRange = {
    from: selectedFrom,
    to: selectedTo,
  };
  const isCurrentMonthRange = isCurrentMonthDashboardDateRange(appliedDateRange);
  const appliedDateRangeLabel = isCurrentMonthRange
    ? "Current month"
    : formatDateRangeLabel(selectedFrom, selectedTo);
  const isDateRangeDirty = draftFrom !== (selectedFrom ?? "") || draftTo !== (selectedTo ?? "");
  const isExportDisabled = exportAction
    ? Boolean(exportAction.disabled) || !exportAction.href
    : true;
  const canResetDateRange = isDateRangeDirty || !isCurrentMonthRange;
  const isExpenseVariant = variant === "expense";

  useEffect(() => {
    setDraftFrom(selectedFrom ?? "");
  }, [selectedFrom]);

  useEffect(() => {
    setDraftTo(selectedTo ?? "");
  }, [selectedTo]);

  useEffect(() => {
    setIsMoreActionsOpen(false);
  }, [routeSignature]);

  useEffect(() => {
    if (!isMoreActionsOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (moreActionsRef.current?.contains(event.target)) {
        return;
      }

      setIsMoreActionsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMoreActionsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMoreActionsOpen]);

  const navigateToHref = (href: string) => {
    if (isSameHref(href, currentHref)) {
      return;
    }

    router.push(href);
  };

  const handleDateRangeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextDateRange = normalizeDateRangeForNavigation({
      from: draftFrom || null,
      to: draftTo || null,
    });
    const nextHref = buildDashboardDateRangeHref(currentPath, currentFilters, nextDateRange);

    navigateToHref(nextHref);
  };

  const handleClearDateRange = () => {
    const nextHref = buildDashboardDateRangeHref(currentPath, currentFilters, {
      from: null,
      to: null,
    });

    setDraftFrom("");
    setDraftTo("");
    navigateToHref(nextHref);
  };

  const handleToolbarAction = (
    action: DashboardPageToolbarAction | DashboardPageToolbarMenuAction | undefined,
  ) => {
    if (!action || action.disabled || !action.href) {
      return;
    }

    navigateToHref(action.href);
  };

  if (isExpenseVariant) {
    const expenseDateInputClass = suggestCanonicalClasses(
      "h-10 w-full min-w-0 rounded-2xl border border-[rgb(var(--border)/0.62)] bg-[rgb(var(--background)/0.82)] px-3 text-sm text-[rgb(var(--foreground))] shadow-sm outline-none transition",
      "focus:border-[rgb(var(--primary)/0.42)] focus:ring-4 focus:ring-[rgb(var(--primary)/0.12)]",
      "disabled:cursor-not-allowed disabled:opacity-60 sm:pl-14",
    );

    return (
      <section
        className={suggestCanonicalClasses(
          "rounded-3xl border border-[rgb(var(--border)/0.58)] bg-[rgb(var(--card)/0.78)] px-3 py-3 shadow-[0_18px_40px_-34px_rgb(var(--shadow)/0.18)] backdrop-blur-xl sm:px-4",
        )}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <form
            className="flex min-w-0 items-center gap-2 sm:gap-2.5"
            onSubmit={handleDateRangeSubmit}
          >
            <label className="relative min-w-0 flex-1 sm:w-42 sm:flex-none lg:w-44">
              <span className="sr-only">From date</span>
              <span className="pointer-events-none absolute top-1/2 left-3 hidden -translate-y-1/2 text-[10px] font-semibold tracking-[0.12em] text-[rgb(var(--muted-foreground))] uppercase sm:inline">
                From
              </span>
              <input
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
                className={expenseDateInputClass}
              />
            </label>

            <label className="relative min-w-0 flex-1 sm:w-42 sm:flex-none lg:w-44">
              <span className="sr-only">To date</span>
              <span className="pointer-events-none absolute top-1/2 left-3 hidden -translate-y-1/2 text-[10px] font-semibold tracking-[0.12em] text-[rgb(var(--muted-foreground))] uppercase sm:inline">
                To
              </span>
              <input
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
                className={expenseDateInputClass}
              />
            </label>

            <Button
              type="submit"
              className="h-10 rounded-2xl px-4 shadow-[0_18px_38px_-24px_rgb(var(--shadow)/0.42)]"
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-2xl px-3 text-[rgb(var(--muted-foreground))] shadow-none hover:text-[rgb(var(--foreground))]"
              disabled={!canResetDateRange}
              onClick={handleClearDateRange}
              title="Reset to current month"
            >
              Clear
            </Button>
          </form>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-2xl px-3 shadow-none sm:px-3.5"
              disabled={isExportDisabled}
              onClick={() => handleToolbarAction(exportAction)}
              aria-label={exportAction?.label ?? "Export"}
              title={
                exportAction?.disabled
                  ? (exportAction.disabledReason ?? exportAction.label)
                  : (exportAction?.label ?? "Export")
              }
            >
              <Download className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              {/* <span className="sr-only sm:ml-2 sm:not-sr-only">{exportAction?.label ?? "Export"}</span> */}
            </Button>

            <div ref={moreActionsRef} className="relative">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-3 shadow-none sm:px-3.5"
                aria-haspopup="menu"
                aria-expanded={isMoreActionsOpen}
                aria-controls={moreActionsMenuId}
                aria-label="More actions"
                title="More actions"
                onClick={() => setIsMoreActionsOpen((currentValue) => !currentValue)}
                onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setIsMoreActionsOpen(true);
                  }
                }}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                {/* <span className="sr-only sm:ml-2 sm:not-sr-only">More</span> */}
                <ChevronDown
                  className={cn(
                    "hidden h-4 w-4 text-[rgb(var(--muted-foreground))] transition-transform sm:ml-1 sm:block",
                    isMoreActionsOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                  strokeWidth={1.9}
                />
              </Button>

              {isMoreActionsOpen ? (
                <div
                  id={moreActionsMenuId}
                  role="menu"
                  aria-label="More actions"
                  className={suggestCanonicalClasses(
                    "absolute top-full right-0 z-40 mt-2 w-56 overflow-hidden rounded-3xl",
                    "border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.94)] p-1.5 shadow-[0_24px_52px_-36px_rgb(var(--shadow)/0.2)] backdrop-blur-xl",
                  )}
                >
                  <div className="space-y-1">
                    {resolvedMoreActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        role="menuitem"
                        disabled={action.disabled}
                        onClick={() => {
                          setIsMoreActionsOpen(false);
                          handleToolbarAction(action);
                        }}
                        className={cn(
                          "flex w-full flex-col rounded-2xl px-3 py-2 text-left transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
                          action.disabled
                            ? "cursor-not-allowed opacity-72"
                            : "hover:bg-[rgb(var(--muted)/0.72)] focus-visible:bg-[rgb(var(--muted)/0.72)]",
                        )}
                        title={
                          action.disabled
                            ? `${action.label} (${action.disabledReason ?? "Unavailable"})`
                            : action.label
                        }
                      >
                        <span className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                          {action.label}
                        </span>
                        <span className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
                          {action.disabled
                            ? (action.disabledReason ?? "Unavailable")
                            : "Open action"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const createButtonLabel = buildActionButtonLabel(createAction, createLabel);
  const isCreateDisabled = createAction
    ? Boolean(createAction.disabled) || !createAction.href
    : true;

  return (
    <section
      className={suggestCanonicalClasses(
        "rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.92)] px-3.5 py-3.5 shadow-[0_18px_44px_-36px_rgb(var(--shadow)/0.16)] backdrop-blur-lg sm:px-4",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 lg:gap-3">
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5"
          onSubmit={handleDateRangeSubmit}
        >
          <div
            className={suggestCanonicalClasses(
              "flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-[20px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--background)/0.72)] px-2.5 py-2 shadow-[0_16px_36px_-32px_rgb(var(--shadow)/0.14)] backdrop-blur-lg",
            )}
          >
            <div className="flex items-center gap-2 pr-1">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--primary-soft))] text-[rgb(var(--primary-soft-foreground))]">
                <CalendarRange className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[rgb(var(--foreground))]">Date range</p>
                <p className="truncate text-[11px] text-[rgb(var(--muted-foreground))]">
                  {appliedDateRangeLabel}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <label className="min-w-0 flex-1 sm:flex-none">
                <span className="sr-only">From date</span>
                <Input
                  type="date"
                  value={draftFrom}
                  onChange={(event) => setDraftFrom(event.target.value)}
                  className="h-9 min-w-0 rounded-xl border-[rgb(var(--border)/0.8)] bg-[rgb(var(--card)/0.94)] px-3 sm:w-38"
                />
              </label>
              <span className="hidden text-xs text-[rgb(var(--muted-foreground))] sm:inline">
                to
              </span>
              <label className="min-w-0 flex-1 sm:flex-none">
                <span className="sr-only">To date</span>
                <Input
                  type="date"
                  value={draftTo}
                  onChange={(event) => setDraftTo(event.target.value)}
                  className="h-9 min-w-0 rounded-xl border-[rgb(var(--border)/0.8)] bg-[rgb(var(--card)/0.94)] px-3 sm:w-38"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              variant="secondary"
              className={cn(
                "h-9 rounded-xl px-3.5",
                isDateRangeDirty &&
                  "border-[rgb(var(--primary)/0.28)] bg-[rgb(var(--primary-soft)/0.92)] text-[rgb(var(--primary-soft-foreground))] hover:bg-[rgb(var(--primary-soft))]",
              )}
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-9 rounded-xl px-3.5 text-[rgb(var(--muted-foreground))] shadow-none hover:text-[rgb(var(--foreground))]"
              disabled={!canResetDateRange}
              onClick={handleClearDateRange}
              title="Reset to current month"
            >
              Clear
            </Button>
          </div>
        </form>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-9 rounded-xl px-3.5"
            disabled={isExportDisabled}
            onClick={() => handleToolbarAction(exportAction)}
            title={
              exportAction?.disabled
                ? (exportAction.disabledReason ?? exportAction.label)
                : (exportAction?.label ?? "Export")
            }
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            {exportAction?.label ?? "Export"}
          </Button>

          <div ref={moreActionsRef} className="relative">
            <Button
              type="button"
              variant="secondary"
              className="h-9 rounded-xl px-3.5"
              aria-haspopup="menu"
              aria-expanded={isMoreActionsOpen}
              aria-controls={moreActionsMenuId}
              aria-label="More actions"
              title="More actions"
              onClick={() => setIsMoreActionsOpen((currentValue) => !currentValue)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setIsMoreActionsOpen(true);
                }
              }}
            >
              <MoreHorizontal className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
              More
              <ChevronDown
                className={cn(
                  "ml-2 h-4 w-4 text-[rgb(var(--muted-foreground))] transition-transform",
                  isMoreActionsOpen && "rotate-180",
                )}
                aria-hidden="true"
                strokeWidth={1.9}
              />
            </Button>

            {isMoreActionsOpen ? (
              <div
                id={moreActionsMenuId}
                role="menu"
                aria-label="More actions"
                className={suggestCanonicalClasses(
                  "absolute top-[calc(100%+0.55rem)] right-0 z-40 w-56 overflow-hidden rounded-[20px]",
                  "border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.94)] p-1.5 shadow-[0_24px_52px_-36px_rgb(var(--shadow)/0.2)] backdrop-blur-lg",
                )}
              >
                <div className="space-y-1">
                  {resolvedMoreActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      role="menuitem"
                      disabled={action.disabled}
                      onClick={() => {
                        setIsMoreActionsOpen(false);
                        handleToolbarAction(action);
                      }}
                      className={cn(
                        "flex w-full flex-col rounded-2xl px-3 py-2 text-left transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
                        action.disabled
                          ? "cursor-not-allowed opacity-72"
                          : "hover:bg-[rgb(var(--muted)/0.72)] focus-visible:bg-[rgb(var(--muted)/0.72)]",
                      )}
                      title={
                        action.disabled
                          ? `${action.label} (${action.disabledReason ?? "Unavailable"})`
                          : action.label
                      }
                    >
                      <span className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                        {action.label}
                      </span>
                      <span className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
                        {action.disabled ? (action.disabledReason ?? "Unavailable") : "Open action"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            className="h-9 rounded-xl px-4 shadow-[0_20px_40px_-28px_rgb(var(--shadow)/0.4)]"
            disabled={isCreateDisabled}
            onClick={() => handleToolbarAction(createAction)}
            title={
              createAction?.disabled
                ? (createAction.disabledReason ?? createButtonLabel)
                : createButtonLabel
            }
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            {createButtonLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
