import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { CustomerDetailActions } from "@/components/customers/customer-detail-actions";
import {
  DataPill,
  getCustomerStatusTone,
  getCustomerTypeTone,
  getOrderPaymentStatusLabel,
  getOrderPaymentStatusTone,
  getOrderStatusLabel,
  getOrderStatusTone,
} from "@/components/dashboard/data-pill";
import { SectionCard } from "@/components/dashboard/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getPaymentModeLabel } from "@/lib/expenses/types";
import { getCustomerDetailPageData } from "@/lib/customers/queries";
import { resolveAvatarUrl } from "@/lib/utils/resolve-avatar-url";
import { maskAadhaar } from "@/lib/utils/mask-aadhaar";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatEnumLabel,
} from "@/lib/utils/format";

type CustomerDetailPageProps = {
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

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "primary" | "emerald" | "amber" | "rose";
}) {
  const isPrimary = tone === "primary";
  const isEmerald = tone === "emerald";
  const isAmber = tone === "amber";
  const isRose = tone === "rose";

  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        isPrimary
          ? "border-[rgb(var(--primary)/0.2)] bg-[rgb(var(--primary-soft))]"
          : isEmerald
            ? "border-[rgb(var(--metric-emerald)/0.2)] bg-[rgb(var(--metric-emerald-soft))]"
            : isAmber
              ? "border-[rgb(var(--metric-amber)/0.2)] bg-[rgb(var(--metric-amber-soft))]"
              : isRose
                ? "border-[rgb(var(--danger)/0.15)] bg-[rgb(var(--danger)/0.06)]"
                : "border-[rgb(var(--border))] bg-[rgb(var(--card))]"
      }`}
    >
      <p
        className={`text-[10.5px] font-bold tracking-[0.06em] uppercase ${
          isPrimary
            ? "text-[rgb(var(--primary-soft-foreground)/0.7)]"
            : isEmerald
              ? "text-[rgb(var(--metric-emerald-ink)/0.75)]"
              : isAmber
                ? "text-[rgb(var(--metric-amber-ink)/0.75)]"
                : isRose
                  ? "text-[rgb(var(--danger)/0.8)]"
                  : "text-[rgb(var(--muted-foreground))]"
        }`}
      >
        {label}
      </p>
      <div
        className={`mt-1.5 font-mono text-[22px] leading-none font-extrabold tracking-[-0.02em] ${
          isPrimary
            ? "text-[rgb(var(--primary-soft-foreground))]"
            : isEmerald
              ? "text-[rgb(var(--metric-emerald-ink))]"
              : isAmber
                ? "text-[rgb(var(--metric-amber-ink))]"
                : isRose
                  ? "text-[rgb(var(--danger))]"
                  : "text-[rgb(var(--card-foreground))]"
        }`}
      >
        {value}
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

function getAuditActionLabel(action: string) {
  switch (action) {
    case "create":
      return "Customer created";
    case "update":
      return "Customer updated";
    case "deactivate":
      return "Customer deactivated";
    case "restore":
      return "Customer restored";
    default:
      return formatEnumLabel(action);
  }
}

function summarizeChangedFields(changedFields: Record<string, unknown> | null): string {
  if (!changedFields) return "Snapshot recorded";
  const keys = Object.keys(changedFields);
  if (keys.length === 0) return "No field changes recorded";
  return `Changed: ${keys.map(formatEnumLabel).join(", ")}`;
}

function getRefundStatusTone(status: string) {
  switch (status) {
    case "completed":
      return "emerald" as const;
    case "processing":
      return "blue" as const;
    case "failed":
      return "rose" as const;
    default:
      return "amber" as const;
  }
}

function getRefundModeLabel(mode: string) {
  return mode === "credit" ? "Customer credits" : getPaymentModeLabel(mode);
}

function getCreditTransactionTypeLabel(type: string) {
  switch (type) {
    case "refund_credit":
      return "Refund credited";
    case "applied_to_order":
      return "Applied to order";
    case "manual_adjustment":
      return "Manual adjustment";
    default:
      return formatEnumLabel(type);
  }
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) redirect("/login");

  if (!hasPermission(currentUser, "customers:view")) {
    redirect("/dashboard?forbidden=1");
  }

  const { id } = await params;
  const pageData = await getCustomerDetailPageData(id);
  if (!pageData) notFound();

  const {
    customer,
    metrics,
    recentOrders,
    recentPayments,
    recentRefunds,
    recentCreditTransactions,
    auditLogs,
  } = pageData;
  const statusLabel = customer.isActive ? "active" : "inactive";
  const avatarUrl = resolveAvatarUrl(customer.avatar, customer.avatarSource);
  const maskedAadhaar = maskAadhaar(customer.aadhaarNumber);
  const outstandingTone = metrics.totalOutstanding > 0 ? ("rose" as const) : ("emerald" as const);

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
            href="/dashboard/customers"
            className="transition-colors hover:text-[rgb(var(--foreground))]"
          >
            Customers
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-55" aria-hidden />
          <span className="font-semibold text-[rgb(var(--foreground))]">Customer Details</span>
        </nav>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <CustomerAvatar name={customer.name} avatarUrl={avatarUrl} sizeClass="h-14 w-14" />
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <DataPill tone={getCustomerTypeTone(customer.type)}>
                  {formatEnumLabel(customer.type)}
                </DataPill>
                <DataPill tone={getCustomerStatusTone(statusLabel)} appearance="outline">
                  {formatEnumLabel(statusLabel)}
                </DataPill>
              </div>
              <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.022em] text-[rgb(var(--card-foreground))]">
                {customer.name}
              </h1>
              {customer.customerCode || customer.customerNumericId ? (
                <p className="mt-0.5 font-mono text-[13px] text-[rgb(var(--muted-foreground))]">
                  {[
                    customer.customerCode,
                    customer.customerNumericId ? `#${customer.customerNumericId}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </div>

          <CustomerDetailActions
            customerId={customer.id}
            customerName={customer.name}
            customerPhone={customer.phone}
            isActive={customer.isActive}
            canEdit={hasPermission(currentUser, "customers:edit")}
            canDeactivate={hasPermission(currentUser, "customers:deactivate")}
            canRestore={hasPermission(currentUser, "customers:restore")}
            canCreateOrder={hasPermission(currentUser, "orders:create")}
          />
        </div>

        {/* ── Order Metrics ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Orders"
            value={formatCompactNumber(metrics.totalOrders)}
            tone="primary"
          />
          <MetricCard label="Total Payable" value={formatCurrency(metrics.totalPayable)} />
          <MetricCard label="Total Paid" value={formatCurrency(metrics.totalPaid)} tone="emerald" />
          <MetricCard
            label="Outstanding"
            value={formatCurrency(metrics.totalOutstanding)}
            tone={outstandingTone}
          />
          <MetricCard
            label="Credit Balance"
            value={formatCurrency(metrics.creditBalance)}
            tone="emerald"
          />
          <MetricCard
            label="Cancelled Orders"
            value={formatCompactNumber(metrics.cancelledOrders)}
            tone={metrics.cancelledOrders > 0 ? "rose" : undefined}
          />
          <MetricCard
            label="Refunded Amount"
            value={
              <>
                {formatCurrency(metrics.totalRefunded)}
                {metrics.pendingRefundAmount > 0 ? (
                  <span className="ml-1.5 text-[11px] font-semibold text-[rgb(var(--metric-amber-ink))]">
                    +{formatCurrency(metrics.pendingRefundAmount)} pending
                  </span>
                ) : null}
              </>
            }
          />
        </div>

        {/* ── 1. Customer Summary ──────────────────────────────────────────── */}
        <SectionCard title="Customer Summary">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <DetailRow label="Phone" value={customer.phone} />
            {customer.alternatePhone ? (
              <DetailRow label="Alternate Phone" value={customer.alternatePhone} />
            ) : null}
            {customer.address ? <DetailRow label="Address" value={customer.address} /> : null}
            {maskedAadhaar ? (
              <DetailRow
                label="Aadhaar"
                value={<span className="font-mono tracking-wider">{maskedAadhaar}</span>}
              />
            ) : null}
            <DetailRow
              label="Created"
              value={formatDateTime(customer.createdAt)}
              valueClassName="mt-1 text-[13px] text-[rgb(var(--card-foreground))]"
            />
            {customer.createdByName ? (
              <DetailRow
                label="Created by"
                value={customer.createdByName}
                valueClassName="mt-1 text-[13px] text-[rgb(var(--card-foreground))]"
              />
            ) : null}
            <DetailRow
              label="Last updated"
              value={formatDateTime(customer.updatedAt)}
              valueClassName="mt-1 text-[13px] text-[rgb(var(--card-foreground))]"
            />
            {customer.updatedByName ? (
              <DetailRow
                label="Updated by"
                value={customer.updatedByName}
                valueClassName="mt-1 text-[13px] text-[rgb(var(--card-foreground))]"
              />
            ) : null}
          </div>
        </SectionCard>

        {/* ── 2. Studio Details (conditional) ─────────────────────────────── */}
        {customer.type === "studio" ? (
          <SectionCard title="Studio Details">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
              {customer.studioName ? (
                <DetailRow label="Studio Name" value={customer.studioName} />
              ) : null}
              {customer.studioAssociationName ? (
                <DetailRow label="Association Name" value={customer.studioAssociationName} />
              ) : null}
              {customer.studioAssociationIdNumber ? (
                <DetailRow
                  label="Association ID"
                  value={<span className="font-mono">{customer.studioAssociationIdNumber}</span>}
                />
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {/* ── 3. Recent Orders ─────────────────────────────────────────────── */}
        <SectionCard
          title="Recent Orders"
          description={
            recentOrders.length > 0
              ? `${recentOrders.length === 10 ? "Latest 10" : recentOrders.length} order${recentOrders.length === 1 ? "" : "s"}`
              : undefined
          }
        >
          {recentOrders.length === 0 ? (
            <EmptyState>
              No orders yet.{" "}
              {hasPermission(currentUser, "orders:create") ? (
                <Link
                  href={`/dashboard/orders/new?customerId=${customer.id}`}
                  className="font-medium text-[rgb(var(--primary))] underline-offset-2 hover:underline"
                >
                  Create the first order
                </Link>
              ) : null}
            </EmptyState>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
                  <colgroup>
                    <col style={{ width: 130 }} />
                    <col style={{ width: 110 }} />
                    <col />
                    <col />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 64 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <TableHeader label="Order" />
                      <TableHeader label="Date" />
                      <TableHeader label="Status" />
                      <TableHeader label="Payment" />
                      <TableHeader label="Payable" align="right" />
                      <TableHeader label="Paid" align="right" />
                      <TableHeader label="Branch" />
                      <TableHeader label="" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 font-mono text-[13px] font-semibold text-[rgb(var(--card-foreground))]">
                          {order.orderCode}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[12.5px] text-[rgb(var(--muted-foreground))]">
                          {formatDate(order.orderDate)}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5">
                          <DataPill tone={getOrderStatusTone(order.status)}>
                            {getOrderStatusLabel(order.status)}
                          </DataPill>
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5">
                          <DataPill tone={getOrderPaymentStatusTone(order.paymentStatus)}>
                            {getOrderPaymentStatusLabel(order.paymentStatus)}
                          </DataPill>
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13px] font-semibold text-[rgb(var(--card-foreground))]">
                          {formatCurrency(order.payableAmount)}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13px] text-[rgb(var(--metric-emerald-ink))]">
                          {formatCurrency(order.paidAmount)}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[12.5px] text-[rgb(var(--muted-foreground))]">
                          {order.branchName ?? "—"}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="text-[12px] font-medium text-[rgb(var(--primary))] hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── 4. Payment History ───────────────────────────────────────────── */}
        <SectionCard
          title="Payment History"
          description={
            recentPayments.length > 0
              ? `${recentPayments.length === 10 ? "Latest 10" : recentPayments.length} payment${recentPayments.length === 1 ? "" : "s"}`
              : undefined
          }
        >
          {recentPayments.length === 0 ? (
            <EmptyState>No payments recorded.</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <TableHeader label="Amount" align="right" />
                      <TableHeader label="Mode" />
                      <TableHeader label="Order" />
                      <TableHeader label="Reference" />
                      <TableHeader label="Received by" />
                      <TableHeader label="Date" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13.5px] font-semibold text-[rgb(var(--metric-emerald-ink))]">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13px]">
                          {getPaymentModeLabel(payment.mode)}
                        </td>
                        <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5">
                          <Link
                            href={`/dashboard/orders/${payment.orderId}`}
                            className="font-mono text-[12.5px] font-medium text-[rgb(var(--primary))] hover:underline"
                          >
                            {payment.orderCode}
                          </Link>
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
            </div>
          )}
        </SectionCard>

        {/* ── 4b. Refunds & Credits ────────────────────────────────────────── */}
        <SectionCard
          title="Refunds & Credits"
          description={`Credit balance: ${formatCurrency(metrics.creditBalance)}`}
        >
          <div className="space-y-5">
            <div>
              <p className="mb-2.5 text-[13px] font-semibold text-[rgb(var(--card-foreground))]">
                Refunds
              </p>
              {recentRefunds.length === 0 ? (
                <EmptyState>No refunds recorded.</EmptyState>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <TableHeader label="Order" />
                          <TableHeader label="Action" />
                          <TableHeader label="Amount" align="right" />
                          <TableHeader label="Mode" />
                          <TableHeader label="Status" />
                          <TableHeader label="Date" />
                        </tr>
                      </thead>
                      <tbody>
                        {recentRefunds.map((refund) => (
                          <tr key={refund.id}>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5">
                              <Link
                                href={`/dashboard/orders/${refund.orderId}`}
                                className="font-mono text-[12.5px] font-medium text-[rgb(var(--primary))] hover:underline"
                              >
                                {refund.orderCode}
                              </Link>
                            </td>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13px]">
                              {formatEnumLabel(refund.triggerAction)}
                            </td>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13px] font-semibold text-[rgb(var(--card-foreground))]">
                              {formatCurrency(refund.refundAmount)}
                            </td>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13px]">
                              {getRefundModeLabel(refund.refundMode)}
                            </td>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5">
                              <DataPill tone={getRefundStatusTone(refund.refundStatus)}>
                                {formatEnumLabel(refund.refundStatus)}
                              </DataPill>
                            </td>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[12.5px] text-[rgb(var(--muted-foreground))]">
                              {formatDateTime(refund.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2.5 text-[13px] font-semibold text-[rgb(var(--card-foreground))]">
                Credit transactions
              </p>
              {recentCreditTransactions.length === 0 ? (
                <EmptyState>No credit transactions recorded.</EmptyState>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <TableHeader label="Type" />
                          <TableHeader label="Amount" align="right" />
                          <TableHeader label="Related order" />
                          <TableHeader label="Date" />
                        </tr>
                      </thead>
                      <tbody>
                        {recentCreditTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[13px]">
                              {getCreditTransactionTypeLabel(tx.transactionType)}
                            </td>
                            <td
                              className={`border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-right font-mono text-[13px] font-semibold ${
                                tx.amount >= 0
                                  ? "text-[rgb(var(--metric-emerald-ink))]"
                                  : "text-[rgb(var(--danger))]"
                              }`}
                            >
                              {tx.amount >= 0 ? "+" : ""}
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 font-mono text-[12.5px] text-[rgb(var(--muted-foreground))]">
                              {tx.relatedOrderCode ?? "—"}
                            </td>
                            <td className="border-b border-[rgb(var(--border)/0.7)] px-3 py-2.5 text-[12.5px] text-[rgb(var(--muted-foreground))]">
                              {formatDateTime(tx.createdAt)}
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
        </SectionCard>

        {/* ── 5. Customer Activity ─────────────────────────────────────────── */}
        <SectionCard
          title="Customer Activity"
          description={`${auditLogs.length} ${auditLogs.length === 1 ? "event" : "events"}`}
        >
          {auditLogs.length === 0 ? (
            <EmptyState>No audit history yet.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {auditLogs.map((log) => (
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
                        {summarizeChangedFields(log.changedFields)}
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
