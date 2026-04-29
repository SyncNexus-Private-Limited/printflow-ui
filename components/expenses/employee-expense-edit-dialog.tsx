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
import { updateEmployeeExpenseSchema } from "@/lib/expenses/schema";
import { paymentModeLabels, paymentModeValues } from "@/lib/expenses/types";
import type {
  EmployeeExpenseDetailApiResponse,
  UpdateEmployeeExpenseApiResponse,
  UpdateEmployeeExpenseFieldName,
  UpdateEmployeeExpenseFormValues,
  ExpenseCategoryOption,
  ExpenseEmployeeOption,
  ExpenseOrderOption,
} from "@/lib/expenses/types";
import { formatDateTime } from "@/lib/utils/format";

type EditDialogOptions = {
  categories: ExpenseCategoryOption[];
  employees: ExpenseEmployeeOption[];
  orders: ExpenseOrderOption[];
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      expenseId: string;
      options: EditDialogOptions;
      updatedAt: string;
      updatedByName: string | null;
    };

type EmployeeExpenseEditDialogProps = {
  expenseId: string | null;
  onClose: () => void;
  onSuccess: (id: string) => void;
};

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-foreground))]"
    >
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-[rgb(var(--danger))]">{message}</p>
  ) : null;
}

function LoadingShimmer() {
  return (
    <div className="space-y-5 px-5 pb-6 pt-4" aria-busy="true" aria-label="Loading expense details">
      {[1, 2, 3].map((row) => (
        <div key={row} className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((col) => (
            <div key={col} className="space-y-2">
              <div className="h-3.5 w-20 animate-pulse rounded-md bg-[rgb(var(--muted)/0.7)]" />
              <div className="h-11 animate-pulse rounded-xl bg-[rgb(var(--muted)/0.5)]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmployeeExpenseEditDialog({
  expenseId,
  onClose,
  onSuccess,
}: EmployeeExpenseEditDialogProps) {
  const isOpen = expenseId !== null;
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [serverError, setServerError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<UpdateEmployeeExpenseFormValues>({
    resolver: zodResolver(updateEmployeeExpenseSchema) as unknown as Resolver<UpdateEmployeeExpenseFormValues>,
    defaultValues: {
      title: "",
      categoryId: "",
      amount: "",
      paymentMode: "cash",
      expenseDate: "",
      remarks: "",
      employeeId: "",
      orderId: "",
    },
  });

  useEffect(() => {
    if (!expenseId) {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoadState({ status: "idle" });
      setServerError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading" });
    setServerError(null);

    fetch(`/api/expenses/employee/${expenseId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as EmployeeExpenseDetailApiResponse;
        if (!data.success) {
          setLoadState({ status: "error", message: data.message });
          return;
        }
        const { expense, options } = data.data;

        reset({
          title: expense.title,
          categoryId: expense.categoryId,
          amount: String(expense.amount),
          paymentMode: expense.paymentMode as UpdateEmployeeExpenseFormValues["paymentMode"],
          expenseDate: expense.expenseDate,
          remarks: expense.remarks ?? "",
          employeeId: expense.userId,
          orderId: expense.orderId ?? "",
        });

        setLoadState({
          status: "ready",
          expenseId: expense.id,
          options,
          updatedAt: expense.updatedAt,
          updatedByName: expense.updatedByName,
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLoadState({ status: "error", message: "Unable to load expense details right now." });
      });

    return () => {
      controller.abort();
    };
  }, [expenseId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (loadState.status !== "ready") return;
    setServerError(null);
    clearErrors();

    try {
      const res = await fetch(`/api/expenses/employee/${loadState.expenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as UpdateEmployeeExpenseApiResponse | null;

      if (!res.ok || !data?.success) {
        if (data && !data.success && data.fieldErrors) {
          for (const [field, message] of Object.entries(data.fieldErrors) as Array<
            [UpdateEmployeeExpenseFieldName, string]
          >) {
            if (message) setError(field, { type: "server", message });
          }
        }
        setServerError(
          data && !data.success ? data.message : "Unable to update this expense right now.",
        );
        return;
      }

      onSuccess(loadState.expenseId);
    } catch {
      setServerError("Unable to update this expense right now.");
    }
  });

  const options = loadState.status === "ready" ? loadState.options : null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit employee expense"
      description="Changes are saved immediately and will appear in the list."
      size="md"
    >
      {loadState.status === "loading" || loadState.status === "idle" ? (
        <LoadingShimmer />
      ) : loadState.status === "error" ? (
        <div className="px-5 py-8 text-center text-sm text-[rgb(var(--muted-foreground))]">
          {loadState.message}
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 px-5 pb-2 pt-4">
            {serverError ? (
              <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
                {serverError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-title">Title</FieldLabel>
                <Input
                  id="edit-title"
                  placeholder="Local delivery travel"
                  disabled={isSubmitting}
                  {...register("title")}
                />
                <FieldError message={errors.title?.message} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-employee">Employee</FieldLabel>
                <Select
                  id="edit-employee"
                  disabled={isSubmitting || (options?.employees.length ?? 0) === 0}
                  {...register("employeeId")}
                >
                  <option value="" disabled>
                    {(options?.employees.length ?? 0) === 0
                      ? "No employees available"
                      : "Select employee"}
                  </option>
                  {options?.employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName}
                      {emp.role ? ` (${emp.role})` : ""}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.employeeId?.message} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-category">Category</FieldLabel>
                <Select
                  id="edit-category"
                  disabled={isSubmitting || (options?.categories.length ?? 0) === 0}
                  {...register("categoryId")}
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {options?.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.categoryId?.message} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-amount">Amount</FieldLabel>
                <Input
                  id="edit-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  disabled={isSubmitting}
                  {...register("amount")}
                />
                <FieldError message={errors.amount?.message} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-payment-mode">Payment mode</FieldLabel>
                <Select id="edit-payment-mode" disabled={isSubmitting} {...register("paymentMode")}>
                  {paymentModeValues.map((mode) => (
                    <option key={mode} value={mode}>
                      {paymentModeLabels[mode]}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.paymentMode?.message} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-expense-date">Expense date</FieldLabel>
                <Input
                  id="edit-expense-date"
                  type="date"
                  disabled={isSubmitting}
                  {...register("expenseDate")}
                />
                <FieldError message={errors.expenseDate?.message} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="edit-order">Linked order</FieldLabel>
                <Select
                  id="edit-order"
                  disabled={isSubmitting || (options?.orders.length ?? 0) === 0}
                  {...register("orderId")}
                >
                  <option value="">
                    {(options?.orders.length ?? 0) === 0
                      ? "No recent orders"
                      : "No linked order"}
                  </option>
                  {options?.orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderCode} — {order.customerName}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.orderId?.message} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel htmlFor="edit-remarks">Remarks</FieldLabel>
                <Textarea
                  id="edit-remarks"
                  placeholder="Add context or notes if needed"
                  disabled={isSubmitting}
                  {...register("remarks")}
                />
                <FieldError message={errors.remarks?.message} />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-[rgb(var(--border)/0.62)] bg-[rgb(var(--card)/0.98)] px-5 py-4">
            {loadState.status === "ready" && loadState.updatedByName ? (
              <p className="mb-3 text-xs text-[rgb(var(--muted-foreground))]">
                Last edited by{" "}
                <span className="font-medium text-[rgb(var(--foreground))]">
                  {loadState.updatedByName}
                </span>{" "}
                on {formatDateTime(loadState.updatedAt)}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4 shadow-none"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 min-w-28 rounded-2xl px-5"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
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
