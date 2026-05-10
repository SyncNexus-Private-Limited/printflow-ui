import { z } from "zod";
import { paymentModeValues } from "@/lib/expenses/types";
import { customerTypeValues } from "@/lib/offers/types";
import {
  createOrderFieldNames,
  orderVendorStatusValues,
  orderStatusValues,
  type CreateOrderFieldName,
} from "@/lib/orders/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

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
    customerCode: optionalText(80).refine(
      (value) => value === undefined || codePattern.test(value),
      "Use letters, numbers, underscores, or hyphens",
    ),
    customerNumericId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined))
      .refine((value) => value === undefined || /^\d+$/.test(value), "Numeric ID must be a number"),
    studioName: optionalText(160),
    alternatePhone: optionalText(40),
    customerAddress: optionalText(400),
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
    vendorNotes: optionalText(400),
  })
  .superRefine((value, ctx) => {
    if (value.customerMode === "existing") {
      if (!uuidPattern.test(value.customerId)) {
        ctx.addIssue({ code: "custom", path: ["customerId"], message: "Select a customer" });
      }
    } else {
      if (!value.customerName.trim()) {
        ctx.addIssue({ code: "custom", path: ["customerName"], message: "Name is required" });
      }
      if (!value.customerPhone.trim()) {
        ctx.addIssue({ code: "custom", path: ["customerPhone"], message: "Phone is required" });
      }
      if (!value.customerType) {
        ctx.addIssue({
          code: "custom",
          path: ["customerType"],
          message: "Customer type is required",
        });
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
  notes: optionalText(400),
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
