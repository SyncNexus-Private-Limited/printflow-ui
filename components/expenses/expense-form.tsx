"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { ExpenseFormFields } from "@/components/expenses/expense-form-fields";
import { Button } from "@/components/ui/button";
import { createExpenseSchema, type CreateExpenseFormValues } from "@/lib/expenses/schema";
import type {
  CreateExpenseApiResponse,
  CreateExpenseFieldName,
  ExpenseFormPageData,
  ExpenseType,
} from "@/lib/expenses/types";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type ExpenseFormProps = ExpenseFormPageData;

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function buildDefaultValues(
  selectedType: ExpenseType,
  selectedBranchId: string,
): CreateExpenseFormValues {
  return {
    type: selectedType,
    branchId: selectedBranchId,
    title: "",
    categoryId: "",
    amount: "",
    paymentMode: "cash",
    expenseDate: getTodayDateValue(),
    remarks: "",
    vendorId: "",
    orderVendorId: "",
    employeeId: "",
    orderId: "",
  };
}

export function ExpenseForm(props: ExpenseFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showBlockingLoader, hideBlockingLoader } = useGlobalLoader();
  const [, startNavTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const defaultValues = useMemo(
    () => buildDefaultValues(props.selectedType, props.selectedBranchId),
    [props.selectedBranchId, props.selectedType],
  );
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema) as unknown as Resolver<CreateExpenseFormValues>,
    defaultValues,
  });
  const selectedVendorId = props.selectedType === "business" ? (watch("vendorId") ?? "") : "";

  useEffect(() => {
    reset(defaultValues);
    setServerError(null);
  }, [defaultValues, reset]);

  const navigateToContext = (nextBranchId: string, nextType: ExpenseType) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("branchId", nextBranchId);
    nextSearchParams.set("type", nextType);

    const nextHref = `${pathname}?${nextSearchParams.toString()}`;
    const currentHref = `${pathname}?${searchParams.toString()}`;

    if (nextHref === currentHref) {
      return;
    }

    startNavTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    clearErrors();
    showBlockingLoader("Saving expense...", {
      autoHideOnRouteChange: true,
    });

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const data = (await response.json().catch(() => null)) as CreateExpenseApiResponse | null;

      if (!response.ok || !data || !("success" in data) || !data.success) {
        if (data && "fieldErrors" in data && data.fieldErrors) {
          for (const [fieldName, message] of Object.entries(data.fieldErrors) as Array<
            [CreateExpenseFieldName, string]
          >) {
            if (!message) {
              continue;
            }

            setError(fieldName, {
              type: "server",
              message,
            });
          }
        }

        setServerError(
          data && "message" in data ? data.message : "Unable to save this expense right now.",
        );
        hideBlockingLoader();
        return;
      }

      router.push(data.data.redirectTo);
    } catch {
      setServerError("Unable to save this expense right now.");
      hideBlockingLoader();
    }
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <input type="hidden" {...register("type")} value={props.selectedType} />
      <input type="hidden" {...register("branchId")} value={props.selectedBranchId} />

      {serverError ? (
        <div className="rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {serverError}
        </div>
      ) : null}

      <ExpenseFormFields
        {...props}
        errors={errors}
        isSubmitting={isSubmitting}
        register={register}
        control={control}
        selectedVendorId={selectedVendorId}
        onTypeChange={(nextType) => navigateToContext(props.selectedBranchId, nextType)}
        onBranchChange={(nextBranchId) => navigateToContext(nextBranchId, props.selectedType)}
      />

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={isSubmitting} className="rounded-2xl px-5">
          {isSubmitting
            ? "Saving..."
            : props.selectedType === "business"
              ? "Add Business Expense"
              : "Add Employee Expense"}
        </Button>
      </div>
    </form>
  );
}
