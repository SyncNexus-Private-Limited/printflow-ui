import { z } from "zod";
import {
  expenseCategoryFieldNames,
  expenseCategoryScopeValues,
  type ExpenseCategoryFieldName,
} from "@/lib/expense-categories/types";

const codePattern = /^[a-z0-9][a-z0-9_-]*$/;

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function optionalTrimmedString(maxLength: number) {
  return z.preprocess(
    (value) => {
      const trimmed = trimString(value);
      return typeof trimmed === "string" && trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(maxLength, `Must be ${maxLength} characters or less`).optional(),
  );
}

export const expenseCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Code is required")
    .max(80, "Code must be 80 characters or less")
    .refine(
      (value) => codePattern.test(value),
      "Use lowercase letters, numbers, underscores, or hyphens",
    ),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name must be 120 characters or less"),
  description: optionalTrimmedString(300),
  scope: z.enum(expenseCategoryScopeValues, { error: "Scope is required" }),
  isActive: z.boolean().default(true),
  sortOrder: z
    .string()
    .trim()
    .min(1, "Sort order is required")
    .regex(/^\d+$/, "Sort order must be a whole number")
    .refine((value) => Number.parseInt(value, 10) >= 0, "Sort order cannot be negative"),
});

export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;

export function getExpenseCategoryFieldErrors(
  error: z.ZodError,
): Partial<Record<ExpenseCategoryFieldName, string>> {
  const fieldErrors: Partial<Record<ExpenseCategoryFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];
    if (typeof fieldName !== "string") continue;
    if (!(expenseCategoryFieldNames as readonly string[]).includes(fieldName)) continue;
    const typed = fieldName as ExpenseCategoryFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}
