"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExpenseDataTable } from "@/components/dashboard/expense-data-table";
import { BusinessExpenseEditDialog } from "@/components/expenses/business-expense-edit-dialog";
import { BusinessExpenseDeleteDialog } from "@/components/expenses/business-expense-delete-dialog";
import type { BusinessExpenseDetailRow, DashboardPaginationState } from "@/lib/dashboard/types";
import type { ExpensePageFilterState } from "@/lib/dashboard/expense-page-filters";

type DeleteTarget = {
  id: string;
  title: string | null;
  category: string;
  amount: number;
  expenseDate: string;
  branchName: string | null;
};

type BusinessExpenseTableWithActionsProps = {
  items: BusinessExpenseDetailRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: ExpensePageFilterState;
  pagination: DashboardPaginationState;
  fallbackBranchName?: string;
};

export function BusinessExpenseTableWithActions({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
  fallbackBranchName,
}: BusinessExpenseTableWithActionsProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  function handleRefresh() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  function handleEditRow(expense: BusinessExpenseDetailRow) {
    setEditExpenseId(expense.id);
  }

  function handleDeleteRow(expense: BusinessExpenseDetailRow) {
    setDeleteTarget({
      id: expense.id,
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      branchName: expense.branchName,
    });
  }

  return (
    <>
      <ExpenseDataTable
        kind="business"
        items={items}
        emptyMessage={emptyMessage}
        currentPath={currentPath}
        currentFilters={currentFilters}
        pagination={pagination}
        fallbackBranchName={fallbackBranchName ?? ""}
        onEditRow={handleEditRow}
        onDeleteRow={handleDeleteRow}
      />

      <BusinessExpenseEditDialog
        expenseId={editExpenseId}
        onClose={() => setEditExpenseId(null)}
        onSuccess={() => {
          setEditExpenseId(null);
          handleRefresh();
        }}
      />

      <BusinessExpenseDeleteDialog
        expense={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => {
          setDeleteTarget(null);
          handleRefresh();
        }}
      />
    </>
  );
}
