import { SectionCard } from "@/components/dashboard/section-card";
import type { LowStockRow } from "@/lib/dashboard/types";
import { formatCompactNumber } from "@/lib/utils/format";

type LowStockPanelProps = {
  items: LowStockRow[];
};

export function LowStockPanel({ items }: LowStockPanelProps) {
  return (
    <SectionCard title="Low Stock Inventory" description="Items that need attention soon.">
      {items.length === 0 ? (
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          No low stock items found for this branch.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-[rgb(var(--metric-amber)/0.16)] bg-[rgb(var(--metric-amber-soft))] px-4 py-3"
            >
              <div>
                <p className="font-medium text-[rgb(var(--card-foreground))]">{item.name}</p>
                <p className="text-sm text-[rgb(var(--muted-foreground))]">
                  {item.sku} / {item.branchName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[rgb(var(--muted-foreground))]">Quantity</p>
                <p className="font-semibold text-[rgb(var(--metric-amber-ink))]">
                  {formatCompactNumber(item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
