import { z } from "zod";
import {
  addressSchema,
  alternatePhoneSchema,
  indianPhoneSchema,
  makeOptionalTextSchema,
  nameSchema,
  optionalEntityCodeSchema,
  optionalUrlSchema,
} from "@/lib/validations/common-validators";
import { customerTypeValues } from "@/lib/dashboard/customer-page-filters";
import {
  customerFieldNames,
  type AvatarSource,
  type CustomerFieldName,
} from "@/lib/customers/types";

export const customerSchema = z
  .object({
    type: z.enum(customerTypeValues, { error: "Type is required" }),
    name: nameSchema,
    phone: indianPhoneSchema,
    alternatePhone: alternatePhoneSchema,
    address: addressSchema,
    studioName: makeOptionalTextSchema(120),
    customerCode: optionalEntityCodeSchema,
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
  });

export type CustomerInput = z.infer<typeof customerSchema>;

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
