import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  DataPill,
  getOrderPaymentStatusLabel,
  getOrderPaymentStatusTone,
  getOrderStatusLabel,
  getOrderStatusTone,
} from "@/components/dashboard/data-pill";
import { SectionCard } from "@/components/dashboard/section-card";
import { OrderDetailActions } from "@/components/orders/order-detail-actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { paymentModeLabels } from "@/lib/expenses/types";
import { getAddOrderPageData, getOrderDetail } from "@/lib/orders/queries";
import type { OrderDetailData } from "@/lib/orders/types";
import { formatCurrency, formatDate, formatDateTime, formatEnumLabel } from "@/lib/utils/format";

type OrderDetailsPageProps = {
  params: Promise<{ id: string }>;
};

type DetailRowProps = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

function DetailRow({ label, value, valueClassName }: DetailRowProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[rgb(var(--muted-foreground))]">{label}</p>
      <div
        className={
          valueClassName ?? "mt-1 font-semibold wrap-break-word text-[rgb(var(--foreground))]"
        }
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[rgb(var(--border)/0.76)] bg-[rgb(var(--muted)/0.18)] px-4 py-5 text-sm text-[rgb(var(--muted-foreground))]">
      {children}
    </div>
  );
}

function ResponsiveTable({
  headers,
  children,
}: {
  headers: Array<{ label: string; align?: "left" | "right" }>;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[rgb(var(--border)/0.58)] text-xs font-semibold tracking-[0.04em] text-[rgb(var(--muted-foreground))] uppercase">
            {headers.map((header) => (
              <th
                key={header.label}
                className={header.align === "right" ? "py-2 pl-4 text-right" : "py-2 pr-4"}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgb(var(--border)/0.42)]">{children}</tbody>
      </table>
    </div>
  );
}

function getVendorStatusLabel(status: string) {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "in_progress":
      return "In Progress";
    case "received":
      return "Received";
    case "cancelled":
      return "Cancelled";
    default:
      return formatEnumLabel(status);
  }
}

function getVendorStatusTone(status: string) {
  switch (status) {
    case "assigned":
      return "blue" as const;
    case "in_progress":
      return "amber" as const;
    case "received":
      return "emerald" as const;
    case "cancelled":
      return "rose" as const;
    default:
      return "neutral" as const;
  }
}

function getVendorPaymentStatus(vendor: { paidAmount: number; chargeAmount: number }) {
  if (vendor.paidAmount <= 0) return { label: "Unpaid", tone: "rose" as const };
  if (vendor.paidAmount < vendor.chargeAmount) return { label: "Partial", tone: "amber" as const };
  return { label: "Paid", tone: "emerald" as const };
}

function getAuditActionLabel(action: string) {
  switch (action) {
    case "create":
      return "Order created";
    case "order_updated":
      return "Order updated";
    case "items_updated":
      return "Items updated";
    case "discount_updated":
      return "Discount updated";
    case "status_changed":
      return "Status changed";
    case "customer_payment_added":
      return "Customer payment added";
    case "vendor_assigned":
      return "Vendor assigned";
    case "vendor_updated":
      return "Vendor updated";
    case "vendor_payment_recorded":
      return "Vendor payment recorded";
    case "cancelled":
      return "Cancelled";
    default:
      return formatEnumLabel(action);
  }
}

function summarizeChangedFields(log: OrderDetailData["auditLogs"][number]) {
  const fields = log.changedFields;
  if (fields && typeof fields === "object") {
    const keys = Object.keys(fields).filter((key) => key !== "action");
    if (keys.length > 0) {
      return `Changed ${keys.map(formatEnumLabel).join(", ")}`;
    }
  }

  switch (log.action) {
    case "create":
      return "Initial order snapshot recorded";
    case "order_updated":
      return "Customer or order details changed";
    case "items_updated":
      return "Order item lines were replaced";
    case "discount_updated":
      return "Applied offer or discount amount changed";
    case "status_changed":
      return "Order work status changed";
    case "customer_payment_added":
      return "Customer payment was recorded";
    case "vendor_assigned":
      return "Outsource vendor was assigned";
    case "vendor_updated":
      return "Vendor charge, status, delivery, or notes changed";
    case "vendor_payment_recorded":
      return "Vendor expense payment was recorded";
    case "cancelled":
      return "Order was marked cancelled";
    default:
      return "Audit snapshot recorded";
  }
}

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const detail = await getOrderDetail(currentUser, id);
  if (!detail) notFound();

  const { order } = detail;
  const orderPageData = await getAddOrderPageData(currentUser, order.branchId);
  const assignedVendor = detail.vendors[0] ?? null;
  const outstandingAmount = Math.max(0, order.payableAmount - order.paidAmount);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-xs font-medium text-[rgb(var(--muted-foreground))]"
        >
          <ol className="flex flex-wrap items-center gap-1">
            <li className="flex items-center gap-1">
              <Link
                className="rounded-md px-1 py-0.5 transition-colors hover:text-[rgb(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none"
                href="/dashboard"
              >
                Home
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} />
            </li>
            <li className="flex items-center gap-1">
              <Link
                className="rounded-md px-1 py-0.5 transition-colors hover:text-[rgb(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none"
                href="/dashboard/orders"
              >
                Sales
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} />
            </li>
            <li className="flex items-center gap-1">
              <Link
                className="rounded-md px-1 py-0.5 transition-colors hover:text-[rgb(var(--foreground))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none"
                href="/dashboard/orders"
              >
                Orders
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} />
            </li>
            <li className="px-1 py-0.5 text-[rgb(var(--foreground))]" aria-current="page">
              Order Details
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Order Details</p>
            <h1 className="text-3xl font-semibold wrap-break-word text-[rgb(var(--foreground))]">
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
            canEditVendor={hasPermission(currentUser, "orders:edit_vendor")}
            canAddVendorPayment={hasPermission(currentUser, "orders:add_vendor_payment")}
            vendors={orderPageData.vendors}
            assignedVendor={assignedVendor}
          />
        </div>

        <SectionCard title="Order summary">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Order code" value={order.orderCode} />
            <DetailRow
              label="Order status"
              value={
                <DataPill tone={getOrderStatusTone(order.status)}>
                  {getOrderStatusLabel(order.status)}
                </DataPill>
              }
            />
            <DetailRow
              label="Payment status"
              value={
                <DataPill tone={getOrderPaymentStatusTone(order.paymentStatus)}>
                  {getOrderPaymentStatusLabel(order.paymentStatus)}
                </DataPill>
              }
            />
            <DetailRow label="Order date" value={formatDate(order.orderDate)} />
            <DetailRow label="Branch" value={order.branchName} />
            <DetailRow label="Created by" value={order.createdByName ?? "System"} />
            <DetailRow label="Created at" value={formatDateTime(order.createdAt)} />
            <DetailRow label="Paid" value={formatCurrency(order.paidAmount)} />
            <DetailRow label="Total amount" value={formatCurrency(order.totalAmount)} />
            <DetailRow label="Discount" value={formatCurrency(order.discountAmount)} />
            <DetailRow label="Payable" value={formatCurrency(order.payableAmount)} />
            <DetailRow label="Outstanding" value={formatCurrency(outstandingAmount)} />
          </div>
        </SectionCard>

        <SectionCard title="Customer details">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Name" value={order.customerName} />
            <DetailRow label="Phone" value={order.customerPhone} />
            <DetailRow label="Code" value={order.customerCode ?? "-"} />
            <DetailRow label="Type" value={formatEnumLabel(order.customerType)} />
          </div>
        </SectionCard>

        <SectionCard title="Order items">
          {detail.items.length === 0 ? (
            <EmptyState>No items recorded for this order.</EmptyState>
          ) : (
            <ResponsiveTable
              headers={[
                { label: "Item" },
                { label: "SKU" },
                { label: "Qty", align: "right" },
                { label: "Rate", align: "right" },
                { label: "Total", align: "right" },
              ]}
            >
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4 font-medium text-[rgb(var(--foreground))]">
                    {item.name}
                  </td>
                  <td className="py-3 pr-4 text-[rgb(var(--muted-foreground))]">{item.sku}</td>
                  <td className="py-3 pl-4 text-right">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-3 pl-4 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 pl-4 text-right font-semibold">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </ResponsiveTable>
          )}
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Offers / discounts">
            {detail.offers.length === 0 ? (
              <EmptyState>No offers applied.</EmptyState>
            ) : (
              <div className="space-y-3">
                {detail.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-2xl border border-[rgb(var(--border)/0.68)] bg-[rgb(var(--muted)/0.18)] p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-[rgb(var(--foreground))]">{offer.name}</p>
                        <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
                          {offer.code} - {formatEnumLabel(offer.offerType)}
                        </p>
                      </div>
                      <DataPill tone="emerald">{formatCurrency(offer.discountAmount)}</DataPill>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Customer payments">
            {detail.payments.length === 0 ? (
              <EmptyState>No customer payments recorded.</EmptyState>
            ) : (
              <ResponsiveTable
                headers={[
                  { label: "Amount", align: "right" },
                  { label: "Mode" },
                  { label: "Reference" },
                  { label: "Received by" },
                  { label: "Created at" },
                ]}
              >
                {detail.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-3 pl-4 text-right font-semibold">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="py-3 pr-4">{paymentModeLabels[payment.mode]}</td>
                    <td className="py-3 pr-4 text-[rgb(var(--muted-foreground))]">
                      {payment.txnReference ?? "-"}
                    </td>
                    <td className="py-3 pr-4">{payment.receivedByName ?? "System"}</td>
                    <td className="py-3 pr-4 text-[rgb(var(--muted-foreground))]">
                      {formatDateTime(payment.createdAt)}
                    </td>
                  </tr>
                ))}
              </ResponsiveTable>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Vendor / outsource details">
          {detail.vendors.length === 0 ? (
            <EmptyState>No vendor assigned.</EmptyState>
          ) : (
            <div className="space-y-4">
              {detail.vendors.map((vendor) => {
                const paymentStatus = getVendorPaymentStatus(vendor);

                return (
                  <div
                    key={vendor.id}
                    className="space-y-4 rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.18)] p-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailRow label="Vendor" value={vendor.vendorName} />
                      <DetailRow
                        label="Work status"
                        value={
                          <DataPill tone={getVendorStatusTone(vendor.status)}>
                            {getVendorStatusLabel(vendor.status)}
                          </DataPill>
                        }
                      />
                      <DetailRow
                        label="Payment status"
                        value={<DataPill tone={paymentStatus.tone}>{paymentStatus.label}</DataPill>}
                      />
                      <DetailRow
                        label="Expected delivery"
                        value={
                          vendor.expectedDeliveryDate
                            ? formatDate(vendor.expectedDeliveryDate)
                            : "-"
                        }
                      />
                      <DetailRow
                        label="Vendor charge"
                        value={formatCurrency(vendor.chargeAmount)}
                      />
                      <DetailRow label="Vendor paid" value={formatCurrency(vendor.paidAmount)} />
                      <DetailRow
                        label="Vendor balance"
                        value={formatCurrency(vendor.balanceAmount)}
                      />
                      <DetailRow label="Notes" value={vendor.notes ?? "-"} />
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-[rgb(var(--foreground))]">
                        Vendor payment history
                      </p>
                      {vendor.payments.length === 0 ? (
                        <EmptyState>No vendor payments recorded.</EmptyState>
                      ) : (
                        <ResponsiveTable
                          headers={[
                            { label: "Amount", align: "right" },
                            { label: "Mode" },
                            { label: "Reference / notes" },
                            { label: "Recorded by" },
                            { label: "Expense date" },
                          ]}
                        >
                          {vendor.payments.map((payment) => (
                            <tr key={payment.id}>
                              <td className="py-3 pl-4 text-right font-semibold">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="py-3 pr-4">
                                {paymentModeLabels[payment.paymentMode]}
                              </td>
                              <td className="py-3 pr-4 text-[rgb(var(--muted-foreground))]">
                                {payment.remarks ?? payment.title ?? "-"}
                              </td>
                              <td className="py-3 pr-4">{payment.createdByName ?? "System"}</td>
                              <td className="py-3 pr-4 text-[rgb(var(--muted-foreground))]">
                                {formatDate(payment.expenseDate)}
                              </td>
                            </tr>
                          ))}
                        </ResponsiveTable>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Order activity / history">
          {detail.auditLogs.length === 0 ? (
            <EmptyState>No audit history yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {detail.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-[rgb(var(--border)/0.68)] bg-[rgb(var(--muted)/0.16)] p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[rgb(var(--foreground))]">
                        {getAuditActionLabel(log.action)}
                      </p>
                      <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
                        {summarizeChangedFields(log)}
                      </p>
                    </div>
                    <div className="text-left text-sm text-[rgb(var(--muted-foreground))] sm:text-right">
                      <p>{formatDateTime(log.createdAt)}</p>
                      <p>By {log.changedByName ?? "System"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
