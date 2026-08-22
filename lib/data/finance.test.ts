import { describe, it, expect, beforeEach } from 'vitest';
import { StorageKeys, writeCollection, readCollection } from './storage';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  deleteExpense,
  getAccountsPayable,
  getAccountsPayableById,
  syncAPFromPurchaseOrders,
  recordAPPayment,
  generateProfitAndLossReport,
  generateCashFlowReport,
} from './finance';
import type {
  Branch,
  Employee,
  Product,
  Service,
  PurchaseOrder,
  Transaction,
  PayrollRecord,
  CashMove,
} from './types';

describe('Finance, Expense, Accounts Payable & Reports Data Layer', () => {
  const mockBranch: Branch = {
    id: 'br_bypass',
    name: 'Bypass Cirebon',
    city: 'Cirebon',
    province: 'Jawa Barat',
    address: 'Jl. Bypass No. 10',
    phone: '0231-11111',
  };

  const mockOwner: Employee = {
    id: 'emp_owner',
    name: 'Bpk. Herman',
    role: 'Owner',
    branchId: 'br_bypass',
    pin: '9999',
  };

  const mockBranchManager: Employee = {
    id: 'emp_bm',
    name: 'Yusuf BM',
    role: 'BranchManager',
    branchId: 'br_bypass',
    pin: '1234',
  };

  const mockKasir: Employee = {
    id: 'emp_kasir',
    name: 'Kasir Sari',
    role: 'Kasir',
    branchId: 'br_bypass',
    pin: '1111',
  };

  const mockProducts: Product[] = [
    { id: 'prd_pomade', name: 'Pomade Waterbased', sku: 'POM-01', category: 'Styling', brand: 'RedBox', cost: 40000, price: 80000, lowStockThreshold: 5 },
  ];

  const mockServices: Service[] = [
    { id: 'svc_haircut', name: 'Haircut Reguler', category: 'Rambut', durationMinutes: 30, price: 60000, commissionPercent: 20 },
    { id: 'svc_membership_activation', name: 'Aktivasi Member', category: 'Membership', durationMinutes: 5, price: 100000, commissionPercent: 0 },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    writeCollection(StorageKeys.branches, [mockBranch]);
    writeCollection(StorageKeys.employees, [mockOwner, mockBranchManager, mockKasir]);
    writeCollection(StorageKeys.products, mockProducts);
    writeCollection(StorageKeys.services, mockServices);
    writeCollection(StorageKeys.expenses, []);
    writeCollection(StorageKeys.accountsPayable, []);
    writeCollection(StorageKeys.purchaseOrders, []);
    writeCollection(StorageKeys.transactions, []);
    writeCollection(StorageKeys.payrollRecords, []);
    writeCollection(StorageKeys.cashMoves, []);
  });

  describe('Operational Expenses Module', () => {
    it('creates, lists and deletes operational expenses with RBAC protection', () => {
      const exp = createExpense(
        {
          branchId: mockBranch.id,
          category: 'utilities',
          amount: 750000,
          notes: 'Tagihan Listrik PLN Agustus',
          recipientOrVendor: 'PLN Persero',
          paymentMethod: 'Transfer',
          date: '2026-08-10',
        },
        mockBranchManager,
      );

      expect(exp.id).toMatch(/^exp_/);
      expect(exp.expenseNumber).toMatch(/^EXP-/);
      expect(exp.amount).toBe(750000);
      expect(exp.category).toBe('utilities');

      const all = getExpenses(mockBranch.id);
      expect(all).toHaveLength(1);
      expect(getExpenseById(exp.id)).toBeDefined();

      // Kasir cannot delete expense
      expect(() => deleteExpense(exp.id, mockKasir)).toThrow('Akses ditolak');

      // Manager can delete
      const deleted = deleteExpense(exp.id, mockBranchManager);
      expect(deleted).toBe(true);
      expect(getExpenses(mockBranch.id)).toHaveLength(0);
    });

    it('rejects expense creation by unauthorized role', () => {
      expect(() =>
        createExpense(
          {
            branchId: mockBranch.id,
            category: 'supplies',
            amount: 50000,
            notes: 'Beli air galon',
            paymentMethod: 'Cash',
          },
          mockKasir,
        ),
      ).toThrow('Akses ditolak');
    });
  });

  describe('Accounts Payable (AP) Module', () => {
    it('automatically syncs AP from received POs and tracks installments to full payoff', () => {
      // 1. Seed received PO
      const po: PurchaseOrder = {
        id: 'po_001',
        poNumber: 'PO-202608-0001',
        supplierId: 'sup_01',
        supplierName: 'PT Barber Supply',
        branchId: mockBranch.id,
        orderDate: '2026-08-01',
        paymentTerms: 'Net 30',
        status: 'received',
        receivedAt: '2026-08-03T10:00:00Z',
        items: [
          { id: 'poi_1', productId: 'prd_pomade', productName: 'Pomade', productSku: 'POM-01', qtyOrdered: 10, qtyReceived: 10, unitCost: 40000, subtotal: 400000 },
        ],
        subtotal: 400000,
        taxAmount: 0,
        totalAmount: 400000,
        createdBy: mockOwner.id,
        createdByName: mockOwner.name,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-03T10:00:00Z',
      };
      writeCollection(StorageKeys.purchaseOrders, [po]);

      // 2. Sync AP
      const apList = getAccountsPayable(mockBranch.id);
      expect(apList).toHaveLength(1);

      const ap = apList[0];
      expect(ap.poId).toBe('po_001');
      expect(ap.totalAmount).toBe(400000);
      expect(ap.paidAmount).toBe(0);
      expect(ap.remainingBalance).toBe(400000);
      expect(ap.status).toBe('unpaid');

      // 3. Make Partial Payment (Rp 150.000)
      const afterPartial = recordAPPayment(
        ap.id,
        {
          amount: 150000,
          paymentMethod: 'Transfer',
          bankReference: 'TRF-BCA-9821',
          notes: 'Cicilan ke-1',
          date: '2026-08-10',
        },
        mockBranchManager,
      );

      expect(afterPartial.paidAmount).toBe(150000);
      expect(afterPartial.remainingBalance).toBe(250000);
      expect(afterPartial.status).toBe('partial');
      expect(afterPartial.payments).toHaveLength(1);

      // 4. Overpayment rejection
      expect(() =>
        recordAPPayment(
          ap.id,
          {
            amount: 300000, // exceeds 250.000
            paymentMethod: 'Transfer',
          },
          mockBranchManager,
        ),
      ).toThrow('melebihi sisa tagihan');

      // 5. Final Payoff (Rp 250.000)
      const afterPaid = recordAPPayment(
        ap.id,
        {
          amount: 250000,
          paymentMethod: 'Transfer',
          notes: 'Pelunasan',
          date: '2026-08-20',
        },
        mockOwner,
      );

      expect(afterPaid.paidAmount).toBe(400000);
      expect(afterPaid.remainingBalance).toBe(0);
      expect(afterPaid.status).toBe('paid');
      expect(afterPaid.payments).toHaveLength(2);
    });
  });

  describe('Profit & Loss (P&L) Report Generation', () => {
    it('aggregates Revenue, COGS, OPEX, and Net Profit correctly', () => {
      // 1. Transactions:
      // - 2x Haircut @ 60.000 = 120.000
      // - 2x Pomade @ 80.000 = 160.000 (Cost = 40.000 x 2 = 80.000)
      // - 1x Member Activation @ 100.000 = 100.000
      // - Discount = 10.000
      // Total Revenue = 120k + 160k + 100k - 10k = 370.000
      const tx1: Transaction = {
        id: 'TRX-101',
        branchId: mockBranch.id,
        cashierId: mockKasir.id,
        cashierName: mockKasir.name,
        customer: { type: 'guest', customerId: null, name: 'Budi', phone: '0812', tier: null },
        items: [
          { kind: 'service', itemId: 'svc_haircut', name: 'Haircut Reguler', price: 60000, qty: 2 },
          { kind: 'product', itemId: 'prd_pomade', name: 'Pomade', price: 80000, qty: 2 },
          { kind: 'service', itemId: 'svc_membership_activation', name: 'Aktivasi Member', price: 100000, qty: 1 },
        ],
        subtotal: 380000,
        discount: 10000,
        tax: 37000,
        total: 407000,
        method: 'Cash',
        cashTendered: 450000,
        change: 43000,
        timestamp: '2026-08-05T10:00:00Z',
      };
      writeCollection(StorageKeys.transactions, [tx1]);

      // 2. Operational Expense (Sewa 50.000)
      createExpense(
        {
          branchId: mockBranch.id,
          category: 'rent',
          amount: 50000,
          notes: 'Sewa stand',
          paymentMethod: 'Cash',
          date: '2026-08-05',
        },
        mockBranchManager,
      );

      // 3. Payroll (Gross Pay 150.000)
      const pay: PayrollRecord = {
        id: 'pay_01',
        payrollNumber: 'PAY-01',
        employeeId: 'emp_barber',
        employeeName: 'Arif Barber',
        employeeRole: 'Barber',
        branchId: mockBranch.id,
        branchName: mockBranch.name,
        periodMonth: '2026-08',
        attendanceDays: 20,
        totalServicesCompleted: 10,
        totalProductsSold: 2,
        baseSalary: 100000,
        serviceCommission: 30000,
        productCommission: 10000,
        overtimeBonus: 10000,
        allowances: 0,
        grossPay: 150000,
        advanceDeduction: 0,
        lateDeduction: 0,
        otherDeductions: 0,
        totalDeductions: 0,
        takeHomePay: 150000,
        status: 'approved',
        createdBy: mockOwner.id,
        createdByName: mockOwner.name,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      };
      writeCollection(StorageKeys.payrollRecords, [pay]);

      const report = generateProfitAndLossReport(mockBranch.id, '2026-08');

      expect(report.serviceRevenue).toBe(120000);
      expect(report.productRevenue).toBe(160000);
      expect(report.membershipRevenue).toBe(100000);
      expect(report.totalDiscount).toBe(10000);
      expect(report.totalRevenue).toBe(370000);
      expect(report.cogs).toBe(80000);
      expect(report.grossProfit).toBe(290000); // 370.000 - 80.000
      expect(report.operationalExpenses).toBe(50000);
      expect(report.payrollExpenses).toBe(150000);
      expect(report.totalOpex).toBe(200000); // 50.000 + 150.000
      expect(report.netProfit).toBe(90000); // 290.000 - 200.000
    });
  });

  describe('Cash Flow Report Generation', () => {
    it('aggregates inflows and outflows to compute net cash flow', () => {
      // Inflow: POS Cash 407.000 + Manual Cash In 50.000 = 457.000
      const tx: Transaction = {
        id: 'TRX-201',
        branchId: mockBranch.id,
        cashierId: mockKasir.id,
        cashierName: mockKasir.name,
        customer: { type: 'guest', customerId: null, name: 'Budi', phone: '0812', tier: null },
        items: [{ kind: 'service', itemId: 'svc_haircut', name: 'Haircut', price: 60000, qty: 1 }],
        subtotal: 60000,
        discount: 0,
        tax: 6000,
        total: 66000,
        method: 'Cash',
        cashTendered: 100000,
        change: 34000,
        timestamp: '2026-08-10T10:00:00Z',
      };
      writeCollection(StorageKeys.transactions, [tx]);

      const moveIn: CashMove = {
        id: 'cm_01',
        branchId: mockBranch.id,
        type: 'in',
        amount: 50000,
        note: 'Modal kasir',
        actorId: mockKasir.id,
        timestamp: '2026-08-10T08:00:00Z',
      };
      writeCollection(StorageKeys.cashMoves, [moveIn]);

      // Outflow: Expense 30.000
      createExpense(
        {
          branchId: mockBranch.id,
          category: 'supplies',
          amount: 30000,
          notes: 'Beli sabun',
          paymentMethod: 'Cash',
          date: '2026-08-10',
        },
        mockBranchManager,
      );

      const cf = generateCashFlowReport(mockBranch.id, '2026-08');

      expect(cf.posCashInflow).toBe(66000);
      expect(cf.manualCashIn).toBe(50000);
      expect(cf.totalInflow).toBe(116000);
      expect(cf.expenseOutflow).toBe(30000);
      expect(cf.totalOutflow).toBe(30000);
      expect(cf.netCashFlow).toBe(86000);
    });
  });
});
