"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, HandCoins, Pencil, RotateCcw, Truck, XCircle } from "lucide-react";
import { AddPaymentDialog } from "@/components/orders/add-payment-dialog";
import { OrderVendorDialog } from "@/components/orders/order-vendor-dialog";
import { OrderVendorPaymentDialog } from "@/components/orders/order-vendor-payment-dialog";
import { OrderStatusDialog } from "@/components/orders/order-status-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { OrderDetailData, OrderStatusValue, OrderVendorOption } from "@/lib/orders/types";

type OrderDetailActionsProps = {
  orderId: string;
  orderCode: string;
  status: OrderStatusValue;
  outstandingAmount: number;
  canEdit: boolean;
  canAddPayment: boolean;
  canUpdateStatus: boolean;
  canCancel: boolean;
  canEditVendor: boolean;
  canAddVendorPayment: boolean;
  vendors: OrderVendorOption[];
  assignedVendor?: OrderDetailData["vendors"][number] | null;
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
  canEditVendor,
  canAddVendorPayment,
  vendors,
  assignedVendor = null,
}: OrderDetailActionsProps) {
  const router = useRouter();
  const [showPayment, setShowPayment] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showVendor, setShowVendor] = useState(false);
  const [showVendorPayment, setShowVendorPayment] = useState(false);
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
      {canEdit ? (
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-2xl px-4 shadow-none"
          disabled={isCancelled}
          onClick={() => router.push(`/dashboard/orders/${orderId}/edit`)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit Order
        </Button>
      ) : null}
      {canAddPayment ? (
        <Button
          type="button"
          className="h-10 rounded-2xl px-4"
          disabled={isCancelled || outstandingAmount <= 0}
          onClick={() => setShowPayment(true)}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Add Customer Payment
        </Button>
      ) : null}
      {canEditVendor ? (
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-2xl px-4 shadow-none"
          disabled={isCancelled}
          onClick={() => setShowVendor(true)}
        >
          <Truck className="mr-2 h-4 w-4" />
          {assignedVendor ? "Edit Vendor Details" : "Assign Vendor"}
        </Button>
      ) : null}
      {canAddVendorPayment ? (
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-2xl px-4 shadow-none"
          disabled={isCancelled || !assignedVendor || assignedVendor.balanceAmount <= 0}
          onClick={() => setShowVendorPayment(true)}
        >
          <HandCoins className="mr-2 h-4 w-4" />
          Record Vendor Payment
        </Button>
      ) : null}
      {canUpdateStatus ? (
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-2xl px-4 shadow-none"
          disabled={isCancelled}
          onClick={() => setShowStatus(true)}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Update Status
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          type="button"
          className="h-10 rounded-2xl bg-[rgb(var(--danger))] px-4 hover:bg-[rgb(var(--danger)/0.9)]"
          disabled={isCancelled}
          onClick={() => setShowCancel(true)}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Cancel Order
        </Button>
      ) : null}
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
      <OrderVendorDialog
        isOpen={showVendor}
        orderId={orderId}
        vendors={vendors}
        currentVendor={assignedVendor}
        onClose={() => setShowVendor(false)}
      />
      <OrderVendorPaymentDialog
        isOpen={showVendorPayment}
        orderId={orderId}
        vendor={assignedVendor}
        onClose={() => setShowVendorPayment(false)}
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
