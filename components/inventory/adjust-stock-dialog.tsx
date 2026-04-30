"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { adjustInventoryStockSchema } from "@/lib/inventory/schema";
import { INVENTORY_LOW_STOCK_THRESHOLD } from "@/lib/dashboard/inventory-page-filters";
import type {
  AdjustInventoryStockApiResponse,
  AdjustInventoryStockFormValues,
} from "@/lib/inventory/types";
import type { InventoryPageDetailRow, InventoryStockState } from "@/lib/dashboard/types";

export type AdjustStockRowPatch = {
  quantity: number;
  stockState: InventoryStockState;
};

type AdjustStockDialogProps = {
  item: InventoryPageDetailRow | null;
  onClose: () => void;
  onSuccess: (id: string, patch: AdjustStockRowPatch) => void;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-[rgb(var(--danger))]">{message}</p> : null;
}

export function AdjustStockDialog({ item, onClose, onSuccess }: AdjustStockDialogProps) {
  const isOpen = item !== null;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdjustInventoryStockFormValues>({
    resolver: zodResolver(
      adjustInventoryStockSchema,
    ) as unknown as Resolver<AdjustInventoryStockFormValues>,
    defaultValues: { newQuantity: "", note: "" },
  });

  useEffect(() => {
    if (item) {
      reset({ newQuantity: String(item.quantity), note: "" });
    }
  }, [item, reset]);

  const newQtyRaw = watch("newQuantity");
  const newQty = parseFloat(newQtyRaw);
  const currentQty = item?.quantity ?? null;
  const delta =
    currentQty !== null && !isNaN(newQty) && Math.abs(newQty - currentQty) > 0.0005
      ? newQty - currentQty
      : null;

  const onSubmit = handleSubmit(async (values) => {
    if (!item) return;
    clearErrors();

    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust-stock", ...values }),
      });
      const data = (await res.json().catch(() => null)) as AdjustInventoryStockApiResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors)) {
            if (message)
              setError(field as keyof AdjustInventoryStockFormValues, {
                type: "server",
                message,
              });
          }
        }
        setError("root", {
          type: "server",
          message: data && !data.success ? data.message : "Unable to adjust stock right now.",
        });
        return;
      }

      const qty = parseFloat(values.newQuantity) || 0;
      const threshold = item.reorderLevel ?? INVENTORY_LOW_STOCK_THRESHOLD;
      const stockState: InventoryStockState =
        qty === 0 ? "out-of-stock" : qty <= threshold ? "low-stock" : "in-stock";

      onSuccess(item.id, { quantity: qty, stockState });
    } catch {
      setError("root", { type: "server", message: "Unable to adjust stock right now." });
    }
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust stock"
      description="Set the new quantity. A stock movement entry will be recorded automatically."
      size="sm"
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="space-y-5 px-5 pt-4 pb-2">
          {errors.root?.message ? (
            <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
              {errors.root.message}
            </div>
          ) : null}

          {item ? (
            <div className="rounded-[18px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-3.5 py-2.5">
              <p className="text-xs font-semibold text-[rgb(var(--foreground))]">{item.name}</p>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
                SKU: {item.sku} &middot; Current qty:{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {item.quantity.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="adj-qty"
              className="block text-[11px] font-semibold tracking-[0.16em] text-[rgb(var(--muted-foreground))] uppercase"
            >
              New quantity
            </label>
            <Input
              id="adj-qty"
              inputMode="decimal"
              placeholder="0"
              disabled={isSubmitting}
              {...register("newQuantity")}
            />
            {delta !== null ? (
              <p className="text-xs text-[rgb(var(--muted-foreground))]">
                {delta > 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3)} from current ({currentQty})
              </p>
            ) : null}
            <FieldError message={errors.newQuantity?.message} />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="adj-note"
              className="block text-[11px] font-semibold tracking-[0.16em] text-[rgb(var(--muted-foreground))] uppercase"
            >
              Note{" "}
              <span className="ml-1.5 font-normal tracking-normal normal-case">· Optional</span>
            </label>
            <Textarea
              id="adj-note"
              placeholder="Reason for adjustment"
              disabled={isSubmitting}
              {...register("note")}
            />
            <FieldError message={errors.note?.message} />
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-2xl px-4 shadow-none"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 min-w-28 rounded-2xl px-5"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="xs" ariaHidden className="mr-2" />
                  Saving...
                </>
              ) : (
                "Adjust stock"
              )}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
