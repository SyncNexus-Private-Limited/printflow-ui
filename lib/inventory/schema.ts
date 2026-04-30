import { z } from "zod";
import {
  inventoryUnitValues,
  createInventoryFieldNames,
  updateInventoryFieldNames,
  adjustInventoryStockFieldNames,
  type CreateInventoryFieldName,
  type UpdateInventoryFieldName,
  type AdjustInventoryStockFieldName,
} from "@/lib/inventory/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nonNegativeDecimalPattern = /^\d+(\.\d{1,3})?$/;

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function optionalTrimmedString(maxLength: number) {
  return z.preprocess(
    (v) => {
      const trimmed = trimString(v);
      return typeof trimmed === "string" && trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(maxLength, `Must be ${maxLength} characters or less`).optional(),
  );
}

function nonNegativeDecimal(label: string) {
  return z.preprocess(
    (v) => {
      const trimmed = trimString(v);
      return typeof trimmed === "string" && trimmed.length === 0 ? undefined : trimmed;
    },
    z
      .string()
      .refine((v) => nonNegativeDecimalPattern.test(v), `Enter a valid ${label}`)
      .refine((v) => parseFloat(v) >= 0, `${label} cannot be negative`)
      .optional(),
  );
}

// ---------------------------------------------------------------------------
// Create schema
// ---------------------------------------------------------------------------

export const createInventorySchema = z.object({
  branchId: z
    .string()
    .trim()
    .min(1, "Branch is required")
    .refine((v) => uuidPattern.test(v), "Select a valid branch"),
  name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(120, "Must be 120 characters or less"),
  sku: z.string().trim().min(1, "SKU is required").max(60, "Must be 60 characters or less"),
  unit: z.enum(inventoryUnitValues, { error: "Unit is required" }),
  isActive: z.boolean().default(true),
  initialQuantity: z
    .preprocess(
      (v) => {
        const trimmed = trimString(v);
        return typeof trimmed === "string" && trimmed.length === 0 ? "0" : trimmed;
      },
      z
        .string()
        .refine((v) => nonNegativeDecimalPattern.test(v), "Enter a valid quantity")
        .refine((v) => parseFloat(v) >= 0, "Quantity cannot be negative"),
    )
    .default("0"),
  lastPurchaseRate: nonNegativeDecimal("purchase rate"),
  lastVendorId: z.preprocess(
    (v) => {
      const trimmed = trimString(v);
      return typeof trimmed === "string" && trimmed.length === 0 ? undefined : trimmed;
    },
    z
      .string()
      .refine((v) => uuidPattern.test(v), "Select a valid vendor")
      .optional(),
  ),
  reorderLevel: nonNegativeDecimal("reorder level"),
  image: optionalTrimmedString(512),
  note: optionalTrimmedString(300),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;

export function getCreateInventoryFieldErrors(
  error: z.ZodError,
): Partial<Record<CreateInventoryFieldName, string>> {
  const fieldErrors: Partial<Record<CreateInventoryFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string") continue;
    if (!(createInventoryFieldNames as readonly string[]).includes(fieldName)) continue;

    const typed = fieldName as CreateInventoryFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}

// ---------------------------------------------------------------------------
// Update schema
// ---------------------------------------------------------------------------

export const updateInventorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(120, "Must be 120 characters or less"),
  sku: z.string().trim().min(1, "SKU is required").max(60, "Must be 60 characters or less"),
  unit: z.enum(inventoryUnitValues, { error: "Unit is required" }),
  isActive: z.boolean(),
  newQuantity: z
    .string()
    .trim()
    .refine((v) => nonNegativeDecimalPattern.test(v), "Enter a valid quantity")
    .refine((v) => parseFloat(v) >= 0, "Quantity cannot be negative"),
  lastPurchaseRate: nonNegativeDecimal("purchase rate"),
  lastVendorId: z.preprocess(
    (v) => {
      const trimmed = trimString(v);
      return typeof trimmed === "string" && trimmed.length === 0 ? undefined : trimmed;
    },
    z
      .string()
      .refine((v) => uuidPattern.test(v), "Select a valid vendor")
      .optional(),
  ),
  reorderLevel: nonNegativeDecimal("reorder level"),
  image: optionalTrimmedString(512),
  adjustmentNote: optionalTrimmedString(300),
});

export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

export function getUpdateInventoryFieldErrors(
  error: z.ZodError,
): Partial<Record<UpdateInventoryFieldName, string>> {
  const fieldErrors: Partial<Record<UpdateInventoryFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string") continue;
    if (!(updateInventoryFieldNames as readonly string[]).includes(fieldName)) continue;

    const typed = fieldName as UpdateInventoryFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}

// ---------------------------------------------------------------------------
// Adjust stock schema
// ---------------------------------------------------------------------------

export const adjustInventoryStockSchema = z.object({
  newQuantity: z
    .string()
    .trim()
    .refine((v) => nonNegativeDecimalPattern.test(v), "Enter a valid quantity")
    .refine((v) => parseFloat(v) >= 0, "Quantity cannot be negative"),
  note: optionalTrimmedString(300),
});

export type AdjustInventoryStockInput = z.infer<typeof adjustInventoryStockSchema>;

export function getAdjustInventoryStockFieldErrors(
  error: z.ZodError,
): Partial<Record<AdjustInventoryStockFieldName, string>> {
  const fieldErrors: Partial<Record<AdjustInventoryStockFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string") continue;
    if (!(adjustInventoryStockFieldNames as readonly string[]).includes(fieldName)) continue;

    const typed = fieldName as AdjustInventoryStockFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}
