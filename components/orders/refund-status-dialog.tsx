"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { refundStatusValues, type RefundStatusValue } from "@/lib/orders/types";

const refundStatusLabels: Record<RefundStatusValue, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

type RefundStatusDialogProps = {
  orderId: string | null;
  refundId: string | null;
  currentStatus?: RefundStatusValue;
  isOpen: boolean;
  onClose: () => void;
};

export function RefundStatusDialog({
  orderId,
  refundId,
  currentStatus = "pending",
  isOpen,
  onClose,
}: RefundStatusDialogProps) {
  const router = useRouter();
  const [status, setStatus] = useState<RefundStatusValue>(currentStatus);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetAndClose() {
    setNote("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId || !refundId) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/refunds/${refundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; message: string }
        | null;

      if (!response.ok || !data?.success) {
        setError(data && !data.success ? data.message : "Unable to update refund status.");
        return;
      }

      resetAndClose();
      router.refresh();
    } catch {
      setError("Unable to update refund status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={resetAndClose} title="Update Refund Status" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {error ? (
          <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
            {error}
          </div>
        ) : null}
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as RefundStatusValue)}
          disabled={isSubmitting}
        >
          {refundStatusValues.map((value) => (
            <option key={value} value={value}>
              {refundStatusLabels[value]}
            </option>
          ))}
        </Select>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          disabled={isSubmitting}
          rows={3}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="xs" ariaHidden className="mr-2" /> : null}
            Update status
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
