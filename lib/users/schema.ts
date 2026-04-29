import { z } from "zod";
import { userRoleValues, createUserFieldNames, type CreateUserFieldName } from "@/lib/users/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const usernamePattern = /^[a-z0-9_.-]+$/i;
const phonePattern = /^[+\d][\d\s\-().]{4,}$/;

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

export const userRoleSchema = z.enum(userRoleValues);

export const createUserSchema = z
  .object({
    role: userRoleSchema,
    // branchId is required for non-admin roles; validated in superRefine
    branchId: z.string().trim(),
    fullName: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(120, "Full name must be 120 characters or less"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .max(30, "Phone number must be 30 characters or less")
      .refine((v) => phonePattern.test(v), "Enter a valid phone number"),
    alternatePhone: optionalTrimmedString(30).refine(
      (v) => !v || phonePattern.test(v),
      "Enter a valid alternate phone number",
    ),
    email: z.preprocess(
      (value) => {
        const trimmed = trimString(value);
        return typeof trimmed === "string" && trimmed.length === 0 ? undefined : trimmed;
      },
      z
        .string()
        .max(120, "Email must be 120 characters or less")
        .email("Enter a valid email address")
        .optional(),
    ),
    address: optionalTrimmedString(300),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(40, "Username must be 40 characters or less")
      .refine(
        (v) => usernamePattern.test(v),
        "Username can only contain letters, numbers, underscores, hyphens, and dots",
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password must be 100 characters or less"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // Branch is required for all non-admin roles.
    if (data.role !== "admin") {
      if (!data.branchId || !uuidPattern.test(data.branchId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Branch is required for this role",
          path: ["branchId"],
        });
      }
    }

    // Passwords must match.
    if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export type CreateUserInput = Omit<z.infer<typeof createUserSchema>, "confirmPassword">;

export function getCreateUserFieldErrors(error: z.ZodError) {
  const fieldErrors: Partial<Record<CreateUserFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string") continue;
    if (!(createUserFieldNames as readonly string[]).includes(fieldName)) continue;

    const typedFieldName = fieldName as CreateUserFieldName;
    if (!fieldErrors[typedFieldName]) fieldErrors[typedFieldName] = issue.message;
  }

  return fieldErrors;
}
