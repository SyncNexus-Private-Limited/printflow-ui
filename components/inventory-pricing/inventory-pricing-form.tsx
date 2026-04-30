"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
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
import type { InventoryPricingInventoryOption } from "@/lib/dashboard/types";

type InventoryPricingFormProps = {
  inventoryOptions: InventoryPricingInventoryOption[];
  selectedBranchName: string;
  redirectTo: string;
  initialInventoryId?: string;
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

export function InventoryPricingForm({
  inventoryOptions,
  selectedBranchName,
  redirectTo,
  initialInventoryId,
}: InventoryPricingFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const initialItemAvailable =
    !!initialInventoryId && inventoryOptions.some((opt) => opt.id === initialInventoryId);
  const initialItemUnavailable = !!initialInventoryId && !initialItemAvailable;

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InventoryPricingFormValues>({
    resolver: zodResolver(
      inventoryPricingSchema,
    ) as unknown as Resolver<InventoryPricingFormValues>,
    defaultValues: {
      inventoryId: initialItemAvailable ? initialInventoryId : "",
      customerType: "",
      sellingRate: "",
      effectiveFrom: "",
      effectiveTo: "",
    },
  });

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
      const res = await fetch("/api/inventory-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
        setServerError(
          data && !data.success ? data.message : "Unable to create pricing right now.",
        );
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setServerError("Unable to create pricing right now.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {serverError ? (
        <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {serverError}
        </div>
      ) : null}

      <div className="rounded-[18px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-3.5 py-2.5">
        <p className="text-xs text-[rgb(var(--muted-foreground))]">
          Branch context:{" "}
          <span className="font-medium text-[rgb(var(--foreground))]">{selectedBranchName}</span>
        </p>
      </div>

      {selectedItem ? (
        <div className="rounded-[18px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--background)/0.62)] px-4 py-3">
          <p className="text-sm font-semibold text-[rgb(var(--foreground))]">{selectedItem.name}</p>
          <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
            SKU: <span className="font-mono">{selectedItem.sku}</span> &middot; Branch:{" "}
            {selectedItem.branchName}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel htmlFor="pricing-page-inventory-id">Item</FieldLabel>
          <Select
            id="pricing-page-inventory-id"
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
          {initialItemUnavailable ? (
            <p className="text-xs text-[rgb(var(--danger))]">
              This item is inactive or unavailable for pricing. Only active inventory items are
              shown.
            </p>
          ) : (
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Only active inventory items are shown.
            </p>
          )}
          <FieldError message={getFieldError("inventoryId")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="pricing-page-customer-type">Customer type</FieldLabel>
          <Select
            id="pricing-page-customer-type"
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
          <FieldLabel htmlFor="pricing-page-selling-rate">Selling rate</FieldLabel>
          <Input
            id="pricing-page-selling-rate"
            inputMode="decimal"
            placeholder="0.00"
            disabled={isSubmitting}
            {...register("sellingRate")}
          />
          <FieldError message={getFieldError("sellingRate")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="pricing-page-effective-from">Effective from</FieldLabel>
          <Input
            id="pricing-page-effective-from"
            type="date"
            disabled={isSubmitting}
            {...register("effectiveFrom")}
          />
          <FieldError message={getFieldError("effectiveFrom")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="pricing-page-effective-to" optional>
            Effective to
          </FieldLabel>
          <Input
            id="pricing-page-effective-to"
            type="date"
            disabled={isSubmitting}
            {...register("effectiveTo")}
          />
          <FieldError message={getFieldError("effectiveTo")} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[rgb(var(--border)/0.62)] pt-5 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-2xl px-4 shadow-none"
          onClick={() => router.push(redirectTo)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-10 min-w-32 rounded-2xl px-5"
          disabled={isSubmitting || inventoryOptions.length === 0}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner size="xs" ariaHidden className="mr-2" />
              Creating...
            </>
          ) : (
            "Create pricing"
          )}
        </Button>
      </div>
    </form>
  );
}
