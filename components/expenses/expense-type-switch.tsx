"use client";

import { Building2, UserRound } from "lucide-react";
import type { ExpenseType } from "@/lib/expenses/types";
import { cn } from "@/lib/utils/cn";

type ExpenseTypeSwitchProps = {
  value: ExpenseType;
  disabled?: boolean;
  onChange: (nextValue: ExpenseType) => void;
};

const expenseTypeOptions: Array<{
  value: ExpenseType;
  label: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    value: "business",
    label: "Business",
    description: "Branch-level operational expense",
    icon: Building2,
  },
  {
    value: "employee",
    label: "Employee",
    description: "Employee-linked reimbursement or spend",
    icon: UserRound,
  },
];

export function ExpenseTypeSwitch({ value, disabled = false, onChange }: ExpenseTypeSwitchProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Expense type">
      {expenseTypeOptions.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => {
              if (!isActive) {
                onChange(option.value);
              }
            }}
            className={cn(
              "rounded-[22px] border px-4 py-4 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              isActive
                ? "border-[rgb(var(--primary)/0.3)] bg-[rgb(var(--primary-soft))] shadow-[0_20px_42px_-38px_rgb(var(--shadow)/0.3)]"
                : "border-[rgb(var(--border)/0.82)] bg-[rgb(var(--card)/0.82)] hover:bg-[rgb(var(--muted)/0.72)]",
              disabled && "cursor-not-allowed opacity-70",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  isActive
                    ? "bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]"
                    : "bg-[rgb(var(--muted))] text-[rgb(var(--foreground))]",
                )}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={1.9} />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[rgb(var(--card-foreground))]">{option.label}</p>
                <p className="text-sm text-[rgb(var(--muted-foreground))]">{option.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
