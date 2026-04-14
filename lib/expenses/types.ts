export const expenseTypeValues = ["business", "employee"] as const;
export type ExpenseType = (typeof expenseTypeValues)[number];

export const paymentModeValues = ["cash", "upi", "card", "credit", "other"] as const;
export type PaymentMode = (typeof paymentModeValues)[number];
export const paymentModeLabels: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  credit: "Credit",
  other: "Other",
};

export function getPaymentModeLabel(value: string) {
  if (value in paymentModeLabels) {
    return paymentModeLabels[value as PaymentMode];
  }

  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const expenseCategoryScopeValues = ["branch", "employee", "both"] as const;
export type ExpenseCategoryScope = (typeof expenseCategoryScopeValues)[number];

export type ExpenseBranchOption = {
  id: string;
  name: string;
};

export type ExpenseCategoryOption = {
  id: string;
  code: string;
  name: string;
  scope: ExpenseCategoryScope;
};

export type ExpenseEmployeeOption = {
  id: string;
  fullName: string;
  role: string;
};

export type ExpenseVendorOption = {
  id: string;
  name: string;
};

export type ExpenseOrderOption = {
  id: string;
  orderCode: string;
  customerName: string;
  status: string;
  orderDate: string;
};

export type ExpenseOrderVendorOption = {
  id: string;
  orderId: string;
  orderCode: string;
  vendorId: string;
  vendorName: string;
  vendorPaidAmount: number;
  orderDate: string;
};

export type ExpenseFormPageData = {
  branchOptions: ExpenseBranchOption[];
  selectedBranchId: string;
  selectedBranchName: string;
  selectedType: ExpenseType;
  canSelectBranch: boolean;
  categoryOptions: ExpenseCategoryOption[];
  employeeOptions: ExpenseEmployeeOption[];
  vendorOptions: ExpenseVendorOption[];
  orderOptions: ExpenseOrderOption[];
  orderVendorOptions: ExpenseOrderVendorOption[];
};

export const createExpenseFieldNames = [
  "type",
  "branchId",
  "title",
  "categoryId",
  "amount",
  "paymentMode",
  "expenseDate",
  "remarks",
  "vendorId",
  "orderVendorId",
  "employeeId",
  "orderId",
] as const;

export type CreateExpenseFieldName = (typeof createExpenseFieldNames)[number];

export type CreateExpenseSuccessPayload = {
  id: string;
  type: ExpenseType;
  redirectTo: string;
};

export type CreateExpenseApiSuccessResponse = {
  success: true;
  data: CreateExpenseSuccessPayload;
};

export type CreateExpenseApiErrorResponse = {
  success: false;
  message: string;
  fieldErrors?: Partial<Record<CreateExpenseFieldName, string>>;
};

export type CreateExpenseApiResponse = CreateExpenseApiSuccessResponse | CreateExpenseApiErrorResponse;
