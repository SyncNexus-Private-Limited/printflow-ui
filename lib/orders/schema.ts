import { z } from "zod";
import { normalizePhone } from "@/lib/validations/common-validators";
import { paymentModeValues } from "@/lib/expenses/types";
import { customerTypeValues } from "@/lib/offers/types";
import {
  createOrderFieldNames,
  orderVendorStatusValues,
  orderStatusValues,
  refundStatusValues,
  type CreateOrderFieldName,
} from "@/lib/orders/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITY_CODE_RE = /^[A-Z0-9-]{4,25}$/;
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or less`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

function optionalAmount(label: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => value === undefined || /^\d+(\.\d{1,2})?$/.test(value),
      `${label} must be a valid amount`,
    );
}

export const createOrderSchema = z
  .object({
    branchId: z
      .string()
      .trim()
      .refine((value) => uuidPattern.test(value), "Select a valid branch"),
    customerMode: z.enum(["existing", "new"]),
    customerId: z.string().trim().optional().default(""),
    customerType: z.enum(customerTypeValues).or(z.literal("")).optional().default(""),
    customerName: z.string().trim().optional().default(""),
    customerPhone: z.string().trim().optional().default(""),
    customerCode: optionalText(25).refine(
      (value) => value === undefined || ENTITY_CODE_RE.test(value.toUpperCase()),
      "Code must be 4–25 uppercase letters, numbers, or hyphens",
    ),
    customerNumericId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined))
      .refine((value) => value === undefined || /^\d+$/.test(value), "Numeric ID must be a number"),
    studioName: optionalText(120),
    alternatePhone: optionalText(40),
    customerAddress: optionalText(250),
    items: z
      .array(
        z.object({
          inventoryId: z
            .string()
            .trim()
            .refine((value) => uuidPattern.test(value), "Select an item"),
          quantity: z
            .string()
            .trim()
            .regex(/^\d+(\.\d{1,3})?$/, "Quantity must be valid")
            .refine((value) => Number.parseFloat(value) > 0, "Quantity is required"),
          unitPrice: z.string().trim().optional().default(""),
        }),
      )
      .min(1, "Add at least one order item"),
    offerIds: z
      .array(
        z
          .string()
          .trim()
          .refine((value) => uuidPattern.test(value)),
      )
      .default([]),
    manualDiscount: optionalAmount("Manual discount"),
    creditsAppliedAmount: optionalAmount("Credits applied"),
    initialPaymentAmount: optionalAmount("Initial payment"),
    paymentMode: z.enum(paymentModeValues).or(z.literal("")).optional().default(""),
    txnReference: optionalText(120),
    vendorId: z.string().trim().optional().default(""),
    vendorChargeAmount: optionalAmount("Vendor charge"),
    vendorPaidAmount: optionalAmount("Vendor paid amount"),
    vendorExpectedDeliveryDate: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined))
      .refine(
        (value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value),
        "Expected delivery must be a valid date",
      ),
    vendorNotes: optionalText(250),
  })
  .superRefine((value, ctx) => {
    if (value.customerMode === "existing") {
      if (!uuidPattern.test(value.customerId)) {
        ctx.addIssue({ code: "custom", path: ["customerId"], message: "Select a customer" });
      }
    } else {
      const trimmedName = value.customerName.trim();
      if (!trimmedName) {
        ctx.addIssue({ code: "custom", path: ["customerName"], message: "Name is required" });
      } else if (trimmedName.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["customerName"],
          message: "Name must be at least 2 characters",
        });
      } else if (trimmedName.length > 120) {
        ctx.addIssue({
          code: "custom",
          path: ["customerName"],
          message: "Name must be 120 characters or less",
        });
      }

      const normalizedPhone = normalizePhone(value.customerPhone);
      if (typeof normalizedPhone !== "string" || !normalizedPhone) {
        ctx.addIssue({ code: "custom", path: ["customerPhone"], message: "Phone is required" });
      } else if (!INDIAN_PHONE_RE.test(normalizedPhone)) {
        ctx.addIssue({
          code: "custom",
          path: ["customerPhone"],
          message: "Enter a valid 10-digit Indian mobile number (must start with 6, 7, 8, or 9)",
        });
      }

      if (!value.customerType) {
        ctx.addIssue({
          code: "custom",
          path: ["customerType"],
          message: "Customer type is required",
        });
      }

      if (value.alternatePhone) {
        const normalizedAlt = normalizePhone(value.alternatePhone);
        if (typeof normalizedAlt === "string" && normalizedAlt.length > 0) {
          if (!INDIAN_PHONE_RE.test(normalizedAlt)) {
            ctx.addIssue({
              code: "custom",
              path: ["alternatePhone"],
              message:
                "Enter a valid 10-digit Indian mobile number (must start with 6, 7, 8, or 9)",
            });
          } else if (
            normalizedAlt ===
            (typeof normalizePhone(value.customerPhone) === "string"
              ? normalizePhone(value.customerPhone)
              : "")
          ) {
            ctx.addIssue({
              code: "custom",
              path: ["alternatePhone"],
              message: "Alternate phone must be different from the primary phone",
            });
          }
        }
      }
    }

    if (value.initialPaymentAmount && !value.paymentMode) {
      ctx.addIssue({ code: "custom", path: ["paymentMode"], message: "Payment mode is required" });
    }

    const hasVendor = value.vendorId.length > 0;
    if (hasVendor && !uuidPattern.test(value.vendorId)) {
      ctx.addIssue({ code: "custom", path: ["vendorId"], message: "Select a valid vendor" });
    }
    if (
      (value.vendorChargeAmount || value.vendorPaidAmount || value.vendorExpectedDeliveryDate) &&
      !hasVendor
    ) {
      ctx.addIssue({ code: "custom", path: ["vendorId"], message: "Select a vendor" });
    }
    if (value.vendorPaidAmount && !value.vendorChargeAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["vendorChargeAmount"],
        message: "Vendor charge is required",
      });
    }
    if (
      value.vendorPaidAmount &&
      value.vendorChargeAmount &&
      Number.parseFloat(value.vendorPaidAmount) > Number.parseFloat(value.vendorChargeAmount)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["vendorPaidAmount"],
        message: "Vendor paid amount cannot exceed vendor charge",
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const addOrderPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be valid")
    .refine((value) => Number.parseFloat(value) > 0, "Amount must be greater than 0"),
  paymentMode: z.enum(paymentModeValues),
  txnReference: optionalText(120),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(orderStatusValues),
});

const refundDecisionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Reason must be 500 characters or less"),
  refundAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Refund amount must be valid")
    .refine((value) => Number.parseFloat(value) >= 0, "Refund amount cannot be negative"),
  refundMode: z.enum(paymentModeValues),
  txnReference: optionalText(120),
});

export const cancelOrderSchema = refundDecisionSchema;

export const deleteOrderSchema = refundDecisionSchema;

export const updateRefundStatusSchema = z.object({
  status: z.enum(refundStatusValues),
  note: optionalText(250),
});

export const upsertOrderVendorSchema = z.object({
  vendorId: z
    .string()
    .trim()
    .refine((value) => uuidPattern.test(value), "Select a vendor"),
  vendorChargeAmount: optionalAmount("Vendor charge").refine(
    (value) => value !== undefined && Number.parseFloat(value) >= 0,
    "Vendor charge is required",
  ),
  vendorStatus: z.enum(orderVendorStatusValues).default("assigned"),
  expectedDeliveryDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Expected delivery must be a valid date",
    ),
  notes: optionalText(250),
});

export const recordOrderVendorPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be valid")
    .refine((value) => Number.parseFloat(value) > 0, "Amount must be greater than 0"),
  paymentMode: z.enum(paymentModeValues),
  expenseDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be valid")
    .optional()
    .default(() => new Date().toISOString().slice(0, 10)),
  remarks: optionalText(400),
});

export const updateOrderSchema = z.object({
  customerId: z
    .string()
    .trim()
    .refine((value) => uuidPattern.test(value), "Select a customer"),
  items: z
    .array(
      z.object({
        inventoryId: z
          .string()
          .trim()
          .refine((value) => uuidPattern.test(value), "Select an item"),
        quantity: z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,3})?$/, "Quantity must be valid")
          .refine((value) => Number.parseFloat(value) > 0, "Quantity is required"),
        unitPrice: z.string().trim().optional().default(""),
      }),
    )
    .min(1, "Add at least one order item"),
  offerIds: z
    .array(
      z
        .string()
        .trim()
        .refine((value) => uuidPattern.test(value)),
    )
    .default([]),
  manualDiscount: optionalAmount("Manual discount"),
});

export type AddOrderPaymentInput = z.infer<typeof addOrderPaymentSchema>;
export type UpsertOrderVendorInput = z.infer<typeof upsertOrderVendorSchema>;
export type RecordOrderVendorPaymentInput = z.infer<typeof recordOrderVendorPaymentSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type DeleteOrderInput = z.infer<typeof deleteOrderSchema>;
export type UpdateRefundStatusInput = z.infer<typeof updateRefundStatusSchema>;

export function getCreateOrderFieldErrors(
  error: z.ZodError,
): Partial<Record<CreateOrderFieldName, string>> {
  const fieldErrors: Partial<Record<CreateOrderFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];
    if (typeof fieldName !== "string") continue;
    if (!(createOrderFieldNames as readonly string[]).includes(fieldName)) continue;
    const typed = fieldName as CreateOrderFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}
