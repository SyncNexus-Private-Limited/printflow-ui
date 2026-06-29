"use client";

import { useState } from "react";
import { DataPill, type DataPillTone } from "@/components/dashboard/data-pill";
import { RefundStatusDialog } from "@/components/orders/refund-status-dialog";
import { paymentModeLabels } from "@/lib/expenses/types";
import type { OrderRefund, RefundStatusValue } from "@/lib/orders/types";
import { formatCurrency, formatDateTime, formatEnumLabel } from "@/lib/utils/format";

function getRefundStatusTone(status: string): DataPillTone {
  switch (status) {
    case "completed":
      return "emerald";
    case "processing":
      return "blue";
    case "failed":
      return "rose";
    default:
      return "amber";
  }
}

type RefundsSectionProps = {
  orderId: string;
  refunds: OrderRefund[];
  canUpdateStatus: boolean;
};

export function RefundsSection({ orderId, refunds, canUpdateStatus }: RefundsSectionProps) {
  const [activeRefundId, setActiveRefundId] = useState<string | null>(null);
  const activeRefund = refunds.find((refund) => refund.id === activeRefundId) ?? null;

  if (refunds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--border)/0.76)] bg-[rgb(var(--muted)/0.18)] px-4 py-5 text-[13px] text-[rgb(var(--muted-foreground))]">
        No refunds recorded for this order.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        {refunds.map((refund) => (
          <div
            key={refund.id}
            className="rounded-xl border border-[rgb(var(--border)/0.68)] bg-[rgb(var(--muted)/0.18)] px-4 py-3.5"
          >
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-[rgb(var(--card-foreground))]">
                  {refund.triggerAction === "cancel" ? "Cancellation refund" : "Deletion refund"} ·{" "}
                  {formatCurrency(refund.refundAmount)} via{" "}
                  {refund.refundMode === "credit"
                    ? "customer credits"
                    : paymentModeLabels[refund.refundMode]}
                </p>
                <p className="mt-0.5 text-[12.5px] text-[rgb(var(--muted-foreground))]">
                  {refund.reason}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DataPill tone={getRefundStatusTone(refund.refundStatus)}>
                  {formatEnumLabel(refund.refundStatus)}
                </DataPill>
                {canUpdateStatus ? (
                  <button
                    type="button"
                    onClick={() => setActiveRefundId(refund.id)}
                    className="text-[12px] font-semibold text-[rgb(var(--primary))] hover:underline"
                  >
                    Update status
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-[12px] text-[rgb(var(--muted-foreground))]">
              {formatDateTime(refund.createdAt)} · By {refund.createdByName ?? "System"}
            </p>
          </div>
        ))}
      </div>

      <RefundStatusDialog
        orderId={orderId}
        refundId={activeRefund?.id ?? null}
        currentStatus={activeRefund?.refundStatus as RefundStatusValue | undefined}
        isOpen={activeRefund !== null}
        onClose={() => setActiveRefundId(null)}
      />
    </>
  );
}
