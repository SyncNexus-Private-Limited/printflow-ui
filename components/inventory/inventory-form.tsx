"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { createInventorySchema } from "@/lib/inventory/schema";
import {
  inventoryUnitLabels,
  inventoryUnitValues,
  type CreateInventoryApiResponse,
  type CreateInventoryFieldName,
  type CreateInventoryFormValues,
  type InventoryFormPageData,
} from "@/lib/inventory/types";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

function buildDefaultValues(selectedBranchId: string): CreateInventoryFormValues {
  return {
    branchId: selectedBranchId,
    name: "",
    sku: "",
    unit: "",
    isActive: true,
    initialQuantity: "0",
    lastPurchaseRate: "",
    lastVendorId: "",
    reorderLevel: "",
    image: "",
    note: "",
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
  errors: ReturnType<typeof useForm<CreateInventoryFormValues>>["formState"]["errors"],
  field: CreateInventoryFieldName,
): string | undefined {
  const err = errors[field];
  if (!err || typeof err !== "object" || !("message" in err)) return undefined;
  return typeof err.message === "string" ? err.message : undefined;
}

export function InventoryForm(props: InventoryFormPageData) {
  const { branchOptions, vendorOptions, selectedBranchId, canSelectBranch } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showBlockingLoader, hideBlockingLoader } = useGlobalLoader();
  const [, startNavTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues = useMemo(() => buildDefaultValues(selectedBranchId), [selectedBranchId]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateInventoryFormValues>({
    resolver: zodResolver(createInventorySchema) as unknown as Resolver<CreateInventoryFormValues>,
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
    setServerError(null);
  }, [defaultValues, reset]);

  const navigateToBranch = (nextBranchId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (nextBranchId) {
      next.set("branchId", nextBranchId);
    } else {
      next.delete("branchId");
    }
    const nextHref = `${pathname}?${next.toString()}`;
    const currentHref = `${pathname}?${searchParams.toString()}`;
    if (nextHref === currentHref) return;
    startNavTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();
    showBlockingLoader("Creating inventory item...", { autoHideOnRouteChange: true });

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json().catch(() => null)) as CreateInventoryApiResponse | null;

      if (!response.ok || !data || !("success" in data) || !data.success) {
        if (data && "fieldErrors" in data && data.fieldErrors) {
          for (const [fieldName, message] of Object.entries(data.fieldErrors) as Array<
            [CreateInventoryFieldName, string]
          >) {
            if (!message) continue;
            setError(fieldName, { type: "server", message });
          }
        }
        setServerError(
          data && "message" in data
            ? data.message
            : "Unable to create the inventory item right now.",
        );
        hideBlockingLoader();
        return;
      }

      router.push(data.data.redirectTo);
    } catch {
      setServerError("Unable to create the inventory item right now.");
      hideBlockingLoader();
    }
  });

  const isActiveValue = watch("isActive");
  const unitValue = watch("unit");

  return (
    <form className="space-y-8" onSubmit={onSubmit} noValidate>
      <input type="hidden" {...register("branchId")} value={selectedBranchId} />

      {/* Server error */}
      {serverError ? (
        <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {serverError}
        </div>
      ) : null}

      {/* Section A — Item identity */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">Item details</p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Basic information about the inventory item.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {canSelectBranch && branchOptions.length > 0 && (
            <div className="space-y-2 md:col-span-2">
              <FieldLabel htmlFor="inv-branch">Branch</FieldLabel>
              <Select
                id="inv-branch"
                value={selectedBranchId}
                disabled={isSubmitting}
                onChange={(e) => navigateToBranch(e.target.value)}
              >
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <FieldError message={getFieldError(errors, "branchId")} />
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="inv-name">Item name</FieldLabel>
            <Input
              id="inv-name"
              placeholder="e.g. A4 Bond Paper"
              disabled={isSubmitting}
              {...register("name")}
            />
            <FieldError message={getFieldError(errors, "name")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="inv-sku">SKU</FieldLabel>
            <Input
              id="inv-sku"
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
            <FieldLabel htmlFor="inv-unit">Unit</FieldLabel>
            <Select
              id="inv-unit"
              value={unitValue}
              disabled={isSubmitting}
              onChange={(e) =>
                setValue("unit", e.target.value as CreateInventoryFormValues["unit"], {
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
            <FieldLabel htmlFor="inv-status">Status</FieldLabel>
            <Select
              id="inv-status"
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
            Opening stock quantity and purchase details.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="inv-qty">Opening quantity</FieldLabel>
            <Input
              id="inv-qty"
              inputMode="decimal"
              placeholder="0"
              disabled={isSubmitting}
              {...register("initialQuantity")}
            />
            <FieldError message={getFieldError(errors, "initialQuantity")} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="inv-rate" optional>
              Last purchase rate
            </FieldLabel>
            <Input
              id="inv-rate"
              inputMode="decimal"
              placeholder="0.00"
              disabled={isSubmitting}
              {...register("lastPurchaseRate")}
            />
            <FieldError message={getFieldError(errors, "lastPurchaseRate")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="inv-vendor" optional>
              Last vendor
            </FieldLabel>
            <Select
              id="inv-vendor"
              value={watch("lastVendorId")}
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
            <FieldLabel htmlFor="inv-reorder" optional>
              Reorder level
            </FieldLabel>
            <Input
              id="inv-reorder"
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
            <FieldLabel htmlFor="inv-image" optional>
              Image URL
            </FieldLabel>
            <Input
              id="inv-image"
              placeholder="https://..."
              disabled={isSubmitting}
              {...register("image")}
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Enter a full http or https URL.
            </p>
            <FieldError message={getFieldError(errors, "image")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel htmlFor="inv-note" optional>
              Opening stock note
            </FieldLabel>
            <Textarea
              id="inv-note"
              placeholder="e.g. Initial stock on hand as of today"
              disabled={isSubmitting}
              {...register("note")}
            />
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Recorded on the stock movement for this opening balance.
            </p>
            <FieldError message={getFieldError(errors, "note")} />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={isSubmitting} className="rounded-2xl px-5">
          {isSubmitting ? (
            <>
              <Spinner size="xs" ariaHidden className="mr-2" />
              Creating item...
            </>
          ) : (
            "Create Inventory Item"
          )}
        </Button>
      </div>
    </form>
  );
}
