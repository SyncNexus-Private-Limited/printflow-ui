import { suggestCanonicalClasses, cn } from "@/lib/utils/cn";

type ListStatCardAccent = "emerald" | "blue" | "violet" | "amber";

type ListStatCardProps = {
  label: string;
  value: string;
  meta: string;
  accent?: ListStatCardAccent;
  className?: string;
};

const accentClasses: Record<ListStatCardAccent, string> = {
  emerald:
    "border-[rgb(var(--metric-emerald)/0.14)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-emerald-soft)/0.88)_100%)] text-[rgb(var(--metric-emerald-ink))]",
  blue:
    "border-[rgb(var(--metric-blue)/0.14)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-blue-soft)/0.88)_100%)] text-[rgb(var(--metric-blue-ink))]",
  violet:
    "border-[rgb(var(--metric-violet)/0.14)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-violet-soft)/0.88)_100%)] text-[rgb(var(--metric-violet-ink))]",
  amber:
    "border-[rgb(var(--metric-amber)/0.16)] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--metric-amber-soft)/0.9)_100%)] text-[rgb(var(--metric-amber-ink))]",
};

export function ListStatCard({
  label,
  value,
  meta,
  accent = "blue",
  className,
}: ListStatCardProps) {
  return (
    <article
      className={cn(
        suggestCanonicalClasses(
          "relative overflow-hidden rounded-[28px] border px-5 py-5 shadow-[0_22px_50px_-42px_rgb(var(--shadow)/0.18)] backdrop-blur-lg",
          "sm:px-6 sm:py-5",
        ),
        accentClasses[accent],
        className,
      )}
    >
      <div className="absolute right-5 top-5 h-2.5 w-2.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--foreground)/0.7)]">{label}</p>
          <p className="text-3xl font-semibold tracking-tight text-[rgb(var(--card-foreground))] sm:text-[2rem]">{value}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--foreground)/0.64)]">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-55" aria-hidden="true" />
          <span>{meta}</span>
        </div>
      </div>
    </article>
  );
}
