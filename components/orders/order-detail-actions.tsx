"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  CreditCard,
  HandCoins,
  Pencil,
  RotateCcw,
  Trash2,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AddPaymentDialog } from "@/components/orders/add-payment-dialog";
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog";
import { DeleteOrderDialog } from "@/components/orders/delete-order-dialog";
import { OrderVendorDialog } from "@/components/orders/order-vendor-dialog";
import { OrderVendorPaymentDialog } from "@/components/orders/order-vendor-payment-dialog";
import { OrderStatusDialog } from "@/components/orders/order-status-dialog";
import { Button } from "@/components/ui/button";
import type { OrderDetailData, OrderStatusValue, OrderVendorOption } from "@/lib/orders/types";

type OrderDetailActionsProps = {
  orderId: string;
  orderCode: string;
  status: OrderStatusValue;
  isDeleted: boolean;
  outstandingAmount: number;
  paidAmount: number;
  remainingRefundableAmount: number;
  canEdit: boolean;
  canAddPayment: boolean;
  canUpdateStatus: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canEditVendor: boolean;
  canAddVendorPayment: boolean;
  vendors: OrderVendorOption[];
  assignedVendor?: OrderDetailData["vendors"][number] | null;
};

function DropdownItem({
  icon: Icon,
  children,
  onClick,
  disabled,
  destructive,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        destructive
          ? "text-[rgb(var(--danger))] hover:bg-[rgb(var(--danger)/0.08)]"
          : "text-[rgb(var(--card-foreground))] hover:bg-[rgb(var(--muted)/0.7)]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      {children}
    </button>
  );
}

export function OrderDetailActions({
  orderId,
  orderCode,
  status,
  isDeleted,
  outstandingAmount,
  paidAmount,
  remainingRefundableAmount,
  canEdit,
  canAddPayment,
  canUpdateStatus,
  canCancel,
  canDelete,
  canEditVendor,
  canAddVendorPayment,
  vendors,
  assignedVendor = null,
}: OrderDetailActionsProps) {
  const router = useRouter();
  const moreRef = useRef<HTMLDivElement>(null);

  const [showPayment, setShowPayment] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showVendor, setShowVendor] = useState(false);
  const [showVendorPayment, setShowVendorPayment] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const isCancelled = status === "cancelled";
  const showActiveOrderActions =
    !isCancelled && (canUpdateStatus || canEditVendor || canAddVendorPayment || canCancel);
  const showDeleteAction = canDelete && isCancelled && !isDeleted;
  const hasMoreActions = showActiveOrderActions || showDeleteAction;

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!showMore) return;
    function onOutside(e: MouseEvent) {
      if (!moreRef.current?.contains(e.target as Node)) setShowMore(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowMore(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [showMore]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? (
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-xl px-4 shadow-none"
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
          className="h-10 rounded-xl px-4"
          disabled={isCancelled || outstandingAmount <= 0}
          onClick={() => setShowPayment(true)}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Add Customer Payment
        </Button>
      ) : null}

      {hasMoreActions ? (
        <div ref={moreRef} className="relative">
          <Button
            type="button"
            variant="secondary"
            className="h-10 gap-2 rounded-xl px-4 shadow-none"
            onClick={() => setShowMore((v) => !v)}
          >
            More
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-160 ${showMore ? "-rotate-180" : ""}`}
            />
          </Button>

          {showMore ? (
            <div className="absolute top-full right-0 z-80 mt-1.5 min-w-53.75 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] py-1 shadow-[0_8px_24px_-8px_rgb(var(--shadow)/0.22)]">
              {!isCancelled && canUpdateStatus ? (
                <DropdownItem
                  icon={RotateCcw}
                  onClick={() => {
                    setShowMore(false);
                    setShowStatus(true);
                  }}
                >
                  Update Status
                </DropdownItem>
              ) : null}

              {!isCancelled && canEditVendor ? (
                <DropdownItem
                  icon={Truck}
                  onClick={() => {
                    setShowMore(false);
                    setShowVendor(true);
                  }}
                >
                  {assignedVendor ? "Edit Vendor Details" : "Assign Vendor"}
                </DropdownItem>
              ) : null}

              {!isCancelled && canAddVendorPayment ? (
                <DropdownItem
                  icon={HandCoins}
                  disabled={!assignedVendor || assignedVendor.balanceAmount <= 0}
                  onClick={() => {
                    setShowMore(false);
                    setShowVendorPayment(true);
                  }}
                >
                  Record Vendor Payment
                </DropdownItem>
              ) : null}

              {!isCancelled && canCancel ? (
                <>
                  <div className="mx-2 my-1 h-px bg-[rgb(var(--border))]" />
                  <DropdownItem
                    icon={XCircle}
                    destructive
                    onClick={() => {
                      setShowMore(false);
                      setShowCancel(true);
                    }}
                  >
                    Cancel Order
                  </DropdownItem>
                </>
              ) : null}

              {showDeleteAction ? (
                <>
                  <div className="mx-2 my-1 h-px bg-[rgb(var(--border))]" />
                  <DropdownItem
                    icon={Trash2}
                    destructive
                    onClick={() => {
                      setShowMore(false);
                      setShowDelete(true);
                    }}
                  >
                    Delete Order
                  </DropdownItem>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
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
      <CancelOrderDialog
        isOpen={showCancel}
        orderId={orderId}
        orderLabel={orderCode}
        paidAmount={paidAmount}
        onClose={() => setShowCancel(false)}
      />
      <DeleteOrderDialog
        isOpen={showDelete}
        orderId={orderId}
        orderLabel={orderCode}
        remainingRefundableAmount={remainingRefundableAmount}
        onClose={() => setShowDelete(false)}
      />
    </div>
  );
}
