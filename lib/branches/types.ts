export type BranchFormValues = {
  code: string;
  name: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  logo: string;
  banner: string;
  description: string;
  isActive: boolean;
};

export const branchFieldNames = [
  "code",
  "name",
  "phone",
  "alternatePhone",
  "email",
  "address",
  "logo",
  "banner",
  "description",
  "isActive",
] as const;

export type BranchFieldName = (typeof branchFieldNames)[number];

export type BranchMutationResponse =
  | { success: true; data?: { id?: string; redirectTo?: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<BranchFieldName, string>>;
    };

export type EditBranchRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  logo: string | null;
  banner: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
};

export type BranchAuditLogRow = {
  action: "create" | "update" | "deactivate" | "restore";
  snapshot: unknown;
  changedFields: unknown | null;
  changedByName: string | null;
  createdAt: string;
};
