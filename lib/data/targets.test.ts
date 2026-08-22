import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBranchTarget,
  getBranchTargets,
  getBranchTargetById,
  calculateBranchTargetProgress,
} from './targets';
import { recordAuditLog, getAuditLogs } from './audit';
import { StorageKeys, writeCollection } from './storage';
import type { Employee, Branch, Transaction, Customer } from './types';

const mockOwner: Employee = {
  id: 'emp_owner',
  name: 'Pak Hendra (Owner)',
  role: 'Owner',
  branchId: 'br_cirebon_bypass',
  pin: '123456',
};

const mockCashier: Employee = {
  id: 'emp_cashier',
  name: 'Siti Kasir',
  role: 'Kasir',
  branchId: 'br_cirebon_bypass',
  pin: '111111',
};

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

describe('Branch Targets & System Audit Log Module', () => {
  beforeEach(() => {
    writeCollection(StorageKeys.branches, mockBranches);
    writeCollection(StorageKeys.employees, [mockOwner, mockCashier]);
    writeCollection(StorageKeys.branchTargets, []);
    writeCollection(StorageKeys.auditLogs, []);
    writeCollection(StorageKeys.transactions, []);
    writeCollection(StorageKeys.customers, []);
  });

  describe('Branch Targets CRUD & RBAC', () => {
    it('allows Owner to set new branch target and automatically logs audit event', () => {
      const target = setBranchTarget(
        {
          branchId: 'br_cirebon_bypass',
          periodMonth: '2026-08',
          targetRevenue: 50000000,
          targetTransactions: 500,
          targetNewCustomers: 100,
          targetMembershipActivations: 30,
          notes: 'Target promosi kemerdekaan',
        },
        mockOwner,
      );

      expect(target.id).toBeDefined();
      expect(target.branchName).toBe('Redbox Bypass Cirebon');
      expect(target.targetRevenue).toBe(50000000);
      expect(target.targetTransactions).toBe(500);

      // Verify stored target
      const targets = getBranchTargets('br_cirebon_bypass', '2026-08');
      expect(targets).toHaveLength(1);
      expect(targets[0].targetRevenue).toBe(50000000);

      // Verify audit log generated
      const logs = getAuditLogs('br_cirebon_bypass', 'SET_BRANCH_TARGET');
      expect(logs).toHaveLength(1);
      expect(logs[0].actorName).toBe('Pak Hendra (Owner)');
      expect(logs[0].entityType).toBe('BranchTarget');
    });

    it('upserts existing target if already set for the same branch and period', () => {
      setBranchTarget(
        {
          branchId: 'br_cirebon_bypass',
          periodMonth: '2026-08',
          targetRevenue: 40000000,
          targetTransactions: 400,
          targetNewCustomers: 80,
          targetMembershipActivations: 20,
        },
        mockOwner,
      );

      const updated = setBranchTarget(
        {
          branchId: 'br_cirebon_bypass',
          periodMonth: '2026-08',
          targetRevenue: 60000000,
          targetTransactions: 600,
          targetNewCustomers: 120,
          targetMembershipActivations: 40,
          notes: 'Target direvisi naik',
        },
        mockOwner,
      );

      expect(updated.targetRevenue).toBe(60000000);
      const allTargets = getBranchTargets('br_cirebon_bypass', '2026-08');
      expect(allTargets).toHaveLength(1);
      expect(allTargets[0].notes).toBe('Target direvisi naik');
    });

    it('rejects target creation from non-Owner roles', () => {
      expect(() =>
        setBranchTarget(
          {
            branchId: 'br_cirebon_bypass',
            periodMonth: '2026-08',
            targetRevenue: 50000000,
            targetTransactions: 500,
            targetNewCustomers: 100,
            targetMembershipActivations: 30,
          },
          mockCashier,
        ),
      ).toThrow('Akses ditolak: hanya Owner');
    });

    it('rejects negative target values', () => {
      expect(() =>
        setBranchTarget(
          {
            branchId: 'br_cirebon_bypass',
            periodMonth: '2026-08',
            targetRevenue: -10000,
            targetTransactions: 500,
            targetNewCustomers: 100,
            targetMembershipActivations: 30,
          },
          mockOwner,
        ),
      ).toThrow('Target tidak boleh bernilai negatif.');
    });
  });

  describe('calculateBranchTargetProgress', () => {
    it('aggregates live transaction and customer data to compute target progress', () => {
      // Set explicit target
      setBranchTarget(
        {
          branchId: 'br_cirebon_bypass',
          periodMonth: '2026-08',
          targetRevenue: 1000000,
          targetTransactions: 10,
          targetNewCustomers: 4,
          targetMembershipActivations: 2,
        },
        mockOwner,
      );

      // Seed transactions
      // Seed transactions
      const mockTxs: Transaction[] = [
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_cashier',
          cashierName: 'Siti Kasir',
          customer: {
            type: 'guest',
            customerId: null,
            name: 'Budi',
            phone: '08123',
            tier: null,
          },
          subtotal: 500000,
          discount: 0,
          tax: 0,
          total: 500000,
          method: 'Cash',
          cashTendered: 500000,
          change: 0,
          timestamp: '2026-08-10T10:00:00Z',
          items: [
            {
              itemId: 'svc_haircut',
              name: 'Executive Haircut',
              price: 100000,
              qty: 1,
              kind: 'service',
            },
            {
              itemId: 'svc_membership_activation',
              name: 'Aktivasi Member',
              price: 100000,
              qty: 1,
              kind: 'service',
            },
          ],
        },
        {
          id: 'tx_2',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_cashier',
          cashierName: 'Siti Kasir',
          customer: {
            type: 'guest',
            customerId: null,
            name: 'Andi',
            phone: '08124',
            tier: null,
          },
          subtotal: 500000,
          discount: 0,
          tax: 0,
          total: 500000,
          method: 'QRIS',
          cashTendered: 500000,
          change: 0,
          timestamp: '2026-08-15T14:00:00Z',
          items: [
            {
              itemId: 'svc_haircut',
              name: 'Executive Haircut',
              price: 100000,
              qty: 1,
              kind: 'service',
            },
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
          name: 'Budi',
          phone: '08123',
          type: 'guest',
          tier: null,
          points: 0,
          createdAt: '2026-08-05T09:00:00Z',
        },
        {
          id: 'c_2',
          name: 'Andi',
          phone: '08124',
          type: 'guest',
          tier: null,
          points: 0,
          createdAt: '2026-08-12T11:00:00Z',
        },
      ];
      writeCollection(StorageKeys.customers, mockCusts);

      const progress = calculateBranchTargetProgress('br_cirebon_bypass', '2026-08');

      expect(progress.actualRevenue).toBe(1000000);
      expect(progress.revenuePercentage).toBe(100); // 1.000.000 / 1.000.000

      expect(progress.actualTransactions).toBe(2);
      expect(progress.transactionsPercentage).toBe(20); // 2 / 10

      expect(progress.actualNewCustomers).toBe(2);
      expect(progress.newCustomersPercentage).toBe(50); // 2 / 4

      expect(progress.actualMembershipActivations).toBe(2);
      expect(progress.membershipPercentage).toBe(100); // 2 / 2

      // Average: (100 + 20 + 50 + 100) / 4 = 67.5% -> at_risk
      expect(progress.overallPercentage).toBe(67.5);
      expect(progress.status).toBe('at_risk');
    });

    it('accurately categorizes status: achieved, on_track, at_risk, off_track', () => {
      // 1. Achieved (>= 100%)
      setBranchTarget(
        {
          branchId: 'br_cirebon_csb',
          periodMonth: '2026-08',
          targetRevenue: 100000,
          targetTransactions: 1,
          targetNewCustomers: 1,
          targetMembershipActivations: 1,
        },
        mockOwner,
      );

      const mockTx: Transaction = {
        id: 'tx_achieved',
        branchId: 'br_cirebon_csb',
        cashierId: 'emp_cashier',
        cashierName: 'Siti Kasir',
        customer: {
          type: 'guest',
          customerId: null,
          name: 'Budi',
          phone: '08123',
          tier: null,
        },
        subtotal: 100000,
        discount: 0,
        tax: 0,
        total: 100000,
        method: 'Cash',
        cashTendered: 100000,
        change: 0,
        timestamp: '2026-08-01T10:00:00Z',
        items: [
          {
            itemId: 'svc_membership_activation',
            name: 'Aktivasi Member',
            price: 100000,
            qty: 1,
            kind: 'service',
          },
        ],
      };
      writeCollection(StorageKeys.transactions, [mockTx]);
      writeCollection(StorageKeys.customers, [
        {
          id: 'c_1',
          name: 'Budi',
          phone: '08123',
          type: 'guest',
          tier: null,
          points: 0,
          createdAt: '2026-08-01T09:00:00Z',
        },
      ]);

      const achievedProgress = calculateBranchTargetProgress('br_cirebon_csb', '2026-08');
      expect(achievedProgress.overallPercentage).toBe(100);
      expect(achievedProgress.status).toBe('achieved');
    });
  });

  describe('System Audit Log', () => {
    it('creates append-only audit log records and supports multi-filter querying', () => {
      recordAuditLog({
        actor: mockOwner,
        branchId: 'br_cirebon_bypass',
        action: 'VOID_TRANSACTION',
        entityType: 'Transaction',
        entityId: 'TRX-12345',
        details: 'Otorisasi pembatalan transaksi kasir',
        metadata: { reason: 'Konsumen salah pilih menu' },
      });

      recordAuditLog({
        actor: mockOwner,
        branchId: 'br_cirebon_csb',
        action: 'APPROVE_PO',
        entityType: 'PurchaseOrder',
        entityId: 'PO-999',
        details: 'Menyetujui pesanan barang pomade',
      });

      const allLogs = getAuditLogs();
      expect(allLogs).toHaveLength(2);

      const bypassLogs = getAuditLogs('br_cirebon_bypass');
      expect(bypassLogs).toHaveLength(1);
      expect(bypassLogs[0].action).toBe('VOID_TRANSACTION');
      expect(bypassLogs[0].details).toBe('Otorisasi pembatalan transaksi kasir');
      expect(bypassLogs[0].metadata).toEqual({ reason: 'Konsumen salah pilih menu' });

      const poLogs = getAuditLogs(undefined, 'APPROVE_PO');
      expect(poLogs).toHaveLength(1);
      expect(poLogs[0].entityId).toBe('PO-999');
    });
  });
});
