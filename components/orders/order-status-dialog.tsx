"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { getOrderStatusLabel } from "@/components/dashboard/data-pill";
import { orderStatusValues, type OrderStatusValue } from "@/lib/orders/types";

type OrderStatusDialogProps = {
  orderId: string | null;
  currentStatus?: OrderStatusValue;
  isOpen: boolean;
  onClose: () => void;
};

export function OrderStatusDialog({
  orderId,
  currentStatus = "pending",
  isOpen,
  onClose,
}: OrderStatusDialogProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatusValue>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", status }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; message: string }
        | null;

      if (!response.ok || !data?.success) {
        setError(data && !data.success ? data.message : "Unable to update status.");
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Unable to update status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Update Status" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {error ? (
          <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
            {error}
          </div>
        ) : null}
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as OrderStatusValue)}
          disabled={isSubmitting}
        >
          {orderStatusValues.map((value) => (
            <option key={value} value={value}>
              {getOrderStatusLabel(value)}
            </option>
          ))}
        </Select>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
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
