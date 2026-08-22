/**
 * Domain types for RedBox ERP's localStorage-backed data layer (Tier 1 slice).
 * Field names are camelCase for TS/JS convention; the underlying persisted
 * shape (see storage.ts) mirrors these 1:1 (JSON.stringify of these types).
 */

export type EmployeeRole = 'Kasir' | 'Barber' | 'BranchManager' | 'Owner';

export interface Branch {
  id: string;
  name: string;
  city: string;
  province: string;
  address: string;
  phone: string;
  /** Minimum number of active barbers required on duty per day. Defaults to 1. */
  minBarberCoverage?: number;
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  branchId: string;
  /** 4-digit PIN. Plaintext is acceptable only for this Tier 1 localStorage demo — never for a real auth backend. */
  pin: string;
}

export type CustomerType = 'member' | 'guest';
export type MembershipTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface CustomerPreferences {
  /** ID Barber favorit/langganan (Employee dengan role 'Barber'), null jika belum ada. */
  preferredBarberId: string | null;
  /** Gaya potongan rambut favorit/langganan konsumen. */
  preferredStyle: string;
  /** Preferensi produk styling/grooming konsumen. */
  preferredProduct: string;
  /** Catatan servis spesifik atau instruksi khusus dari barber/konsumen. */
  notes: string;
}

export const DEFAULT_CUSTOMER_PREFERENCES: CustomerPreferences = {
  preferredBarberId: null,
  preferredStyle: '',
  preferredProduct: '',
  notes: '',
};

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  /** Always set for members; guests don't have a tier. */
  tier: MembershipTier | null;
  points: number;
  createdAt: string;
  preferences?: CustomerPreferences;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  commissionPercent: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  cost: number;
  price: number;
  lowStockThreshold: number;
}

/** Cached current balance — always derived from StockMove, never written directly outside stock.ts. */
export interface InventoryBalance {
  productId: string;
  branchId: string;
  qty: number;
}

export type StockMoveType = 'in' | 'out' | 'sale' | 'opname_set';

/** Append-only stock ledger entry. */
export interface StockMove {
  id: string;
  productId: string;
  branchId: string;
  type: StockMoveType;
  qty: number;
  reference: string;
  note: string;
  actorId: string;
  timestamp: string;
}

export type PaymentMethod = 'Cash' | 'QRIS' | 'Debit' | 'Transfer' | 'E-Wallet';

export interface TransactionLineItem {
  kind: 'service' | 'product';
  itemId: string;
  name: string;
  price: number;
  qty: number;
  barberId?: string;
  barberName?: string;
  commissionPercent?: number;
  /**
   * Defaults to taxable when omitted — every ordinary service/product line
   * leaves this unset. Only the membership activation fee sets it to
   * false: CLAUDE.md specifies that fee as a flat Rp100.000, not a taxable
   * goods/service sale, so it must not get 10% added on top.
   */
  taxable?: boolean;
}

/** Snapshot of the chosen customer at time of sale — not a live join, so historical receipts stay stable. */
export interface TransactionCustomer {
  type: CustomerType;
  /** Member's Customer.id, or null for a guest (guests aren't persisted as Customer records). */
  customerId: string | null;
  name: string;
  phone: string;
  tier: MembershipTier | null;
  preferences?: CustomerPreferences;
}

export type PromoType = 'percentage' | 'flat';
export type PromoScope = 'holding' | 'branch';

export interface Promotion {
  id: string;
  code: string;
  name: string;
  type: PromoType;
  /** Value percentage (e.g. 10 for 10%) or flat nominal in Rupiah (e.g. 20000 for Rp20.000). */
  value: number;
  /** Maximum discount in Rupiah for percentage promos, or null if no cap. */
  maxDiscount: number | null;
  /** Minimum subtotal required for promo to apply. Defaults to 0. */
  minSpend: number;
  scope: PromoScope;
  /** branchId if scope === 'branch', or null if scope === 'holding' (applies company-wide). */
  branchId: string | null;
  /** Total maximum usage quota, or null if unlimited. */
  usageLimit: number | null;
  /** Number of times this promo has been successfully used. */
  usedCount: number;
  /** Start date in YYYY-MM-DD or ISO string, or null if no start limit. */
  startDate: string | null;
  /** End date in YYYY-MM-DD or ISO string, or null if no end limit. */
  endDate: string | null;
  active: boolean;
  createdAt: string;
}

export interface AppliedPromoInfo {
  promoId: string;
  code: string;
  name: string;
  type: PromoType;
  value: number;
  discountAmount: number;
}

export interface Transaction {
  id: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  customer: TransactionCustomer;
  items: TransactionLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  method: PaymentMethod;
  cashTendered: number;
  change: number;
  appliedPromo?: AppliedPromoInfo | null;
  timestamp: string;
}

