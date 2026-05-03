import { z } from "zod";
import { branchFieldNames, type BranchFieldName } from "@/lib/branches/types";

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

export const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(80, "Code must be 80 characters or less")
    .regex(codePattern, "Use letters, numbers, underscores, or hyphens"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(160, "Name must be 160 characters or less"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .max(40, "Phone must be 40 characters or less"),
  alternatePhone: optionalTrimmedString(40),
  email: optionalTrimmedString(160).refine(
    (value) => value === undefined || z.email().safeParse(value).success,
    "Enter a valid email address",
  ),
  address: optionalTrimmedString(500),
  logo: optionalTrimmedString(500),
  banner: optionalTrimmedString(500),
  description: optionalTrimmedString(800),
  isActive: z.boolean().default(true),
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
