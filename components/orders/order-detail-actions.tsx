"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Pencil, RotateCcw, XCircle } from "lucide-react";
import { AddPaymentDialog } from "@/components/orders/add-payment-dialog";
import { OrderStatusDialog } from "@/components/orders/order-status-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { OrderStatusValue } from "@/lib/orders/types";

type OrderDetailActionsProps = {
  orderId: string;
  orderCode: string;
  status: OrderStatusValue;
  outstandingAmount: number;
  canEdit: boolean;
  canAddPayment: boolean;
  canUpdateStatus: boolean;
  canCancel: boolean;
};

export function OrderDetailActions({
  orderId,
  orderCode,
  status,
  outstandingAmount,
  canEdit,
  canAddPayment,
  canUpdateStatus,
  canCancel,
}: OrderDetailActionsProps) {
  const router = useRouter();
  const [showPayment, setShowPayment] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancelled = status === "cancelled";

  async function handleCancel() {
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (response.ok) {
        setShowCancel(false);
        router.refresh();
      }
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        className="h-10 rounded-2xl px-4 shadow-none"
        disabled={!canEdit || isCancelled}
        onClick={() => router.push(`/dashboard/orders/${orderId}/edit`)}
      >
        <Pencil className="mr-2 h-4 w-4" />
        Edit Order
      </Button>
      <Button
        type="button"
        className="h-10 rounded-2xl px-4"
        disabled={!canAddPayment || isCancelled || outstandingAmount <= 0}
        onClick={() => setShowPayment(true)}
      >
        <CreditCard className="mr-2 h-4 w-4" />
        Add Payment
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="h-10 rounded-2xl px-4 shadow-none"
        disabled={!canUpdateStatus || isCancelled}
        onClick={() => setShowStatus(true)}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Update Status
      </Button>
      <Button
        type="button"
        className="h-10 rounded-2xl bg-[rgb(var(--danger))] px-4 hover:bg-[rgb(var(--danger)/0.9)]"
        disabled={!canCancel || isCancelled}
        onClick={() => setShowCancel(true)}
      >
        <XCircle className="mr-2 h-4 w-4" />
        Cancel Order
      </Button>
      <AddPaymentDialog
        isOpen={showPayment}
        orderId={orderId}
        orderLabel={orderCode}
        outstandingAmount={outstandingAmount}
        onClose={() => setShowPayment(false)}
      />
      <OrderStatusDialog
        isOpen={showStatus}
        orderId={orderId}
        currentStatus={status}
        onClose={() => setShowStatus(false)}
      />
      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancel}
        title="Cancel order?"
        description="This marks the order as cancelled and lets the database restore item stock."
        confirmKeyword="cancel"
        confirmLabel="Cancel order"
        isPending={isCancelling}
      />
    </div>
  );
}
