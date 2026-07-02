export type InventoryPricingFormValues = {
  inventoryId: string;
  customerType: string;
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
