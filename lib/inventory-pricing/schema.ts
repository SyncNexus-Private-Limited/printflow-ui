import { z } from "zod";
import {
  inventoryPricingCustomerTypeValues,
  inventoryPricingFieldNames,
  type InventoryPricingFieldName,
} from "@/lib/inventory-pricing/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const moneyPattern = /^\d+(\.\d{1,2})?$/;

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function dateField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d{4}-\d{2}-\d{2}$/, `Enter a valid ${label.toLowerCase()}`)
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), {
      message: `Enter a valid ${label.toLowerCase()}`,
    });
}

export const inventoryPricingSchema = z
  .object({
    inventoryId: z
      .string()
      .trim()
      .min(1, "Item is required")
      .refine((v) => uuidPattern.test(v), "Select a valid item"),
    customerType: z.enum(inventoryPricingCustomerTypeValues, {
      error: "Customer type is required",
    }),
    sellingRate: z
      .preprocess(trimString, z.string().min(1, "Selling rate is required"))
      .refine((v) => moneyPattern.test(v), "Enter a valid selling rate")
      .refine((v) => parseFloat(v) >= 0, "Selling rate cannot be negative"),
    effectiveFrom: dateField("Effective from"),
    effectiveTo: z.preprocess(
      (v) => {
        const trimmed = trimString(v);
        return typeof trimmed === "string" && trimmed.length === 0 ? undefined : trimmed;
      },
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid effective to date")
        .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), {
          message: "Enter a valid effective to date",
        })
        .optional(),
    ),
  })
  .refine((values) => !values.effectiveTo || values.effectiveTo >= values.effectiveFrom, {
    path: ["effectiveTo"],
    message: "Effective to must be on or after effective from",
  });

export type InventoryPricingInput = z.infer<typeof inventoryPricingSchema>;

export function getInventoryPricingFieldErrors(
  error: z.ZodError,
): Partial<Record<InventoryPricingFieldName, string>> {
  const fieldErrors: Partial<Record<InventoryPricingFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];
    if (typeof fieldName !== "string") continue;
    if (!(inventoryPricingFieldNames as readonly string[]).includes(fieldName)) continue;
    const typed = fieldName as InventoryPricingFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}
