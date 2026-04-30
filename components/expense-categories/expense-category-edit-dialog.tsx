"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { expenseCategorySchema } from "@/lib/expense-categories/schema";
import {
  expenseCategoryScopeLabels,
  expenseCategoryScopeValues,
  type EditExpenseCategoryRow,
  type ExpenseCategoryFieldName,
  type ExpenseCategoryFormValues,
  type ExpenseCategoryMutationResponse,
} from "@/lib/expense-categories/types";
import { formatDateTime } from "@/lib/utils/format";

type ExpenseCategoryDetailApiResponse =
  | { success: true; data: { category: EditExpenseCategoryRow } }
  | { success: false; message: string };

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; category: EditExpenseCategoryRow };

type ExpenseCategoryEditDialogProps = {
  categoryId: string | null;
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

function buildDefaultValues(category: EditExpenseCategoryRow): ExpenseCategoryFormValues {
  return {
    code: category.code,
    name: category.name,
    description: category.description ?? "",
    scope: category.scope,
    isActive: category.isActive,
    sortOrder: String(category.sortOrder),
  };
}

export function ExpenseCategoryEditDialog({
  categoryId,
  onClose,
  onSuccess,
}: ExpenseCategoryEditDialogProps) {
  const isOpen = categoryId !== null;
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

  useEffect(() => {
    if (!categoryId) {
      abortRef.current?.abort();
      setLoadState({ status: "idle" });
      setServerError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading" });
    setServerError(null);

    fetch(`/api/expense-categories/${categoryId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as ExpenseCategoryDetailApiResponse;
        if (!data.success) {
          setLoadState({ status: "error", message: data.message });
          return;
        }
        reset(buildDefaultValues(data.data.category));
        setLoadState({ status: "ready", category: data.data.category });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadState({ status: "error", message: "Unable to load category details right now." });
      });

    return () => controller.abort();
  }, [categoryId, reset]);

  const scope = watch("scope");
  const isActive = watch("isActive");

  function getFieldError(field: ExpenseCategoryFieldName): string | undefined {
    const err = errors[field];
    if (!err || typeof err !== "object" || !("message" in err)) return undefined;
    return typeof err.message === "string" ? err.message : undefined;
  }

  const onSubmit = handleSubmit(async (values) => {
    if (loadState.status !== "ready") return;
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch(`/api/expense-categories/${loadState.category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...values }),
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
        setServerError(data && !data.success ? data.message : "Unable to save changes right now.");
        return;
      }

      onSuccess();
    } catch {
      setServerError("Unable to save changes right now.");
    }
  });

  const readyCategory = loadState.status === "ready" ? loadState.category : null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit expense category"
      description="Changes are saved immediately and will appear in category selectors."
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
                <FieldLabel htmlFor="edit-expense-category-code">Code</FieldLabel>
                <Input
                  id="edit-expense-category-code"
                  disabled={isSubmitting}
                  {...register("code")}
                />
                <FieldError message={getFieldError("code")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-expense-category-name">Name</FieldLabel>
                <Input
                  id="edit-expense-category-name"
                  disabled={isSubmitting}
                  {...register("name")}
                />
                <FieldError message={getFieldError("name")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-expense-category-scope">Scope</FieldLabel>
                <Select
                  id="edit-expense-category-scope"
                  value={scope}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setValue("scope", event.target.value as ExpenseCategoryFormValues["scope"], {
                      shouldValidate: true,
                    })
                  }
                >
                  {expenseCategoryScopeValues.map((value) => (
                    <option key={value} value={value}>
                      {expenseCategoryScopeLabels[value]}
                    </option>
                  ))}
                </Select>
                <FieldError message={getFieldError("scope")} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-expense-category-status">Status</FieldLabel>
                <Select
                  id="edit-expense-category-status"
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
              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-expense-category-sort-order">Sort order</FieldLabel>
                <Input
                  id="edit-expense-category-sort-order"
                  inputMode="numeric"
                  disabled={isSubmitting}
                  {...register("sortOrder")}
                />
                <FieldError message={getFieldError("sortOrder")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-expense-category-description" optional>
                  Description
                </FieldLabel>
                <Textarea
                  id="edit-expense-category-description"
                  disabled={isSubmitting}
                  {...register("description")}
                />
                <FieldError message={getFieldError("description")} />
              </div>
            </div>

            {readyCategory ? (
              <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] px-4 py-3 text-xs text-[rgb(var(--muted-foreground))]">
                Created {formatDateTime(readyCategory.createdAt)}
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
            {readyCategory ? (
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Last edited by{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {readyCategory.updatedByName ?? "Unknown user"}
                </span>{" "}
                on {formatDateTime(readyCategory.updatedAt)}
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
