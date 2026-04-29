"use client";

import type { ReactNode, RefObject } from "react";
import { Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";

type FilterDrawerShellProps = {
  panelId: string;
  titleId: string;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  isPending: boolean;
  closeButtonRef: RefObject<HTMLButtonElement>;
  children: ReactNode;
};

const panelCardClassName = suggestCanonicalClasses(
  "overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.96)] shadow-[0_28px_64px_-42px_rgb(var(--shadow)/0.28)] backdrop-blur-xl",
);

export function FilterDrawerShell({
  panelId,
  titleId,
  title,
  subtitle,
  isOpen,
  onClose,
  onApply,
  onReset,
  isPending,
  closeButtonRef,
  children,
}: FilterDrawerShellProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      id={panelId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(var(--shadow)/0.28)] backdrop-blur-sm"
        aria-label="Close filters"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full md:max-w-md">
        <div className={cn(panelCardClassName, "flex h-full flex-col")}>
          <div className="flex items-center justify-between gap-4 border-b border-[rgb(var(--border)/0.62)] px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p
                id={titleId}
                className="text-base font-semibold text-[rgb(var(--card-foreground))]"
              >
                {title}
              </p>
              {subtitle ? (
                <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{subtitle}</p>
              ) : null}
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))]",
                "focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none",
              )}
              onClick={onClose}
              aria-label="Close filters"
              title="Close filters"
            >
              <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

          <div className="border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-4 py-4 sm:px-5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                className="h-11 rounded-2xl px-4 shadow-none"
                onClick={onReset}
                disabled={isPending}
              >
                <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
                Reset all
              </Button>
              <Button
                type="button"
                className="h-11 min-w-34 rounded-2xl px-5"
                onClick={onApply}
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending ? (
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
  );
}
