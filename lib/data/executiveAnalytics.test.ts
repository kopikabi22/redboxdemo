import { describe, it, expect, beforeEach } from 'vitest';
import {
  getExecutiveHoldingSummary,
  getBranchLeaderboard,
  getHourlyPeakTraffic,
  getPaymentMethodDistribution,
} from './executiveAnalytics';
import { StorageKeys, writeCollection } from './storage';
import type { Branch, Transaction, Customer, ExpenseRecord, Product } from './types';

const mockBranches: Branch[] = [
  {
    id: 'br_cirebon_bypass',
    name: 'Redbox Bypass Cirebon',
    address: 'Jl. Brigjend Dharsono No. 12',
    city: 'Cirebon',
    province: 'Jawa Barat',
    phone: '0231-123456',
  },
  {
    id: 'br_cirebon_csb',
    name: 'Redbox CSB Mall',
    address: 'CSB Mall Lt. 2',
    city: 'Cirebon',
    province: 'Jawa Barat',
    phone: '0231-654321',
  },
];

const mockProducts: Product[] = [
  {
    id: 'prod_pomade',
    sku: 'SKU-POM-01',
    name: 'Redbox Matte Clay Pomade',
    category: 'Hair Styling',
    brand: 'Redbox Grooming',
    cost: 50000,
    price: 90000,
    lowStockThreshold: 5,
  },
];

