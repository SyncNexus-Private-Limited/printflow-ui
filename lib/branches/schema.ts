import { z } from "zod";
import {
  addressSchema,
  alternatePhoneSchema,
  emailSchema,
  entityCodeSchema,
  indianPhoneSchema,
  makeOptionalTextSchema,
  nameSchema,
  optionalUrlSchema,
} from "@/lib/validations/common-validators";
import { branchFieldNames, type BranchFieldName } from "@/lib/branches/types";

export const branchSchema = z
  .object({
    code: entityCodeSchema,
    name: nameSchema,
    phone: indianPhoneSchema,
    alternatePhone: alternatePhoneSchema,
    email: emailSchema,
    address: addressSchema,
    logo: optionalUrlSchema,
    banner: optionalUrlSchema,
    description: makeOptionalTextSchema(250),
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

export type BranchInput = z.infer<typeof branchSchema>;

export function getBranchFieldErrors(error: z.ZodError): Partial<Record<BranchFieldName, string>> {
  const fieldErrors: Partial<Record<BranchFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];
    if (typeof fieldName !== "string") continue;
    if (!(branchFieldNames as readonly string[]).includes(fieldName)) continue;
    const typed = fieldName as BranchFieldName;
    if (!fieldErrors[typed]) fieldErrors[typed] = issue.message;
  }

  return fieldErrors;
}
