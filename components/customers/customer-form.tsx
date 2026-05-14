"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { customerSchema } from "@/lib/customers/schema";
import {
  type CustomerFieldName,
  type CustomerFormValues,
  type CustomerMutationResponse,
} from "@/lib/customers/types";

type CustomerFormProps = {
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

export function CustomerForm({ redirectTo }: CustomerFormProps) {
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

  const type = watch("type");
  const nameValue = watch("name");
  const avatarValue = watch("avatar");

  function getFieldError(field: CustomerFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
        setServerError(
          data && !data.success ? data.message : "Unable to create customer right now.",
        );
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setServerError("Unable to create customer right now.");
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
          <FieldLabel htmlFor="customer-type">Type</FieldLabel>
          <Select
            id="customer-type"
            value={type}
            disabled={isSubmitting}
            onChange={(event) => setValue("type", event.target.value, { shouldValidate: true })}
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
          <FieldLabel htmlFor="customer-name">Name</FieldLabel>
          <Input
            id="customer-name"
            placeholder="Customer name"
            disabled={isSubmitting}
            {...register("name")}
          />
          <FieldError message={getFieldError("name")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="customer-phone">Phone</FieldLabel>
          <Input
            id="customer-phone"
            placeholder="Phone number"
            disabled={isSubmitting}
            {...register("phone")}
          />
          <FieldError message={getFieldError("phone")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="customer-alt-phone" optional>
            Alternate phone
          </FieldLabel>
          <Input
            id="customer-alt-phone"
            placeholder="Alternate phone"
            disabled={isSubmitting}
            {...register("alternatePhone")}
          />
          <FieldError message={getFieldError("alternatePhone")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="customer-code" optional>
            Customer code
          </FieldLabel>
          <Input
            id="customer-code"
            placeholder="e.g. C-001"
            disabled={isSubmitting}
            {...register("customerCode")}
          />
          <FieldError message={getFieldError("customerCode")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="customer-studio-name" optional>
            Studio name
          </FieldLabel>
          <Input
            id="customer-studio-name"
            placeholder="Studio name"
            disabled={isSubmitting}
            {...register("studioName")}
          />
          <FieldError message={getFieldError("studioName")} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel htmlFor="customer-address" optional>
            Address
          </FieldLabel>
          <Input
            id="customer-address"
            placeholder="Address"
            disabled={isSubmitting}
            {...register("address")}
          />
          <FieldError message={getFieldError("address")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="customer-aadhaar" optional>
            Aadhaar number
          </FieldLabel>
          <Input
            id="customer-aadhaar"
            placeholder="12-digit Aadhaar number"
            disabled={isSubmitting}
            {...register("aadhaarNumber")}
          />
          <FieldError message={getFieldError("aadhaarNumber")} />
        </div>

        {type === "studio" ? (
          <>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="customer-assoc-name" optional>
                Studio association name
              </FieldLabel>
              <Input
                id="customer-assoc-name"
                placeholder="e.g. Photography Association of India"
                disabled={isSubmitting}
                {...register("studioAssociationName")}
              />
              <FieldError message={getFieldError("studioAssociationName")} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="customer-assoc-id" optional>
                Studio association ID
              </FieldLabel>
              <Input
                id="customer-assoc-id"
                placeholder="Association membership ID"
                disabled={isSubmitting}
                {...register("studioAssociationIdNumber")}
              />
              <FieldError message={getFieldError("studioAssociationIdNumber")} />
            </div>
          </>
        ) : null}

        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel htmlFor="customer-avatar" optional>
            Avatar URL
          </FieldLabel>
          <div className="flex items-center gap-3">
            {/* Live preview alongside the URL input */}
            <CustomerAvatar
              name={nameValue || "?"}
              avatarUrl={avatarValue || null}
              sizeClass="h-9 w-9 shrink-0"
            />
            <Input
              id="customer-avatar"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              disabled={isSubmitting}
              className="flex-1"
              {...register("avatar")}
            />
          </div>
          <FieldError message={getFieldError("avatar")} />
          <p className="text-xs text-[rgb(var(--muted-foreground))]">
            Paste the URL of a profile picture. Leave blank to use initials.
          </p>
        </div>

        {/* avatarSource is always "external" for now */}
        <input type="hidden" value="external" {...register("avatarSource")} />
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
            "Add customer"
          )}
        </Button>
      </div>
    </form>
  );
}
