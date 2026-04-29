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
  branchName?: string | null;
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

export type CreateExpenseApiResponse =
  | CreateExpenseApiSuccessResponse
  | CreateExpenseApiErrorResponse;

// ---------- Employee expense detail (used by edit dialog) ----------

export type EmployeeExpenseDetail = {
  id: string;
  branchId: string;
  branchName: string;
  userId: string;
  userName: string;
  title: string;
  categoryId: string;
  categoryCode: string;
  category: string;
  amount: number;
  paymentMode: string;
  expenseDate: string;
  remarks: string | null;
  orderId: string | null;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
};

export const updateEmployeeExpenseFieldNames = [
  "title",
  "categoryId",
  "amount",
  "paymentMode",
  "expenseDate",
  "remarks",
  "employeeId",
  "orderId",
] as const;

export type UpdateEmployeeExpenseFieldName = (typeof updateEmployeeExpenseFieldNames)[number];

export type UpdateEmployeeExpenseFormValues = {
  title: string;
  categoryId: string;
  amount: string;
  paymentMode: PaymentMode;
  expenseDate: string;
  remarks: string;
  employeeId: string;
  orderId: string;
};

export type EmployeeExpenseDetailApiResponse =
  | {
      success: true;
      data: {
        expense: EmployeeExpenseDetail;
        options: {
          categories: ExpenseCategoryOption[];
          employees: ExpenseEmployeeOption[];
          orders: ExpenseOrderOption[];
        };
      };
    }
  | { success: false; message: string };

export type UpdateEmployeeExpenseApiResponse =
  | { success: true; data: { id: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<UpdateEmployeeExpenseFieldName, string>>;
    };

export type DeleteEmployeeExpenseApiResponse =
  | { success: true }
  | { success: false; message: string };

// ---------- Business expense detail (used by edit dialog) ----------

export type BusinessExpenseDetail = {
  id: string;
  branchId: string;
  branchName: string;
  title: string | null;
  categoryId: string;
  categoryCode: string;
  category: string;
  amount: number;
  paymentMode: string;
  expenseDate: string;
  remarks: string | null;
  orderVendorId: string | null;
  vendorId: string | null;
  vendorName: string | null;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
};

export const updateBusinessExpenseFieldNames = [
  "title",
  "categoryId",
  "amount",
  "paymentMode",
  "expenseDate",
  "remarks",
  "vendorId",
  "orderVendorId",
] as const;

export type UpdateBusinessExpenseFieldName = (typeof updateBusinessExpenseFieldNames)[number];

export type UpdateBusinessExpenseFormValues = {
  title: string;
  categoryId: string;
  amount: string;
  paymentMode: PaymentMode;
  expenseDate: string;
  remarks: string;
  vendorId: string;
  orderVendorId: string;
};

export type BusinessExpenseDetailApiResponse =
  | {
      success: true;
      data: {
        expense: BusinessExpenseDetail;
        options: {
          categories: ExpenseCategoryOption[];
          vendors: ExpenseVendorOption[];
          orderVendors: ExpenseOrderVendorOption[];
        };
      };
    }
  | { success: false; message: string };

export type UpdateBusinessExpenseApiResponse =
  | { success: true; data: { id: string } }
  | {
      success: false;
      message: string;
      fieldErrors?: Partial<Record<UpdateBusinessExpenseFieldName, string>>;
    };

export type DeleteBusinessExpenseApiResponse =
  | { success: true }
  | { success: false; message: string };
