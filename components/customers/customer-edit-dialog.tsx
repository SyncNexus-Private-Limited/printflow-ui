"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { customerSchema } from "@/lib/customers/schema";
import { maskAadhaar } from "@/lib/utils/mask-aadhaar";
import { resolveAvatarUrl } from "@/lib/utils/resolve-avatar-url";
import {
  type CustomerFieldName,
  type CustomerFormValues,
  type CustomerMutationResponse,
  type EditCustomerRow,
} from "@/lib/customers/types";
import { formatDateTime } from "@/lib/utils/format";

type CustomerDetailApiResponse =
  | { success: true; data: { customer: EditCustomerRow } }
  | { success: false; message: string };

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; customer: EditCustomerRow };

type CustomerEditDialogProps = {
  customerId: string | null;
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

function buildDefaultValues(customer: EditCustomerRow): CustomerFormValues {
  return {
    type: customer.type,
    name: customer.name,
    phone: customer.phone,
    alternatePhone: customer.alternatePhone ?? "",
    address: customer.address ?? "",
    studioName: customer.studioName ?? "",
    customerCode: customer.customerCode ?? "",
    // Aadhaar is intentionally NOT pre-filled (sensitive; must be re-entered).
    aadhaarNumber: "",
    studioAssociationName: customer.studioAssociationName ?? "",
    studioAssociationIdNumber: customer.studioAssociationIdNumber ?? "",
    // Avatar URL is pre-filled so the user can see and edit the current value.
    avatar: customer.avatar ?? "",
    avatarSource: customer.avatarSource,
  };
}

export function CustomerEditDialog({ customerId, onClose, onSuccess }: CustomerEditDialogProps) {
  const isOpen = customerId !== null;
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
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema) as unknown as Resolver<CustomerFormValues>,
    defaultValues: {
      type: "",
      name: "",
      phone: "",
      alternatePhone: "",
      address: "",
      studioName: "",
      customerCode: "",
      aadhaarNumber: "",
      studioAssociationName: "",
      studioAssociationIdNumber: "",
      avatar: "",
      avatarSource: "external",
    },
  });

  useEffect(() => {
    if (!customerId) {
      abortRef.current?.abort();
      setLoadState({ status: "idle" });
      setServerError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading" });
    setServerError(null);

    fetch(`/api/customers/${customerId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as CustomerDetailApiResponse;
        if (!data.success) {
          setLoadState({ status: "error", message: data.message });
          return;
        }
        reset(buildDefaultValues(data.data.customer));
        setLoadState({ status: "ready", customer: data.data.customer });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadState({ status: "error", message: "Unable to load customer details right now." });
      });

    return () => controller.abort();
  }, [customerId, reset]);

  const type = watch("type");
  const avatarValue = watch("avatar");

  function getFieldError(field: CustomerFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    if (loadState.status !== "ready") return;
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch(`/api/customers/${loadState.customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...values }),
      });
      const data = (await res.json().catch(() => null)) as CustomerMutationResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [CustomerFieldName, string]
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

  const readyCustomer = loadState.status === "ready" ? loadState.customer : null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit customer"
      description="Update customer details. Changes take effect immediately."
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

            {readyCustomer ? (
              <div className="flex items-center gap-3 pb-1">
                {/* Live preview — updates as user types a new avatar URL */}
                <CustomerAvatar
                  name={readyCustomer.name}
                  avatarUrl={resolveAvatarUrl(
                    avatarValue || readyCustomer.avatar,
                    readyCustomer.avatarSource,
                  )}
                  sizeClass="h-10 w-10"
                />
                <div>
                  <p className="text-sm font-semibold text-[rgb(var(--foreground))]">
                    {readyCustomer.name}
                  </p>
                  {readyCustomer.aadhaarNumber ? (
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">
                      Aadhaar on file:{" "}
                      <span className="font-medium">
                        {maskAadhaar(readyCustomer.aadhaarNumber)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-customer-type">Type</FieldLabel>
                <Select
                  id="edit-customer-type"
                  value={type}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setValue("type", event.target.value, { shouldValidate: true })
                  }
                >
                  <option value="">Select type</option>
                  <option value="studio">Studio</option>
                  <option value="amateur">Amateur</option>
                  <option value="other">Other</option>
                  <option value="employee">Employee</option>
                </Select>
                <FieldError message={getFieldError("type")} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-customer-name">Name</FieldLabel>
                <Input id="edit-customer-name" disabled={isSubmitting} {...register("name")} />
                <FieldError message={getFieldError("name")} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-customer-phone">Phone</FieldLabel>
                <Input id="edit-customer-phone" disabled={isSubmitting} {...register("phone")} />
                <FieldError message={getFieldError("phone")} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-customer-alt-phone" optional>
                  Alternate phone
                </FieldLabel>
                <Input
                  id="edit-customer-alt-phone"
                  disabled={isSubmitting}
                  {...register("alternatePhone")}
                />
                <FieldError message={getFieldError("alternatePhone")} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-customer-code" optional>
                  Customer code
                </FieldLabel>
                <Input
                  id="edit-customer-code"
                  disabled={isSubmitting}
                  {...register("customerCode")}
                />
                <FieldError message={getFieldError("customerCode")} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-customer-studio-name" optional>
                  Studio name
                </FieldLabel>
                <Input
                  id="edit-customer-studio-name"
                  disabled={isSubmitting}
                  {...register("studioName")}
                />
                <FieldError message={getFieldError("studioName")} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-customer-address" optional>
                  Address
                </FieldLabel>
                <Input
                  id="edit-customer-address"
                  disabled={isSubmitting}
                  {...register("address")}
                />
                <FieldError message={getFieldError("address")} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-customer-aadhaar" optional>
                  Aadhaar number
                </FieldLabel>
                <Input
                  id="edit-customer-aadhaar"
                  placeholder={
                    readyCustomer?.aadhaarNumber
                      ? "Re-enter to update (leave blank to keep)"
                      : "12-digit Aadhaar number"
                  }
                  disabled={isSubmitting}
                  {...register("aadhaarNumber")}
                />
                <FieldError message={getFieldError("aadhaarNumber")} />
              </div>

              {type === "studio" ? (
                <>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="edit-customer-assoc-name" optional>
                      Studio association name
                    </FieldLabel>
                    <Input
                      id="edit-customer-assoc-name"
                      disabled={isSubmitting}
                      {...register("studioAssociationName")}
                    />
                    <FieldError message={getFieldError("studioAssociationName")} />
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="edit-customer-assoc-id" optional>
                      Studio association ID
                    </FieldLabel>
                    <Input
                      id="edit-customer-assoc-id"
                      disabled={isSubmitting}
                      {...register("studioAssociationIdNumber")}
                    />
                    <FieldError message={getFieldError("studioAssociationIdNumber")} />
                  </div>
                </>
              ) : null}

              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-customer-avatar" optional>
                  Avatar URL
                </FieldLabel>
                <Input
                  id="edit-customer-avatar"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  disabled={isSubmitting}
                  {...register("avatar")}
                />
                <FieldError message={getFieldError("avatar")} />
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  Paste the URL of a profile picture. Clear to remove.
                </p>
              </div>

              {/* avatarSource is always "external" for now — hidden field */}
              <input type="hidden" value="external" {...register("avatarSource")} />
            </div>

            {readyCustomer ? (
              <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-4 py-3 text-xs text-[rgb(var(--muted-foreground))]">
                Added {formatDateTime(readyCustomer.createdAt)}
                {readyCustomer.customerNumericId ? (
                  <span className="ml-3">ID #{readyCustomer.customerNumericId}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
            {readyCustomer ? (
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Last edited by{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {readyCustomer.updatedByName ?? "Unknown user"}
                </span>{" "}
                on {formatDateTime(readyCustomer.updatedAt)}
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
