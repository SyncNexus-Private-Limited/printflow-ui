import { z } from "zod";
import { vendorFieldNames, type VendorFieldName } from "@/lib/vendors/types";

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

export const vendorSchema = z.object({
  vendorCode: optionalTrimmedString(80).refine(
    (value) => value === undefined || codePattern.test(value),
    "Use letters, numbers, underscores, or hyphens",
  ),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(160, "Name must be 160 characters or less"),
  avatar: optionalTrimmedString(500),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .max(40, "Phone must be 40 characters or less"),
  alternatePhone: optionalTrimmedString(40),
  address: optionalTrimmedString(400),
  isActive: z.boolean().default(true),
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
