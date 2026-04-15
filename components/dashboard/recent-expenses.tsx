import { SectionCard } from "@/components/dashboard/section-card";
import type { RecentExpenseRow } from "@/lib/dashboard/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type RecentExpensesProps = {
  expenses: RecentExpenseRow[];
};

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  return (
    <SectionCard title="Recent Expenses" description="Latest employee and business expense activity.">
      {expenses.length === 0 ? (
        <p className="text-sm text-[rgb(var(--muted-foreground))]">No recent expenses found for this branch.</p>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="rounded-2xl border border-[rgb(var(--border)/0.68)] bg-[rgb(var(--card)/0.84)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[rgb(var(--card-foreground))]">{expense.title ?? expense.type}</p>
                  <p className="text-sm text-[rgb(var(--muted-foreground))]">
                    {expense.title ? `${expense.type} / ` : ""}
                    {expense.category} / {expense.context}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[rgb(var(--card-foreground))]">{formatCurrency(expense.amount)}</p>
                  <p className="text-sm text-[rgb(var(--muted-foreground))]">{formatDate(expense.expenseDate)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
