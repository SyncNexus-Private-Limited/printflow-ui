import { z } from "zod";
import {
  expenseCategoryFieldNames,
  expenseCategoryScopeValues,
  type ExpenseCategoryFieldName,
} from "@/lib/expense-categories/types";

/**
 * Accepted code characters: uppercase letters, digits, and hyphens.
 * Min 4 / max 25 characters. Examples: FOOD, PETTY-CASH, RENT01.
 */
const codePattern = /^[A-Z0-9-]+$/;

function optionalTrimmedString(maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(maxLength, `Must be ${maxLength} characters or less`).optional(),
  );
}

export const expenseCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Code must be at least 4 characters")
    .max(25, "Code must be 25 characters or less")
    .refine(
      (value) => codePattern.test(value),
      "Code may only contain uppercase letters, numbers, and hyphens",
    ),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be 120 characters or less"),
  description: optionalTrimmedString(250),
  scope: z.enum(expenseCategoryScopeValues, { error: "Scope is required" }),
  isActive: z.boolean().default(true),
  sortOrder: z
    .string()
    .trim()
    .min(1, "Sort order is required")
    .regex(/^\d+$/, "Sort order must be a whole number")
    .refine((value) => Number.parseInt(value, 10) >= 0, "Sort order cannot be negative")
    .refine((value) => Number.parseInt(value, 10) <= 10000, "Sort order cannot exceed 10,000"),
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
