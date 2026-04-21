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
import { Filter, Undo2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataPill } from "@/components/dashboard/data-pill";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  buildActiveUsersPageHref,
  type ActiveUserPageFilterState,
} from "@/lib/dashboard/active-users-page-filters";
import type { ActiveUserRoleOption } from "@/lib/dashboard/types";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";

type BranchOption = { label: string; value: string };

type ActiveUsersListControlsProps = {
  currentPath: string;
  currentFilters: ActiveUserPageFilterState;
  roleOptions: ActiveUserRoleOption[];
  branchOptions: BranchOption[];
  canSelectBranch: boolean;
};

type DraftFilterState = {
  role: string | null;
  branchId: string | null;
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

function getActiveFilterCount(filters: ActiveUserPageFilterState): number {
  return filters.role ? 1 : 0;
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getPanelCardClassName() {
  return suggestCanonicalClasses(
    "overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] shadow-[0_28px_64px_-42px_rgb(var(--shadow)/0.28)] backdrop-blur-xl",
  );
}

export function ActiveUsersListControls({
  currentPath,
  currentFilters,
  roleOptions,
  branchOptions,
  canSelectBranch,
}: ActiveUsersListControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseId = useId();
  const filterPanelId = `${baseId}-filter-panel`;
  const filterTitleId = `${baseId}-filter-title`;
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousOpenPanelRef = useRef<"filter" | null>(null);
  const [openPanel, setOpenPanel] = useState<"filter" | null>(null);
  const [draftFilters, setDraftFilters] = useState<DraftFilterState>({
    role: currentFilters.role,
    branchId: currentFilters.branchId,
  });
  const [pendingAction, setPendingAction] = useState<"apply" | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentHref = useMemo(
    () => buildActiveUsersPageHref(currentPath, currentFilters),
    [currentFilters, currentPath],
  );
  const activeFilterCount = useMemo(() => getActiveFilterCount(currentFilters), [currentFilters]);
  const showBranchSelect = canSelectBranch && branchOptions.length > 1;

  const appliedRoleLabel = currentFilters.role
    ? `Role: ${capitalizeFirst(currentFilters.role)}`
    : null;

  const fieldLabelClassName =
    "text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]";

  useEffect(() => {
    setDraftFilters({
      role: currentFilters.role,
      branchId: currentFilters.branchId,
    });
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

  const handleFilterToggle = () => {
    setOpenPanel((current) => (current === "filter" ? null : "filter"));
  };

  const handleApplyFilters = () => {
    const nextHref = buildActiveUsersPageHref(currentPath, currentFilters, {
      role: draftFilters.role,
      branchId: draftFilters.branchId,
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
    const nextHref = buildActiveUsersPageHref(currentPath, currentFilters, {
      role: null,
      branchId: null,
      page: 1,
    });

    setDraftFilters({ role: null, branchId: null });
    navigateToHref(nextHref);
  };

  const isApplyPending = isPending && pendingAction === "apply";

  const filterSheet =
    openPanel === "filter" ? (
      <div
        id={filterPanelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={filterTitleId}
        className="fixed inset-0 z-50"
      >
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
                <p
                  id={filterTitleId}
                  className="text-base font-semibold text-[rgb(var(--card-foreground))]"
                >
                  Filter sessions
                </p>
                <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} active ${activeFilterCount === 1 ? "filter" : "filters"}`
                    : "Narrow down active sessions"}
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
                <label className="block space-y-2">
                  <span className={fieldLabelClassName}>Role</span>
                  <Select
                    value={draftFilters.role ?? ""}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        role: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    disabled={roleOptions.length === 0}
                  >
                    <option value="">All roles</option>
                    {roleOptions.map((option) => (
                      <option key={option.role} value={option.role}>
                        {capitalizeFirst(option.role)}
                      </option>
                    ))}
                  </Select>
                </label>

                {showBranchSelect ? (
                  <label className="block space-y-2">
                    <span className={fieldLabelClassName}>Branch</span>
                    <Select
                      value={draftFilters.branchId ?? "all"}
                      onChange={(event) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          branchId: event.target.value === "all" ? null : event.target.value,
                        }))
                      }
                      className="h-11 rounded-2xl bg-[rgb(var(--background))]"
                    >
                      {branchOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : null}
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
            <p className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
              Active sessions
            </p>

            {appliedRoleLabel ? (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                <DataPill tone="neutral" appearance="outline">
                  {appliedRoleLabel}
                </DataPill>
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
