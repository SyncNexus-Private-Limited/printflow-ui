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
import { RefundsSection } from "@/components/orders/refunds-section";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { paymentModeLabels } from "@/lib/expenses/types";
import { getAddOrderPageData, getOrderDetail } from "@/lib/orders/queries";
import type { OrderDetailData } from "@/lib/orders/types";
import { formatCurrency, formatDate, formatDateTime, formatEnumLabel } from "@/lib/utils/format";

type OrderDetailsPageProps = {
  params: Promise<{ id: string }>;
};

// ─── helper components ────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-[rgb(var(--muted-foreground))] uppercase">
        {label}
      </p>
      <div
        className={
          valueClassName ??
          "mt-1 text-[14px] font-semibold wrap-break-word text-[rgb(var(--card-foreground))]"
        }
      >
        {value}
      </div>
    </div>
  );
}

function FinancialCell({
  label,
  value,
  tone,
  colSpanMobile,
}: {
  label: string;
  value: number;
  tone?: "primary" | "emerald" | "amber";
  colSpanMobile?: boolean;
}) {
  const isPrimary = tone === "primary";
  const isEmerald = tone === "emerald";
  const isAmber = tone === "amber";

  return (
    <div
      className={`px-5 py-4 ${colSpanMobile ? "col-span-2 sm:col-span-1" : ""} ${
        isPrimary
          ? "bg-[rgb(var(--primary-soft))]"
          : isEmerald
            ? "bg-[rgb(var(--metric-emerald-soft))]"
            : isAmber
              ? "bg-[rgb(var(--metric-amber-soft))]"
              : "bg-[rgb(var(--card))]"
      }`}
    >
      <div
        className={`text-[10.5px] font-bold tracking-[0.06em] uppercase ${
          isPrimary
            ? "text-[rgb(var(--primary-soft-foreground)/0.7)]"
            : isEmerald
              ? "text-[rgb(var(--metric-emerald-ink)/0.75)]"
              : isAmber
                ? "text-[rgb(var(--metric-amber-ink)/0.75)]"
                : "text-[rgb(var(--muted-foreground))]"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1.5 font-mono text-[20px] leading-none font-extrabold tracking-[-0.02em] ${
          isPrimary
            ? "text-[rgb(var(--primary-soft-foreground))]"
            : isEmerald
              ? "text-[rgb(var(--metric-emerald-ink))]"
              : isAmber
                ? "text-[rgb(var(--metric-amber-ink))]"
                : "text-[rgb(var(--card-foreground))]"
        }`}
      >
        {formatCurrency(value)}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[rgb(var(--border)/0.76)] bg-[rgb(var(--muted)/0.18)] px-4 py-5 text-[13px] text-[rgb(var(--muted-foreground))]">
      {children}
    </div>
  );
}

function TableHeader({ label, align = "left" }: { label: string; align?: "left" | "right" }) {
  return (
    <th
      className="border-b border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.55)] px-3 py-2.5 font-mono text-[10.5px] font-bold tracking-[0.06em] text-[rgb(var(--muted-foreground))] uppercase"
      style={{ textAlign: align }}
    >
      {label}
    </th>
  );
}

// ─── status/label helpers ─────────────────────────────────────────────────────

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
    case "deleted":
      return "Deleted";
    case "refund_status_updated":
      return "Refund status updated";
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
    case "deleted":
      return "Cancelled order was soft-deleted";
    case "refund_status_updated":
      return "Refund status was changed";
    default:
      return "Audit snapshot recorded";
  }
}

