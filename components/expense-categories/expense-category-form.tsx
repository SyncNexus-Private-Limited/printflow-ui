"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { expenseCategorySchema } from "@/lib/expense-categories/schema";
import {
  expenseCategoryScopeLabels,
  expenseCategoryScopeValues,
  type ExpenseCategoryFieldName,
  type ExpenseCategoryFormValues,
  type ExpenseCategoryMutationResponse,
} from "@/lib/expense-categories/types";

type ExpenseCategoryFormProps = {
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

export function ExpenseCategoryForm({ redirectTo }: ExpenseCategoryFormProps) {
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
  } = useForm<ExpenseCategoryFormValues>({
    resolver: zodResolver(expenseCategorySchema) as unknown as Resolver<ExpenseCategoryFormValues>,
    defaultValues: {
      code: "",
      name: "",
      description: "",
      scope: "",
      isActive: true,
      sortOrder: "100",
    },
  });

  const scope = watch("scope");
  const isActive = watch("isActive");

  function getFieldError(field: ExpenseCategoryFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch("/api/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as ExpenseCategoryMutationResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [ExpenseCategoryFieldName, string]
          >) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(
          data && !data.success ? data.message : "Unable to create category right now.",
        );
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setServerError("Unable to create category right now.");
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
          <FieldLabel htmlFor="expense-category-code">Code</FieldLabel>
          <Input
            id="expense-category-code"
            placeholder="TRAVEL"
            disabled={isSubmitting}
            {...register("code")}
            onChange={(e) => setValue("code", e.target.value.toUpperCase(), { shouldDirty: true })}
          />
          <p className="text-xs text-[rgb(var(--muted-foreground))]">
            4–25 characters. Uppercase letters, numbers, and hyphens only.
          </p>
          <FieldError message={getFieldError("code")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="expense-category-name">Name</FieldLabel>
          <Input
            id="expense-category-name"
            placeholder="Travel"
            disabled={isSubmitting}
            {...register("name")}
          />
          <FieldError message={getFieldError("name")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="expense-category-scope">Scope</FieldLabel>
          <Select
            id="expense-category-scope"
            value={scope}
            disabled={isSubmitting}
            onChange={(event) =>
              setValue("scope", event.target.value as ExpenseCategoryFormValues["scope"], {
                shouldValidate: true,
              })
            }
          >
            <option value="">Select scope</option>
            {expenseCategoryScopeValues.map((value) => (
              <option key={value} value={value}>
                {expenseCategoryScopeLabels[value]}
              </option>
            ))}
          </Select>
          <FieldError message={getFieldError("scope")} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="expense-category-status">Status</FieldLabel>
          <Select
            id="expense-category-status"
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
          <FieldLabel htmlFor="expense-category-sort-order">Sort order</FieldLabel>
          <Input
            id="expense-category-sort-order"
            inputMode="numeric"
            placeholder="100"
            disabled={isSubmitting}
            {...register("sortOrder")}
          />
          <p className="text-xs text-[rgb(var(--muted-foreground))]">
            Whole number between 0 and 10,000.
          </p>
          <FieldError message={getFieldError("sortOrder")} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel htmlFor="expense-category-description" optional>
            Description
          </FieldLabel>
          <Textarea
            id="expense-category-description"
            placeholder="Add context or usage notes"
            disabled={isSubmitting}
            {...register("description")}
          />
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
            "Create category"
          )}
        </Button>
      </div>
    </form>
  );
}
