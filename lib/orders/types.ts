import type { CustomerTypeOption } from "@/lib/customers/types";
import type { BranchOption } from "@/lib/dashboard/types";
import type { PaymentMode } from "@/lib/expenses/types";
import type { OfferType } from "@/lib/offers/types";

// Percentage of subtotal above which orders:apply_high_discount is required.
export const ORDER_HIGH_DISCOUNT_PERCENT = 10;

export type OrderCustomerOption = {
  id: string;
  customerNumericId: number | null;
  customerCode: string | null;
  type: string;
  name: string;
  studioName: string | null;
  phone: string;
  alternatePhone: string | null;
  avatar: string | null;
  avatarSource: "external" | "uploaded";
  creditBalance: number;
};

export type OrderInventoryOption = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  prices: Partial<Record<string, number>>;
};

export type OrderOfferOption = {
  id: string;
  code: string;
  name: string;
  offerType: OfferType;
  discountValue: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minimumOrderValue: number | null;
  customerTypes: string[] | null;
  startsAt: string;
  endsAt: string | null;
};

export type OrderVendorOption = {
  id: string;
  name: string;
};

export type AddOrderPageData = {
  branchOptions: BranchOption[];
  selectedBranchId: string;
  selectedBranchName: string;
  canSelectBranch: boolean;
  noBranchAssigned: boolean;
  canApplyDiscount: boolean;
  canApplyHighDiscount: boolean;
  customers: OrderCustomerOption[];
  inventoryItems: OrderInventoryOption[];
  offers: OrderOfferOption[];
  vendors: OrderVendorOption[];
  prefillCustomer: OrderCustomerOption | null;
  prefillError: string | null;
  customerTypeOptions: CustomerTypeOption[];
};

export type CreateOrderFormValues = {
  branchId: string;
  customerMode: "existing" | "new";
  customerId: string;
  customerType: string;
  customerName: string;
  customerPhone: string;
  customerCode: string;
  customerNumericId: string;
  studioName: string;
  alternatePhone: string;
  customerAddress: string;
  items: Array<{
    inventoryId: string;
    quantity: string;
    unitPrice: string;
  }>;
  offerIds: string[];
  manualDiscount: string;
  creditsAppliedAmount: string;
  initialPaymentAmount: string;
  paymentMode: PaymentMode | "";
  txnReference: string;
  vendorId: string;
  vendorChargeAmount: string;
  vendorPaidAmount: string;
  vendorExpectedDeliveryDate: string;
  vendorNotes: string;
};

export const createOrderFieldNames = [
  "branchId",
  "customerMode",
  "customerId",
  "customerType",
  "customerName",
  "customerPhone",
  "customerCode",
  "customerNumericId",
  "studioName",
  "alternatePhone",
  "customerAddress",
  "items",
  "offerIds",
  "manualDiscount",
  "creditsAppliedAmount",
  "initialPaymentAmount",
  "paymentMode",
  "txnReference",
  "vendorId",
  "vendorChargeAmount",
  "vendorPaidAmount",
  "vendorExpectedDeliveryDate",
  "vendorNotes",
] as const;

export type CreateOrderFieldName = (typeof createOrderFieldNames)[number];

export type CreateOrderApiResponse =
  | { success: true; data: { id: string; orderCode: string; redirectTo: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<CreateOrderFieldName, string>>;
    };

export const orderStatusValues = [
  "pending",
  "processing",
  "completed",
  "delivered",
  "cancelled",
] as const;

export type OrderStatusValue = (typeof orderStatusValues)[number];

export const orderVendorStatusValues = [
  "assigned",
  "in_progress",
  "received",
  "cancelled",
] as const;

export type OrderVendorStatusValue = (typeof orderVendorStatusValues)[number];

export const refundStatusValues = ["pending", "processing", "completed", "failed"] as const;

export type RefundStatusValue = (typeof refundStatusValues)[number];

export const orderRefundTriggerActionValues = ["cancel", "delete"] as const;

export type OrderRefundTriggerAction = (typeof orderRefundTriggerActionValues)[number];

export type OrderRefund = {
  id: string;
  triggerAction: OrderRefundTriggerAction;
  reason: string;
  refundBasisAmount: number;
  refundPercent: number;
  refundAmount: number;
  refundMode: PaymentMode;
  refundStatus: RefundStatusValue;
  txnReference: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderDetailData = {
  order: {
    id: string;
    orderCode: string;
    branchId: string;
    branchName: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerCode: string | null;
    customerType: string;
    status: OrderStatusValue;
    totalAmount: number;
    discountAmount: number;
    offerDiscountAmount: number;
    manualDiscountAmount: number;
    payableAmount: number;
    paidAmount: number;
    paymentStatus: string;
    orderDate: string;
    createdAt: string;
    updatedAt: string;
    createdByName: string | null;
    isDeleted: boolean;
    cancellationReason: string | null;
    deletionReason: string | null;
  };
  items: Array<{
    id: string;
    inventoryId: string;
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  offers: Array<{
    id: string;
    offerId: string;
    code: string;
    name: string;
    offerType: OfferType;
    discountAmount: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    mode: PaymentMode;
    txnReference: string | null;
    receivedByName: string | null;
    createdAt: string;
  }>;
  vendors: Array<{
    id: string;
    vendorId: string;
    vendorName: string;
    chargeAmount: number;
    paidAmount: number;
    balanceAmount: number;
    status: OrderVendorStatusValue;
    expectedDeliveryDate: string | null;
    notes: string | null;
    payments: Array<{
      id: string;
      title: string | null;
      amount: number;
      paymentMode: PaymentMode;
      expenseDate: string;
      remarks: string | null;
      createdByName: string | null;
      createdAt: string;
    }>;
  }>;
  refunds: OrderRefund[];
  auditLogs: Array<{
    id: string;
    action: string;
    changedFields: Record<string, unknown> | null;
    changedByName: string | null;
    createdAt: string;
  }>;
};

export type EditOrderPageData = AddOrderPageData & {
  detail: OrderDetailData;
};
