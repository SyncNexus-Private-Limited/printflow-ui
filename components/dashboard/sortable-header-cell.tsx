"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  TABLE_HEADER_CELL_CLASS,
} from "@/lib/dashboard/list-page-classes";
import {
  type HeaderSortConfig,
  getSortDirection,
  getNextSortValue,
  getNextSortDirectionLabel,
} from "@/lib/dashboard/sortable-header-utils";
import {
  type StickySpec,
  getStickyHeaderCellClass,
  getStickyHeaderCellStyle,
} from "@/lib/dashboard/sticky-column-utils";

type SortableHeaderCellProps<TSortValue extends string> = {
  label: string;
  align?: "left" | "right";
  sortConfig: HeaderSortConfig<TSortValue>;
  currentSort: TSortValue;
  onSort: (nextSortValue: TSortValue) => void;
  /** Optional sticky spec produced by computeStickySpecs(). */
  stickySpec?: StickySpec;
};

export function SortableHeaderCell<TSortValue extends string>({
  label,
  align = "left",
  sortConfig,
  currentSort,
  onSort,
  stickySpec,
}: SortableHeaderCellProps<TSortValue>) {
  const activeDirection = getSortDirection(currentSort, sortConfig);
  const ariaSortValue =
    activeDirection === "asc" ? "ascending" : activeDirection === "desc" ? "descending" : "none";
  const nextDirectionLabel = getNextSortDirectionLabel(currentSort, sortConfig);
  const resolvedStickySpec = stickySpec ?? null;

  return (
    <th
      scope="col"
      aria-sort={ariaSortValue}
      className={cn(
        TABLE_HEADER_CELL_CLASS,
        align === "right" && "text-right",
        getStickyHeaderCellClass(resolvedStickySpec),
      )}
      style={getStickyHeaderCellStyle(resolvedStickySpec)}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 rounded-xl transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          align === "right" ? "justify-end text-right" : "justify-between text-left",
          activeDirection
            ? "text-[rgb(var(--card-foreground))]"
            : "hover:text-[rgb(var(--foreground))]",
        )}
        onClick={() => onSort(getNextSortValue(currentSort, sortConfig))}
        aria-label={`Sort ${label} ${nextDirectionLabel}`}
        title={`Sort ${label} ${nextDirectionLabel}`}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
          <ArrowUp
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              activeDirection === "asc"
                ? "text-[rgb(var(--primary))]"
                : "text-[rgb(var(--muted-foreground)/0.72)]",
            )}
            strokeWidth={2}
          />
          <ArrowDown
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              activeDirection === "desc"
                ? "text-[rgb(var(--primary))]"
                : "text-[rgb(var(--muted-foreground)/0.72)]",
            )}
            strokeWidth={2}
          />
        </span>
      </button>
    </th>
  );
}
