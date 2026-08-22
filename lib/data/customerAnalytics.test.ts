import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateCustomerRFM,
  getCustomerRFMProfiles,
  getCustomerIntelligenceSummary,
} from './customerAnalytics';
import { StorageKeys, writeCollection, todayDateString } from './storage';
import type { Customer, Transaction } from './types';

describe('Customer Intelligence & RFM Segmentation Module', () => {
  const todayStr = todayDateString();

  beforeEach(() => {
    writeCollection(StorageKeys.customers, []);
    writeCollection(StorageKeys.transactions, []);
  });

  describe('calculateCustomerRFM', () => {
    it('classifies a high-value active customer as Champions with barber & service affinity', () => {
      const customer: Customer = {
        id: 'cust_vip',
        name: 'Budi Santoso',
        phone: '081234567890',
        type: 'member',
        tier: 'Gold',
        points: 500,
        createdAt: '2026-01-01T00:00:00Z',
      };

      // 8 transactions, total 900.000, last visit 5 days ago
      const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const olderDate1 = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
      const olderDate2 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

      const txs: Transaction[] = [
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'member', customerId: 'cust_vip', name: 'Budi', phone: '081234567890', tier: 'Gold' },
          subtotal: 300000,
          discount: 0,
          tax: 0,
          total: 300000,
          method: 'Cash',
          cashTendered: 300000,
          change: 0,
          timestamp: olderDate2,
          items: [{ itemId: 's_1', name: 'Executive Haircut', price: 100000, qty: 1, kind: 'service', barberName: 'Ahmad Barber' }],
        },
        {
          id: 'tx_2',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'member', customerId: 'cust_vip', name: 'Budi', phone: '081234567890', tier: 'Gold' },
          subtotal: 300000,
          discount: 0,
          tax: 0,
          total: 300000,
          method: 'QRIS',
          cashTendered: 300000,
          change: 0,
          timestamp: olderDate1,
          items: [{ itemId: 's_1', name: 'Executive Haircut', price: 100000, qty: 1, kind: 'service', barberName: 'Ahmad Barber' }],
        },
        {
          id: 'tx_3',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'member', customerId: 'cust_vip', name: 'Budi', phone: '081234567890', tier: 'Gold' },
          subtotal: 300000,
          discount: 0,
          tax: 0,
          total: 300000,
          method: 'QRIS',
          cashTendered: 300000,
          change: 0,
          timestamp: recentDate,
          items: [
            { itemId: 's_1', name: 'Executive Haircut', price: 100000, qty: 1, kind: 'service', barberName: 'Ahmad Barber' },
            { itemId: 's_2', name: 'Beard Trim', price: 50000, qty: 1, kind: 'service', barberName: 'Ahmad Barber' },
          ],
        },
      ];

      const profile = calculateCustomerRFM(customer, txs);

      expect(profile.customerId).toBe('cust_vip');
      expect(profile.frequency).toBe(3);
      expect(profile.monetary).toBe(900000);
      expect(profile.rScore).toBe(5); // <= 14 days
      expect(profile.mScore).toBe(5); // >= 800.000
      expect(profile.favoriteBarberName).toBe('Ahmad Barber');
      expect(profile.favoriteServiceName).toBe('Executive Haircut');
      expect(profile.isOverdue).toBe(false);
    });

    it('classifies a customer with no recent visits (>65 days) as At Risk', () => {
      const customer: Customer = {
        id: 'cust_atrisk',
        name: 'Dedi Sutrisno',
        phone: '081299990000',
        type: 'member',
        tier: 'Bronze',
        points: 50,
        createdAt: '2026-01-01T00:00:00Z',
      };

      const pastDate1 = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
      const pastDate2 = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString();

      const txs: Transaction[] = [
        {
          id: 'tx_old1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'member', customerId: 'cust_atrisk', name: 'Dedi', phone: '081299990000', tier: 'Bronze' },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: pastDate1,
          items: [{ itemId: 's_1', name: 'Haircut', price: 100000, qty: 1, kind: 'service' }],
        },
        {
          id: 'tx_old2',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'member', customerId: 'cust_atrisk', name: 'Dedi', phone: '081299990000', tier: 'Bronze' },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: pastDate2,
          items: [{ itemId: 's_1', name: 'Haircut', price: 100000, qty: 1, kind: 'service' }],
        },
      ];

      const profile = calculateCustomerRFM(customer, txs);

      expect(profile.rScore).toBe(2); // 61-90 days
      expect(profile.frequency).toBe(2);
      expect(profile.segment).toBe('at_risk');
      expect(profile.isOverdue).toBe(true);
    });

    it('classifies a customer with last visit >90 days as Hibernating', () => {
      const customer: Customer = {
        id: 'cust_lost',
        name: 'Hendro',
        phone: '081288887777',
        type: 'guest',
        tier: null,
        points: 0,
        createdAt: '2025-01-01T00:00:00Z',
      };

      const pastDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

      const txs: Transaction[] = [
        {
          id: 'tx_lost',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: 'cust_lost', name: 'Hendro', phone: '081288887777', tier: null },
          subtotal: 80000,
          discount: 0,
          tax: 0,
          total: 80000,
          method: 'Cash',
          cashTendered: 80000,
          change: 0,
          timestamp: pastDate,
          items: [{ itemId: 's_1', name: 'Haircut', price: 80000, qty: 1, kind: 'service' }],
        },
      ];

      const profile = calculateCustomerRFM(customer, txs);

      expect(profile.rScore).toBe(1); // >90 days
      expect(profile.segment).toBe('hibernating');
      expect(profile.isOverdue).toBe(true);
    });
  });

  describe('getCustomerRFMProfiles & getCustomerIntelligenceSummary', () => {
    it('aggregates all profiles, supports segment filtering, and calculates intelligence summary', () => {
      const customers: Customer[] = [
        {
          id: 'c_1',
          name: 'Budi (VIP)',
          phone: '0811',
          type: 'member',
          tier: 'Platinum',
          points: 1000,
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'c_2',
          name: 'Andi (At Risk)',
          phone: '0812',
          type: 'member',
          tier: 'Bronze',
          points: 50,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];
      writeCollection(StorageKeys.customers, customers);

      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const pastDate = new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString();

      const txs: Transaction[] = [
        // Budi: 5 visits, 1.000.000 spend, recent
        {
          id: 'tx_b1',
          branchId: 'br_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'member', customerId: 'c_1', name: 'Budi', phone: '0811', tier: 'Platinum' },
          subtotal: 1000000,
          discount: 0,
          tax: 0,
          total: 1000000,
          method: 'Cash',
          cashTendered: 1000000,
          change: 0,
          timestamp: recentDate,
          items: [{ itemId: 's_1', name: 'Executive Haircut', price: 1000000, qty: 1, kind: 'service' }],
        },
        // Andi: 2 visits, 150.000 spend, past 80 days
        {
          id: 'tx_a1',
          branchId: 'br_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'member', customerId: 'c_2', name: 'Andi', phone: '0812', tier: 'Bronze' },
          subtotal: 75000,
          discount: 0,
          tax: 0,
          total: 75000,
          method: 'Cash',
          cashTendered: 75000,
          change: 0,
          timestamp: pastDate,
          items: [{ itemId: 's_1', name: 'Haircut', price: 75000, qty: 1, kind: 'service' }],
        },
        {
          id: 'tx_a2',
          branchId: 'br_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'member', customerId: 'c_2', name: 'Andi', phone: '0812', tier: 'Bronze' },
          subtotal: 75000,
          discount: 0,
          tax: 0,
          total: 75000,
          method: 'Cash',
          cashTendered: 75000,
          change: 0,
          timestamp: pastDate,
          items: [{ itemId: 's_1', name: 'Haircut', price: 75000, qty: 1, kind: 'service' }],
        },
      ];
      writeCollection(StorageKeys.transactions, txs);

      const allProfiles = getCustomerRFMProfiles();
      expect(allProfiles).toHaveLength(2);
      expect(allProfiles[0].customerId).toBe('c_1'); // 1.000.000 spend (ranked 1st)

      // Filter by segment 'at_risk'
      const atRiskProfiles = getCustomerRFMProfiles(undefined, 'at_risk');
      expect(atRiskProfiles).toHaveLength(1);
      expect(atRiskProfiles[0].customerId).toBe('c_2');

      // Intelligence Summary
      const summary = getCustomerIntelligenceSummary();
      expect(summary.totalAnalyzedCustomers).toBe(2);
      expect(summary.atRiskCustomerCount).toBe(1);
      expect(summary.segments).toHaveLength(6);

      const atRiskSegment = summary.segments.find((s) => s.segment === 'at_risk');
      expect(atRiskSegment?.customerCount).toBe(1);
      expect(atRiskSegment?.percentage).toBe(50);
      expect(atRiskSegment?.totalRevenue).toBe(150000);
      expect(atRiskSegment?.recommendedAction).toContain('WhatsApp');
    });
  });
});
