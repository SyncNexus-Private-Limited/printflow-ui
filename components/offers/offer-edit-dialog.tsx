"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerTypeOption } from "@/lib/customers/types";
import { buildOfferSchema } from "@/lib/offers/schema";
import {
  offerTypeLabels,
  offerTypeValues,
  type EditOfferRow,
  type OfferFieldName,
  type OfferFormValues,
  type OfferMutationResponse,
} from "@/lib/offers/types";
import type { BranchOption } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

type OfferDetailApiResponse =
  | { success: true; data: { offer: EditOfferRow } }
  | { success: false; message: string };

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; offer: EditOfferRow };

type OfferEditDialogProps = {
  offerId: string | null;
  branchOptions: BranchOption[];
  canSelectBranch: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerTypeOptions: CustomerTypeOption[];
};

function FieldLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor?: string;
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

function buildDefaultValues(offer: EditOfferRow): OfferFormValues {
  return {
    branchId: offer.branchId,
    code: offer.code,
    name: offer.name,
    description: offer.description ?? "",
    offerType: offer.offerType,
    discountValue: offer.discountValue === null ? "" : String(offer.discountValue),
    buyQuantity: offer.buyQuantity === null ? "" : String(offer.buyQuantity),
    getQuantity: offer.getQuantity === null ? "" : String(offer.getQuantity),
    minimumOrderValue: offer.minimumOrderValue === null ? "" : String(offer.minimumOrderValue),
    customerTypes: offer.customerTypes ?? [],
    startsAt: offer.startsAt,
    endsAt: offer.endsAt ?? "",
    isActive: offer.isActive,
  };
}

