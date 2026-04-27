"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type DialogSize = "sm" | "md" | "lg";

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: DialogSize;
  className?: string;
};

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
};

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("hidden") && el.offsetParent !== null,
  );
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
}: DialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => closeButtonRef.current?.focus(), 10);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const focusable = getFocusable(panelRef.current);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement;

        if (e.shiftKey) {
          if (active === first || !panelRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !panelRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(var(--shadow)/0.32)] backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.72)]",
          "bg-[rgb(var(--card)/0.98)] shadow-[0_32px_72px_-40px_rgb(var(--shadow)/0.36)] backdrop-blur-xl",
          "flex max-h-[min(90dvh,800px)] flex-col",
          sizeClasses[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[rgb(var(--border)/0.62)] px-5 py-4">
          <div className="min-w-0">
            <p
              id={titleId}
              className="text-base font-semibold text-[rgb(var(--card-foreground))]"
            >
              {title}
            </p>
            {description ? (
              <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">{description}</p>
            ) : null}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            )}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
