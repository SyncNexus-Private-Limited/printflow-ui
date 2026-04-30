"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { updateInventorySchema } from "@/lib/inventory/schema";
import { formatDateTime } from "@/lib/utils/format";
import type { InventoryPageDetailRow } from "@/lib/dashboard/types";
import {
  inventoryUnitLabels,
  inventoryUnitValues,
  type EditInventoryItem,
  type InventoryDetailApiResponse,
  type InventoryFormVendorOption,
  type UpdateInventoryApiResponse,
  type UpdateInventoryFieldName,
  type UpdateInventoryFormValues,
} from "@/lib/inventory/types";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      inventoryId: string;
      item: EditInventoryItem;
      vendorOptions: InventoryFormVendorOption[];
      updatedAt: string;
      updatedByName: string | null;
    };

export type InventoryRowPatch = Partial<
  Pick<
    InventoryPageDetailRow,
    | "name"
    | "sku"
    | "unit"
    | "isActive"
    | "quantity"
    | "stockState"
    | "lastPurchaseRate"
    | "lastVendorName"
    | "image"
  >
>;

type EditInventoryDialogProps = {
  inventoryId: string | null;
  onClose: () => void;
  onSuccess: (id: string, patch: InventoryRowPatch) => void;
};

function FieldLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor: string;
  children: string;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold tracking-[0.16em] text-[rgb(var(--muted-foreground))] uppercase"
    >
      {children}
      {optional ? (
        <span className="ml-1.5 font-normal tracking-normal normal-case">· Optional</span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-[rgb(var(--danger))]">{message}</p> : null;
}

function LoadingShimmer() {
  return (
    <div className="space-y-5 px-5 pt-4 pb-6" aria-busy="true" aria-label="Loading item details">
      {[1, 2, 3, 4].map((row) => (
        <div key={row} className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((col) => (
            <div key={col} className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded-md bg-[rgb(var(--muted)/0.7)]" />
              <div className="h-10 animate-pulse rounded-xl bg-[rgb(var(--muted)/0.5)]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function buildDefaultValues(item: EditInventoryItem): UpdateInventoryFormValues {
  return {
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    isActive: item.isActive,
    newQuantity: String(item.quantity),
    lastPurchaseRate: item.lastPurchaseRate !== null ? String(item.lastPurchaseRate) : "",
    lastVendorId: item.lastVendorId ?? "",
    reorderLevel: item.reorderLevel !== null ? String(item.reorderLevel) : "",
    image: item.image ?? "",
    adjustmentNote: "",
  };
}

export function EditInventoryDialog({ inventoryId, onClose, onSuccess }: EditInventoryDialogProps) {
  const isOpen = inventoryId !== null;
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [serverError, setServerError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateInventoryFormValues>({
    resolver: zodResolver(updateInventorySchema) as unknown as Resolver<UpdateInventoryFormValues>,
    defaultValues: {
      name: "",
      sku: "",
      unit: "",
      isActive: true,
      newQuantity: "0",
      lastPurchaseRate: "",
      lastVendorId: "",
      reorderLevel: "",
      image: "",
      adjustmentNote: "",
    },
  });

  useEffect(() => {
    if (!inventoryId) {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoadState({ status: "idle" });
      setServerError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading" });
    setServerError(null);

    fetch(`/api/inventory/${inventoryId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as InventoryDetailApiResponse;
        if (!data.success) {
          setLoadState({ status: "error", message: data.message });
          return;
        }
        const { item, vendorOptions } = data.data;
        reset(buildDefaultValues(item));
        setLoadState({
          status: "ready",
          inventoryId: item.id,
          item,
          vendorOptions,
          updatedAt: item.updatedAt,
          updatedByName: item.updatedByName,
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLoadState({ status: "error", message: "Unable to load item details right now." });
      });

    return () => {
      controller.abort();
    };
  }, [inventoryId, reset]);

  function getFieldError(field: UpdateInventoryFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    if (loadState.status !== "ready") return;
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch(`/api/inventory/${loadState.inventoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...values }),
      });
      const data = (await res.json().catch(() => null)) as UpdateInventoryApiResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [UpdateInventoryFieldName, string]
          >) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(data && !data.success ? data.message : "Unable to save changes right now.");
        return;
      }

      const patch: InventoryRowPatch = {
        name: values.name,
        sku: values.sku,
        unit: values.unit as string,
        isActive: values.isActive,
        lastPurchaseRate:
          values.lastPurchaseRate !== "" ? parseFloat(values.lastPurchaseRate) : null,
        lastVendorName: values.lastVendorId
          ? (loadState.vendorOptions.find((v) => v.id === values.lastVendorId)?.name ?? null)
          : null,
        image: values.image !== "" ? values.image : null,
      };

      onSuccess(loadState.inventoryId, patch);
    } catch {
      setServerError("Unable to save changes right now.");
    }
  });

  const isActiveValue = watch("isActive");
  const unitValue = watch("unit");
  const vendorValue = watch("lastVendorId");

  const vendorOptions = loadState.status === "ready" ? loadState.vendorOptions : [];
  const item = loadState.status === "ready" ? loadState.item : null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit inventory item"
      description="Changes are saved immediately and will appear in the list."
      size="lg"
    >
      {loadState.status === "loading" || loadState.status === "idle" ? (
        <LoadingShimmer />
      ) : loadState.status === "error" ? (
        <div className="px-5 py-8 text-center text-sm text-[rgb(var(--muted-foreground))]">
          {loadState.message}
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 px-5 pt-4 pb-2">
            {serverError ? (
              <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
                {serverError}
              </div>
            ) : null}

            {item ? (
              <div className="rounded-[18px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-3.5 py-2.5">
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  Branch:{" "}
                  <span className="font-medium text-[rgb(var(--foreground))]">
                    {item.branchName}
                  </span>
                </p>
              </div>
            ) : null}

            {/* Item details */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-[rgb(var(--muted-foreground))] uppercase">
                Item details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="edit-inv-name">Item name</FieldLabel>
                  <Input
                    id="edit-inv-name"
                    placeholder="e.g. A4 Bond Paper"
                    disabled={isSubmitting}
                    {...register("name")}
                  />
                  <FieldError message={getFieldError("name")} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-inv-sku">SKU</FieldLabel>
                  <Input
                    id="edit-inv-sku"
                    placeholder="e.g. PAPER-A4-80"
                    disabled={isSubmitting}
                    {...register("sku")}
                  />
                  <FieldError message={getFieldError("sku")} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-inv-unit">Unit</FieldLabel>
                  <Select
                    id="edit-inv-unit"
                    value={unitValue}
                    disabled={isSubmitting}
                    onChange={(e) =>
                      setValue("unit", e.target.value as UpdateInventoryFormValues["unit"], {
                        shouldValidate: true,
                      })
                    }
                  >
                    <option value="">Select unit</option>
                    {inventoryUnitValues.map((u) => (
                      <option key={u} value={u}>
                        {inventoryUnitLabels[u]}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={getFieldError("unit")} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-inv-status">Status</FieldLabel>
                  <Select
                    id="edit-inv-status"
                    disabled={isSubmitting}
                    value={isActiveValue ? "active" : "inactive"}
                    onChange={(e) =>
                      setValue("isActive", e.target.value === "active", { shouldValidate: true })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                  <FieldError message={getFieldError("isActive")} />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-[rgb(var(--muted-foreground))] uppercase">
                Pricing
              </p>
              <input type="hidden" {...register("newQuantity")} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-inv-rate" optional>
                    Last purchase rate
                  </FieldLabel>
                  <Input
                    id="edit-inv-rate"
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={isSubmitting}
                    {...register("lastPurchaseRate")}
                  />
                  <FieldError message={getFieldError("lastPurchaseRate")} />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="edit-inv-vendor" optional>
                    Last vendor
                  </FieldLabel>
                  <Select
                    id="edit-inv-vendor"
                    value={vendorValue}
                    disabled={isSubmitting}
                    onChange={(e) =>
                      setValue("lastVendorId", e.target.value, { shouldValidate: true })
                    }
                  >
                    <option value="">No vendor</option>
                    {vendorOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={getFieldError("lastVendorId")} />
                </div>
              </div>
            </div>

            {/* Management */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-[rgb(var(--muted-foreground))] uppercase">
                Management
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-inv-reorder" optional>
                    Reorder level
                  </FieldLabel>
                  <Input
                    id="edit-inv-reorder"
                    inputMode="decimal"
                    placeholder="e.g. 5"
                    disabled={isSubmitting}
                    {...register("reorderLevel")}
                  />
                  <FieldError message={getFieldError("reorderLevel")} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-inv-image" optional>
                    Image URL
                  </FieldLabel>
                  <Input
                    id="edit-inv-image"
                    type="url"
                    placeholder="https://..."
                    disabled={isSubmitting}
                    {...register("image")}
                  />
                  <FieldError message={getFieldError("image")} />
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
            {loadState.status === "ready" && loadState.updatedByName ? (
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Last edited by{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {loadState.updatedByName}
                </span>{" "}
                on {formatDateTime(loadState.updatedAt)}
              </p>
            ) : null}
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
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
}