export type CashMoveType = 'in' | 'out';

export interface CashMove {
  id: string;
  branchId: string;
  type: CashMoveType;
  amount: number;
  note: string;
  actorId: string;
  timestamp: string;
}

export interface AttendanceBreak {
  start: string;
  end: string | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  branchId: string;
  /** YYYY-MM-DD, one record per employee per day. */
  date: string;
  clockIn: string;
  clockOut: string | null;
  breaks: AttendanceBreak[];
}

/**
 * A POS cart set aside mid-transaction to serve another customer, retrieved
 * later. Unlike Transaction, this is a working draft — no totals, no
 * payment — so it's fine for `customer` to still be unset.
 */
export interface HeldBill {
  id: string;
  branchId: string;
  customer: TransactionCustomer | null;
  items: TransactionLineItem[];
  savedAt: string;
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod;
  expected: number;
  actual: number;
  variance: number;
}

/**
 * End-of-shift reconciliation. Immutable once created — no update function
 * exists, matching the "historical record" treatment given to Transaction
 * pricing. `periodStart`/`periodEnd` bound the window of Transactions this
 * closing reconciles; the next closing for the same cashier+branch starts
 * where this one's `periodEnd` left off, which is how double-counting is
 * prevented without mutating Transaction itself.
 */
export interface CashierClosing {
  id: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  periodStart: string;
  periodEnd: string;
  breakdown: PaymentMethodBreakdown[];
  totalExpected: number;
  totalActual: number;
  totalVariance: number;
  createdAt: string;
}

export type LoyaltyLedgerEntryType = 'earn' | 'redeem' | 'adjustment' | 'referral_bonus';

/**
 * Append-only, like StockMove — but unlike StockMove's always-positive qty
 * with direction inferred from `type`, `points` here is a SIGNED delta.
 * 'adjustment' legitimately needs to go either direction, so there's no
 * clean type-implies-sign mapping the way stock's in/out/sale has.
 */
export interface LoyaltyLedgerEntry {
  id: string;
  customerId: string;
  type: LoyaltyLedgerEntryType;
  points: number;
  reference: string;
  note: string;
  actorId: string;
  timestamp: string;
}

