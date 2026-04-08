import { SectionCard } from "@/components/dashboard/section-card";
import type { RecentOrderRow } from "@/lib/dashboard/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type RecentOrdersProps = {
  orders: RecentOrderRow[];
};

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <SectionCard title="Recent Orders" description="Latest orders for the selected branch view.">
      {orders.length === 0 ? (
        <p className="text-sm text-[rgb(var(--muted-foreground))]">No recent orders found for this branch.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[rgb(var(--muted-foreground))]">
              <tr>
                <th className="pb-3 font-medium">Order</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Payable</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="py-3 font-medium text-[rgb(var(--card-foreground))]">{order.orderCode}</td>
                  <td className="py-3 text-[rgb(var(--foreground)/0.85)]">{order.customerName}</td>
                  <td className="py-3 capitalize text-[rgb(var(--foreground)/0.85)]">{order.status}</td>
                  <td className="py-3 text-[rgb(var(--foreground)/0.85)]">{formatCurrency(order.payableAmount)}</td>
                  <td className="py-3 text-[rgb(var(--foreground)/0.85)]">{formatDate(order.orderDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
