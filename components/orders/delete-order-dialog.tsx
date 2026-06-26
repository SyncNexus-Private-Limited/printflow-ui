"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { RefundDecisionFields } from "@/components/orders/refund-decision-fields";
import type { PaymentMode } from "@/lib/expenses/types";
import { amountToPercent, percentToAmount } from "@/lib/orders/refund-calc";

type DeleteOrderDialogProps = {
  orderId: string | null;
  orderLabel?: string;
  remainingRefundableAmount: number;
  isOpen: boolean;
  onClose: () => void;
};

export function DeleteOrderDialog({
  orderId,
  orderLabel,
  remainingRefundableAmount,
  isOpen,
  onClose,
}: DeleteOrderDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("0");
  const [percent, setPercent] = useState("0");
  const [refundMode, setRefundMode] = useState<PaymentMode | "">("other");
  const [txnReference, setTxnReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleAmountChange(value: string) {
    setAmount(value);
    setPercent(String(amountToPercent(Number.parseFloat(value) || 0, remainingRefundableAmount)));
  }

  function handlePercentChange(value: string) {
    setPercent(value);
    setAmount(String(percentToAmount(Number.parseFloat(value) || 0, remainingRefundableAmount)));
  }

  function resetAndClose() {
    setReason("");
    setAmount("0");
    setPercent("0");
    setRefundMode("other");
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
          action: "delete",
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
        setError(data && !data.success ? data.message : "Unable to delete order.");
        return;
      }

      resetAndClose();
      router.refresh();
    } catch {
      setError("Unable to delete order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={resetAndClose} title="Delete Order" size="sm">
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
          reasonPlaceholder="Why is this cancelled order being deleted?"
          amount={amount}
          onAmountChange={handleAmountChange}
          percent={percent}
          onPercentChange={handlePercentChange}
          refundMode={refundMode}
          onRefundModeChange={setRefundMode}
          txnReference={txnReference}
          onTxnReferenceChange={setTxnReference}
          basisAmount={remainingRefundableAmount}
          basisLabel="Remaining unrefunded amount"
          disabled={isSubmitting}
        />

        <p className="text-xs text-[rgb(var(--muted-foreground))]">
          This soft-removes the order from the orders list. Inventory was already restored when it
          was cancelled, so it is not adjusted again.
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
            Delete order
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
