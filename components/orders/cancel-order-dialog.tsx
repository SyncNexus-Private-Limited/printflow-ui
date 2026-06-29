"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { RefundDecisionFields } from "@/components/orders/refund-decision-fields";
import type { PaymentMode } from "@/lib/expenses/types";
import { amountToPercent, percentToAmount } from "@/lib/orders/refund-calc";

type CancelOrderDialogProps = {
  orderId: string | null;
  orderLabel?: string;
  paidAmount: number;
  isOpen: boolean;
  onClose: () => void;
};

export function CancelOrderDialog({
  orderId,
  orderLabel,
  paidAmount,
  isOpen,
  onClose,
}: CancelOrderDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("0");
  const [percent, setPercent] = useState("0");
  const [refundMode, setRefundMode] = useState<PaymentMode | "">("");
  const [txnReference, setTxnReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleAmountChange(value: string) {
    setAmount(value);
    setPercent(String(amountToPercent(Number.parseFloat(value) || 0, paidAmount)));
  }

  function handlePercentChange(value: string) {
    setPercent(value);
    setAmount(String(percentToAmount(Number.parseFloat(value) || 0, paidAmount)));
  }

  function resetAndClose() {
    setReason("");
    setAmount("0");
    setPercent("0");
    setRefundMode("");
    setTxnReference("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId) return;
    if (!refundMode) {
      setError("Select a refund mode.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          reason,
          refundAmount: amount,
          refundMode,
          txnReference,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; message: string }
        | null;

      if (!response.ok || !data?.success) {
        setError(data && !data.success ? data.message : "Unable to cancel order.");
        return;
      }

      resetAndClose();
      router.refresh();
    } catch {
      setError("Unable to cancel order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={resetAndClose} title="Cancel Order" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {orderLabel ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))]">{orderLabel}</p>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
            {error}
          </div>
        ) : null}

        <RefundDecisionFields
          reason={reason}
          onReasonChange={setReason}
          reasonPlaceholder="Why is this order being cancelled?"
          amount={amount}
          onAmountChange={handleAmountChange}
          percent={percent}
          onPercentChange={handlePercentChange}
          refundMode={refundMode}
          onRefundModeChange={setRefundMode}
          txnReference={txnReference}
          onTxnReferenceChange={setTxnReference}
          basisAmount={paidAmount}
          basisLabel="Paid amount"
          disabled={isSubmitting}
        />

        <p className="text-xs text-[rgb(var(--muted-foreground))]">
          Cancelling restores item stock for this order automatically.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Back
          </Button>
          <Button
            type="submit"
            className="bg-[rgb(var(--danger))] hover:bg-[rgb(var(--danger)/0.9)]"
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? <Spinner size="xs" ariaHidden className="mr-2" /> : null}
            Cancel order
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
