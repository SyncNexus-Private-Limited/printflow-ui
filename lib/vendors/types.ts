export type VendorFormValues = {
  vendorCode: string;
  name: string;
  avatar: string;
  phone: string;
  alternatePhone: string;
  address: string;
  isActive: boolean;
};

export const vendorFieldNames = [
  "vendorCode",
  "name",
  "avatar",
  "phone",
  "alternatePhone",
  "address",
  "isActive",
] as const;

export type VendorFieldName = (typeof vendorFieldNames)[number];

export type VendorMutationResponse =
  | { success: true; data?: { id?: string; redirectTo?: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<VendorFieldName, string>>;
    };

export type EditVendorRow = {
  id: string;
  vendorCode: string | null;
  name: string;
  avatar: string | null;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
};

export type VendorAuditLogRow = {
  action: "create" | "update" | "deactivate" | "restore";
  snapshot: unknown;
  changedFields: unknown | null;
  changedByName: string | null;
  createdAt: string;
};
