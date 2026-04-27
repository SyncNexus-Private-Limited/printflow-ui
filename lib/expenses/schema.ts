import { z } from "zod";
import {
  createExpenseFieldNames,
  expenseTypeValues,
  paymentModeValues,
  updateEmployeeExpenseFieldNames,
  type CreateExpenseFieldName,
  type ExpenseType,
  type PaymentMode,
  type UpdateEmployeeExpenseFieldName,
} from "@/lib/expenses/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const amountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

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

function requiredUuid(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => uuidPattern.test(value), `Select a valid ${label.toLowerCase()}`);
}

function optionalUuid(label: string) {
  return z.preprocess(
    (value) => {
      const trimmed = trimString(value);

      return typeof trimmed === "string" && trimmed.length === 0 ? undefined : trimmed;
    },
    z
      .string()
      .refine((value) => uuidPattern.test(value), `Select a valid ${label.toLowerCase()}`)
      .optional(),
  );
}

const expenseTypeSchema = z.enum(expenseTypeValues);
const paymentModeSchema = z.enum(paymentModeValues, {
  error: "Payment mode is required",
});

const baseExpenseSchema = z.object({
  type: expenseTypeSchema,
  branchId: requiredUuid("Branch"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or less"),
  categoryId: requiredUuid("Category"),
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((value) => amountPattern.test(value), "Enter a valid amount with up to 2 decimal places")
    .refine((value) => Number(value) > 0, "Amount must be greater than 0"),
  paymentMode: paymentModeSchema,
  expenseDate: z
    .string()
    .trim()
    .min(1, "Expense date is required")
    .refine((value) => isoDatePattern.test(value), "Enter a valid expense date")
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a valid expense date"),
  remarks: optionalTrimmedString(500),
});

const businessExpenseSchema = baseExpenseSchema.extend({
  type: z.literal("business"),
  vendorId: optionalUuid("Vendor"),
  orderVendorId: optionalUuid("Linked order vendor"),
});

const employeeExpenseSchema = baseExpenseSchema.extend({
  type: z.literal("employee"),
  employeeId: requiredUuid("Employee"),
  orderId: optionalUuid("Linked order"),
});

export const expenseTypeQuerySchema = expenseTypeSchema;
export const createExpenseSchema = z.discriminatedUnion("type", [businessExpenseSchema, employeeExpenseSchema]);

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpenseFormValues = {
  type: ExpenseType;
  branchId: string;
  title: string;
  categoryId: string;
  amount: string;
  paymentMode: PaymentMode;
  expenseDate: string;
  remarks: string;
  vendorId: string;
  orderVendorId: string;
  employeeId: string;
  orderId: string;
};

export const updateEmployeeExpenseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or less"),
  categoryId: requiredUuid("Category"),
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((value) => amountPattern.test(value), "Enter a valid amount with up to 2 decimal places")
    .refine((value) => Number(value) > 0, "Amount must be greater than 0"),
  paymentMode: paymentModeSchema,
  expenseDate: z
    .string()
    .trim()
    .min(1, "Expense date is required")
    .refine((value) => isoDatePattern.test(value), "Enter a valid expense date")
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a valid expense date"),
  remarks: optionalTrimmedString(500),
  employeeId: requiredUuid("Employee"),
  orderId: optionalUuid("Linked order"),
});

export type UpdateEmployeeExpenseInput = z.infer<typeof updateEmployeeExpenseSchema>;

export function getUpdateEmployeeExpenseFieldErrors(error: z.ZodError) {
  const fieldErrors: Partial<Record<UpdateEmployeeExpenseFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string") continue;
    if (!(updateEmployeeExpenseFieldNames as readonly string[]).includes(fieldName)) continue;

    const typedFieldName = fieldName as UpdateEmployeeExpenseFieldName;

    if (!fieldErrors[typedFieldName]) fieldErrors[typedFieldName] = issue.message;
  }

  return fieldErrors;
}

export function getCreateExpenseFieldErrors(error: z.ZodError) {
  const fieldErrors: Partial<Record<CreateExpenseFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string") {
      continue;
    }

    if (!(createExpenseFieldNames as readonly string[]).includes(fieldName)) {
      continue;
    }

    const typedFieldName = fieldName as CreateExpenseFieldName;

    if (!fieldErrors[typedFieldName]) {
      fieldErrors[typedFieldName] = issue.message;
    }
  }

  return fieldErrors;
}
