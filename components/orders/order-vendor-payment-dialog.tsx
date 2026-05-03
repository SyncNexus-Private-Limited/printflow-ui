"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { paymentModeLabels, paymentModeValues, type PaymentMode } from "@/lib/expenses/types";
import { type OrderDetailData } from "@/lib/orders/types";
import { formatCurrency } from "@/lib/utils/format";

type OrderVendorPaymentDialogProps = {
  orderId: string;
  vendor: OrderDetailData["vendors"][number] | null;
  isOpen: boolean;
  onClose: () => void;
};

export function OrderVendorPaymentDialog({
  orderId,
  vendor,
  isOpen,
  onClose,
}: OrderVendorPaymentDialogProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode | "">("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/vendors/${vendor.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paymentMode, remarks }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; message: string }
        | null;
      if (!response.ok || !data?.success) {
        setError(data && !data.success ? data.message : "Unable to record vendor payment.");
        return;
      }

      setAmount("");
      setPaymentMode("");
      setRemarks("");
      onClose();
      router.refresh();
    } catch {
      setError("Unable to record vendor payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Record Vendor Payment" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {vendor ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            {vendor.vendorName} - Balance {formatCurrency(vendor.balanceAmount)}
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
        <Textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          placeholder="Remarks"
          disabled={isSubmitting}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !vendor}>
            {isSubmitting ? <Spinner size="xs" ariaHidden className="mr-2" /> : null}
            Record payment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
