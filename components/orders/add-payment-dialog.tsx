"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { paymentModeLabels, paymentModeValues, type PaymentMode } from "@/lib/expenses/types";
import { formatCurrency } from "@/lib/utils/format";

type AddPaymentDialogProps = {
  orderId: string | null;
  orderLabel?: string;
  outstandingAmount?: number;
  isOpen: boolean;
  onClose: () => void;
};

export function AddPaymentDialog({
  orderId,
  orderLabel,
  outstandingAmount,
  isOpen,
  onClose,
}: AddPaymentDialogProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode | "">("");
  const [txnReference, setTxnReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paymentMode, txnReference }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; message: string }
        | null;

      if (!response.ok || !data?.success) {
        setError(data && !data.success ? data.message : "Unable to record payment.");
        return;
      }

      setAmount("");
      setPaymentMode("");
      setTxnReference("");
      onClose();
      router.refresh();
    } catch {
      setError("Unable to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Add Customer Payment" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {orderLabel ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            {orderLabel}
            {typeof outstandingAmount === "number"
              ? ` - Outstanding ${formatCurrency(outstandingAmount)}`
              : ""}
          </p>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
            {error}
          </div>
        ) : null}
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder="Amount"
          disabled={isSubmitting}
        />
        <Select
          value={paymentMode}
          onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}
          disabled={isSubmitting}
        >
          <option value="">Payment mode</option>
          {paymentModeValues.map((mode) => (
            <option key={mode} value={mode}>
              {paymentModeLabels[mode]}
            </option>
          ))}
        </Select>
        <Input
          value={txnReference}
          onChange={(event) => setTxnReference(event.target.value)}
          placeholder="Transaction reference"
          disabled={isSubmitting}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="xs" ariaHidden className="mr-2" /> : null}
            Save customer payment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
