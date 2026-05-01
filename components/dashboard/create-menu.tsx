"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Boxes,
  ChevronDown,
  Plus,
  Receipt,
  ShoppingBag,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type CreateAction = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
};

type CreateMenuProps = {
  canCreateInventory: boolean;
  canCreateExpense: boolean;
  canCreateUser: boolean;
  canCreateVendor: boolean;
  canCreateOffer: boolean;
};

const STAFF_CREATE_USER_HREF =
  "/dashboard/users/new?branchId=12121212-1212-4212-8212-121212121212&role=staff";

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

  return `${url.pathname}?${normalizedQuery}`;
}

function isSameHref(leftHref: string, rightHref: string) {
  return normalizeHref(leftHref) === normalizeHref(rightHref);
}

function getCreateActions({
  canCreateInventory,
  canCreateExpense,
  canCreateUser,
  canCreateVendor,
  canCreateOffer,
}: CreateMenuProps): CreateAction[] {
  return [
    {
      key: "order",
      label: "Add Order",
      href: "/dashboard/orders/new",
      icon: ShoppingBag,
      disabled: true,
      disabledReason: "Coming soon",
    },
    {
      key: "customer",
      label: "Add Customer",
      href: "/dashboard/customers/new",
      icon: UserRound,
      disabled: true,
      disabledReason: "Coming soon",
    },
    {
      key: "inventory",
      label: "Add Inventory",
      href: "/dashboard/inventory/new",
      icon: Boxes,
      disabled: !canCreateInventory,
      disabledReason: "Unavailable",
    },
    {
      key: "expense",
      label: "Add Expense",
      href: "/dashboard/expenses/new",
      icon: Receipt,
      disabled: !canCreateExpense,
      disabledReason: "Unavailable",
    },
    {
      key: "user",
      label: "Add User",
      href: STAFF_CREATE_USER_HREF,
      icon: Users,
      disabled: !canCreateUser,
      disabledReason: "Unavailable",
    },
    {
      key: "offer",
      label: "Add Offer",
      href: "/dashboard/offers/new",
      icon: BadgePercent,
      disabled: !canCreateOffer,
      disabledReason: "Unavailable",
    },
    {
      key: "vendor",
      label: "Add Vendor",
      href: "/dashboard/vendors/new",
      icon: Truck,
      disabled: !canCreateVendor,
      disabledReason: "Unavailable",
    },
  ];
}

function getFocusableActionIndices(actions: CreateAction[]) {
  return actions.flatMap((action, index) => (action.disabled ? [] : [index]));
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

export function CreateMenu({
  canCreateInventory,
  canCreateExpense,
  canCreateUser,
  canCreateVendor,
  canCreateOffer,
}: CreateMenuProps) {
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
  const actions = useMemo(
    () =>
      getCreateActions({
        canCreateInventory,
        canCreateExpense,
        canCreateUser,
        canCreateVendor,
        canCreateOffer,
      }),
    [canCreateExpense, canCreateInventory, canCreateOffer, canCreateUser, canCreateVendor],
  );
  const focusableActionIndices = useMemo(() => getFocusableActionIndices(actions), [actions]);
  const currentHref = useMemo(
    () => `${pathname}?${searchParams.toString()}`,
    [pathname, searchParams],
  );
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
        ? (currentFocusableIndex + direction + focusableActionIndices.length) %
          focusableActionIndices.length
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

  const handleActionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    actionIndex: number,
  ) => {
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
        // On mobile the sheet is a portal outside this wrapper — don't close on blur.
        // The sheet closes via its own dismiss backdrop and X button.
        if (!isDesktopViewport) return;

        const nextFocusedElement = event.relatedTarget;

        if (
          nextFocusedElement instanceof Node &&
          wrapperRef.current?.contains(nextFocusedElement)
        ) {
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
          className={cn(
            "hidden h-4 w-4 shrink-0 text-[rgb(var(--muted-foreground))] transition-transform sm:inline",
            isOpen && "rotate-180",
          )}
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
            "absolute top-[calc(100%+0.55rem)] right-0 z-50 w-80 overflow-hidden rounded-[22px]",
            "border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] p-1.5 shadow-[0_24px_52px_-36px_rgb(var(--shadow)/0.22)] backdrop-blur-[14px] sm:w-64",
          )}
        >
          <div className="space-y-1">
            {actions.map((action, index) => {
              const Icon = action.icon;

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
                    "flex w-full items-center gap-2.5 rounded-[18px] px-3 py-2 text-left transition-colors",
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
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                      action.disabled
                        ? "bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))]"
                        : "bg-[rgb(var(--primary-soft))] text-[rgb(var(--primary-soft-foreground))]",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[rgb(var(--card-foreground))]">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {isOpen && !isDesktopViewport
        ? createPortal(
            // Portal to document.body so `fixed inset-0` is always viewport-relative,
            // escaping any stacking-context or compositing-layer ancestor in the nav.
            <div className="fixed inset-0 z-70">
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
                  <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-2">
                    <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
                      Create new
                    </p>
                    <button
                      type="button"
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))]",
                        "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
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
                            "flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left transition-colors",
                            "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
                            action.disabled
                              ? "cursor-not-allowed opacity-72"
                              : "bg-[rgb(var(--primary-soft)/0.54)] text-[rgb(var(--card-foreground))]",
                          )}
                          title={
                            action.disabled
                              ? `${action.label} (${action.disabledReason ?? "Unavailable"})`
                              : action.label
                          }
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
                            <span className="block truncate text-sm font-semibold text-[rgb(var(--card-foreground))]">
                              {action.label}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