describe('Executive Analytics & Multi-Branch BI Module', () => {
  beforeEach(() => {
    writeCollection(StorageKeys.branches, mockBranches);
    writeCollection(StorageKeys.products, mockProducts);
    writeCollection(StorageKeys.transactions, []);
    writeCollection(StorageKeys.customers, []);
    writeCollection(StorageKeys.expenses, []);
    writeCollection(StorageKeys.payrollRecords, []);
  });

  describe('getExecutiveHoldingSummary', () => {
    it('aggregates multi-branch consolidated KPIs, AOV, and customer metrics', () => {
      // Seed multi-branch transactions for 2026-08
      const mockTxs: Transaction[] = [
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_cashier',
          cashierName: 'Siti Kasir',
          customer: {
            type: 'member',
            customerId: 'c_1',
            name: 'Budi Santoso',
            phone: '081234567890',
            tier: 'Gold',
          },
          subtotal: 190000,
          discount: 10000,
          tax: 0,
          total: 180000,
          method: 'QRIS',
          cashTendered: 180000,
          change: 0,
          timestamp: '2026-08-10T10:30:00Z',
          items: [
            {
              itemId: 'svc_haircut',
              name: 'Executive Haircut',
              price: 100000,
              qty: 1,
              kind: 'service',
            },
            {
              itemId: 'prod_pomade',
              name: 'Redbox Matte Clay Pomade',
              price: 90000,
              qty: 1,
              kind: 'product',
            },
          ],
        },
        {
          id: 'tx_2',
          branchId: 'br_cirebon_csb',
          cashierId: 'emp_cashier_2',
          cashierName: 'Rian Kasir',
          customer: {
            type: 'guest',
            customerId: null,
            name: 'Andi',
            phone: '081234567891',
            tier: null,
          },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-12T14:15:00Z',
          items: [
            {
              itemId: 'svc_membership_activation',
              name: 'Aktivasi Member',
              price: 100000,
              qty: 1,
              kind: 'service',
            },
          ],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      // Seed customers
      const mockCusts: Customer[] = [
        {
          id: 'c_1',
          name: 'Budi Santoso',
          phone: '081234567890',
          type: 'member',
          tier: 'Gold',
          points: 150,
          createdAt: '2026-08-01T09:00:00Z',
        },
        {
          id: 'c_2',
          name: 'Andi',
          phone: '081234567891',
          type: 'guest',
          tier: null,
          points: 0,
          createdAt: '2026-08-12T14:00:00Z',
        },
      ];
      writeCollection(StorageKeys.customers, mockCusts);

      // Seed operational expense for Bypass
      const mockExpenses: ExpenseRecord[] = [
        {
          id: 'exp_1',
          expenseNumber: 'EXP-1001',
          branchId: 'br_cirebon_bypass',
          branchName: 'Redbox Bypass Cirebon',
          category: 'utilities',
          amount: 50000,
          date: '2026-08-05',
          notes: 'Listrik kasir',
          paymentMethod: 'Cash',
          createdBy: 'emp_owner',
          createdByName: 'Owner',
          createdAt: '2026-08-05T10:00:00Z',
          updatedAt: '2026-08-05T10:00:00Z',
        },
      ];
      writeCollection(StorageKeys.expenses, mockExpenses);

      const summary = getExecutiveHoldingSummary('2026-08');

      // Total Revenue = (100k + 90k - 10k) + (100k) = 180k + 100k = 280.000
      expect(summary.totalRevenue).toBe(280000);
      expect(summary.serviceRevenue).toBe(100000);
      expect(summary.productRevenue).toBe(90000);
      expect(summary.membershipRevenue).toBe(100000);
      expect(summary.totalDiscount).toBe(10000);

      // COGS = 50.000 (Pomade cost)
      expect(summary.totalCOGS).toBe(50000);
      expect(summary.totalGrossProfit).toBe(230000);

      // OPEX = 50.000 (Expense) -> Net Profit = 230.000 - 50.000 = 180.000
      expect(summary.totalOpex).toBe(50000);
      expect(summary.totalNetProfit).toBe(180000);

      // AOV = 280.000 / 2 = 140.000
      expect(summary.totalTransactions).toBe(2);
      expect(summary.averageOrderValue).toBe(140000);

      // Customer stats
      expect(summary.totalUniqueCustomers).toBe(2);
      expect(summary.totalActiveMembers).toBe(1);
    });
  });

  describe('getBranchLeaderboard', () => {
    it('ranks branches by revenue and computes branch revenue share % and member ratio', () => {
      const mockTxs: Transaction[] = [
        {
          id: 'tx_bypass_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: {
            type: 'member',
            customerId: 'c_1',
            name: 'Budi',
            phone: '08123',
            tier: 'Silver',
          },
          subtotal: 300000,
          discount: 0,
          tax: 0,
          total: 300000,
          method: 'Cash',
          cashTendered: 300000,
          change: 0,
          timestamp: '2026-08-01T10:00:00Z',
          items: [{ itemId: 'svc_haircut', name: 'Haircut', price: 300000, qty: 1, kind: 'service' }],
        },
        {
          id: 'tx_csb_1',
          branchId: 'br_cirebon_csb',
          cashierId: 'emp_2',
          cashierName: 'Kasir 2',
          customer: {
            type: 'guest',
            customerId: null,
            name: 'Andi',
            phone: '08124',
            tier: null,
          },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'QRIS',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-01T11:00:00Z',
          items: [{ itemId: 'svc_haircut', name: 'Haircut', price: 100000, qty: 1, kind: 'service' }],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const leaderboard = getBranchLeaderboard('2026-08');

      expect(leaderboard).toHaveLength(2);
      // Rank 1: Bypass (300k revenue)
      expect(leaderboard[0].branchId).toBe('br_cirebon_bypass');
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].revenue).toBe(300000);
      expect(leaderboard[0].revenueShare).toBe(75); // 300k / 400k * 100
      expect(leaderboard[0].memberRatio).toBe(100); // 1 out of 1 is member

      // Rank 2: CSB (100k revenue)
      expect(leaderboard[1].branchId).toBe('br_cirebon_csb');
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[1].revenue).toBe(100000);
      expect(leaderboard[1].revenueShare).toBe(25); // 100k / 400k * 100
      expect(leaderboard[1].memberRatio).toBe(0); // 0 out of 1 is member
    });
  });

  describe('getHourlyPeakTraffic', () => {
    it('aggregates transactions into hourly time slots and flags rush hours', () => {
      const mockTxs: Transaction[] = [
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'B', phone: '081', tier: null },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-10T14:10:00Z', // 14:00 slot
          items: [{ itemId: 's_1', name: 'Haircut', price: 100000, qty: 1, kind: 'service' }],
        },
        {
          id: 'tx_2',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'C', phone: '082', tier: null },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-10T14:45:00Z', // 14:00 slot
          items: [{ itemId: 's_1', name: 'Haircut', price: 100000, qty: 1, kind: 'service' }],
        },
        {
          id: 'tx_3',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'D', phone: '083', tier: null },
          subtotal: 50000,
          discount: 0,
          tax: 0,
          total: 50000,
          method: 'Cash',
          cashTendered: 50000,
          change: 0,
          timestamp: '2026-08-10T19:20:00Z', // 19:00 slot
          items: [{ itemId: 's_1', name: 'Haircut', price: 50000, qty: 1, kind: 'service' }],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const traffic = getHourlyPeakTraffic(undefined, '2026-08');

      // 13 hourly slots from 09:00 to 21:00
      expect(traffic).toHaveLength(13);

      const slot14 = traffic.find((t) => t.hour === 14);
      expect(slot14).toBeDefined();
      expect(slot14?.transactionCount).toBe(2);
      expect(slot14?.revenue).toBe(200000);
      expect(slot14?.isPeakHour).toBe(true);

      const slot19 = traffic.find((t) => t.hour === 19);
      expect(slot19?.transactionCount).toBe(1);
      expect(slot19?.revenue).toBe(50000);

      const slot09 = traffic.find((t) => t.hour === 9);
      expect(slot09?.transactionCount).toBe(0);
    });
  });

  describe('getPaymentMethodDistribution', () => {
    it('aggregates payment method distribution percentages and nominal totals', () => {
      const mockTxs: Transaction[] = [
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'B', phone: '081', tier: null },
          subtotal: 300000,
          discount: 0,
          tax: 0,
          total: 300000,
          method: 'QRIS',
          cashTendered: 300000,
          change: 0,
          timestamp: '2026-08-01T10:00:00Z',
          items: [{ itemId: 's_1', name: 'Haircut', price: 300000, qty: 1, kind: 'service' }],
        },
        {
          id: 'tx_2',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'C', phone: '082', tier: null },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-01T11:00:00Z',
          items: [{ itemId: 's_1', name: 'Haircut', price: 100000, qty: 1, kind: 'service' }],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const distribution = getPaymentMethodDistribution(undefined, '2026-08');

      const qris = distribution.find((d) => d.method === 'QRIS');
      expect(qris?.transactionCount).toBe(1);
      expect(qris?.totalAmount).toBe(300000);
      expect(qris?.percentage).toBe(75); // 300k / 400k

      const cash = distribution.find((d) => d.method === 'Cash');
      expect(cash?.transactionCount).toBe(1);
      expect(cash?.totalAmount).toBe(100000);
      expect(cash?.percentage).toBe(25); // 100k / 400k
    });
  });
});
