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
        <p className="text-sm text-slate-600">No low stock items found for this branch.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-600">
                  {item.sku} • {item.branchName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Quantity</p>
                <p className="font-semibold text-amber-700">{formatCompactNumber(item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

