import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Accent = "blue" | "emerald" | "amber" | "violet" | "rose" | "orange";

type MetricCardProps = {
  title: string;
  value: string;
  helperText: string;
  href: string;
  accent: Accent;
  stats: Array<{
    label: string;
    value: string;
  }>;
};

const accentClasses: Record<Accent, string> = {
  blue: "border-[rgb(var(--metric-blue)/0.18)] bg-[linear-gradient(180deg,rgb(var(--card))_0%,rgb(var(--metric-blue-soft))_125%)] text-[rgb(var(--metric-blue-ink))] shadow-[0_26px_60px_-42px_rgb(var(--metric-blue)/0.5)]",
  emerald:
    "border-[rgb(var(--metric-emerald)/0.18)] bg-[linear-gradient(180deg,rgb(var(--card))_0%,rgb(var(--metric-emerald-soft))_125%)] text-[rgb(var(--metric-emerald-ink))] shadow-[0_26px_60px_-42px_rgb(var(--metric-emerald)/0.38)]",
  amber:
    "border-[rgb(var(--metric-amber)/0.2)] bg-[linear-gradient(180deg,rgb(var(--card))_0%,rgb(var(--metric-amber-soft))_125%)] text-[rgb(var(--metric-amber-ink))] shadow-[0_26px_60px_-42px_rgb(var(--metric-amber)/0.35)]",
  violet:
    "border-[rgb(var(--metric-violet)/0.18)] bg-[linear-gradient(180deg,rgb(var(--card))_0%,rgb(var(--metric-violet-soft))_125%)] text-[rgb(var(--metric-violet-ink))] shadow-[0_26px_60px_-42px_rgb(var(--metric-violet)/0.38)]",
  rose: "border-[rgb(var(--metric-rose)/0.18)] bg-[linear-gradient(180deg,rgb(var(--card))_0%,rgb(var(--metric-rose-soft))_125%)] text-[rgb(var(--metric-rose-ink))] shadow-[0_26px_60px_-42px_rgb(var(--metric-rose)/0.35)]",
  orange:
    "border-[rgb(var(--metric-orange)/0.18)] bg-[linear-gradient(180deg,rgb(var(--card))_0%,rgb(var(--metric-orange-soft))_125%)] text-[rgb(var(--metric-orange-ink))] shadow-[0_26px_60px_-42px_rgb(var(--metric-orange)/0.35)]",
};

export function MetricCard({ title, value, helperText, href, accent, stats }: MetricCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-[24px] border p-5 transition-transform duration-200 hover:-translate-y-0.5",
        accentClasses[accent],
      )}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.18em]">{title}</p>
              <p className="text-3xl font-semibold tracking-tight text-[rgb(var(--card-foreground))]">{value}</p>
            </div>
            <div className="h-3 w-3 rounded-full bg-current opacity-80 transition-transform group-hover:scale-125" />
          </div>
          <p className="max-w-sm text-sm text-[rgb(var(--muted-foreground))]">{helperText}</p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[rgb(var(--border)/0.8)] bg-[rgb(var(--card)/0.8)] px-3 py-2"
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]">
                {stat.label}
              </p>
              <p className="mt-1 font-medium text-[rgb(var(--card-foreground))]">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
