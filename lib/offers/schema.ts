import { z } from "zod";
import {
  customerTypeValues,
  offerFieldNames,
  offerTypeValues,
  type OfferFieldName,
} from "@/lib/offers/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

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

function optionalMoney(fieldLabel: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => value === undefined || /^\d+(\.\d{1,2})?$/.test(value),
      `${fieldLabel} must be a valid amount`,
    );
}

function optionalPositiveInteger(fieldLabel: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => value === undefined || /^[1-9]\d*$/.test(value),
      `${fieldLabel} must be a positive whole number`,
    );
}

export const offerSchema = z
  .object({
    branchId: z
      .string()
      .trim()
      .min(1, "Branch is required")
      .refine((value) => uuidPattern.test(value), "Select a valid branch"),
    code: z
      .string()
      .trim()
      .min(1, "Code is required")
      .max(80, "Code must be 80 characters or less")
      .refine((value) => codePattern.test(value), "Use letters, numbers, underscores, or hyphens"),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(160, "Name must be 160 characters or less"),
    description: optionalTrimmedString(400),
    offerType: z.enum(offerTypeValues, { error: "Offer type is required" }),
    discountValue: optionalMoney("Discount value"),
    buyQuantity: optionalPositiveInteger("Buy quantity"),
    getQuantity: optionalPositiveInteger("Get quantity"),
    minimumOrderValue: optionalMoney("Minimum order value"),
    customerType: z
      .enum(customerTypeValues)
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    startsAt: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    endsAt: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined))
      .refine(
        (value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value),
        "End date must be a valid date",
      ),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.endsAt && value.endsAt < value.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "End date cannot be before start date",
      });
    }

    if (value.offerType === "percentage") {
      if (!value.discountValue) {
        ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Discount is required" });
      } else if (Number.parseFloat(value.discountValue) > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["discountValue"],
          message: "Percentage cannot exceed 100",
        });
      }
      if (value.buyQuantity || value.getQuantity) {
        ctx.addIssue({
          code: "custom",
          path: ["buyQuantity"],
          message: "Buy/get quantities are only for Buy X Get Y offers",
        });
      }
    }

    if (value.offerType === "flat" && !value.discountValue) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Discount is required" });
    }

    if (value.offerType === "buy_x_get_y") {
      if (!value.buyQuantity) {
        ctx.addIssue({
          code: "custom",
          path: ["buyQuantity"],
          message: "Buy quantity is required",
        });
      }
      if (!value.getQuantity) {
        ctx.addIssue({
          code: "custom",
          path: ["getQuantity"],
          message: "Get quantity is required",
        });
      }
      if (value.discountValue) {
        ctx.addIssue({
          code: "custom",
          path: ["discountValue"],
          message: "Discount value is only for percentage or flat offers",
        });
      }
    }
  });

export type OfferInput = z.infer<typeof offerSchema>;

export function getOfferFieldErrors(error: z.ZodError): Partial<Record<OfferFieldName, string>> {
  const fieldErrors: Partial<Record<OfferFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];
    if (typeof fieldName !== "string") continue;
    if (!(offerFieldNames as readonly string[]).includes(fieldName)) continue;
    const typed = fieldName as OfferFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}
