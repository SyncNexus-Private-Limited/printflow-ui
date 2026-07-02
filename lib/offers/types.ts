import type { CustomerTypeOption } from "@/lib/customers/types";
import type { BranchOption } from "@/lib/dashboard/types";

export const offerTypeValues = ["percentage", "flat", "buy_x_get_y"] as const;

export type OfferType = (typeof offerTypeValues)[number];

export const offerTypeLabels: Record<OfferType, string> = {
  percentage: "Percentage",
  flat: "Flat",
  buy_x_get_y: "Buy X Get Y",
};

export type OfferFormValues = {
  branchId: string;
  code: string;
  name: string;
  description: string;
  offerType: OfferType | "";
  discountValue: string;
  buyQuantity: string;
  getQuantity: string;
  minimumOrderValue: string;
  customerTypes: string[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export const offerFieldNames = [
  "branchId",
  "code",
  "name",
  "description",
  "offerType",
  "discountValue",
  "buyQuantity",
  "getQuantity",
  "minimumOrderValue",
  "customerTypes",
  "startsAt",
  "endsAt",
  "isActive",
] as const;

export type OfferFieldName = (typeof offerFieldNames)[number];

export type OfferMutationResponse =
  | { success: true; data?: { id?: string; redirectTo?: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<OfferFieldName, string>>;
    };

export type OfferFormPageData = {
  branchOptions: BranchOption[];
  selectedBranchId: string;
  canSelectBranch: boolean;
  noBranchAssigned: boolean;
  customerTypeOptions: CustomerTypeOption[];
};

export type EditOfferRow = {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  name: string;
  description: string | null;
  offerType: OfferType;
  discountValue: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minimumOrderValue: number | null;
  customerTypes: string[] | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
};

export type OfferAuditLogRow = {
  action: "create" | "update" | "deactivate" | "restore";
  snapshot: unknown;
  changedFields: unknown | null;
  changedByName: string | null;
  createdAt: string;
};
