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
        <p className="text-sm text-slate-600">No recent orders found for this branch.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
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
                  <td className="py-3 font-medium text-slate-900">{order.orderCode}</td>
                  <td className="py-3 text-slate-700">{order.customerName}</td>
                  <td className="py-3 capitalize text-slate-700">{order.status}</td>
                  <td className="py-3 text-slate-700">{formatCurrency(order.payableAmount)}</td>
                  <td className="py-3 text-slate-700">{formatDate(order.orderDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

