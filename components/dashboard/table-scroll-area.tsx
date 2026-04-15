"use client";

import { MoveHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn, suggestCanonicalClasses } from "@/lib/utils/cn";

type ScrollState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

type TableScrollAreaProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
};

export function TableScrollArea({ children, className, viewportClassName }: TableScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState<ScrollState>({
    canScrollLeft: false,
    canScrollRight: false,
  });

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateScrollState = () => {
      const hasHorizontalOverflow = viewport.scrollWidth > viewport.clientWidth + 1;
      const nextScrollState = {
        canScrollLeft: hasHorizontalOverflow && viewport.scrollLeft > 1,
        canScrollRight: hasHorizontalOverflow && viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
      };

      setScrollState((currentState) => {
        if (
          currentState.canScrollLeft === nextScrollState.canScrollLeft &&
          currentState.canScrollRight === nextScrollState.canScrollRight
        ) {
          return currentState;
        }

        return nextScrollState;
      });
    };

    updateScrollState();

    viewport.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateScrollState();
          })
        : null;

    resizeObserver?.observe(viewport);

    const content = viewport.firstElementChild;

    if (content instanceof HTMLElement) {
      resizeObserver?.observe(content);
    }

    return () => {
      viewport.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [children]);

  return (
    <div className={cn("relative", className)}>
      <div ref={viewportRef} className={cn("dashboard-scrollbar overflow-x-auto pb-2", viewportClassName)}>
        {children}
      </div>

      {scrollState.canScrollRight ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-[rgb(var(--card)/0.98)] via-[rgb(var(--card)/0.9)] to-transparent"
            aria-hidden="true"
          />
          <div
            className={suggestCanonicalClasses(
              "pointer-events-none absolute right-2 top-2.5 inline-flex items-center gap-1 rounded-full border",
              "border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.9)] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--muted-foreground))] shadow-[0_16px_30px_-24px_rgb(var(--shadow)/0.14)] backdrop-blur-lg",
            )}
            aria-hidden="true"
          >
            <MoveHorizontal className="h-3.5 w-3.5" strokeWidth={1.9} />
            <span>Scroll</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
