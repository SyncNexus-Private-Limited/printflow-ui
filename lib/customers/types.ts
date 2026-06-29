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

// ─── Customer detail page ─────────────────────────────────────────────────────

export type CustomerOrderMetrics = {
  totalOrders: number;
  totalPayable: number;
  totalPaid: number;
  totalOutstanding: number;
  cancelledOrders: number;
  creditBalance: number;
  totalRefunded: number;
  pendingRefundAmount: number;
};

export type CustomerRefundEntry = {
  id: string;
  orderId: string;
  orderCode: string;
  triggerAction: string;
  reason: string;
  refundAmount: number;
  refundMode: string;
  refundStatus: string;
  createdAt: string;
};

export type CustomerCreditTransactionEntry = {
  id: string;
  transactionType: string;
  amount: number;
  relatedOrderCode: string | null;
  note: string | null;
  createdAt: string;
};

export type CustomerRecentOrder = {
  id: string;
  orderCode: string;
  orderDate: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  payableAmount: number;
  paidAmount: number;
  branchName: string | null;
};

export type CustomerRecentPayment = {
  id: string;
  orderId: string;
  orderCode: string;
  amount: number;
  mode: string;
  txnReference: string | null;
  receivedByName: string | null;
  createdAt: string;
};

export type CustomerAuditLogEntry = {
  id: string;
  action: string;
  changedByName: string | null;
  changedFields: Record<string, unknown> | null;
  createdAt: string;
};

export type CustomerDetailPageData = {
  customer: EditCustomerRow;
  metrics: CustomerOrderMetrics;
  recentOrders: CustomerRecentOrder[];
  recentPayments: CustomerRecentPayment[];
  recentRefunds: CustomerRefundEntry[];
  recentCreditTransactions: CustomerCreditTransactionEntry[];
  auditLogs: CustomerAuditLogEntry[];
};
