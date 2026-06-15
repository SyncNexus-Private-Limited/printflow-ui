"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { vendorSchema } from "@/lib/vendors/schema";
import type {
  EditVendorRow,
  VendorFieldName,
  VendorFormValues,
  VendorMutationResponse,
} from "@/lib/vendors/types";
import { formatDateTime } from "@/lib/utils/format";

type VendorDetailApiResponse =
  | { success: true; data: { vendor: EditVendorRow } }
  | { success: false; message: string };

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; vendor: EditVendorRow };

type VendorEditDialogProps = {
  vendorId: string | null;
  onClose: () => void;
  onSuccess: () => void;
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

function buildDefaultValues(vendor: EditVendorRow): VendorFormValues {
  return {
    vendorCode: vendor.vendorCode ?? "",
    businessName: vendor.businessName,
    name: vendor.name,
    avatar: vendor.avatar ?? "",
    phone: vendor.phone,
    alternatePhone: vendor.alternatePhone ?? "",
    address: vendor.address ?? "",
    isActive: vendor.isActive,
  };
}

export function VendorEditDialog({ vendorId, onClose, onSuccess }: VendorEditDialogProps) {
  const isOpen = vendorId !== null;
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
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema) as unknown as Resolver<VendorFormValues>,
    defaultValues: {
      vendorCode: "",
      businessName: "",
      name: "",
      avatar: "",
      phone: "",
      alternatePhone: "",
      address: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!vendorId) {
      abortRef.current?.abort();
      setLoadState({ status: "idle" });
      setServerError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading" });
    setServerError(null);

    fetch(`/api/vendors/${vendorId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as VendorDetailApiResponse;
        if (!data.success) {
          setLoadState({ status: "error", message: data.message });
          return;
        }
        reset(buildDefaultValues(data.data.vendor));
        setLoadState({ status: "ready", vendor: data.data.vendor });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadState({ status: "error", message: "Unable to load vendor details right now." });
      });

    return () => controller.abort();
  }, [vendorId, reset]);

  const isActive = watch("isActive");

  function getFieldError(field: VendorFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    if (loadState.status !== "ready") return;
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch(`/api/vendors/${loadState.vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...values }),
      });
      const data = (await res.json().catch(() => null)) as VendorMutationResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [VendorFieldName, string]
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

  const readyVendor = loadState.status === "ready" ? loadState.vendor : null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit vendor"
      description="Changes are saved immediately and historical references remain linked."
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
                <FieldLabel htmlFor="edit-vendor-code" optional>
                  Code
                </FieldLabel>
                <Input
                  id="edit-vendor-code"
                  disabled={isSubmitting}
                  {...register("vendorCode")}
                  onChange={(e) =>
                    setValue("vendorCode", e.target.value.toUpperCase(), { shouldDirty: true })
                  }
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  4–25 characters. Uppercase letters, numbers, and hyphens only.
                </p>
                <FieldError message={getFieldError("vendorCode")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-vendor-business-name">Business Name</FieldLabel>
                <Input
                  id="edit-vendor-business-name"
                  disabled={isSubmitting}
                  {...register("businessName")}
                />
                <FieldError message={getFieldError("businessName")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-vendor-name">Name</FieldLabel>
                <Input id="edit-vendor-name" disabled={isSubmitting} {...register("name")} />
                <FieldError message={getFieldError("name")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-vendor-phone">Phone</FieldLabel>
                <Input
                  id="edit-vendor-phone"
                  inputMode="tel"
                  disabled={isSubmitting}
                  {...register("phone")}
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  10-digit Indian mobile number (starts with 6–9).
                </p>
                <FieldError message={getFieldError("phone")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-vendor-alternate-phone" optional>
                  Alternate phone
                </FieldLabel>
                <Input
                  id="edit-vendor-alternate-phone"
                  inputMode="tel"
                  disabled={isSubmitting}
                  {...register("alternatePhone")}
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  10-digit Indian mobile number (starts with 6–9).
                </p>
                <FieldError message={getFieldError("alternatePhone")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-vendor-avatar" optional>
                  Avatar URL
                </FieldLabel>
                <Input id="edit-vendor-avatar" disabled={isSubmitting} {...register("avatar")} />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  Enter a full http or https URL.
                </p>
                <FieldError message={getFieldError("avatar")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-vendor-status">Status</FieldLabel>
                <Select
                  id="edit-vendor-status"
                  value={isActive ? "active" : "inactive"}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setValue("isActive", event.target.value === "active", {
                      shouldValidate: true,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
                <FieldError message={getFieldError("isActive")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-vendor-address" optional>
                  Address
                </FieldLabel>
                <Textarea
                  id="edit-vendor-address"
                  disabled={isSubmitting}
                  {...register("address")}
                />
                <FieldError message={getFieldError("address")} />
              </div>
            </div>

            {readyVendor ? (
              <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-4 py-3 text-xs text-[rgb(var(--muted-foreground))]">
                Created {formatDateTime(readyVendor.createdAt)}
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
            {readyVendor ? (
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Last edited by{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {readyVendor.updatedByName ?? "Unknown user"}
                </span>{" "}
                on {formatDateTime(readyVendor.updatedAt)}
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
