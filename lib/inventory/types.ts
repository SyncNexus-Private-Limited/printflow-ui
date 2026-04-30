export const inventoryUnitValues = ["piece", "sheet", "sqft", "unit"] as const;
export type InventoryUnit = (typeof inventoryUnitValues)[number];

export const inventoryUnitLabels: Record<InventoryUnit, string> = {
  piece: "Piece",
  sheet: "Sheet",
  sqft: "Sq. ft",
  unit: "Unit",
};

// ---------------------------------------------------------------------------
// Form value shapes (React Hook Form)
// ---------------------------------------------------------------------------

export type CreateInventoryFormValues = {
  branchId: string;
  name: string;
  sku: string;
  unit: InventoryUnit | "";
  isActive: boolean;
  initialQuantity: string;
  lastPurchaseRate: string;
  lastVendorId: string;
  reorderLevel: string;
  image: string;
  note: string;
};

export type UpdateInventoryFormValues = {
  name: string;
  sku: string;
  unit: InventoryUnit | "";
  isActive: boolean;
  newQuantity: string;
  lastPurchaseRate: string;
  lastVendorId: string;
  reorderLevel: string;
  image: string;
  adjustmentNote: string;
};

// ---------------------------------------------------------------------------
// Field name tuples (for typed field error extraction)
// ---------------------------------------------------------------------------

export const createInventoryFieldNames = [
  "branchId",
  "name",
  "sku",
  "unit",
  "isActive",
  "initialQuantity",
  "lastPurchaseRate",
  "lastVendorId",
  "reorderLevel",
  "image",
  "note",
] as const;

export type CreateInventoryFieldName = (typeof createInventoryFieldNames)[number];

export const updateInventoryFieldNames = [
  "name",
  "sku",
  "unit",
  "isActive",
  "newQuantity",
  "lastPurchaseRate",
  "lastVendorId",
  "reorderLevel",
  "image",
  "adjustmentNote",
] as const;

export type UpdateInventoryFieldName = (typeof updateInventoryFieldNames)[number];

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export type CreateInventoryApiResponse =
  | { success: true; data: { id: string; redirectTo: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<CreateInventoryFieldName, string>>;
    };

export type UpdateInventoryApiResponse =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<UpdateInventoryFieldName, string>>;
    };

export type InventoryActionApiResponse = { success: true } | { success: false; message: string };

export type InventoryDetailApiResponse =
  | { success: true; data: { item: EditInventoryItem; vendorOptions: InventoryFormVendorOption[] } }
  | { success: false; message: string };

// ---------------------------------------------------------------------------
// Form page data (server → client)
// ---------------------------------------------------------------------------

export type InventoryFormBranchOption = {
  id: string;
  name: string;
};

export type InventoryFormVendorOption = {
  id: string;
  name: string;
};

export type InventoryFormPageData = {
  branchOptions: InventoryFormBranchOption[];
  vendorOptions: InventoryFormVendorOption[];
  selectedBranchId: string;
  selectedBranchName: string;
  canSelectBranch: boolean;
};

export type EditInventoryItem = {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  sku: string;
  unit: InventoryUnit;
  isActive: boolean;
  quantity: number;
  lastPurchaseRate: number | null;
  lastVendorId: string | null;
  reorderLevel: number | null;
  image: string | null;
  updatedAt: string;
  updatedByName: string | null;
};

export type EditInventoryFormPageData = {
  item: EditInventoryItem;
  vendorOptions: InventoryFormVendorOption[];
};
