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
  blue: "border-blue-200 bg-blue-50 text-blue-950",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  violet: "border-violet-200 bg-violet-50 text-violet-950",
  rose: "border-rose-200 bg-rose-50 text-rose-950",
  orange: "border-orange-200 bg-orange-50 text-orange-950",
};

export function MetricCard({ title, value, helperText, href, accent, stats }: MetricCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border p-5 transition-colors hover:border-slate-300 hover:bg-white",
        accentClasses[accent],
      )}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-slate-600">{helperText}</p>
        </div>
        <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md bg-white/70 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
              <p className="mt-1 font-medium text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

