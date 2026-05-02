"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  orderVendorStatusValues,
  type OrderDetailData,
  type OrderVendorOption,
  type OrderVendorStatusValue,
} from "@/lib/orders/types";

type OrderVendorDialogProps = {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
  vendors: OrderVendorOption[];
  currentVendor?: OrderDetailData["vendors"][number] | null;
};

function getVendorStatusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function OrderVendorDialog({
  orderId,
  isOpen,
  onClose,
  vendors,
  currentVendor,
}: OrderVendorDialogProps) {
  const router = useRouter();
  const [vendorId, setVendorId] = useState("");
  const [vendorChargeAmount, setVendorChargeAmount] = useState("");
  const [vendorStatus, setVendorStatus] = useState<OrderVendorStatusValue>("assigned");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setVendorId(currentVendor?.vendorId ?? "");
    setVendorChargeAmount(currentVendor ? String(currentVendor.chargeAmount) : "");
    setVendorStatus(currentVendor?.status ?? "assigned");
    setExpectedDeliveryDate(currentVendor?.expectedDeliveryDate ?? "");
    setNotes(currentVendor?.notes ?? "");
    setError(null);
  }, [currentVendor, isOpen]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/vendors`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          vendorChargeAmount,
          vendorStatus,
          expectedDeliveryDate,
          notes,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; message: string }
        | null;
      if (!response.ok || !data?.success) {
        setError(data && !data.success ? data.message : "Unable to update vendor details.");
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Unable to update vendor details.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={currentVendor ? "Edit Vendor Details" : "Assign Vendor"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {error ? (
          <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
            {error}
          </div>
        ) : null}
        <Select
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
          disabled={isSubmitting}
        >
          <option value="">Select vendor</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </Select>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={vendorChargeAmount}
            onChange={(event) => setVendorChargeAmount(event.target.value)}
            inputMode="decimal"
            placeholder="Vendor charge"
            disabled={isSubmitting}
          />
          <Select
            value={vendorStatus}
            onChange={(event) => setVendorStatus(event.target.value as OrderVendorStatusValue)}
            disabled={isSubmitting}
          >
            {orderVendorStatusValues.map((status) => (
              <option key={status} value={status}>
                {getVendorStatusLabel(status)}
              </option>
            ))}
          </Select>
        </div>
        <Input
          type="date"
          value={expectedDeliveryDate}
          onChange={(event) => setExpectedDeliveryDate(event.target.value)}
          disabled={isSubmitting}
        />
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Vendor notes"
          disabled={isSubmitting}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="xs" ariaHidden className="mr-2" /> : null}
            Save vendor
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
