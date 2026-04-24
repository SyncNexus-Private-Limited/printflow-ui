import type { CSSProperties } from "react";

/**
 * Computed sticky metadata for one column, returned by computeStickySpecs.
 * Consumers apply this to both <th> and <td> via the helper functions below.
 */
export type StickySpec = {
  side: "left" | "right";
  /** Cumulative offset from the relevant viewport edge, in px. */
  offset: number;
  /**
   * True on the innermost sticky column for each side — the one that sits
   * at the boundary between sticky and scrolling content.
   * Use this to render the divider/shadow indicator.
   */
  isBoundary: boolean;
};

/**
 * Fields to add to a column definition to enable sticky behaviour.
 * Extend your per-page HeaderConfig with this (or spread it in).
 */
export type ColumnStickyDef = {
  /** Which viewport edge this column should stick to. */
  sticky?: "left" | "right";
  /**
   * Explicit order among same-side sticky columns.
   * 0 = closest to the relevant edge (left: 0 or right: 0).
   * When omitted, visual column order is used as the fallback.
   */
  stickyOrder?: number;
  /**
   * Explicit column width in px — required for reliable sticky offset
   * calculation. Must be consistent with the <col> width in <colgroup>.
   */
  width?: number;
};

/**
 * Given the full column-definition array, computes a StickySpec (or null)
 * for each column in the same positional order.
 *
 * The result is stable: the same input always produces the same output,
 * so it is safe to compute once outside of render or inside useMemo.
 */
export function computeStickySpecs<T extends ColumnStickyDef>(
  columns: T[],
): (StickySpec | null)[] {
  const specs: (StickySpec | null)[] = columns.map(() => null);

  // --- left-sticky ---
  // Sort by stickyOrder, falling back to column index (natural visual order).
  const leftCols = columns
    .map((col, i) => ({ col, i }))
    .filter(({ col }) => col.sticky === "left")
    .sort((a, b) => (a.col.stickyOrder ?? a.i) - (b.col.stickyOrder ?? b.i));

  let leftOffset = 0;
  for (let j = 0; j < leftCols.length; j++) {
    const { col, i } = leftCols[j];
    specs[i] = {
      side: "left",
      offset: leftOffset,
      isBoundary: j === leftCols.length - 1,
    };
    leftOffset += col.width ?? 0;
  }

  // --- right-sticky ---
  // stickyOrder 0 = rightmost column (right: 0); fallback derives from reverse
  // column index so the last column in the array naturally gets order 0.
  const rightCols = columns
    .map((col, i) => ({ col, i }))
    .filter(({ col }) => col.sticky === "right")
    .sort((a, b) => {
      const ao = a.col.stickyOrder !== undefined ? a.col.stickyOrder : columns.length - 1 - a.i;
      const bo = b.col.stickyOrder !== undefined ? b.col.stickyOrder : columns.length - 1 - b.i;
      return ao - bo;
    });

  let rightOffset = 0;
  for (let j = 0; j < rightCols.length; j++) {
    const { col, i } = rightCols[j];
    specs[i] = {
      side: "right",
      offset: rightOffset,
      isBoundary: j === rightCols.length - 1,
    };
    rightOffset += col.width ?? 0;
  }

  return specs;
}

/**
 * Tailwind class additions for a sticky <th> header cell.
 * Pass the result (or "") to cn() alongside TABLE_HEADER_CELL_CLASS.
 */
export function getStickyHeaderCellClass(spec: StickySpec | null): string {
  if (!spec) return "";
  const parts = ["sticky z-[3]"];
  if (spec.isBoundary && spec.side === "left") {
    parts.push("border-r border-[rgb(var(--border)/0.65)]");
  }
  if (spec.isBoundary && spec.side === "right") {
    parts.push("border-l border-[rgb(var(--border)/0.65)]");
  }
  return parts.join(" ");
}

/**
 * Inline style for a sticky <th> header cell.
 * Sets the left/right offset AND an opaque background so scrolling content
 * does not bleed through the semi-transparent header background class.
 */
export function getStickyHeaderCellStyle(spec: StickySpec | null): CSSProperties {
  if (!spec) return {};
  return {
    ...(spec.side === "left" ? { left: spec.offset } : { right: spec.offset }),
    // CSS custom properties resolve in inline styles in all modern browsers.
    // This reliably overrides the semi-transparent bg set by TABLE_HEADER_CELL_CLASS.
    backgroundColor: "rgb(var(--muted))",
  };
}

/**
 * Tailwind + global class additions for a sticky <td> body cell.
 * Pass the result (or "") to cn() alongside TABLE_BODY_CELL_CLASS.
 *
 * Background is handled by the `table-sticky-body-cell` class defined in
 * globals.css, which uses background-color (opaque card base) + background-image
 * (semi-transparent muted gradient on group-hover) so the two layers composite
 * correctly. A plain Tailwind group-hover:bg-* would replace the solid base with
 * a semi-transparent color, causing scrolled text to bleed through on hover.
 *
 * IMPORTANT: the parent <tr> must carry the `group` Tailwind class for the
 * group-hover background-image to activate on hover.
 */
export function getStickyBodyCellClass(spec: StickySpec | null): string {
  if (!spec) return "";
  const parts = ["sticky z-[1]", "table-sticky-body-cell"];
  if (spec.isBoundary && spec.side === "left") {
    parts.push("border-r border-[rgb(var(--border)/0.38)]");
  }
  if (spec.isBoundary && spec.side === "right") {
    parts.push("border-l border-[rgb(var(--border)/0.38)]");
  }
  return parts.join(" ");
}

/**
 * Inline style for a sticky <td> body cell.
 * Background is handled via Tailwind classes (getStickyBodyCellClass).
 */
export function getStickyBodyCellStyle(spec: StickySpec | null): CSSProperties {
  if (!spec) return {};
  return spec.side === "left" ? { left: spec.offset } : { right: spec.offset };
}

/**
 * Returns the total cumulative width (px) of all sticky columns on the given
 * side — i.e. the pixel offset at which the sticky boundary sits.
 * Pass the result as `stickyLeftWidth` / `stickyRightWidth` to TableScrollArea.
 */
export function getStickyEdgeTotalWidth<T extends ColumnStickyDef>(
  columns: T[],
  side: "left" | "right",
): number {
  return columns
    .filter((col) => col.sticky === side)
    .reduce((sum, col) => sum + (col.width ?? 0), 0);
}
