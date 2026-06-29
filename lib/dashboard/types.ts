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

export type DashboardDateRange = {
  from: string | null;
  to: string | null;
};

export type DashboardPaginationState = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type DashboardBaseFilterState = {
  branchId: string | null;
  page: number;
  pageSize: number;
};

export type DashboardPageFilterState = DashboardBaseFilterState & DashboardDateRange;

export type PaginatedListResult<T> = {
  items: T[];
  pagination: DashboardPaginationState;
};

export type DashboardPageToolbarAction = {
  label: string;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
};

export type DashboardPageToolbarMenuAction = DashboardPageToolbarAction & {
  key: string;
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

export type CustomersPageSummary = {
  activeCustomers: number;
  newCustomersInRange: number;
  studioCustomers: number;
  outstandingCustomers: number;
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

export type ExpenseRangeSummary = {
  totalAmountInRange: number;
  entryCountInRange: number;
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
  outstandingAmount: number;
  createdAt: string;
  branchName: string | null;
  createdByName: string | null;
  paymentModeSummary: string | null;
  vendorCount: number;
  itemCount: number;
  refundedAmount: number;
};

export type CustomerDetailRow = {
  id: string;
  customerNumericId: number | null;
  customerCode: string | null;
  type: string;
  name: string;
  avatar: string | null;
  avatarSource: "external" | "uploaded";
  studioName: string | null;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  lastOrderDate: string | null;
  totalPayable: number;
  totalOutstanding: number;
  lastOrderStatus: string | null;
  lastPaymentStatus: string | null;
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

export type InventoryStockState = "in-stock" | "low-stock" | "out-of-stock";

export type InventoryPageDetailRow = {
  id: string;
  branchId: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  isActive: boolean;
  branchName: string;
  lastPurchaseRate: number | null;
  lastVendorName: string | null;
  createdAt: string;
  updatedAt: string;
  image: string | null;
  stockState: InventoryStockState;
  deletedAt: string | null;
  reorderLevel: number | null;
  hasPricing: boolean;
};

export type InventoryPageSummary = {
  totalItemsInRange: number;
  lowStockItemsInRange: number;
  outOfStockItemsInRange: number;
  totalStockQuantityInRange: number;
  itemsWithoutPricingInRange: number;
};

export type InventoryVendorOption = {
  id: string;
  name: string;
};

export type InventoryPageData = {
  summary: InventoryPageSummary;
  result: PaginatedListResult<InventoryPageDetailRow>;
};

export type InventoryPricingStatus = "current" | "upcoming" | "expired";

export type InventoryPricingRow = {
  id: string;
  branchId: string;
  inventoryId: string;
  itemName: string;
  sku: string;
  branchName: string;
  customerType: string;
  sellingRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  pricingStatus: InventoryPricingStatus;
  isExpiringSoon: boolean;
  updatedAt: string;
  updatedByName: string | null;
};

export type InventoryPricingPageSummary = {
  totalPricesInRange: number;
  currentPricesInRange: number;
  upcomingPricesInRange: number;
  expiredPricesInRange: number;
  expiringSoonPricesInRange: number;
};

export type InventoryPricingInventoryOption = {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  sku: string;
};

export type InventoryPricingPageData = {
  summary: InventoryPricingPageSummary;
  result: PaginatedListResult<InventoryPricingRow>;
  inventoryOptions: InventoryPricingInventoryOption[];
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

export type OrdersPageSummary = {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalPayableAmount: number;
  totalPaidAmount: number;
  totalOutstandingAmount: number;
};

export type OrderCustomerOption = {
  id: string;
  name: string;
};

export type OrderCreatorOption = {
  id: string;
  fullName: string;
  branchName: string | null;
};

export type OrderVendorOption = {
  id: string;
  name: string;
};

export type OrderInventoryOption = {
  id: string;
  name: string;
  sku: string;
};

export type OrderOfferItemOption = {
  id: string;
  itemName: string;
};

export type OrderFilterOptions = {
  customers: OrderCustomerOption[];
  creators: OrderCreatorOption[];
  vendors: OrderVendorOption[];
  inventoryItems: OrderInventoryOption[];
  offerItems: OrderOfferItemOption[];
};

export type OrdersPageData = {
  summary: OrdersPageSummary;
  result: PaginatedListResult<OrderDetailRow>;
};

export type CustomersPageData = {
  summary: CustomersPageSummary;
  result: PaginatedListResult<CustomerDetailRow>;
};

export type EmployeeExpensesPageData = {
  summary: ExpenseRangeSummary;
  result: PaginatedListResult<EmployeeExpenseDetailRow>;
};

export type BusinessExpensesPageData = {
  summary: ExpenseRangeSummary;
  result: PaginatedListResult<BusinessExpenseDetailRow>;
};

export type ActiveUserRoleOption = {
  role: string;
};

export type ActiveUsersPageSummary = {
  totalActiveUsers: number;
  adminActiveUsers: number;
  staffActiveUsers: number;
};

export type ActiveUsersPageData = {
  summary: ActiveUsersPageSummary;
  result: PaginatedListResult<ActiveUserRow>;
};

export type UserManagementRow = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
};

export type UserManagementPageSummary = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  lockedUsers: number;
};

export type UserManagementPageData = {
  summary: UserManagementPageSummary;
  result: PaginatedListResult<UserManagementRow>;
};

export type ExpenseCategoryManagementRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: ExpenseCategoryScope;
  isActive: boolean;
  sortOrder: number;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseCategoryManagementSummary = {
  branchCategories: number;
  employeeCategories: number;
  bothScopeCategories: number;
};

export type ExpenseCategoriesPageData = {
  summary: ExpenseCategoryManagementSummary;
  result: PaginatedListResult<ExpenseCategoryManagementRow>;
};

export type VendorManagementRow = {
  id: string;
  vendorCode: string | null;
  businessName: string;
  name: string;
  avatar: string | null;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  isActive: boolean;
  orderCount: number;
  inventoryItemCount: number;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VendorManagementSummary = {
  totalVendors: number;
  activeVendors: number;
  inactiveVendors: number;
};

export type VendorsPageData = {
  summary: VendorManagementSummary;
  result: PaginatedListResult<VendorManagementRow>;
};

export type BranchManagementRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  logo: string | null;
  banner: string | null;
  description: string | null;
  isActive: boolean;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BranchManagementSummary = {
  totalBranches: number;
  activeBranches: number;
  inactiveBranches: number;
  newBranchesInRange: number;
};

export type BranchesPageData = {
  summary: BranchManagementSummary;
  result: PaginatedListResult<BranchManagementRow>;
};

export type OfferTimingState = "current" | "upcoming" | "expired";

export type OfferManagementRow = {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  name: string;
  description: string | null;
  offerType: string;
  discountValue: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minimumOrderValue: number | null;
  customerTypes: string[] | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  timingState: OfferTimingState;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfferManagementSummary = {
  totalOffers: number;
  activeOffers: number;
  currentOffers: number;
  upcomingOffers: number;
};

export type OffersPageData = {
  summary: OfferManagementSummary;
  result: PaginatedListResult<OfferManagementRow>;
};
