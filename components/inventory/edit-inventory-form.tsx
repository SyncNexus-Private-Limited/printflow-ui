"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { updateInventorySchema } from "@/lib/inventory/schema";
import {
  inventoryUnitLabels,
  inventoryUnitValues,
  type EditInventoryFormPageData,
  type UpdateInventoryApiResponse,
  type UpdateInventoryFieldName,
  type UpdateInventoryFormValues,
} from "@/lib/inventory/types";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type EditInventoryFormProps = EditInventoryFormPageData & {
  inventoryId: string;
};

function buildDefaultValues(item: EditInventoryFormPageData["item"]): UpdateInventoryFormValues {
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
      className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--foreground))]"
      htmlFor={htmlFor}
    >
      {children}
      {optional ? (
        <span className="text-xs font-normal text-[rgb(var(--muted-foreground))]">Optional</span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-[rgb(var(--danger))]">{message}</p> : null;
}

function getFieldError(
  errors: ReturnType<typeof useForm<UpdateInventoryFormValues>>["formState"]["errors"],
  field: UpdateInventoryFieldName,
): string | undefined {
  const err = errors[field];
  if (!err || typeof err !== "object" || !("message" in err)) return undefined;
  return typeof err.message === "string" ? err.message : undefined;
}

export function EditInventoryForm({ inventoryId, item, vendorOptions }: EditInventoryFormProps) {
  const router = useRouter();
  const { showBlockingLoader, hideBlockingLoader } = useGlobalLoader();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues = useMemo(() => buildDefaultValues(item), [item]);

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
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
    setServerError(null);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();
    showBlockingLoader("Saving changes...", { autoHideOnRouteChange: true });

    try {
      const response = await fetch(`/api/inventory/${inventoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...values }),
      });
      const data = (await response.json().catch(() => null)) as UpdateInventoryApiResponse | null;

      if (!response.ok || !data || !("success" in data) || !data.success) {
        if (data && "fieldErrors" in data && data.fieldErrors) {
          for (const [fieldName, message] of Object.entries(data.fieldErrors) as Array<
            [UpdateInventoryFieldName, string]
          >) {
            if (!message) continue;
            setError(fieldName, { type: "server", message });
          }
        }
        setServerError(
          data && "message" in data ? data.message : "Unable to save changes right now.",
        );
        hideBlockingLoader();
        return;
      }

      router.push("/dashboard/inventory?updated=1");
    } catch {
      setServerError("Unable to save changes right now.");
      hideBlockingLoader();
    }
  });

  const isActiveValue = watch("isActive");
  const unitValue = watch("unit");
  const vendorValue = watch("lastVendorId");
  const currentQty = item.quantity;
  const newQtyRaw = watch("newQuantity");
  const newQty = parseFloat(newQtyRaw);
  const delta = !isNaN(newQty) ? newQty - currentQty : null;

  return (
    <form className="space-y-8" onSubmit={onSubmit} noValidate>
      {serverError ? (
        <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {serverError}
        </div>
      ) : null}

      {/* Read-only branch info */}
      <div className="rounded-[22px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-4 py-3">
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Branch:{" "}
          <span className="font-medium text-[rgb(var(--foreground))]">{item.branchName}</span>
        </p>
      </div>

      {/* Section A — Item identity */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Item details</p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Basic information about the inventory item.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="edit-inv-name">Item name</FieldLabel>
            <Input
              id="edit-inv-name"
              placeholder="e.g. A4 Bond Paper"
              disabled={isSubmitting}
              {...register("name")}
            />
            <FieldError message={getFieldError(errors, "name")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="edit-inv-sku">SKU</FieldLabel>
            <Input
              id="edit-inv-sku"
              placeholder="e.g. PAPER-A4-80"
              disabled={isSubmitting}
              {...register("sku")}
              onChange={(e) => setValue("sku", e.target.value.toUpperCase(), { shouldDirty: true })}
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              3–25 characters. Uppercase letters, numbers, and hyphens only. Must be unique within
              this branch.
            </p>
            <FieldError message={getFieldError(errors, "sku")} />
          </div>

          <div className="space-y-2">
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
            <FieldError message={getFieldError(errors, "unit")} />
          </div>

          <div className="space-y-2">
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
            <FieldError message={getFieldError(errors, "isActive")} />
          </div>
        </div>
      </section>

      {/* Section B — Stock & pricing */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">
            Stock &amp; pricing
          </p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Current stock quantity and purchase details.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="edit-inv-qty">Quantity</FieldLabel>
            <Input
              id="edit-inv-qty"
              inputMode="decimal"
              placeholder="0"
              disabled={isSubmitting}
              {...register("newQuantity")}
            />
            {delta !== null && Math.abs(delta) > 0.0005 && (
              <p className="text-xs text-[rgb(var(--muted-foreground))]">
                {delta > 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3)} from current stock (
                {currentQty})
              </p>
            )}
            <FieldError message={getFieldError(errors, "newQuantity")} />
          </div>

          <div className="space-y-2">
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
            <FieldError message={getFieldError(errors, "lastPurchaseRate")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="edit-inv-vendor" optional>
              Last vendor
            </FieldLabel>
            <Select
              id="edit-inv-vendor"
              value={vendorValue}
              disabled={isSubmitting}
              onChange={(e) => setValue("lastVendorId", e.target.value, { shouldValidate: true })}
            >
              <option value="">No vendor</option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
            {vendorOptions.length === 0 && (
              <p className="text-xs text-[rgb(var(--muted-foreground))]">
                No vendors found for this branch.
              </p>
            )}
            <FieldError message={getFieldError(errors, "lastVendorId")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="edit-inv-adj-note" optional>
              Adjustment note
            </FieldLabel>
            <Textarea
              id="edit-inv-adj-note"
              placeholder="Reason for quantity change"
              disabled={isSubmitting}
              {...register("adjustmentNote")}
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Recorded on the stock movement if the quantity changes.
            </p>
            <FieldError message={getFieldError(errors, "adjustmentNote")} />
          </div>
        </div>
      </section>

      {/* Section C — Management */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Management</p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Reorder threshold and optional image.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
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
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Alert when stock falls to or below this quantity.
            </p>
            <FieldError message={getFieldError(errors, "reorderLevel")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="edit-inv-image" optional>
              Image URL
            </FieldLabel>
            <Input
              id="edit-inv-image"
              placeholder="https://..."
              disabled={isSubmitting}
              {...register("image")}
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Enter a full http or https URL.
            </p>
            <FieldError message={getFieldError(errors, "image")} />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          className="rounded-2xl px-4"
          disabled={isSubmitting}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="rounded-2xl px-5">
          {isSubmitting ? (
            <>
              <Spinner size="xs" ariaHidden className="mr-2" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  );
}
