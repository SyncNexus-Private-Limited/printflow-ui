export const userRoleValues = ["admin", "manager", "operator", "staff"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const userRoleLabels: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  operator: "Operator",
  staff: "Staff",
};

export const userRoleDescriptions: Record<UserRole, string> = {
  admin: "Full dashboard access and administration",
  manager: "Branch-level management and reporting access",
  operator: "Order and inventory management access",
  staff: "Standard day-to-day operations access",
};

export type UserBranchOption = {
  id: string;
  name: string;
};

export type UserFormPageData = {
  branchOptions: UserBranchOption[];
  selectedBranchId: string;
  selectedBranchName: string;
  selectedRole: UserRole;
  canSelectBranch: boolean;
};

export const createUserFieldNames = [
  "role",
  "branchId",
  "fullName",
  "phone",
  "alternatePhone",
  "email",
  "address",
  "username",
  "password",
  "confirmPassword",
  "isActive",
] as const;

export type CreateUserFieldName = (typeof createUserFieldNames)[number];

export type CreateUserFormValues = {
  role: UserRole;
  branchId: string;
  fullName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  username: string;
  password: string;
  confirmPassword: string;
  isActive: boolean;
};

export type CreateUserApiResponse =
  | { success: true; data: { id: string; redirectTo: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<CreateUserFieldName, string>>;
    };

export type EditUserRow = {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  role: UserRole;
  branchId: string;
  branchName: string | null;
  isActive: boolean;
  username: string;
  updatedAt: string;
  updatedByName: string | null;
};

export type EditUserFormPageData = {
  user: EditUserRow;
  branchOptions: UserBranchOption[];
  canSelectBranch: boolean;
};

export const updateUserFieldNames = [
  "fullName",
  "phone",
  "alternatePhone",
  "email",
  "address",
  "role",
  "branchId",
  "isActive",
] as const;

export type UpdateUserFieldName = (typeof updateUserFieldNames)[number];

export type UpdateUserFormValues = {
  fullName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  role: UserRole;
  branchId: string;
  isActive: boolean;
};

export type UpdateUserApiResponse =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<UpdateUserFieldName, string>>;
    };
