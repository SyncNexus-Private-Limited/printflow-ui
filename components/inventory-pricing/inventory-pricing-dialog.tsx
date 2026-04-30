"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { inventoryPricingSchema } from "@/lib/inventory-pricing/schema";
import {
  inventoryPricingCustomerTypeLabels,
  inventoryPricingCustomerTypeValues,
  type InventoryPricingFieldName,
  type InventoryPricingFormValues,
  type InventoryPricingMutationResponse,
} from "@/lib/inventory-pricing/types";
import type { InventoryPricingInventoryOption, InventoryPricingRow } from "@/lib/dashboard/types";
import { formatDateTime } from "@/lib/utils/format";

type InventoryPricingDialogProps = {
  mode: "create" | "edit";
  isOpen: boolean;
  pricing: InventoryPricingRow | null;
  inventoryOptions: InventoryPricingInventoryOption[];
  onClose: () => void;
  onSaved: () => void;
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
        <span className="ml-1.5 font-normal tracking-normal normal-case">Optional</span>
      ) : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-[rgb(var(--danger))]">{message}</p> : null;
}

function buildDefaultValues(pricing: InventoryPricingRow | null): InventoryPricingFormValues {
  return {
    inventoryId: pricing?.inventoryId ?? "",
    customerType: (pricing?.customerType as InventoryPricingFormValues["customerType"]) ?? "",
    sellingRate: pricing ? String(pricing.sellingRate) : "",
    effectiveFrom: pricing?.effectiveFrom ?? "",
    effectiveTo: pricing?.effectiveTo ?? "",
  };
}

export function InventoryPricingDialog({
  mode,
  isOpen,
  pricing,
  inventoryOptions,
  onClose,
  onSaved,
}: InventoryPricingDialogProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InventoryPricingFormValues>({
    resolver: zodResolver(
      inventoryPricingSchema,
    ) as unknown as Resolver<InventoryPricingFormValues>,
    defaultValues: buildDefaultValues(pricing),
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(buildDefaultValues(pricing));
    setServerError(null);
    clearErrors();
  }, [clearErrors, isOpen, pricing, reset]);

  const inventoryId = watch("inventoryId");
  const customerType = watch("customerType");
  const selectedItem = useMemo(
    () => inventoryOptions.find((item) => item.id === inventoryId) ?? null,
    [inventoryId, inventoryOptions],
  );

  function getFieldError(field: InventoryPricingFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();

    try {
      const endpoint =
        mode === "edit" && pricing
          ? `/api/inventory-pricing/${pricing.id}`
          : "/api/inventory-pricing";
      const res = await fetch(endpoint, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "edit" ? { action: "update", ...values } : values),
      });
      const data = (await res.json().catch(() => null)) as InventoryPricingMutationResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [InventoryPricingFieldName, string]
          >) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(data && !data.success ? data.message : "Unable to save pricing right now.");
        return;
      }

      onSaved();
      router.refresh();
    } catch {
      setServerError("Unable to save pricing right now.");
    }
  });

  const title = mode === "edit" ? "Edit inventory pricing" : "Add inventory pricing";

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description="Pricing windows are validated against existing item, branch, and customer type prices."
      size="lg"
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="space-y-5 px-5 pt-4 pb-2">
          {serverError ? (
            <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
              {serverError}
            </div>
          ) : null}

          {selectedItem ? (
            <div className="rounded-[18px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-3.5 py-2.5">
              <p className="text-xs text-[rgb(var(--muted-foreground))]">
                Branch:{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {selectedItem.branchName}
                </span>{" "}
                &middot; SKU:{" "}
                <span className="font-mono text-[rgb(var(--foreground))]">{selectedItem.sku}</span>
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor="pricing-inventory-id">Item</FieldLabel>
              <Select
                id="pricing-inventory-id"
                value={inventoryId}
                disabled={isSubmitting || inventoryOptions.length === 0}
                onChange={(event) =>
                  setValue("inventoryId", event.target.value, { shouldValidate: true })
                }
              >
                <option value="">
                  {inventoryOptions.length === 0 ? "No active items found" : "Select item"}
                </option>
                {inventoryOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} &middot; {item.sku} &middot; {item.branchName}
                  </option>
                ))}
              </Select>
              <FieldError message={getFieldError("inventoryId")} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="pricing-customer-type">Customer type</FieldLabel>
              <Select
                id="pricing-customer-type"
                value={customerType}
                disabled={isSubmitting}
                onChange={(event) =>
                  setValue(
                    "customerType",
                    event.target.value as InventoryPricingFormValues["customerType"],
                    { shouldValidate: true },
                  )
                }
              >
                <option value="">Select type</option>
                {inventoryPricingCustomerTypeValues.map((type) => (
                  <option key={type} value={type}>
                    {inventoryPricingCustomerTypeLabels[type]}
                  </option>
                ))}
              </Select>
              <FieldError message={getFieldError("customerType")} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="pricing-selling-rate">Selling rate</FieldLabel>
              <Input
                id="pricing-selling-rate"
                inputMode="decimal"
                placeholder="0.00"
                disabled={isSubmitting}
                {...register("sellingRate")}
              />
              <FieldError message={getFieldError("sellingRate")} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="pricing-effective-from">Effective from</FieldLabel>
              <Input
                id="pricing-effective-from"
                type="date"
                disabled={isSubmitting}
                {...register("effectiveFrom")}
              />
              <FieldError message={getFieldError("effectiveFrom")} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="pricing-effective-to" optional>
                Effective to
              </FieldLabel>
              <Input
                id="pricing-effective-to"
                type="date"
                disabled={isSubmitting}
                {...register("effectiveTo")}
              />
              <FieldError message={getFieldError("effectiveTo")} />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
          {mode === "edit" && pricing ? (
            <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
              Last edited by{" "}
              <span className="font-medium text-[rgb(var(--foreground))]">
                {pricing.updatedByName ?? "Unknown user"}
              </span>{" "}
              on {formatDateTime(pricing.updatedAt)}
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
              ) : mode === "edit" ? (
                "Save changes"
              ) : (
                "Create pricing"
              )}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
