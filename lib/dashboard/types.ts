export type BranchOption = {
  id: string;
  name: string;
};

export type BranchFilterState = {
  branches: BranchOption[];
  selectedBranchId: string | null;
  selectedBranchValue: string;
  selectedBranchName: string;
  isAdmin: boolean;
  canSelectAll: boolean;
};

export type OrdersSummary = {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalPayableAmount: number;
};

export type CustomersSummary = {
  totalCustomers: number;
  newCustomersThisMonth: number;
};

export type InventorySummary = {
  totalInventoryItems: number;
  lowStockItems: number;
  totalStockQuantity: number;
};

export type ActiveUsersSummary = {
  currentActiveUsers: number;
  totalActiveStaffAccounts: number;
};

export type ExpenseSummary = {
  totalAmountThisMonth: number;
  entryCountThisMonth: number;
};

export type ExpenseCategoryScope = "branch" | "employee" | "both";

export type ExpenseCategorySummary = {
  categoryId: string;
  categoryCode: string;
  category: string;
  categoryScope: ExpenseCategoryScope;
};

export type DashboardSummary = {
  orders: OrdersSummary;
  customers: CustomersSummary;
  inventory: InventorySummary;
  activeUsers: ActiveUsersSummary;
  employeeExpenses: ExpenseSummary;
  businessExpenses: ExpenseSummary;
};

export type RecentOrderRow = {
  id: string;
  orderCode: string;
  customerName: string;
  status: string;
  payableAmount: number;
  orderDate: string;
};

export type LowStockRow = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  branchName: string;
};

export type RecentExpenseRow = ExpenseCategorySummary & {
  id: string;
  type: "Employee Expense" | "Business Expense";
  title: string | null;
  amount: number;
  expenseDate: string;
  createdAt: string;
  context: string;
};

export type OrderDetailRow = {
  id: string;
  orderCode: string;
  customerName: string;
  status: string;
  payableAmount: number;
  paidAmount: number;
  paymentStatus: string;
  orderDate: string;
};

export type CustomerDetailRow = {
  id: string;
  name: string;
  phone: string;
  type: string;
  studioName: string | null;
  createdAt: string;
};

export type InventoryDetailRow = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  branchName: string;
  isActive: boolean;
};

export type ActiveUserRow = {
  sessionId: string;
  fullName: string;
  username: string;
  role: string;
  branchName: string | null;
  lastSeenAt: string;
  sessionCreatedAt: string;
};

export type EmployeeExpenseDetailRow = ExpenseCategorySummary & {
  id: string;
  userName: string;
  title: string;
  amount: number;
  paymentMode: string;
  remarks: string | null;
  expenseDate: string;
  createdAt: string;
};

export type BusinessExpenseDetailRow = ExpenseCategorySummary & {
  id: string;
  title: string | null;
  amount: number;
  paymentMode: string;
  remarks: string | null;
  expenseDate: string;
  createdAt: string;
  branchName: string | null;
};
