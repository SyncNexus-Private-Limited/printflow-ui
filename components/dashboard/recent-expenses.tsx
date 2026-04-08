import { SectionCard } from "@/components/dashboard/section-card";
import type { RecentExpenseRow } from "@/lib/dashboard/types";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

type RecentExpensesProps = {
  expenses: RecentExpenseRow[];
};

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  return (
    <SectionCard title="Recent Expenses" description="Latest employee and business expense activity.">
      {expenses.length === 0 ? (
        <p className="text-sm text-slate-600">No recent expenses found for this branch.</p>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id} className="rounded-lg border border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{expense.type}</p>
                  <p className="text-sm text-slate-600">
                    {expense.category} • {expense.context}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatCurrency(expense.amount)}</p>
                  <p className="text-sm text-slate-500">{formatDateTime(expense.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

