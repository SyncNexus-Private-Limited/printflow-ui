export type AvatarSource = "external" | "uploaded";

export const customerFieldNames = [
  "type",
  "name",
  "phone",
  "alternatePhone",
  "address",
  "studioName",
  "customerCode",
  "aadhaarNumber",
  "studioAssociationName",
  "studioAssociationIdNumber",
  "avatar",
] as const;

export type CustomerFieldName = (typeof customerFieldNames)[number];

export type CustomerFormValues = {
  type: string;
  name: string;
  phone: string;
  alternatePhone: string;
  address: string;
  studioName: string;
  customerCode: string;
  aadhaarNumber: string;
  studioAssociationName: string;
  studioAssociationIdNumber: string;
  avatar: string;
  avatarSource: AvatarSource;
};

export type EditCustomerRow = {
  id: string;
  customerNumericId: number | null;
  customerCode: string | null;
  type: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  studioName: string | null;
  avatar: string | null;
  avatarSource: AvatarSource;
  aadhaarNumber: string | null;
  studioAssociationName: string | null;
  studioAssociationIdNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
};

export type CustomerMutationResponse =
  | { success: true; data?: { id?: string; redirectTo?: string } }
  | { success: false; message: string; fieldErrors?: Partial<Record<CustomerFieldName, string>> };
