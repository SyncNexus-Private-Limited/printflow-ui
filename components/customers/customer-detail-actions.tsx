"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, PlusCircle, RotateCcw, Trash2 } from "lucide-react";
import { CustomerEditDialog } from "@/components/customers/customer-edit-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

type CustomerDetailActionsProps = {
  customerId: string;
  customerName: string;
  customerPhone: string;
  isActive: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canRestore: boolean;
  canCreateOrder: boolean;
};

export function CustomerDetailActions({
  customerId,
  customerName,
  customerPhone,
  isActive,
  canEdit,
  canDeactivate,
  canRestore,
  canCreateOrder,
}: CustomerDetailActionsProps) {
  const router = useRouter();
  const moreRef = useRef<HTMLDivElement>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasMoreActions = isActive ? canDeactivate : canRestore;

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

  async function handleDeactivate() {
    setIsDeactivating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      });
      const data = (await res.json().catch(() => null)) as {
        success: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        setActionError(data?.message ?? "Unable to deactivate customer right now.");
        return;
      }
      setShowDeactivate(false);
      router.refresh();
    } catch {
      setActionError("Unable to deactivate customer right now.");
    } finally {
      setIsDeactivating(false);
    }
  }

  async function handleRestore() {
    setActionError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = (await res.json().catch(() => null)) as {
        success: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        setActionError(data?.message ?? "Unable to restore customer right now.");
        return;
      }
      setShowMore(false);
      router.refresh();
    } catch {
      setActionError("Unable to restore customer right now.");
    }
  }

  return (
    <>
      {actionError ? (
        <div className="mb-3 rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {actionError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <Button
            type="button"
            variant="secondary"
            className="h-10 rounded-xl px-4 shadow-none"
            onClick={() => setShowEdit(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        ) : null}

        {canCreateOrder ? (
          <Button
            type="button"
            className="h-10 rounded-xl px-4"
            onClick={() => router.push(`/dashboard/orders/new?customerId=${customerId}`)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Order
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
              <div className="absolute top-full right-0 z-80 mt-1.5 min-w-44 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] py-1 shadow-[0_8px_24px_-8px_rgb(var(--shadow)/0.22)]">
                {isActive && canDeactivate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMore(false);
                      setShowDeactivate(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-medium text-[rgb(var(--danger))] transition-colors hover:bg-[rgb(var(--danger)/0.08)]"
                  >
                    <Trash2 className="h-4 w-4 shrink-0 opacity-70" />
                    Deactivate
                  </button>
                ) : null}
                {!isActive && canRestore ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMore(false);
                      void handleRestore();
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-medium text-[rgb(var(--card-foreground))] transition-colors hover:bg-[rgb(var(--muted)/0.7)]"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0 opacity-70" />
                    Restore
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <CustomerEditDialog
        customerId={showEdit ? customerId : null}
        onClose={() => setShowEdit(false)}
        onSuccess={() => {
          setShowEdit(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        isOpen={showDeactivate}
        onClose={() => {
          setShowDeactivate(false);
          setActionError(null);
        }}
        onConfirm={handleDeactivate}
        title="Deactivate customer"
        description="This customer will be marked inactive and won't appear in active customer selectors. Their order history is preserved. This can be undone by restoring the customer."
        confirmKeyword="delete"
        confirmLabel="Deactivate customer"
        isPending={isDeactivating}
      >
        <div className="rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.4)] px-4 py-3">
          <p className="text-sm font-medium text-[rgb(var(--foreground))]">{customerName}</p>
          <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">{customerPhone}</p>
        </div>
      </ConfirmDialog>
    </>
  );
}
