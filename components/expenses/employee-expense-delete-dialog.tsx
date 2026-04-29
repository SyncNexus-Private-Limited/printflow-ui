"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DeleteEmployeeExpenseApiResponse } from "@/lib/expenses/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type EmployeeExpenseDeleteDialogProps = {
  expense: {
    id: string;
    title: string;
    userName: string;
    amount: number;
    expenseDate: string;
    category: string;
  } | null;
  onClose: () => void;
  onSuccess: (id: string) => void;
};

export function EmployeeExpenseDeleteDialog({
  expense,
  onClose,
  onSuccess,
}: EmployeeExpenseDeleteDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    if (!expense) return;
    setServerError(null);
    setIsPending(true);

    try {
      const res = await fetch(`/api/expenses/employee/${expense.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as DeleteEmployeeExpenseApiResponse | null;

      if (!res.ok || !data?.success) {
        setServerError(
          data && !data.success ? data.message : "Unable to delete this expense right now.",
        );
        setIsPending(false);
        return;
      }

      onSuccess(expense.id);
    } catch {
      setServerError("Unable to delete this expense right now.");
      setIsPending(false);
    }
  }

  function handleClose() {
    if (isPending) return;
    setServerError(null);
    onClose();
  }

  return (
    <ConfirmDialog
      isOpen={expense !== null}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title="Delete expense"
      description="This action cannot be undone. The expense record will be permanently removed."
      confirmKeyword="delete"
      confirmLabel="Delete expense"
      isPending={isPending}
    >
      {expense ? (
        <div className="rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--muted)/0.4)] px-4 py-3">
          <p className="text-sm font-medium text-[rgb(var(--foreground))]">{expense.title}</p>
          <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
            {expense.userName} &middot; {expense.category} &middot;{" "}
            {formatCurrency(expense.amount)} &middot; {formatDate(expense.expenseDate)}
          </p>
        </div>
      ) : null}

      {serverError ? (
        <div className="mt-3 rounded-2xl border border-[rgb(var(--danger)/0.18)] bg-[rgb(var(--danger)/0.08)] px-4 py-3 text-sm text-[rgb(var(--danger))]">
          {serverError}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
