import { z } from "zod";
import {
  userRoleValues,
  createUserFieldNames,
  updateUserFieldNames,
  type CreateUserFieldName,
  type UpdateUserFieldName,
} from "@/lib/users/types";
import { requiresBranch } from "@/lib/users/role-rules";
import {
  fullNameSchema,
  indianPhoneSchema,
  alternatePhoneSchema,
  emailSchema,
  addressSchema,
  usernameSchema,
} from "@/lib/validations/common-validators";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const userRoleSchema = z.enum(userRoleValues);

export const createUserSchema = z
  .object({
    role: userRoleSchema,
    // branchId is required for non-admin roles; validated in superRefine
    branchId: z.string().trim(),
    fullName: fullNameSchema,
    phone: indianPhoneSchema,
    alternatePhone: alternatePhoneSchema,
    email: emailSchema,
    address: addressSchema,
    username: usernameSchema,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password must be 100 characters or less"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // Branch is required for all non-admin roles.
    if (requiresBranch(data.role)) {
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

    // Alternate phone must differ from primary phone.
    if (data.phone && data.alternatePhone && data.phone === data.alternatePhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alternate phone must be different from the primary phone",
        path: ["alternatePhone"],
      });
    }
  });

export type CreateUserInput = Omit<z.infer<typeof createUserSchema>, "confirmPassword">;

export function toCreateUserInput(data: z.infer<typeof createUserSchema>): CreateUserInput {
  return {
    role: data.role,
    branchId: data.branchId,
    fullName: data.fullName,
    phone: data.phone,
    alternatePhone: data.alternatePhone,
    email: data.email,
    address: data.address,
    username: data.username,
    password: data.password,
    isActive: data.isActive,
  };
}

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

export const updateUserSchema = z
  .object({
    fullName: fullNameSchema,
    phone: indianPhoneSchema,
    alternatePhone: alternatePhoneSchema,
    email: emailSchema,
    address: addressSchema,
    role: userRoleSchema,
    branchId: z.string().trim(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (requiresBranch(data.role)) {
      if (!data.branchId || !uuidPattern.test(data.branchId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Branch is required for this role",
          path: ["branchId"],
        });
      }
    }

    // Alternate phone must differ from primary phone.
    if (data.phone && data.alternatePhone && data.phone === data.alternatePhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alternate phone must be different from the primary phone",
        path: ["alternatePhone"],
      });
    }
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export function toUpdateUserInput(data: UpdateUserInput): UpdateUserInput {
  return {
    fullName: data.fullName,
    phone: data.phone,
    alternatePhone: data.alternatePhone,
    email: data.email,
    address: data.address,
    role: data.role,
    branchId: data.branchId,
    isActive: data.isActive,
  };
}

export function getUpdateUserFieldErrors(error: z.ZodError) {
  const fieldErrors: Partial<Record<UpdateUserFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string") continue;
    if (!(updateUserFieldNames as readonly string[]).includes(fieldName)) continue;

    const typedFieldName = fieldName as UpdateUserFieldName;
    if (!fieldErrors[typedFieldName]) fieldErrors[typedFieldName] = issue.message;
  }

  return fieldErrors;
}
