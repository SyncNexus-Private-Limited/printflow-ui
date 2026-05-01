import { z } from "zod";
import { customerTypeValues } from "@/lib/dashboard/customer-page-filters";
import { customerFieldNames, type CustomerFieldName } from "@/lib/customers/types";

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

export const customerSchema = z.object({
  type: z.enum(customerTypeValues, { error: "Type is required" }),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or less"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .max(50, "Phone must be 50 characters or less"),
  alternatePhone: optionalTrimmedString(50),
  address: optionalTrimmedString(500),
  studioName: optionalTrimmedString(200),
  customerCode: optionalTrimmedString(80),
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
