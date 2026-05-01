"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { vendorSchema } from "@/lib/vendors/schema";
import type {
  VendorFieldName,
  VendorFormValues,
  VendorMutationResponse,
} from "@/lib/vendors/types";

type VendorFormProps = {
  redirectTo: string;
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

export function VendorForm({ redirectTo }: VendorFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema) as unknown as Resolver<VendorFormValues>,
    defaultValues: {
      vendorCode: "",
      name: "",
      avatar: "",
      phone: "",
      alternatePhone: "",
      address: "",
      isActive: true,
    },
  });

  const isActive = watch("isActive");

  function getFieldError(field: VendorFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
        setServerError(data && !data.success ? data.message : "Unable to create vendor right now.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setServerError("Unable to create vendor right now.");
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
          <FieldLabel htmlFor="vendor-code" optional>
            Code
          </FieldLabel>
          <Input
            id="vendor-code"
            placeholder="vendor_001"
            disabled={isSubmitting}
            {...register("vendorCode")}
          />
          <FieldError message={getFieldError("vendorCode")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="vendor-name">Name</FieldLabel>
          <Input
            id="vendor-name"
            placeholder="Supplier name"
            disabled={isSubmitting}
            {...register("name")}
          />
          <FieldError message={getFieldError("name")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="vendor-phone">Phone</FieldLabel>
          <Input id="vendor-phone" inputMode="tel" disabled={isSubmitting} {...register("phone")} />
          <FieldError message={getFieldError("phone")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="vendor-alternate-phone" optional>
            Alternate phone
          </FieldLabel>
          <Input
            id="vendor-alternate-phone"
            inputMode="tel"
            disabled={isSubmitting}
            {...register("alternatePhone")}
          />
          <FieldError message={getFieldError("alternatePhone")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="vendor-avatar" optional>
            Avatar URL
          </FieldLabel>
          <Input id="vendor-avatar" disabled={isSubmitting} {...register("avatar")} />
          <FieldError message={getFieldError("avatar")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="vendor-status">Status</FieldLabel>
          <Select
            id="vendor-status"
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
          <FieldLabel htmlFor="vendor-address" optional>
            Address
          </FieldLabel>
          <Textarea id="vendor-address" disabled={isSubmitting} {...register("address")} />
          <FieldError message={getFieldError("address")} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[rgb(var(--border)/0.62)] pt-5 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-2xl px-4 shadow-none"
          disabled={isSubmitting}
          onClick={() => router.push(redirectTo)}
        >
          Cancel
        </Button>
        <Button type="submit" className="h-10 min-w-32 rounded-2xl px-5" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="xs" ariaHidden className="mr-2" />
              Creating...
            </>
          ) : (
            "Create vendor"
          )}
        </Button>
      </div>
    </form>
  );
}
