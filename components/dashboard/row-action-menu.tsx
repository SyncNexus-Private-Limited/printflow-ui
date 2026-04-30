"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type RowAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type RowActionMenuProps = {
  actions: RowAction[];
  label?: string;
};

type MenuPosition = {
  top: number;
  right: number;
};

export function RowActionMenu({ actions, label = "Row actions" }: RowActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
    setIsOpen(true);
  }

  function closeMenu() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
        return;
      }

      if (!menuRef.current) return;
      const items = Array.from(
        menuRef.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
      );
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement;
      const idx = items.indexOf(active as HTMLButtonElement);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
      } else if (e.key === "Tab") {
        e.preventDefault();
        closeMenu();
      }
    }

    function handleScroll() {
      if (isOpen) closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [isOpen]);

  function handleTriggerKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openMenu();
      setTimeout(() => {
        const first = menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
        first?.focus();
      }, 10);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card))]",
          "text-[rgb(var(--muted-foreground))] transition-colors hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]",
          "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
          isOpen &&
            "border-[rgb(var(--border))] bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]",
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {isOpen && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              style={{ top: position.top, right: position.right }}
              className={cn(
                "fixed z-60 min-w-40 overflow-hidden rounded-2xl border border-[rgb(var(--border)/0.72)]",
                "bg-[rgb(var(--card)/0.98)] shadow-[0_12px_32px_-16px_rgb(var(--shadow)/0.28)] backdrop-blur-xl",
                "py-1",
              )}
            >
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => {
                    closeMenu();
                    action.onClick();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium",
                    "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:outline-none focus-visible:ring-inset",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    action.destructive
                      ? "text-[rgb(var(--danger))] hover:bg-[rgb(var(--danger)/0.08)]"
                      : "text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))]",
                  )}
                >
                  {action.icon ? (
                    <span className="h-4 w-4 shrink-0" aria-hidden="true">
                      {action.icon}
                    </span>
                  ) : null}
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