export function OfferEditDialog({
  offerId,
  branchOptions,
  canSelectBranch,
  onClose,
  onSuccess,
  customerTypeOptions,
}: OfferEditDialogProps) {
  const isOpen = offerId !== null;
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [serverError, setServerError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const schema = useMemo(
    () => buildOfferSchema(customerTypeOptions.map((option) => option.value)),
    [customerTypeOptions],
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OfferFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<OfferFormValues>,
    defaultValues: {
      branchId: "",
      code: "",
      name: "",
      description: "",
      offerType: "",
      discountValue: "",
      buyQuantity: "",
      getQuantity: "",
      minimumOrderValue: "",
      customerTypes: [],
      startsAt: "",
      endsAt: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!offerId) {
      abortRef.current?.abort();
      setLoadState({ status: "idle" });
      setServerError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading" });
    setServerError(null);

    fetch(`/api/offers/${offerId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as OfferDetailApiResponse;
        if (!data.success) {
          setLoadState({ status: "error", message: data.message });
          return;
        }
        reset(buildDefaultValues(data.data.offer));
        setLoadState({ status: "ready", offer: data.data.offer });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadState({ status: "error", message: "Unable to load offer details right now." });
      });

    return () => controller.abort();
  }, [offerId, reset]);

  const offerType = watch("offerType");
  const isActive = watch("isActive");
  const selectedCustomerTypes = watch("customerTypes");

  function getFieldError(field: OfferFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  function toggleCustomerType(type: string) {
    const current = selectedCustomerTypes ?? [];
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setValue("customerTypes", next, { shouldValidate: true });
  }

  const onSubmit = handleSubmit(async (values) => {
    if (loadState.status !== "ready") return;
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch(`/api/offers/${loadState.offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...values }),
      });
      const data = (await res.json().catch(() => null)) as OfferMutationResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [OfferFieldName, string]
          >) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(data && !data.success ? data.message : "Unable to save changes right now.");
        return;
      }

      onSuccess();
    } catch {
      setServerError("Unable to save changes right now.");
    }
  });

  const readyOffer = loadState.status === "ready" ? loadState.offer : null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit offer"
      description="Changes apply to future order creation."
      size="lg"
    >
      {loadState.status === "loading" || loadState.status === "idle" ? (
        <div className="space-y-4 px-5 pt-4 pb-6" aria-busy="true">
          {[1, 2, 3].map((row) => (
            <div key={row} className="grid gap-4 sm:grid-cols-2">
              <div className="h-11 animate-pulse rounded-xl bg-[rgb(var(--muted)/0.5)]" />
              <div className="h-11 animate-pulse rounded-xl bg-[rgb(var(--muted)/0.5)]" />
            </div>
          ))}
        </div>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-offer-branch">Branch</FieldLabel>
                <Select
                  id="edit-offer-branch"
                  value={watch("branchId")}
                  disabled={isSubmitting || !canSelectBranch}
                  onChange={(event) =>
                    setValue("branchId", event.target.value, { shouldValidate: true })
                  }
                >
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
                <FieldError message={getFieldError("branchId")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-offer-code">Code</FieldLabel>
                <Input
                  id="edit-offer-code"
                  disabled={isSubmitting}
                  {...register("code")}
                  onChange={(e) =>
                    setValue("code", e.target.value.toUpperCase(), { shouldDirty: true })
                  }
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  4–25 characters. Uppercase letters, numbers, and hyphens only.
                </p>
                <FieldError message={getFieldError("code")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-offer-name">Name</FieldLabel>
                <Input id="edit-offer-name" disabled={isSubmitting} {...register("name")} />
                <FieldError message={getFieldError("name")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-offer-type">Type</FieldLabel>
                <Select
                  id="edit-offer-type"
                  value={offerType}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setValue("offerType", event.target.value as OfferFormValues["offerType"], {
                      shouldValidate: true,
                    })
                  }
                >
                  {offerTypeValues.map((value) => (
                    <option key={value} value={value}>
                      {offerTypeLabels[value]}
                    </option>
                  ))}
                </Select>
                <FieldError message={getFieldError("offerType")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-offer-discount" optional>
                  Discount value
                </FieldLabel>
                <Input
                  id="edit-offer-discount"
                  inputMode="decimal"
                  disabled={isSubmitting || offerType === "buy_x_get_y"}
                  {...register("discountValue")}
                />
                <FieldError message={getFieldError("discountValue")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-offer-buy-qty" optional>
                    Buy qty
                  </FieldLabel>
                  <Input
                    id="edit-offer-buy-qty"
                    inputMode="numeric"
                    disabled={isSubmitting || offerType !== "buy_x_get_y"}
                    {...register("buyQuantity")}
                  />
                  <FieldError message={getFieldError("buyQuantity")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-offer-get-qty" optional>
                    Get qty
                  </FieldLabel>
                  <Input
                    id="edit-offer-get-qty"
                    inputMode="numeric"
                    disabled={isSubmitting || offerType !== "buy_x_get_y"}
                    {...register("getQuantity")}
                  />
                  <FieldError message={getFieldError("getQuantity")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-offer-minimum" optional>
                  Minimum order
                </FieldLabel>
                <Input
                  id="edit-offer-minimum"
                  inputMode="decimal"
                  disabled={isSubmitting}
                  {...register("minimumOrderValue")}
                />
                <FieldError message={getFieldError("minimumOrderValue")} />
              </div>

              {/* Customer type — multi-select chips */}
              <div className="space-y-1.5">
                <FieldLabel optional>Customer type</FieldLabel>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {customerTypeOptions.map((option) => {
                    const isSelected = selectedCustomerTypes.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => toggleCustomerType(option.value)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          isSelected
                            ? "border-[rgb(var(--primary)/0.6)] bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))]"
                            : "border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--primary)/0.4)] hover:text-[rgb(var(--foreground))]",
                          isSubmitting && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  {selectedCustomerTypes.length === 0
                    ? "No selection — applies to all customer types."
                    : `Applies to: ${selectedCustomerTypes
                        .map(
                          (t) =>
                            customerTypeOptions.find((option) => option.value === t)?.label ?? t,
                        )
                        .join(", ")}.`}
                </p>
                <FieldError message={getFieldError("customerTypes")} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-offer-starts-at">Starts</FieldLabel>
                  <Input
                    id="edit-offer-starts-at"
                    type="date"
                    disabled={isSubmitting}
                    {...register("startsAt")}
                  />
                  <FieldError message={getFieldError("startsAt")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-offer-ends-at" optional>
                    Ends
                  </FieldLabel>
                  <Input
                    id="edit-offer-ends-at"
                    type="date"
                    disabled={isSubmitting}
                    {...register("endsAt")}
                  />
                  <FieldError message={getFieldError("endsAt")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-offer-status">Status</FieldLabel>
                <Select
                  id="edit-offer-status"
                  value={isActive ? "active" : "inactive"}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setValue("isActive", event.target.value === "active", { shouldValidate: true })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
                <FieldError message={getFieldError("isActive")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-offer-description" optional>
                  Description
                </FieldLabel>
                <Textarea
                  id="edit-offer-description"
                  disabled={isSubmitting}
                  {...register("description")}
                />
                <FieldError message={getFieldError("description")} />
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
            {readyOffer ? (
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Last edited by{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {readyOffer.updatedByName ?? "Unknown user"}
                </span>{" "}
                on {formatDateTime(readyOffer.updatedAt)}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4 shadow-none"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 min-w-28 rounded-2xl px-5"
                disabled={isSubmitting}
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
