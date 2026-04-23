import type { ReactNode } from "react";
import { suggestCanonicalClasses, cn } from "@/lib/utils/cn";

export type DataPillTone = "neutral" | "blue" | "emerald" | "amber" | "violet" | "rose" | "orange";
type DataPillAppearance = "soft" | "outline";

type DataPillProps = {
  children: ReactNode;
  tone?: DataPillTone;
  appearance?: DataPillAppearance;
  className?: string;
};

const softToneClasses: Record<DataPillTone, string> = {
  neutral:
    "border-[rgb(var(--border)/0.78)] bg-[rgb(var(--muted)/0.84)] text-[rgb(var(--foreground)/0.72)]",
  blue:
    "border-[rgb(var(--metric-blue)/0.14)] bg-[rgb(var(--metric-blue-soft)/0.88)] text-[rgb(var(--metric-blue-ink))]",
  emerald:
    "border-[rgb(var(--metric-emerald)/0.16)] bg-[rgb(var(--metric-emerald-soft)/0.9)] text-[rgb(var(--metric-emerald-ink))]",
  amber:
    "border-[rgb(var(--metric-amber)/0.18)] bg-[rgb(var(--metric-amber-soft)/0.9)] text-[rgb(var(--metric-amber-ink))]",
  violet:
    "border-[rgb(var(--metric-violet)/0.16)] bg-[rgb(var(--metric-violet-soft)/0.9)] text-[rgb(var(--metric-violet-ink))]",
  rose:
    "border-[rgb(var(--metric-rose)/0.16)] bg-[rgb(var(--metric-rose-soft)/0.9)] text-[rgb(var(--metric-rose-ink))]",
  orange:
    "border-[rgb(var(--metric-orange)/0.16)] bg-[rgb(var(--metric-orange-soft)/0.9)] text-[rgb(var(--metric-orange-ink))]",
};

const outlineToneClasses: Record<DataPillTone, string> = {
  neutral:
    "border-[rgb(var(--border)/0.74)] bg-[rgb(var(--background)/0.92)] text-[rgb(var(--foreground)/0.72)]",
  blue:
    "border-[rgb(var(--metric-blue)/0.2)] bg-[rgb(var(--metric-blue-soft)/0.38)] text-[rgb(var(--metric-blue-ink))]",
  emerald:
    "border-[rgb(var(--metric-emerald)/0.22)] bg-[rgb(var(--metric-emerald-soft)/0.42)] text-[rgb(var(--metric-emerald-ink))]",
  amber:
    "border-[rgb(var(--metric-amber)/0.24)] bg-[rgb(var(--metric-amber-soft)/0.44)] text-[rgb(var(--metric-amber-ink))]",
  violet:
    "border-[rgb(var(--metric-violet)/0.22)] bg-[rgb(var(--metric-violet-soft)/0.42)] text-[rgb(var(--metric-violet-ink))]",
  rose:
    "border-[rgb(var(--metric-rose)/0.2)] bg-[rgb(var(--metric-rose-soft)/0.42)] text-[rgb(var(--metric-rose-ink))]",
  orange:
    "border-[rgb(var(--metric-orange)/0.2)] bg-[rgb(var(--metric-orange-soft)/0.42)] text-[rgb(var(--metric-orange-ink))]",
};

const expenseCategoryTones: DataPillTone[] = ["blue", "emerald", "amber", "violet", "rose", "orange"];

function hashCategoryKey(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function DataPill({
  children,
  tone = "neutral",
  appearance = "soft",
  className,
}: DataPillProps) {
  const toneClasses = appearance === "outline" ? outlineToneClasses : softToneClasses;

  return (
    <span
      className={cn(
        suggestCanonicalClasses(
          "inline-flex min-w-0 max-w-full items-center justify-center overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none tracking-[0.02em] text-ellipsis whitespace-nowrap",
        ),
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function getExpensePaymentModeTone(value: string): DataPillTone {
  switch (value) {
    case "cash":
      return "amber";
    case "upi":
      return "emerald";
    case "card":
      return "blue";
    case "credit":
      return "violet";
    default:
      return "neutral";
  }
}

export function getActiveUserRoleTone(role: string): DataPillTone {
  switch (role.toLowerCase()) {
    case "admin":
      return "violet";
    case "staff":
      return "emerald";
    default:
      return expenseCategoryTones[hashCategoryKey(role.toLowerCase()) % expenseCategoryTones.length];
  }
}

export function getExpenseCategoryTone(categoryKey: string): DataPillTone {
  const normalizedCategoryKey = categoryKey.trim().toUpperCase();

  if (!normalizedCategoryKey) {
    return "neutral";
  }

  return expenseCategoryTones[hashCategoryKey(normalizedCategoryKey) % expenseCategoryTones.length];
}

export function getInventoryStockStateTone(stockState: string): DataPillTone {
  switch (stockState) {
    case "in-stock":
      return "emerald";
    case "low-stock":
      return "amber";
    case "out-of-stock":
      return "rose";
    default:
      return "neutral";
  }
}
