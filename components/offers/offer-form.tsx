"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { offerSchema } from "@/lib/offers/schema";
import {
  customerTypeLabels,
  customerTypeValues,
  offerTypeLabels,
  offerTypeValues,
  type OfferFieldName,
  type OfferFormPageData,
  type OfferFormValues,
  type OfferMutationResponse,
} from "@/lib/offers/types";

function buildDefaultValues(selectedBranchId: string): OfferFormValues {
  return {
    branchId: selectedBranchId,
    code: "",
    name: "",
    description: "",
    offerType: "",
    discountValue: "",
    buyQuantity: "",
    getQuantity: "",
    minimumOrderValue: "",
    customerType: "",
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: "",
    isActive: true,
  };
}

function FieldLabel({ htmlFor, children, optional = false }: { htmlFor: string; children: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-semibold tracking-[0.16em] text-[rgb(var(--muted-foreground))] uppercase">
      {children}
      {optional ? <span className="ml-1.5 font-normal tracking-normal normal-case">Optional</span> : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-[rgb(var(--danger))]">{message}</p> : null;
}

export function OfferForm({ branchOptions, selectedBranchId, canSelectBranch }: OfferFormPageData) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  } = useForm<OfferFormValues>({
    resolver: zodResolver(offerSchema) as unknown as Resolver<OfferFormValues>,
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
    setServerError(null);
  }, [defaultValues, reset]);

  const offerType = watch("offerType");
  const isActive = watch("isActive");

  function getFieldError(field: OfferFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const navigateToBranch = (nextBranchId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("branchId", nextBranchId);
    const nextHref = `${pathname}?${next.toString()}`;
    const currentHref = `${pathname}?${searchParams.toString()}`;
    if (nextHref === currentHref) return;
    startNavTransition(() => router.replace(nextHref, { scroll: false }));
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as OfferMutationResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<[OfferFieldName, string]>) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(data && !data.success ? data.message : "Unable to create offer right now.");
        return;
      }

      router.push("/dashboard/offers");
      router.refresh();
    } catch {
      setServerError("Unable to create offer right now.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {serverError ? (
        <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {serverError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="offer-branch">Branch</FieldLabel>
          <Select
            id="offer-branch"
            value={watch("branchId")}
            disabled={isSubmitting || !canSelectBranch}
            onChange={(event) => {
              setValue("branchId", event.target.value, { shouldValidate: true });
              navigateToBranch(event.target.value);
            }}
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
          <FieldLabel htmlFor="offer-code">Code</FieldLabel>
          <Input id="offer-code" disabled={isSubmitting} {...register("code")} />
          <FieldError message={getFieldError("code")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="offer-name">Name</FieldLabel>
          <Input id="offer-name" disabled={isSubmitting} {...register("name")} />
          <FieldError message={getFieldError("name")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="offer-type">Type</FieldLabel>
          <Select
            id="offer-type"
            value={offerType}
            disabled={isSubmitting}
            onChange={(event) =>
              setValue("offerType", event.target.value as OfferFormValues["offerType"], {
                shouldValidate: true,
              })
            }
          >
            <option value="">Select type</option>
            {offerTypeValues.map((value) => (
              <option key={value} value={value}>
                {offerTypeLabels[value]}
              </option>
            ))}
          </Select>
          <FieldError message={getFieldError("offerType")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="offer-discount" optional>
            Discount value
          </FieldLabel>
          <Input id="offer-discount" inputMode="decimal" disabled={isSubmitting || offerType === "buy_x_get_y"} {...register("discountValue")} />
          <FieldError message={getFieldError("discountValue")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="offer-buy-qty" optional>
              Buy qty
            </FieldLabel>
            <Input id="offer-buy-qty" inputMode="numeric" disabled={isSubmitting || offerType !== "buy_x_get_y"} {...register("buyQuantity")} />
            <FieldError message={getFieldError("buyQuantity")} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="offer-get-qty" optional>
              Get qty
            </FieldLabel>
            <Input id="offer-get-qty" inputMode="numeric" disabled={isSubmitting || offerType !== "buy_x_get_y"} {...register("getQuantity")} />
            <FieldError message={getFieldError("getQuantity")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="offer-minimum" optional>
            Minimum order
          </FieldLabel>
          <Input id="offer-minimum" inputMode="decimal" disabled={isSubmitting} {...register("minimumOrderValue")} />
          <FieldError message={getFieldError("minimumOrderValue")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="offer-customer-type" optional>
            Customer type
          </FieldLabel>
          <Select id="offer-customer-type" disabled={isSubmitting} {...register("customerType")}>
            <option value="">All customers</option>
            {customerTypeValues.map((value) => (
              <option key={value} value={value}>
                {customerTypeLabels[value]}
              </option>
            ))}
          </Select>
          <FieldError message={getFieldError("customerType")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="offer-starts-at">Starts</FieldLabel>
            <Input id="offer-starts-at" type="date" disabled={isSubmitting} {...register("startsAt")} />
            <FieldError message={getFieldError("startsAt")} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="offer-ends-at" optional>
              Ends
            </FieldLabel>
            <Input id="offer-ends-at" type="date" disabled={isSubmitting} {...register("endsAt")} />
            <FieldError message={getFieldError("endsAt")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="offer-status">Status</FieldLabel>
          <Select
            id="offer-status"
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
          <FieldLabel htmlFor="offer-description" optional>
            Description
          </FieldLabel>
          <Textarea id="offer-description" disabled={isSubmitting} {...register("description")} />
          <FieldError message={getFieldError("description")} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[rgb(var(--border)/0.62)] pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" className="h-10 rounded-2xl px-4 shadow-none" disabled={isSubmitting} onClick={() => router.push("/dashboard/offers")}>
          Cancel
        </Button>
        <Button type="submit" className="h-10 min-w-32 rounded-2xl px-5" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="xs" ariaHidden className="mr-2" />
              Creating...
            </>
          ) : (
            "Create offer"
          )}
        </Button>
      </div>
    </form>
  );
}
