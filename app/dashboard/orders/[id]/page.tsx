import { notFound, redirect } from "next/navigation";
import { DataPill, getOrderPaymentStatusLabel, getOrderStatusLabel } from "@/components/dashboard/data-pill";
import { SectionCard } from "@/components/dashboard/section-card";
import { OrderDetailActions } from "@/components/orders/order-detail-actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getOrderDetail } from "@/lib/orders/queries";
import { paymentModeLabels } from "@/lib/expenses/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type OrderDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-[rgb(var(--muted-foreground))]">{label}</p>
      <div className="mt-1 font-semibold text-[rgb(var(--foreground))]">{value}</div>
    </div>
  );
}

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const detail = await getOrderDetail(currentUser, id);
  if (!detail) notFound();

  const { order } = detail;
  const outstandingAmount = Math.max(0, order.payableAmount - order.paidAmount);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Order Details</p>
            <h1 className="text-3xl font-semibold text-[rgb(var(--foreground))]">
              {order.orderCode}
            </h1>
          </div>
          <OrderDetailActions
            orderId={order.id}
            orderCode={order.orderCode}
            status={order.status}
            outstandingAmount={outstandingAmount}
            canEdit={hasPermission(currentUser, "orders:edit")}
            canAddPayment={hasPermission(currentUser, "orders:add_payment")}
            canUpdateStatus={hasPermission(currentUser, "orders:update_status")}
            canCancel={hasPermission(currentUser, "orders:cancel")}
          />
        </div>

        <SectionCard title="Order summary">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Status" value={<DataPill>{getOrderStatusLabel(order.status)}</DataPill>} />
            <DetailRow label="Payment" value={getOrderPaymentStatusLabel(order.paymentStatus)} />
            <DetailRow label="Order date" value={formatDate(order.orderDate)} />
            <DetailRow label="Branch" value={order.branchName} />
            <DetailRow label="Subtotal" value={formatCurrency(order.totalAmount)} />
            <DetailRow label="Discount" value={formatCurrency(order.discountAmount)} />
            <DetailRow label="Payable" value={formatCurrency(order.payableAmount)} />
            <DetailRow label="Outstanding" value={formatCurrency(outstandingAmount)} />
          </div>
        </SectionCard>

        <SectionCard title="Customer details">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Name" value={order.customerName} />
            <DetailRow label="Phone" value={order.customerPhone} />
            <DetailRow label="Code" value={order.customerCode ?? "—"} />
            <DetailRow label="Type" value={order.customerType} />
          </div>
        </SectionCard>

        <SectionCard title="Order items">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border)/0.58)]">
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4 text-right">Qty</th>
                  <th className="py-2 pr-4 text-right">Rate</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id} className="border-b border-[rgb(var(--border)/0.4)]">
                    <td className="py-3 pr-4 font-medium">{item.name}</td>
                    <td className="py-3 pr-4 text-right">{item.quantity} {item.unit}</td>
                    <td className="py-3 pr-4 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-3 text-right">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Applied offers">
            <div className="space-y-3">
              {detail.offers.length === 0 ? <p className="text-sm text-[rgb(var(--muted-foreground))]">No offers applied.</p> : null}
              {detail.offers.map((offer) => (
                <DetailRow key={offer.id} label={offer.code} value={`${offer.name} - ${formatCurrency(offer.discountAmount)}`} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Payments received">
            <div className="space-y-3">
              {detail.payments.length === 0 ? <p className="text-sm text-[rgb(var(--muted-foreground))]">No payments recorded.</p> : null}
              {detail.payments.map((payment) => (
                <DetailRow
                  key={payment.id}
                  label={formatDate(payment.createdAt)}
                  value={`${formatCurrency(payment.amount)} via ${paymentModeLabels[payment.mode]}`}
                />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Vendor / outsource details">
            <div className="space-y-3">
              {detail.vendors.length === 0 ? <p className="text-sm text-[rgb(var(--muted-foreground))]">No vendor assigned.</p> : null}
              {detail.vendors.map((vendor) => (
                <DetailRow
                  key={vendor.id}
                  label={vendor.vendorName}
                  value={`${vendor.status} - ${formatCurrency(vendor.balanceAmount)} balance`}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Status history">
            <div className="space-y-3">
              {detail.auditLogs.length === 0 ? <p className="text-sm text-[rgb(var(--muted-foreground))]">No audit history yet.</p> : null}
              {detail.auditLogs.map((log) => (
                <DetailRow
                  key={log.id}
                  label={formatDate(log.createdAt)}
                  value={`${log.action.replaceAll("_", " ")} by ${log.changedByName ?? "system"}`}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
