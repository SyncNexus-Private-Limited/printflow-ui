"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Boxes, ChevronDown, Plus, Receipt, ShoppingBag, Truck, UserRound, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type CreateAction = {
  key: string;
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
};

type CreateMenuProps = {
  currentBranchValue: string | null;
};

function buildCreateActionHref(path: string, currentBranchValue: string | null, extraSearchParams?: Record<string, string>) {
  const searchParams = new URLSearchParams();

  if (currentBranchValue) {
    searchParams.set("branchId", currentBranchValue);
  }

  if (extraSearchParams) {
    for (const [key, value] of Object.entries(extraSearchParams)) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

function normalizeHref(href: string) {
  const url = new URL(href, "https://printflow.local");
  const normalizedSearchParams = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) {
      return leftValue.localeCompare(rightValue);
    }

    return leftKey.localeCompare(rightKey);
  });
  const normalizedQuery = new URLSearchParams(normalizedSearchParams).toString();

  return `${url.pathname}?${normalizedQuery}`;
}

function isSameHref(leftHref: string, rightHref: string) {
  return normalizeHref(leftHref) === normalizeHref(rightHref);
}

function getCreateActions(currentBranchValue: string | null): CreateAction[] {
  return [
    {
      key: "order",
      label: "Add Order",
      shortLabel: "Order",
      href: buildCreateActionHref("/dashboard/orders/new", currentBranchValue),
      icon: ShoppingBag,
      disabled: true,
      disabledReason: "Coming soon",
    },
    {
      key: "customer",
      label: "Add Customer",
      shortLabel: "Customer",
      href: buildCreateActionHref("/dashboard/customers/new", currentBranchValue),
      icon: UserRound,
      disabled: true,
      disabledReason: "Coming soon",
    },
    {
      key: "expense",
      label: "Add Expense",
      shortLabel: "Expense",
      href: buildCreateActionHref("/dashboard/expenses/new", currentBranchValue, { type: "business" }),
      icon: Receipt,
    },
    {
      key: "item",
      label: "Add Item",
      shortLabel: "Item",
      href: buildCreateActionHref("/dashboard/inventory/new", currentBranchValue),
      icon: Boxes,
      disabled: true,
      disabledReason: "Coming soon",
    },
    {
      key: "vendor",
      label: "Add Vendor",
      shortLabel: "Vendor",
      href: buildCreateActionHref("/dashboard/vendors/new", currentBranchValue),
      icon: Truck,
      disabled: true,
      disabledReason: "Coming soon",
    },
    {
      key: "staff-account",
      label: "Add Staff Account",
      shortLabel: "Staff",
      href: buildCreateActionHref("/dashboard/users/new", currentBranchValue),
      icon: Users,
      disabled: true,
      disabledReason: "Coming soon",
    },
  ];
}

function getFocusableActionIndices(actions: CreateAction[]) {
  return actions.flatMap((action, index) => (action.disabled ? [] : [index]));
}

