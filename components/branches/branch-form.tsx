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
import { branchSchema } from "@/lib/branches/schema";
import type {
  BranchFieldName,
  BranchFormValues,
  BranchMutationResponse,
} from "@/lib/branches/types";

type BranchFormProps = {
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

export function BranchForm({ redirectTo }: BranchFormProps) {
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
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema) as unknown as Resolver<BranchFormValues>,
    defaultValues: {
      code: "",
      name: "",
      phone: "",
      alternatePhone: "",
      email: "",
      address: "",
      logo: "",
      banner: "",
      description: "",
      isActive: true,
    },
  });

  const isActive = watch("isActive");

  function getFieldError(field: BranchFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as BranchMutationResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [BranchFieldName, string]
          >) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(data && !data.success ? data.message : "Unable to create branch right now.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setServerError("Unable to create branch right now.");
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
          <FieldLabel htmlFor="branch-code">Code</FieldLabel>
          <Input
            id="branch-code"
            placeholder="MAIN"
            disabled={isSubmitting}
            {...register("code")}
          />
          <FieldError message={getFieldError("code")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="branch-name">Name</FieldLabel>
          <Input id="branch-name" disabled={isSubmitting} {...register("name")} />
          <FieldError message={getFieldError("name")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="branch-phone">Phone</FieldLabel>
          <Input id="branch-phone" inputMode="tel" disabled={isSubmitting} {...register("phone")} />
          <FieldError message={getFieldError("phone")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="branch-alternate-phone" optional>
            Alternate phone
          </FieldLabel>
          <Input
            id="branch-alternate-phone"
            inputMode="tel"
            disabled={isSubmitting}
            {...register("alternatePhone")}
          />
          <FieldError message={getFieldError("alternatePhone")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="branch-email" optional>
            Email
          </FieldLabel>
          <Input id="branch-email" type="email" disabled={isSubmitting} {...register("email")} />
          <FieldError message={getFieldError("email")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="branch-status">Status</FieldLabel>
          <Select
            id="branch-status"
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
        <div className="space-y-1.5">
          <FieldLabel htmlFor="branch-logo" optional>
            Logo URL
          </FieldLabel>
          <Input id="branch-logo" disabled={isSubmitting} {...register("logo")} />
          <FieldError message={getFieldError("logo")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="branch-banner" optional>
            Banner URL
          </FieldLabel>
          <Input id="branch-banner" disabled={isSubmitting} {...register("banner")} />
          <FieldError message={getFieldError("banner")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel htmlFor="branch-address" optional>
            Address
          </FieldLabel>
          <Textarea id="branch-address" disabled={isSubmitting} {...register("address")} />
          <FieldError message={getFieldError("address")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel htmlFor="branch-description" optional>
            Description
          </FieldLabel>
          <Textarea id="branch-description" disabled={isSubmitting} {...register("description")} />
          <FieldError message={getFieldError("description")} />
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
            "Create branch"
          )}
        </Button>
      </div>
    </form>
  );
}
