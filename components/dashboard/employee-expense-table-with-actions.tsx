"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExpenseDataTable } from "@/components/dashboard/expense-data-table";
import { EmployeeExpenseEditDialog } from "@/components/expenses/employee-expense-edit-dialog";
import { EmployeeExpenseDeleteDialog } from "@/components/expenses/employee-expense-delete-dialog";
import type { EmployeeExpenseDetailRow, DashboardPaginationState } from "@/lib/dashboard/types";
import type { ExpensePageFilterState } from "@/lib/dashboard/expense-page-filters";

type DeleteTarget = {
  id: string;
  title: string;
  userName: string;
  amount: number;
  expenseDate: string;
  category: string;
};

type EmployeeExpenseTableWithActionsProps = {
  items: EmployeeExpenseDetailRow[];
  emptyMessage: string;
  currentPath: string;
  currentFilters: ExpensePageFilterState;
  pagination: DashboardPaginationState;
};

export function EmployeeExpenseTableWithActions({
  items,
  emptyMessage,
  currentPath,
  currentFilters,
  pagination,
}: EmployeeExpenseTableWithActionsProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  function handleRefresh() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  function handleEditRow(expense: EmployeeExpenseDetailRow) {
    setEditExpenseId(expense.id);
  }

  function handleDeleteRow(expense: EmployeeExpenseDetailRow) {
    setDeleteTarget({
      id: expense.id,
      title: expense.title,
      userName: expense.userName,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      category: expense.category,
    });
  }

  return (
    <>
      <ExpenseDataTable
        kind="employee"
        items={items}
        emptyMessage={emptyMessage}
        currentPath={currentPath}
        currentFilters={currentFilters}
        pagination={pagination}
        onEditRow={handleEditRow}
        onDeleteRow={handleDeleteRow}
      />

      <EmployeeExpenseEditDialog
        expenseId={editExpenseId}
        onClose={() => setEditExpenseId(null)}
        onSuccess={() => {
          setEditExpenseId(null);
          handleRefresh();
        }}
      />

      <EmployeeExpenseDeleteDialog
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
