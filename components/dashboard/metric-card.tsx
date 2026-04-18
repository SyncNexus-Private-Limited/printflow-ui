"use client";

import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/utils/cn";

export type MetricCardAccent = "blue" | "emerald" | "amber" | "violet" | "rose" | "orange";

export type MetricCardMetaItem = {
  label: string;
  value: string;
};

type MetricCardProps = {
  title: string;
  value: string;
  href: string;
  accent: MetricCardAccent;
  meta: MetricCardMetaItem[];
};

const accentClasses: Record<MetricCardAccent, string> = {
  blue: "border-[rgb(var(--metric-blue)/0.12)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-blue-soft)/0.86)_100%)] text-[rgb(var(--metric-blue-ink))] shadow-[0_24px_52px_-42px_rgb(var(--metric-blue)/0.22)]",
  emerald:
    "border-[rgb(var(--metric-emerald)/0.12)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-emerald-soft)/0.86)_100%)] text-[rgb(var(--metric-emerald-ink))] shadow-[0_24px_52px_-42px_rgb(var(--metric-emerald)/0.18)]",
  amber:
    "border-[rgb(var(--metric-amber)/0.14)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-amber-soft)/0.88)_100%)] text-[rgb(var(--metric-amber-ink))] shadow-[0_24px_52px_-42px_rgb(var(--metric-amber)/0.18)]",
  violet:
    "border-[rgb(var(--metric-violet)/0.12)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-violet-soft)/0.86)_100%)] text-[rgb(var(--metric-violet-ink))] shadow-[0_24px_52px_-42px_rgb(var(--metric-violet)/0.18)]",
  rose:
    "border-[rgb(var(--metric-rose)/0.12)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-rose-soft)/0.86)_100%)] text-[rgb(var(--metric-rose-ink))] shadow-[0_24px_52px_-42px_rgb(var(--metric-rose)/0.18)]",
  orange:
    "border-[rgb(var(--metric-orange)/0.12)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-orange-soft)/0.86)_100%)] text-[rgb(var(--metric-orange-ink))] shadow-[0_24px_52px_-42px_rgb(var(--metric-orange)/0.18)]",
};

export function MetricCard({ title, value, href, accent, meta }: MetricCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-3xl border p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 sm:p-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        "hover:shadow-[0_28px_54px_-42px_rgb(var(--shadow)/0.24)]",
        accentClasses[accent],
      )}
    >
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[rgb(var(--foreground)/0.82)]">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-[rgb(var(--card-foreground))]">{value}</p>
          </div>
          <div className="mt-1 h-3 w-3 rounded-full bg-current opacity-80 transition-transform group-hover:scale-125" />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[rgb(var(--muted-foreground)/0.96)]">
          {meta.map((item, index) => (
            <Fragment key={item.label}>
              {index > 0 ? <span aria-hidden="true">&middot;</span> : null}
              <span className="inline-flex items-baseline gap-1.5">
                <span>{item.label}</span>
                <span className="font-semibold text-[rgb(var(--card-foreground))]">{item.value}</span>
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </Link>
  );
}
