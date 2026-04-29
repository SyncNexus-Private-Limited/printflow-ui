"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ScrollState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

type TableScrollAreaProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  /** Total width (px) of all left-sticky columns. When set, a shadow appears at the boundary once the user scrolls. */
  stickyLeftWidth?: number;
};

export function TableScrollArea({
  children,
  className,
  viewportClassName,
  stickyLeftWidth,
}: TableScrollAreaProps) {
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
        canScrollRight:
          hasHorizontalOverflow &&
          viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
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
      <div
        ref={viewportRef}
        className={cn("dashboard-scrollbar overflow-x-auto pb-2", viewportClassName)}
      >
        {children}
      </div>

      {scrollState.canScrollLeft && stickyLeftWidth ? (
        <div
          className="pointer-events-none absolute inset-y-0 w-8 bg-linear-to-r from-[rgb(var(--shadow)/0.14)] via-[rgb(var(--shadow)/0.05)] to-transparent"
          style={{ left: stickyLeftWidth }}
          aria-hidden="true"
        />
      ) : null}

      {scrollState.canScrollRight ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-[rgb(var(--card)/0.98)] via-[rgb(var(--card)/0.9)] to-transparent"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