function useIsDesktopViewport() {
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");

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

export function CreateMenu({ currentBranchValue }: CreateMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktopViewport = useIsDesktopViewport();
  const baseId = useId();
  const desktopMenuId = `${baseId}-desktop-menu`;
  const mobileSheetId = `${baseId}-mobile-sheet`;
  const routeSignature = `${pathname}?${searchParams.toString()}`;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusTargetIndexRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const actions = useMemo(() => getCreateActions(currentBranchValue), [currentBranchValue]);
  const focusableActionIndices = useMemo(() => getFocusableActionIndices(actions), [actions]);
  const currentHref = useMemo(() => `${pathname}?${searchParams.toString()}`, [pathname, searchParams]);
  const activePanelId = isDesktopViewport ? desktopMenuId : mobileSheetId;

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    focusTargetIndexRef.current = null;

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  };

  const openMenu = (focusIndex?: number) => {
    focusTargetIndexRef.current = focusIndex ?? focusableActionIndices[0] ?? null;
    setIsOpen(true);
  };

  const focusActionByOffset = (currentIndex: number, direction: 1 | -1) => {
    if (focusableActionIndices.length === 0) {
      return;
    }

    const currentFocusableIndex = focusableActionIndices.indexOf(currentIndex);
    const nextFocusableIndex =
      currentFocusableIndex >= 0
        ? (currentFocusableIndex + direction + focusableActionIndices.length) % focusableActionIndices.length
        : direction === 1
          ? 0
          : focusableActionIndices.length - 1;
    const nextActionIndex = focusableActionIndices[nextFocusableIndex];

    itemRefs.current[nextActionIndex]?.focus();
  };

  const navigateToCreateAction = (action: CreateAction) => {
    if (action.disabled || isSameHref(action.href, currentHref)) {
      closeMenu(!action.disabled);
      return;
    }

    setIsOpen(false);
    router.push(action.href);
  };

  useEffect(() => {
    closeMenu();
  }, [routeSignature]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isDesktopViewport) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (wrapperRef.current?.contains(event.target)) {
        return;
      }

      closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isDesktopViewport, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const targetIndex = focusTargetIndexRef.current ?? focusableActionIndices[0];

    if (targetIndex === undefined) {
      return;
    }

    window.requestAnimationFrame(() => {
      itemRefs.current[targetIndex]?.focus();
    });
  }, [focusableActionIndices, isOpen]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(focusableActionIndices[0]);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(focusableActionIndices.at(-1));
    }
  };

  const handleActionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, actionIndex: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusActionByOffset(actionIndex, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusActionByOffset(actionIndex, -1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const firstActionIndex = focusableActionIndices[0];

      if (firstActionIndex !== undefined) {
        itemRefs.current[firstActionIndex]?.focus();
      }

      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const lastActionIndex = focusableActionIndices.at(-1);

      if (lastActionIndex !== undefined) {
        itemRefs.current[lastActionIndex]?.focus();
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlurCapture={(event) => {
        const nextFocusedElement = event.relatedTarget;

        if (nextFocusedElement instanceof Node && wrapperRef.current?.contains(nextFocusedElement)) {
          return;
        }

        closeMenu();
      }}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        className="h-10 w-10 px-0 shadow-[0_16px_40px_-32px_rgb(var(--shadow)/0.4)] sm:w-auto sm:rounded-2xl sm:px-3.5"
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }

          openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-label="Create new"
        title="Create new"
        aria-haspopup={isDesktopViewport ? "menu" : "dialog"}
        aria-expanded={isOpen}
        aria-controls={activePanelId}
      >
        <Plus className="h-4.5 w-4.5 shrink-0 sm:hidden" aria-hidden="true" strokeWidth={1.9} />
        <span className="hidden text-sm font-semibold sm:inline">Create</span>
        <ChevronDown
          className={cn("hidden h-4 w-4 shrink-0 text-[rgb(var(--muted-foreground))] transition-transform sm:inline", isOpen && "rotate-180")}
          aria-hidden="true"
          strokeWidth={1.9}
        />
      </Button>

      {isOpen && isDesktopViewport ? (
        <div
          id={desktopMenuId}
          role="menu"
          aria-label="Create new"
          className={cn(
            "absolute right-0 top-[calc(100%+0.55rem)] z-50 w-80 overflow-hidden rounded-[22px]",
            "border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] p-1.5 shadow-[0_24px_52px_-36px_rgb(var(--shadow)/0.22)] backdrop-blur-[14px]",
          )}
        >
          <div className="space-y-1">
            {actions.map((action, index) => {
              const Icon = action.icon;
              const helperText = action.disabled ? action.disabledReason ?? "Unavailable" : `Open ${action.shortLabel ?? action.label}`;

              return (
                <button
                  key={action.key}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  aria-disabled={action.disabled ? "true" : undefined}
                  onClick={() => navigateToCreateAction(action)}
                  onKeyDown={(event) => handleActionKeyDown(event, index)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-[18px] px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    action.disabled
                      ? "cursor-not-allowed opacity-72"
                      : "hover:bg-[rgb(var(--muted)/0.72)] focus-visible:bg-[rgb(var(--muted)/0.72)]",
                  )}
                  title={action.disabled ? `${action.label} (${helperText})` : action.label}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      action.disabled
                        ? "bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
                        : "bg-[rgb(var(--primary-soft))] text-[rgb(var(--primary-soft-foreground))]",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block text-sm font-semibold text-[rgb(var(--card-foreground))]">{action.label}</span>
                    <span className="block text-xs text-[rgb(var(--muted-foreground))]">{helperText}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {isOpen && !isDesktopViewport ? (
        <div className="fixed inset-0 z-70 sm:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgb(var(--shadow)/0.26)] backdrop-blur-[2px]"
            aria-label="Close create panel"
            onClick={() => closeMenu(true)}
          />
          <div className="absolute inset-x-3 bottom-3">
            <div
              id={mobileSheetId}
              role="dialog"
              aria-label="Create new"
              className={cn(
                "mx-auto w-full max-w-sm overflow-hidden rounded-[26px] border border-[rgb(var(--border)/0.8)]",
                "bg-[rgb(var(--card)/0.98)] p-2 shadow-[0_28px_60px_-34px_rgb(var(--shadow)/0.28)] backdrop-blur-lg",
              )}
            >
              <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Create new</p>
                  <p className="text-xs text-[rgb(var(--muted-foreground))]">Choose what to add next.</p>
                </div>
                <button
                  type="button"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                  )}
                  onClick={() => closeMenu(true)}
                  aria-label="Close create panel"
                  title="Close create panel"
                >
                  <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                </button>
              </div>

              <div className="space-y-1">
                {actions.map((action, index) => {
                  const Icon = action.icon;
                  const statusLabel = action.disabled ? action.disabledReason ?? "Unavailable" : "Open";

                  return (
                    <button
                      key={action.key}
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      type="button"
                      disabled={action.disabled}
                      aria-disabled={action.disabled ? "true" : undefined}
                      onClick={() => navigateToCreateAction(action)}
                      onKeyDown={(event) => handleActionKeyDown(event, index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[20px] px-3 py-3 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                        action.disabled
                          ? "cursor-not-allowed opacity-72"
                          : "bg-[rgb(var(--primary-soft)/0.54)] text-[rgb(var(--card-foreground))]",
                      )}
                      title={action.disabled ? `${action.label} (${statusLabel})` : action.label}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          action.disabled
                            ? "bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
                            : "bg-[rgb(var(--card))] text-[rgb(var(--primary-soft-foreground))]",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[rgb(var(--card-foreground))]">{action.label}</span>
                        {action.disabled ? (
                          <span className="mt-0.5 block text-xs text-[rgb(var(--muted-foreground))]">{statusLabel}</span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                          action.disabled
                            ? "bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
                            : "bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]",
                        )}
                      >
                        {action.disabled ? "Soon" : "Open"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
