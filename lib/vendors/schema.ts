import { z } from "zod";
import {
  addressSchema,
  alternatePhoneSchema,
  indianPhoneSchema,
  nameSchema,
  optionalEntityCodeSchema,
  optionalUrlSchema,
} from "@/lib/validations/common-validators";
import { vendorFieldNames, type VendorFieldName } from "@/lib/vendors/types";

export const vendorSchema = z
  .object({
    vendorCode: optionalEntityCodeSchema,
    businessName: nameSchema,
    name: nameSchema,
    avatar: optionalUrlSchema,
    phone: indianPhoneSchema,
    alternatePhone: alternatePhoneSchema,
    address: addressSchema,
    isActive: z.boolean().default(true),
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

export type VendorInput = z.infer<typeof vendorSchema>;

export function getVendorFieldErrors(error: z.ZodError): Partial<Record<VendorFieldName, string>> {
  const fieldErrors: Partial<Record<VendorFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];
    if (typeof fieldName !== "string") continue;
    if (!(vendorFieldNames as readonly string[]).includes(fieldName)) continue;
    const typed = fieldName as VendorFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}
