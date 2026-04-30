import type { InventoryPricingCustomerType } from "@/lib/dashboard/inventory-pricing-page-filters";

export const inventoryPricingCustomerTypeValues = [
  "studio",
  "amateur",
  "other",
  "employee",
] as const;

export const inventoryPricingCustomerTypeLabels: Record<InventoryPricingCustomerType, string> = {
  studio: "Studio",
  amateur: "Amateur",
  other: "Other",
  employee: "Employee",
};

export type InventoryPricingFormValues = {
  inventoryId: string;
  customerType: InventoryPricingCustomerType | "";
  sellingRate: string;
  effectiveFrom: string;
  effectiveTo: string;
};

export const inventoryPricingFieldNames = [
  "inventoryId",
  "customerType",
  "sellingRate",
  "effectiveFrom",
  "effectiveTo",
] as const;

export type InventoryPricingFieldName = (typeof inventoryPricingFieldNames)[number];

export type InventoryPricingMutationResponse =
  | { success: true; data?: { id?: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<InventoryPricingFieldName, string>>;
    };