// ─── page ─────────────────────────────────────────────────────────────────────

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
  const totalRefunded = detail.refunds.reduce((sum, refund) => sum + refund.refundAmount, 0);
  const remainingRefundableAmount = Math.max(0, order.paidAmount - totalRefunded);

  return (
    <main className="min-h-screen px-7 pt-8 pb-16">
      <div className="mx-auto max-w-330 space-y-5">
        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav
          className="flex items-center gap-2 text-[13px] font-medium text-[rgb(var(--muted-foreground))]"
          aria-label="Breadcrumb"
        >
          <Link href="/dashboard" className="transition-colors hover:text-[rgb(var(--foreground))]">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-55" aria-hidden />
          <span>Sales</span>
          <ChevronRight className="h-3.5 w-3.5 opacity-55" aria-hidden />
          <Link
            href="/dashboard/orders"
            className="transition-colors hover:text-[rgb(var(--foreground))]"
          >
            Orders
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-55" aria-hidden />
          <span className="font-semibold text-[rgb(var(--foreground))]">Order Details</span>
        </nav>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[12px] font-semibold tracking-[0.05em] text-[rgb(var(--muted-foreground))] uppercase">
              Order Details
            </p>
            <h1 className="text-[36px] leading-[1.05] font-extrabold tracking-[-0.022em] text-[rgb(var(--card-foreground))]">
              {order.orderCode}
            </h1>
            {order.customerName ? (
              <p className="mt-1.5 text-[14px] font-medium text-[rgb(var(--muted-foreground))]">
                {order.customerName}
              </p>
            ) : null}
          </div>
          <OrderDetailActions
            orderId={order.id}
            orderCode={order.orderCode}
            status={order.status}
            isDeleted={order.isDeleted}
            outstandingAmount={outstandingAmount}
            paidAmount={order.paidAmount}
            remainingRefundableAmount={remainingRefundableAmount}
            canEdit={hasPermission(currentUser, "orders:edit")}
            canAddPayment={hasPermission(currentUser, "orders:add_payment")}
            canUpdateStatus={hasPermission(currentUser, "orders:update_status")}
            canCancel={hasPermission(currentUser, "orders:cancel")}
            canDelete={hasPermission(currentUser, "orders:delete")}
            canEditVendor={hasPermission(currentUser, "orders:edit_vendor")}
            canAddVendorPayment={hasPermission(currentUser, "orders:add_vendor_payment")}
            vendors={orderPageData.vendors}
            assignedVendor={assignedVendor}
          />
        </div>

        {/* ── 1. Order Summary ────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-[0_1px_0_rgb(var(--shadow)/0.04),0_8px_32px_-16px_rgb(var(--shadow)/0.18)]">
          {/* Status + date row */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-[rgb(var(--border)/0.7)] px-6 py-4">
            <DataPill tone={getOrderStatusTone(order.status)}>
              Status: {getOrderStatusLabel(order.status)}
            </DataPill>
            <DataPill tone={getOrderPaymentStatusTone(order.paymentStatus)}>
              Payment: {getOrderPaymentStatusLabel(order.paymentStatus)}
            </DataPill>
            {order.isDeleted ? <DataPill tone="rose">Deleted</DataPill> : null}
            <span className="ml-auto font-mono text-[12.5px] text-[rgb(var(--muted-foreground))]">
              {formatDate(order.orderDate)}
            </span>
          </div>

          {/* Info grid — customer + meta */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-b border-[rgb(var(--border)/0.7)] px-6 py-5 sm:grid-cols-3 lg:grid-cols-4">
            <DetailRow label="Customer" value={order.customerName} />
            <DetailRow label="Phone" value={order.customerPhone} />
            <DetailRow
              label="Numeric ID"
              value={order.customerNumericId != null ? String(order.customerNumericId) : "—"}
            />
            <DetailRow label="Type" value={formatEnumLabel(order.customerType)} />
            <DetailRow label="Branch" value={order.branchName} />
            <DetailRow label="Created by" value={order.createdByName ?? "System"} />
            <DetailRow label="Created at" value={formatDateTime(order.createdAt)} />
            {order.cancellationReason ? (
              <DetailRow label="Cancellation reason" value={order.cancellationReason} />
            ) : null}
            {order.deletionReason ? (
              <DetailRow label="Deletion reason" value={order.deletionReason} />
            ) : null}
          </div>

          {/* Financial summary — full-bleed cells with gap-line dividers */}
          {order.manualDiscountAmount > 0 ? (
            <div className="grid grid-cols-2 gap-px bg-[rgb(var(--border)/0.5)] sm:grid-cols-6">
              <FinancialCell label="Total amount" value={order.totalAmount} />
              <FinancialCell label="Offer discount" value={order.offerDiscountAmount} />
              <FinancialCell label="Manual discount" value={order.manualDiscountAmount} />
              <FinancialCell label="Payable" value={order.payableAmount} tone="primary" />
              <FinancialCell label="Paid" value={order.paidAmount} />
              <FinancialCell
                label="Outstanding"
                value={outstandingAmount}
                tone={outstandingAmount === 0 ? "emerald" : "amber"}
                colSpanMobile
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-[rgb(var(--border)/0.5)] sm:grid-cols-5">
              <FinancialCell label="Total amount" value={order.totalAmount} />
              <FinancialCell label="Discount" value={order.discountAmount} />
              <FinancialCell label="Payable" value={order.payableAmount} tone="primary" />
              <FinancialCell label="Paid" value={order.paidAmount} />
              <FinancialCell
                label="Outstanding"
                value={outstandingAmount}
                tone={outstandingAmount === 0 ? "emerald" : "amber"}
                colSpanMobile
              />
            </div>
          )}
        </div>

        {/* ── 2. Order Items ───────────────────────────────────────────────── */}
        <SectionCard
          title="Order Items"
          description={
            detail.items.length > 0
              ? `${detail.items.length} ${detail.items.length === 1 ? "item" : "items"}`
              : undefined
          }
        >
          {detail.items.length === 0 ? (
            <EmptyState>No items recorded for this order.</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 110 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <TableHeader label="Item" />
                      <TableHeader label="SKU" />
                      <TableHeader label="Qty" align="right" />
                      <TableHeader label="Rate (₹)" align="right" />
                      <TableHeader label="Total" align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13.5px] font-semibold text-[rgb(var(--card-foreground))]">
                          {item.name}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 font-mono text-[12px] text-[rgb(var(--muted-foreground))]">
                          {item.sku}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13px]">
                          {item.quantity}{" "}
                          <span className="text-[rgb(var(--muted-foreground))]">{item.unit}</span>
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13px] text-[rgb(var(--muted-foreground))]">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13.5px] font-semibold text-[rgb(var(--card-foreground))]">
                          {formatCurrency(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between bg-[rgb(var(--muted)/0.4)] px-3.5 py-2.5">
                <span className="text-[12.5px] text-[rgb(var(--muted-foreground))]">
                  {detail.items.length} {detail.items.length === 1 ? "item" : "items"}
                </span>
                <div className="text-[12.5px] text-[rgb(var(--muted-foreground))]">
                  Total:{" "}
                  <b className="font-mono font-semibold text-[rgb(var(--card-foreground))]">
                    {formatCurrency(order.totalAmount)}
                  </b>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── 3. Customer Payments ─────────────────────────────────────────── */}
        <SectionCard
          title="Customer Payments"
          description={
            detail.payments.length > 0
              ? `${detail.payments.length} ${detail.payments.length === 1 ? "payment" : "payments"} · ${formatCurrency(order.paidAmount)} paid`
              : undefined
          }
        >
          {detail.payments.length === 0 ? (
            <EmptyState>No customer payments recorded.</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <TableHeader label="Amount" align="right" />
                      <TableHeader label="Mode" />
                      <TableHeader label="Reference" />
                      <TableHeader label="Received by" />
                      <TableHeader label="Date" />
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13.5px] font-semibold text-[rgb(var(--card-foreground))]">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13px]">
                          {paymentModeLabels[payment.mode]}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 font-mono text-[12px] text-[rgb(var(--muted-foreground))]">
                          {payment.txnReference ?? "—"}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13px]">
                          {payment.receivedByName ?? "System"}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[12.5px] text-[rgb(var(--muted-foreground))]">
                          {formatDateTime(payment.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end bg-[rgb(var(--muted)/0.4)] px-3.5 py-2.5">
                <div className="text-[12.5px] text-[rgb(var(--muted-foreground))]">
                  Total paid:{" "}
                  <b className="font-mono font-semibold text-[rgb(var(--metric-emerald-ink))]">
                    {formatCurrency(order.paidAmount)}
                  </b>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── 3b. Refunds ──────────────────────────────────────────────────── */}
        <SectionCard
          title="Refunds"
          description={
            detail.refunds.length > 0
              ? `${detail.refunds.length} ${detail.refunds.length === 1 ? "refund" : "refunds"}`
              : undefined
          }
        >
          <RefundsSection
            orderId={order.id}
            refunds={detail.refunds}
            canUpdateStatus={hasPermission(currentUser, "orders:cancel")}
          />
        </SectionCard>

        {/* ── 4. Vendor / Outsource ────────────────────────────────────────── */}
        <SectionCard
          title="Vendor / Outsource"
          description={assignedVendor?.vendorName ?? undefined}
        >
          {detail.vendors.length === 0 ? (
            <EmptyState>No vendor assigned to this order.</EmptyState>
          ) : (
            <div className="space-y-4">
              {detail.vendors.map((vendor) => {
                const paymentStatus = getVendorPaymentStatus(vendor);
                return (
                  <div
                    key={vendor.id}
                    className="space-y-4 rounded-xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.18)] p-4"
                  >
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
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
                            : "—"
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
                      <DetailRow label="Notes" value={vendor.notes ?? "—"} />
                    </div>

                    <div>
                      <p className="mb-2.5 text-[13px] font-semibold text-[rgb(var(--card-foreground))]">
                        Vendor payment history
                      </p>
                      {vendor.payments.length === 0 ? (
                        <EmptyState>No vendor payments recorded.</EmptyState>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-[rgb(var(--border)/0.6)] bg-[rgb(var(--card))]">
                          <div style={{ overflowX: "auto" }}>
                            <table
                              style={{
                                width: "100%",
                                minWidth: 420,
                                borderCollapse: "collapse",
                              }}
                            >
                              <thead>
                                <tr>
                                  <TableHeader label="Amount" align="right" />
                                  <TableHeader label="Mode" />
                                  <TableHeader label="Reference / notes" />
                                  <TableHeader label="Recorded by" />
                                  <TableHeader label="Expense date" />
                                </tr>
                              </thead>
                              <tbody>
                                {vendor.payments.map((payment) => (
                                  <tr key={payment.id}>
                                    <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13.5px] font-semibold text-[rgb(var(--card-foreground))]">
                                      {formatCurrency(payment.amount)}
                                    </td>
                                    <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13px]">
                                      {paymentModeLabels[payment.paymentMode]}
                                    </td>
                                    <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 font-mono text-[12px] text-[rgb(var(--muted-foreground))]">
                                      {payment.remarks ?? payment.title ?? "—"}
                                    </td>
                                    <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13px]">
                                      {payment.createdByName ?? "System"}
                                    </td>
                                    <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[12.5px] text-[rgb(var(--muted-foreground))]">
                                      {formatDate(payment.expenseDate)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── 5. Offers / Discounts ────────────────────────────────────────── */}
        <SectionCard
          title="Offers / Discounts"
          description={
            detail.offers.length > 0
              ? `${detail.offers.length} applied · ${formatCurrency(order.offerDiscountAmount)} off`
              : undefined
          }
        >
          {detail.offers.length === 0 ? (
            <EmptyState>No offers applied to this order.</EmptyState>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {detail.offers.map((offer) => (
                <div
                  key={offer.id}
                  className="inline-flex items-center gap-2.5 rounded-xl border border-[rgb(var(--metric-emerald)/0.3)] bg-[rgb(var(--metric-emerald-soft))] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-[rgb(var(--metric-emerald-ink))]">
                      {offer.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[rgb(var(--metric-emerald-ink)/0.75)]">
                      {offer.code} · {formatEnumLabel(offer.offerType)}
                    </div>
                  </div>
                  <div className="ml-2 shrink-0 rounded-lg bg-[rgb(var(--metric-emerald))] px-2.5 py-1 font-mono text-[13px] font-bold text-white">
                    −{formatCurrency(offer.discountAmount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── 6. Activity / History ────────────────────────────────────────── */}
        <SectionCard
          title="Activity / History"
          description={`${detail.auditLogs.length} ${detail.auditLogs.length === 1 ? "event" : "events"}`}
        >
          {detail.auditLogs.length === 0 ? (
            <EmptyState>No audit history yet.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {detail.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-[rgb(var(--border)/0.68)] bg-[rgb(var(--muted)/0.18)] px-4 py-3.5"
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[rgb(var(--card-foreground))]">
                        {getAuditActionLabel(log.action)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-[rgb(var(--muted-foreground))]">
                        {summarizeChangedFields(log)}
                      </p>
                    </div>
                    <div className="shrink-0 text-left text-[12px] text-[rgb(var(--muted-foreground))] sm:text-right">
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
