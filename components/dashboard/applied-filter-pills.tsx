import type { DataPillTone } from "@/components/dashboard/data-pill";
import { DataPill } from "@/components/dashboard/data-pill";
import { cn } from "@/lib/utils/cn";

export type AppliedFilterSummaryItem = {
  key: string;
  label: string;
  tone?: DataPillTone;
};

type AppliedFilterPillsProps = {
  items: AppliedFilterSummaryItem[];
  maxVisible?: number;
  className?: string;
};

export function AppliedFilterPills({ items, maxVisible = 3, className }: AppliedFilterPillsProps) {
  if (items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(0, maxVisible);
  const remainingCount = Math.max(items.length - visibleItems.length, 0);

  return (
    <div className={cn("mt-2 flex min-w-0 flex-wrap items-center gap-2", className)}>
      {visibleItems.map((item) => (
        <DataPill key={item.key} tone={item.tone ?? "neutral"} appearance="outline">
          {item.label}
        </DataPill>
      ))}
      {remainingCount > 0 ? (
        <DataPill tone="neutral" appearance="outline">
          +{remainingCount} more
        </DataPill>
      ) : null}
    </div>
  );
}
