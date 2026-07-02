import { z } from "zod";
import {
  addressSchema,
  alternatePhoneSchema,
  indianPhoneSchema,
  makeOptionalTextSchema,
  nameSchema,
  optionalNumericIdSchema,
  optionalUrlSchema,
} from "@/lib/validations/common-validators";
import {
  customerFieldNames,
  type AvatarSource,
  type CustomerFieldName,
} from "@/lib/customers/types";

export function buildCustomerSchema(validTypes: readonly string[]) {
  return z
    .object({
      type: z.enum(validTypes as [string, ...string[]], { error: "Type is required" }),
      name: nameSchema,
      phone: indianPhoneSchema,
      alternatePhone: alternatePhoneSchema,
      address: addressSchema,
      studioName: makeOptionalTextSchema(120),
      customerNumericId: optionalNumericIdSchema,
      aadhaarNumber: z.preprocess(
        (v) => {
          // Normalise: strip spaces and dashes, then treat empty as undefined.
          const raw = typeof v === "string" ? v.replace(/[\s-]/g, "").trim() : v;
          return typeof raw === "string" && raw.length === 0 ? undefined : raw;
        },
        z
          .string()
          .refine((v) => /^\d{12}$/.test(v), "Aadhaar must be exactly 12 digits")
          .optional(),
      ),
      studioAssociationName: makeOptionalTextSchema(120),
      studioAssociationIdNumber: makeOptionalTextSchema(50),
      avatar: optionalUrlSchema,
      avatarSource: z
        .enum(["external", "uploaded"] as [AvatarSource, ...AvatarSource[]])
        .default("external"),
    })
    .superRefine((data, ctx) => {
      if (data.phone && data.alternatePhone && data.phone === data.alternatePhone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Alternate phone must be different from the primary phone",
          path: ["alternatePhone"],
        });
      }

      if (data.type === "studio") {
        if (data.studioName === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Studio name is required",
            path: ["studioName"],
          });
        } else if (data.studioName.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Studio name must be at least 2 characters",
            path: ["studioName"],
          });
        }

        if (data.studioAssociationName === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Studio association name is required",
            path: ["studioAssociationName"],
          });
        } else if (data.studioAssociationName.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Studio association name must be at least 2 characters",
            path: ["studioAssociationName"],
          });
        }

        if (data.studioAssociationIdNumber === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Studio association ID is required",
            path: ["studioAssociationIdNumber"],
          });
        } else if (data.studioAssociationIdNumber.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Studio association ID must be at least 2 characters",
            path: ["studioAssociationIdNumber"],
          });
        }
      }
    });
}

export type CustomerInput = z.infer<ReturnType<typeof buildCustomerSchema>>;

export function getCustomerFieldErrors(
  error: z.ZodError,
): Partial<Record<CustomerFieldName, string>> {
  const fieldErrors: Partial<Record<CustomerFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];
    if (typeof fieldName !== "string") continue;
    if (!(customerFieldNames as readonly string[]).includes(fieldName)) continue;
    const typed = fieldName as CustomerFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}