export interface RewardCatalogItem {
  id: string;
  name: string;
  pointsCost: number;
  description: string;
  active: boolean;
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected';

export interface RewardRedemption {
  id: string;
  customerId: string;
  rewardId: string;
  /** Snapshot of the reward at request time — same immutable-history principle as TransactionCustomer. */
  rewardName: string;
  pointsCost: number;
  status: RedemptionStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

export type AppointmentType = 'regular' | 'walk_in' | 'home_service' | 'wedding';
export type AppointmentStatus = 'booked' | 'checked_in' | 'in_service' | 'completed' | 'paid' | 'no_show' | 'cancelled';
export type HomeServicePackage = 'single' | 'family';
export type WeddingPackage = 'gentleman' | 'silver' | 'gold' | 'platinum';

export const HOME_SERVICE_PRICING = {
  single: 250000, // per orang, 1 pax
  family: 200000, // per orang, minimal 2 pax
} as const;

export const WEDDING_GROOMING_PRICING = {
  gentleman: 350000, // 1 orang
  silver: 500000, // 2 orang
  gold: 750000, // 3 orang
  platinum: 1000000, // 4 orang
} as const;

export interface Appointment {
  id: string;
  branchId: string;
  customer: TransactionCustomer;
  barberId: string;
  barberName: string;
  type: AppointmentType;
  serviceId?: string | null;
  serviceName?: string | null;
  packageType?: HomeServicePackage | WeddingPackage | null;
  paxCount: number;
  price: number;
  address?: string | null;
  distanceKm?: number | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  queueNumber?: number | null;
  status: AppointmentStatus;
  notes?: string;
  noShowReason?: string | null;
  transactionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ShiftType = 'pagi' | 'siang' | 'full' | 'off' | 'cuti';

export const SHIFT_TIMES: Record<ShiftType, { startTime: string; endTime: string; label: string }> = {
  pagi: { startTime: '09:00', endTime: '15:00', label: 'Pagi (09:00 - 15:00)' },
  siang: { startTime: '15:00', endTime: '21:00', label: 'Siang (15:00 - 21:00)' },
  full: { startTime: '09:00', endTime: '21:00', label: 'Full Day (09:00 - 21:00)' },
  off: { startTime: '', endTime: '', label: 'Day Off (Libur)' },
  cuti: { startTime: '', endTime: '', label: 'Cuti / Izin' },
};

export interface ShiftSchedule {
  id: string;
  branchId: string;
  employeeId: string;
  employeeName: string;
  role: EmployeeRole;
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpiryStatus = 'safe' | 'near_expiry' | 'expired';

export interface ProductBatch {
  id: string;
  productId: string;
  branchId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  initialQty: number;
  remainingQty: number;
  receivedDate: string; // YYYY-MM-DD
  cost: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeductedBatchInfo {
  batchId: string;
  batchNumber: string;
  qty: number;
  expiryDate: string;
}

export type ReminderType = 'haircut_routine' | 'dormant_churn' | 'upcoming_appointment';

export interface CustomerReminderCandidate {
  customer: Customer;
  type: ReminderType;
  lastVisitDate: string; // YYYY-MM-DD
  daysSinceLastVisit: number;
  preferredBarberName?: string;
  lastBranchName?: string;
  lastBranchId?: string;
  upcomingAppointmentDate?: string;
  upcomingAppointmentTime?: string;
  upcomingAppointmentId?: string;
  suggestedMessage: string;
  lastRemindedAt?: string | null;
  isEligible: boolean;
  ineligibilityReason?: string;
}

export interface ReminderLog {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  type: ReminderType;
  message: string;
  sentAt: string; // ISO timestamp
  actorId: string;
  actorName: string;
}

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'approved' | 'received' | 'cancelled';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  paymentTerms: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
  subtotal: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g. "PO-202608-001"
  branchId: string;
  supplierId: string;
  supplierName: string;
  orderDate: string; // YYYY-MM-DD
  expectedDate?: string; // YYYY-MM-DD
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentTerms: string;
  notes?: string;
  cancellationReason?: string;
  createdBy: string;
  createdByName: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type StockOpnameStatus = 'draft' | 'completed' | 'cancelled';

export interface StockOpnameItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  systemQty: number;
  physicalQty: number;
  variance: number;
  notes?: string;
}

export interface StockOpname {
  id: string;
  opnameNumber: string;
  branchId: string;
  branchName: string;
  opnameDate: string;
  status: StockOpnameStatus;
  items: StockOpnameItem[];
  totalVarianceItems: number;
  totalVarianceQty: number;
  notes?: string;
  cancellationReason?: string;
  conductedBy: string;
  conductedByName: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type StockTransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';

export interface StockTransferItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  unitCost: number;
  deductedBatches?: DeductedBatchInfo[];
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  targetBranchId: string;
  targetBranchName: string;
  status: StockTransferStatus;
  items: StockTransferItem[];
  totalQty: number;
  totalValue: number;
  notes?: string;
  cancellationReason?: string;
  dispatchedBy?: string;
  dispatchedByName?: string;
  dispatchedAt?: string;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type AdvanceStatus = 'pending' | 'approved' | 'rejected' | 'deducted';

export interface EmployeeAdvance {
  id: string;
  advanceNumber: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  amount: number;
  requestDate: string; // YYYY-MM-DD
  reason: string;
  status: AdvanceStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  deductedPayrollId?: string;
  createdAt: string;
  updatedAt: string;
}

export type PayrollStatus = 'draft' | 'approved' | 'paid' | 'cancelled';

export interface PayrollRecord {
  id: string;
  payrollNumber: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  branchId: string;
  branchName: string;
  periodMonth: string; // "YYYY-MM"
  attendanceDays: number;
  totalServicesCompleted: number;
  totalProductsSold: number;
  baseSalary: number;
  serviceCommission: number;
  productCommission: number;
  overtimeBonus: number;
  allowances: number;
  grossPay: number;
  advanceDeduction: number;
  lateDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  takeHomePay: number;
  status: PayrollStatus;
  notes?: string;
  cancellationReason?: string;
  createdBy: string;
  createdByName: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  paidBy?: string;
  paidByName?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'maintenance'
  | 'marketing'
  | 'other';

export interface ExpenseRecord {
  id: string;
  expenseNumber: string; // e.g. "EXP-202608-001"
  branchId: string;
  branchName: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  notes: string;
  recipientOrVendor?: string;
  paymentMethod: PaymentMethod;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type APPaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface APPaymentInstallment {
  id: string;
  paymentNumber: string; // e.g. "PAY-AP-202608-001"
  date: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: 'Transfer' | 'Cash' | 'Debit';
  bankReference?: string;
  notes?: string;
  paidBy: string;
  paidByName: string;
  createdAt: string;
}

export interface AccountsPayableRecord {
  id: string;
  poId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  orderDate: string;
  receivedDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: APPaymentStatus;
  payments: APPaymentInstallment[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfitAndLossReport {
  branchId: string | null;
  branchName: string;
  periodMonth: string; // "YYYY-MM"
  serviceRevenue: number;
  productRevenue: number;
  membershipRevenue: number;
  totalDiscount: number;
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  grossProfitMargin: number;
  operationalExpenses: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  payrollExpenses: number;
  totalOpex: number;
  netProfit: number;
  netProfitMargin: number;
  transactionCount: number;
}

export interface CashFlowReport {
  branchId: string | null;
  branchName: string;
  periodMonth: string;
  posCashInflow: number;
  posDigitalInflow: number;
  manualCashIn: number;
  totalInflow: number;
  expenseOutflow: number;
  apPaymentOutflow: number;
  payrollPaidOutflow: number;
  manualCashOut: number;
  totalOutflow: number;
  netCashFlow: number;
}

export interface BranchTarget {
  id: string;
  branchId: string;
  branchName: string;
  periodMonth: string; // "YYYY-MM"
  targetRevenue: number;
  targetTransactions: number;
  targetNewCustomers: number;
  targetMembershipActivations: number;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type TargetStatus = 'achieved' | 'on_track' | 'at_risk' | 'off_track';

export interface BranchTargetProgress {
  target: BranchTarget;
  actualRevenue: number;
  actualTransactions: number;
  actualNewCustomers: number;
  actualMembershipActivations: number;
  revenuePercentage: number;
  transactionsPercentage: number;
  newCustomersPercentage: number;
  membershipPercentage: number;
  overallPercentage: number;
  status: TargetStatus;
}

export type AuditActionType =
  | 'VOID_TRANSACTION'
  | 'REFUND_TRANSACTION'
  | 'APPROVE_PO'
  | 'RECEIVE_PO'
  | 'DISPATCH_TRANSFER'
  | 'RECEIVE_TRANSFER'
  | 'COMPLETE_OPNAME'
  | 'APPROVE_PAYROLL'
  | 'PAY_PAYROLL'
  | 'CREATE_EXPENSE'
  | 'DELETE_EXPENSE'
  | 'PAY_AP'
  | 'SET_BRANCH_TARGET'
  | 'STOCK_ADJUSTMENT'
  | 'PRICE_OVERRIDE'
  | 'ROLE_CHANGE';

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  branchId: string | null;
  branchName: string;
  action: AuditActionType | string;
  entityType: string;
  entityId: string;
  details: string;
  metadata?: Record<string, unknown> | null;
}

export interface ExecutiveHoldingSummary {
  periodMonth: string;
  totalRevenue: number;
  totalGrossProfit: number;
  grossProfitMargin: number;
  totalNetProfit: number;
  netProfitMargin: number;
  totalTransactions: number;
  averageOrderValue: number; // AOV (Rp)
  totalUniqueCustomers: number;
  totalActiveMembers: number;
  serviceRevenue: number;
  productRevenue: number;
  membershipRevenue: number;
  totalDiscount: number;
  totalCOGS: number;
  totalOpex: number;
}

export interface BranchLeaderboardEntry {
  branchId: string;
  branchName: string;
  city: string;
  revenue: number;
  revenueShare: number; // % terhadap total holding
  transactions: number;
  aov: number; // Average Order Value per cabang
  netProfit: number;
  netProfitMargin: number;
  memberTransactionsCount: number;
  memberRatio: number; // % transaksi dari member
  rank: number;
}

export interface HourlyTrafficData {
  hourLabel: string; // e.g. "09:00", "10:00", ..., "21:00"
  hour: number; // 9, 10, ..., 21
  transactionCount: number;
  revenue: number;
  isPeakHour: boolean;
}

export interface PaymentDistributionData {
  method: PaymentMethod;
  transactionCount: number;
  totalAmount: number;
  percentage: number;
}

export type RFMSegment =
  | 'champions'
  | 'loyal'
  | 'potential_loyalist'
  | 'new_customers'
  | 'at_risk'
  | 'hibernating';

export interface CustomerRFMProfile {
  customerId: string;
  name: string;
  phone: string;
  tier: MembershipTier | null;
  recencyDays: number;
  frequency: number;
  monetary: number;
  rScore: number;
  fScore: number;
  mScore: number;
  rfmScore: string; // e.g. "554", "443", "121"
  segment: RFMSegment;
  favoriteBarberName?: string;
  favoriteServiceName?: string;
  lastVisitDate?: string;
  predictedNextVisit?: string;
  isOverdue: boolean;
}

export interface RFMSegmentSummary {
  segment: RFMSegment;
  segmentLabel: string;
  customerCount: number;
  percentage: number;
  totalRevenue: number;
  avgSpend: number;
  recommendedAction: string;
}

export interface CustomerIntelligenceSummary {
  totalAnalyzedCustomers: number;
  averageRecencyDays: number;
  averageVisitInterval: number;
  atRiskCustomerCount: number;
  segments: RFMSegmentSummary[];
}

