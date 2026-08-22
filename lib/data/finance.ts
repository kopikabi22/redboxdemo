import { StorageKeys, readCollection, writeCollection, generateId, nowIso, todayDateString } from './storage';
import { canManageBranch } from './rbac';
import { getBranchById } from './branches';
import { getProductById } from './catalog';
import type {
  ExpenseCategory,
  ExpenseRecord,
  APPaymentStatus,
  AccountsPayableRecord,
  APPaymentInstallment,
  ProfitAndLossReport,
  CashFlowReport,
  Employee,
  PurchaseOrder,
  Transaction,
  CashMove,
  PayrollRecord,
  PaymentMethod,
} from './types';

// ==========================================
// OPERATIONAL EXPENSES MODULE
// ==========================================

export function getExpenses(
  branchId?: string,
  category?: ExpenseCategory,
  startDate?: string,
  endDate?: string,
): ExpenseRecord[] {
  const expenses = readCollection<ExpenseRecord>(StorageKeys.expenses);
  return expenses
    .filter((e) => {
      if (branchId && e.branchId !== branchId) return false;
      if (category && e.category !== category) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function getExpenseById(id: string): ExpenseRecord | undefined {
  return getExpenses().find((e) => e.id === id);
}

export interface CreateExpenseInput {
  branchId: string;
  category: ExpenseCategory;
  amount: number;
  date?: string;
  notes: string;
  recipientOrVendor?: string;
  paymentMethod: PaymentMethod;
}

export function createExpense(input: CreateExpenseInput, actor: Employee): ExpenseRecord {
  const allowedRoles = ['Owner', 'BranchManager'];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Akses ditolak: role tidak memiliki wewenang mencatat beban operasional.');
  }

  if (!canManageBranch(actor, input.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (input.amount <= 0) {
    throw new Error('Nominal pengeluaran harus lebih dari Rp 0.');
  }

  const cleanNotes = input.notes.trim();
  if (!cleanNotes) {
    throw new Error('Catatan / keterangan pengeluaran wajib diisi.');
  }

  const branch = getBranchById(input.branchId);
  const expenses = readCollection<ExpenseRecord>(StorageKeys.expenses);
  const expenseNumber = `EXP-${Date.now().toString().slice(-8)}`;

  const expense: ExpenseRecord = {
    id: generateId('exp'),
    expenseNumber,
    branchId: input.branchId,
    branchName: branch?.name ?? input.branchId,
    category: input.category,
    amount: input.amount,
    date: input.date ?? todayDateString(),
    notes: cleanNotes,
    recipientOrVendor: input.recipientOrVendor?.trim() || undefined,
    paymentMethod: input.paymentMethod,
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  expenses.push(expense);
  writeCollection(StorageKeys.expenses, expenses);
  return expense;
}

export function deleteExpense(id: string, actor: Employee): boolean {
  const allowedRoles = ['Owner', 'BranchManager'];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Akses ditolak: role tidak memiliki wewenang menghapus beban operasional.');
  }

  const expenses = readCollection<ExpenseRecord>(StorageKeys.expenses);
  const targetIndex = expenses.findIndex((e) => e.id === id);
  if (targetIndex < 0) {
    throw new Error('Data pengeluaran tidak ditemukan.');
  }

  const target = expenses[targetIndex];
  if (!canManageBranch(actor, target.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  expenses.splice(targetIndex, 1);
  writeCollection(StorageKeys.expenses, expenses);
  return true;
}

// ==========================================
// ACCOUNTS PAYABLE (HUTANG SUPPLIER) MODULE
// ==========================================

export function getAccountsPayable(
  branchId?: string,
  status?: APPaymentStatus,
  supplierId?: string,
): AccountsPayableRecord[] {
  // Always trigger auto-sync from received Purchase Orders
  syncAPFromPurchaseOrders();

  const apRecords = readCollection<AccountsPayableRecord>(StorageKeys.accountsPayable);
  return apRecords
    .filter((ap) => {
      if (branchId && ap.branchId !== branchId) return false;
      if (status && ap.status !== status) return false;
      if (supplierId && ap.supplierId !== supplierId) return false;
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.createdAt.localeCompare(a.createdAt));
}

export function getAccountsPayableById(id: string): AccountsPayableRecord | undefined {
  return getAccountsPayable().find((ap) => ap.id === id);
}

export function syncAPFromPurchaseOrders(): AccountsPayableRecord[] {
  const purchaseOrders = readCollection<PurchaseOrder>(StorageKeys.purchaseOrders);
  const receivedPOs = purchaseOrders.filter((po) => po.status === 'received');

  const apRecords = readCollection<AccountsPayableRecord>(StorageKeys.accountsPayable);
  let changed = false;

  for (const po of receivedPOs) {
    const existing = apRecords.find((ap) => ap.poId === po.id);
    if (!existing) {
      // Calculate dueDate based on supplier / PO terms (e.g. Net 30 default)
      const receivedDateStr = po.receivedAt ? po.receivedAt.slice(0, 10) : po.orderDate;
      const recDate = new Date(receivedDateStr);
      recDate.setDate(recDate.getDate() + 30);
      const dueDate = isNaN(recDate.getTime()) ? receivedDateStr : recDate.toISOString().slice(0, 10);

      const branchObj = getBranchById(po.branchId);
      const newAP: AccountsPayableRecord = {
        id: generateId('ap'),
        poId: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        branchId: po.branchId,
        branchName: branchObj?.name ?? po.branchId,
        orderDate: po.orderDate,
        receivedDate: receivedDateStr,
        dueDate,
        totalAmount: po.totalAmount,
        paidAmount: 0,
        remainingBalance: po.totalAmount,
        status: 'unpaid',
        payments: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      apRecords.push(newAP);
      changed = true;
    }
  }

  if (changed) {
    writeCollection(StorageKeys.accountsPayable, apRecords);
  }

  return apRecords;
}

export interface RecordAPPaymentInput {
  amount: number;
  paymentMethod: 'Transfer' | 'Cash' | 'Debit';
  bankReference?: string;
  notes?: string;
  date?: string;
}

export function recordAPPayment(
  apId: string,
  input: RecordAPPaymentInput,
  actor: Employee,
): AccountsPayableRecord {
  const allowedRoles = ['Owner', 'BranchManager'];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Akses ditolak: role tidak memiliki wewenang mencatat pembayaran hutang dagang.');
  }

  const apRecords = readCollection<AccountsPayableRecord>(StorageKeys.accountsPayable);
  const ap = apRecords.find((r) => r.id === apId);
  if (!ap) {
    throw new Error('Tagihan hutang dagang tidak ditemukan.');
  }

  if (!canManageBranch(actor, ap.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (input.amount <= 0) {
    throw new Error('Nominal pembayaran harus lebih dari Rp 0.');
  }

  if (input.amount > ap.remainingBalance) {
    throw new Error(
      `Nominal pembayaran (Rp ${input.amount.toLocaleString()}) melebihi sisa tagihan (Rp ${ap.remainingBalance.toLocaleString()}).`,
    );
  }

  const paymentNumber = `PAY-AP-${Date.now().toString().slice(-8)}`;
  const payment: APPaymentInstallment = {
    id: generateId('appay'),
    paymentNumber,
    date: input.date ?? todayDateString(),
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    bankReference: input.bankReference?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    paidBy: actor.id,
    paidByName: actor.name,
    createdAt: nowIso(),
  };

  ap.payments.push(payment);
  ap.paidAmount += input.amount;
  ap.remainingBalance = ap.totalAmount - ap.paidAmount;
  ap.status = ap.remainingBalance <= 0 ? 'paid' : 'partial';
  ap.updatedAt = nowIso();

  writeCollection(StorageKeys.accountsPayable, apRecords);
  return ap;
}

// ==========================================
// REPORTS: PROFIT & LOSS AND CASH FLOW
// ==========================================

export function generateProfitAndLossReport(
  branchId?: string,
  periodMonth?: string,
): ProfitAndLossReport {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const branch = branchId ? getBranchById(branchId) : null;
  const branchName = branch ? branch.name : 'Seluruh Cabang (Konsolidasi)';

  // 1. Transactions (Revenue & COGS)
  const transactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) => {
    if (!tx.timestamp.startsWith(targetMonth)) return false;
    if (branchId && tx.branchId !== branchId) return false;
    return true;
  });

  let serviceRevenue = 0;
  let productRevenue = 0;
  let membershipRevenue = 0;
  let totalDiscount = 0;
  let cogs = 0;

  for (const tx of transactions) {
    totalDiscount += tx.discount;
    for (const item of tx.items) {
      if (item.itemId === 'svc_membership_activation') {
        membershipRevenue += item.price * item.qty;
      } else if (item.kind === 'service') {
        serviceRevenue += item.price * item.qty;
      } else if (item.kind === 'product') {
        productRevenue += item.price * item.qty;
        const prod = getProductById(item.itemId);
        const unitCost = prod?.cost ?? 0;
        cogs += unitCost * item.qty;
      }
    }
  }

  const totalRevenue = serviceRevenue + productRevenue + membershipRevenue - totalDiscount;
  const grossProfit = totalRevenue - cogs;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // 2. Operational Expenses
  const allExpenses = readCollection<ExpenseRecord>(StorageKeys.expenses).filter((exp) => {
    if (!exp.date.startsWith(targetMonth)) return false;
    if (branchId && exp.branchId !== branchId) return false;
    return true;
  });

  const expensesByCategory: Record<ExpenseCategory, number> = {
    rent: 0,
    utilities: 0,
    supplies: 0,
    maintenance: 0,
    marketing: 0,
    other: 0,
  };

  for (const exp of allExpenses) {
    expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + exp.amount;
  }

  const operationalExpenses = Object.values(expensesByCategory).reduce((sum, v) => sum + v, 0);

  // 3. Payroll Expenses
  const payrollRecords = readCollection<PayrollRecord>(StorageKeys.payrollRecords).filter((rec) => {
    if (rec.periodMonth !== targetMonth) return false;
    if (branchId && rec.branchId !== branchId) return false;
    if (rec.status === 'cancelled') return false;
    return true;
  });

  const payrollExpenses = payrollRecords.reduce((sum, rec) => sum + rec.grossPay, 0);
  const totalOpex = operationalExpenses + payrollExpenses;
  const netProfit = grossProfit - totalOpex;
  const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    branchId: branchId || null,
    branchName,
    periodMonth: targetMonth,
    serviceRevenue,
    productRevenue,
    membershipRevenue,
    totalDiscount,
    totalRevenue,
    cogs,
    grossProfit,
    grossProfitMargin,
    operationalExpenses,
    expensesByCategory,
    payrollExpenses,
    totalOpex,
    netProfit,
    netProfitMargin,
    transactionCount: transactions.length,
  };
}

export function generateCashFlowReport(
  branchId?: string,
  periodMonth?: string,
): CashFlowReport {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const branch = branchId ? getBranchById(branchId) : null;
  const branchName = branch ? branch.name : 'Seluruh Cabang (Konsolidasi)';

  // 1. Inflows
  const transactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) => {
    if (!tx.timestamp.startsWith(targetMonth)) return false;
    if (branchId && tx.branchId !== branchId) return false;
    return true;
  });

  let posCashInflow = 0;
  let posDigitalInflow = 0;

  for (const tx of transactions) {
    if (tx.method === 'Cash') {
      posCashInflow += tx.total;
    } else {
      posDigitalInflow += tx.total;
    }
  }

  const cashMoves = readCollection<CashMove>(StorageKeys.cashMoves).filter((cm) => {
    if (!cm.timestamp.startsWith(targetMonth)) return false;
    if (branchId && cm.branchId !== branchId) return false;
    return true;
  });

  const manualCashIn = cashMoves
    .filter((cm) => cm.type === 'in')
    .reduce((sum, cm) => sum + cm.amount, 0);

  const totalInflow = posCashInflow + posDigitalInflow + manualCashIn;

  // 2. Outflows
  const expenses = readCollection<ExpenseRecord>(StorageKeys.expenses).filter((exp) => {
    if (!exp.date.startsWith(targetMonth)) return false;
    if (branchId && exp.branchId !== branchId) return false;
    return true;
  });
  const expenseOutflow = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const apRecords = readCollection<AccountsPayableRecord>(StorageKeys.accountsPayable).filter((ap) => {
    if (branchId && ap.branchId !== branchId) return false;
    return true;
  });

  let apPaymentOutflow = 0;
  for (const ap of apRecords) {
    for (const p of ap.payments) {
      if (p.date.startsWith(targetMonth)) {
        apPaymentOutflow += p.amount;
      }
    }
  }

  const payrollRecords = readCollection<PayrollRecord>(StorageKeys.payrollRecords).filter((rec) => {
    if (branchId && rec.branchId !== branchId) return false;
    if (rec.status !== 'paid') return false;
    const paidDate = rec.paidAt ? rec.paidAt.slice(0, 7) : rec.periodMonth;
    return paidDate === targetMonth;
  });
  const payrollPaidOutflow = payrollRecords.reduce((sum, rec) => sum + rec.takeHomePay, 0);

  const manualCashOut = cashMoves
    .filter((cm) => cm.type === 'out')
    .reduce((sum, cm) => sum + cm.amount, 0);

  const totalOutflow = expenseOutflow + apPaymentOutflow + payrollPaidOutflow + manualCashOut;
  const netCashFlow = totalInflow - totalOutflow;

  return {
    branchId: branchId || null,
    branchName,
    periodMonth: targetMonth,
    posCashInflow,
    posDigitalInflow,
    manualCashIn,
    totalInflow,
    expenseOutflow,
    apPaymentOutflow,
    payrollPaidOutflow,
    manualCashOut,
    totalOutflow,
    netCashFlow,
  };
}
