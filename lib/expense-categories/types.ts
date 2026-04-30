import type { ExpenseCategoryScope } from "@/lib/dashboard/expense-categories-page-filters";

export const expenseCategoryScopeValues = ["branch", "employee", "both"] as const;

export const expenseCategoryScopeLabels: Record<ExpenseCategoryScope, string> = {
  branch: "Branch",
  employee: "Employee",
  both: "Both",
};

export type ExpenseCategoryFormValues = {
  code: string;
  name: string;
  description: string;
  scope: ExpenseCategoryScope | "";
  isActive: boolean;
  sortOrder: string;
};

export const expenseCategoryFieldNames = [
  "code",
  "name",
  "description",
  "scope",
  "isActive",
  "sortOrder",
] as const;

export type ExpenseCategoryFieldName = (typeof expenseCategoryFieldNames)[number];

export type ExpenseCategoryMutationResponse =
  | { success: true; data?: { id?: string; redirectTo?: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<ExpenseCategoryFieldName, string>>;
    };

export type EditExpenseCategoryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: ExpenseCategoryScope;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
};

export type ExpenseCategoryAuditLogRow = {
  action: "create" | "update" | "deactivate" | "restore";
  snapshot: unknown;
  changedFields: unknown | null;
  changedByName: string | null;
  createdAt: string;
};
