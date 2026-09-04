import { describe, it, expect, beforeEach } from 'vitest';
import { StorageKeys, writeCollection, readCollection } from './storage';
import {
  getProductBatches,
  getBatchById,
  getBatchesByProductAndBranch,
  getNearExpiryBatches,
  getExpiredBatches,
  evaluateExpiryStatus,
  createProductBatch,
  updateProductBatch,
  deleteProductBatch,
  deductStockFEFO,
  restoreBatchDeductions,
} from './batches';
import { checkout } from './transactions';
import { getAvailableStock } from './stock';
import type { Employee, ProductBatch, TransactionCustomer } from './types';

describe('Expiry Management & FEFO Data Layer', () => {
  const BRANCH_ID = 'br_bypass';
  const PRODUCT_ID = 'prd_pomade';

  const mockManager: Employee = {
    id: 'emp_bm',
    name: 'Yusuf BM',
    role: 'BranchManager',
    branchId: 'br_bypass',
    pin: '1234',
  };

  const mockOtherManager: Employee = {
    id: 'emp_bm_other',
    name: 'Rudi BM',
    role: 'BranchManager',
    branchId: 'br_samadikun',
    pin: '5678',
  };

  const mockCustomer: TransactionCustomer = {
    type: 'member',
    customerId: 'cust_budi',
    name: 'Budi Santoso',
    phone: '081234567890',
    tier: 'Silver',
  };

  beforeEach(() => {
    window.localStorage.clear();
    writeCollection(StorageKeys.productBatches, []);
    writeCollection(StorageKeys.inventoryBalances, []);
    writeCollection(StorageKeys.stockMoves, []);
    writeCollection(StorageKeys.transactions, []);
    writeCollection(StorageKeys.customers, [
      { id: 'cust_budi', name: 'Budi Santoso', phone: '081234567890', type: 'member', tier: 'Silver', points: 0, createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });

  describe('Expiry Status Evaluation', () => {
    it('correctly evaluates safe, near_expiry, and expired dates', () => {
      // Past date -> expired
      expect(evaluateExpiryStatus('2025-01-01')).toBe('expired');

      // Future date far away -> safe
      expect(evaluateExpiryStatus('2027-12-31', 30)).toBe('safe');

      // Date within 15 days from now -> near_expiry
      const nearDate = new Date();
      nearDate.setDate(nearDate.getDate() + 15);
      const nearStr = nearDate.toISOString().split('T')[0];
      expect(evaluateExpiryStatus(nearStr, 30)).toBe('near_expiry');
    });
  });

  describe('CRUD Batch Operations', () => {
    it('creates a batch, updates inventory balance, and records stock move', () => {
      const batch = createProductBatch(
        {
          productId: PRODUCT_ID,
          branchId: BRANCH_ID,
          batchNumber: 'LOT-2026-001',
          expiryDate: '2027-06-30',
          initialQty: 20,
          cost: 45000,
          notes: 'Penerimaan kiriman supplier PT Pomade Jaya',
        },
        mockManager,
      );

      expect(batch.id).toMatch(/^bat_/);
      expect(batch.batchNumber).toBe('LOT-2026-001');
      expect(batch.initialQty).toBe(20);
      expect(batch.remainingQty).toBe(20);
      expect(getAvailableStock(PRODUCT_ID, BRANCH_ID)).toBe(20);

      const all = getProductBatches();
      expect(all).toHaveLength(1);
    });

    it('enforces RBAC when creating batch in a different branch', () => {
      expect(() =>
        createProductBatch(
          {
            productId: PRODUCT_ID,
            branchId: BRANCH_ID,
            batchNumber: 'LOT-FAIL',
            expiryDate: '2027-06-30',
            initialQty: 10,
            cost: 40000,
          },
          mockOtherManager,
        ),
      ).toThrow('Tidak punya akses ke cabang ini.');
    });

    it('updates and deletes a batch', () => {
      const batch = createProductBatch(
        {
          productId: PRODUCT_ID,
          branchId: BRANCH_ID,
          batchNumber: 'LOT-EDIT',
          expiryDate: '2027-06-30',
          initialQty: 10,
          cost: 40000,
        },
        mockManager,
      );

      const updated = updateProductBatch(
        batch.id,
        { batchNumber: 'LOT-EDITED', notes: 'Catatan revisi' },
        mockManager,
      );
      expect(updated.batchNumber).toBe('LOT-EDITED');
      expect(updated.notes).toBe('Catatan revisi');

      deleteProductBatch(batch.id, mockManager);
      expect(getBatchById(batch.id)).toBeUndefined();
    });
  });

  describe('FEFO (First-Expired, First-Out) Deduction Logic', () => {
    it('deducts stock from the earliest expiring batch first (single batch)', () => {
      // Batch 1: Expire 2026-10-01 (Qty: 10)
      createProductBatch(
        { productId: PRODUCT_ID, branchId: BRANCH_ID, batchNumber: 'BATCH-EARLY', expiryDate: '2026-10-01', initialQty: 10, cost: 40000 },
        mockManager,
      );
      // Batch 2: Expire 2027-05-01 (Qty: 15)
      createProductBatch(
        { productId: PRODUCT_ID, branchId: BRANCH_ID, batchNumber: 'BATCH-LATER', expiryDate: '2027-05-01', initialQty: 15, cost: 40000 },
        mockManager,
      );

      // Deduct 4 units
      const result = deductStockFEFO(PRODUCT_ID, BRANCH_ID, 4);
      expect(result.totalDeducted).toBe(4);
      expect(result.deductedBatches).toHaveLength(1);
      expect(result.deductedBatches[0].batchNumber).toBe('BATCH-EARLY');
      expect(result.deductedBatches[0].qty).toBe(4);

      const batches = getBatchesByProductAndBranch(PRODUCT_ID, BRANCH_ID, true);
      const early = batches.find((b) => b.batchNumber === 'BATCH-EARLY');
      const later = batches.find((b) => b.batchNumber === 'BATCH-LATER');

      expect(early?.remainingQty).toBe(6);
      expect(later?.remainingQty).toBe(15);
    });

    it('splits deduction across multiple batches when first batch is depleted', () => {
      // Batch 1: Expire 2026-09-15 (Qty: 3)
      createProductBatch(
        { productId: PRODUCT_ID, branchId: BRANCH_ID, batchNumber: 'BATCH-A', expiryDate: '2026-09-15', initialQty: 3, cost: 40000 },
        mockManager,
      );
      // Batch 2: Expire 2026-11-20 (Qty: 10)
      createProductBatch(
        { productId: PRODUCT_ID, branchId: BRANCH_ID, batchNumber: 'BATCH-B', expiryDate: '2026-11-20', initialQty: 10, cost: 40000 },
        mockManager,
      );

      // Deduct 7 units (should take all 3 from BATCH-A, and 4 from BATCH-B)
      const result = deductStockFEFO(PRODUCT_ID, BRANCH_ID, 7);
      expect(result.totalDeducted).toBe(7);
      expect(result.deductedBatches).toHaveLength(2);
      expect(result.deductedBatches[0].batchNumber).toBe('BATCH-A');
      expect(result.deductedBatches[0].qty).toBe(3);
      expect(result.deductedBatches[1].batchNumber).toBe('BATCH-B');
      expect(result.deductedBatches[1].qty).toBe(4);

      const batches = getBatchesByProductAndBranch(PRODUCT_ID, BRANCH_ID, true);
      const batchA = batches.find((b) => b.batchNumber === 'BATCH-A');
      const batchB = batches.find((b) => b.batchNumber === 'BATCH-B');

      expect(batchA?.remainingQty).toBe(0);
      expect(batchB?.remainingQty).toBe(6);
    });

    it('refuses to deduct from expired batches and throws error if non-expired stock is insufficient', () => {
      // Expired batch: Expire 2025-01-01 (Qty: 10)
      const expiredBatch: ProductBatch = {
        id: 'bat_expired',
        productId: PRODUCT_ID,
        branchId: BRANCH_ID,
        batchNumber: 'BATCH-EXPIRED',
        expiryDate: '2025-01-01',
        initialQty: 10,
        remainingQty: 10,
        receivedDate: '2024-12-01',
        cost: 40000,
        createdAt: '2024-12-01T00:00:00.000Z',
        updatedAt: '2024-12-01T00:00:00.000Z',
      };
      // Active batch: Expire 2027-01-01 (Qty: 2)
      const activeBatch: ProductBatch = {
        id: 'bat_active',
        productId: PRODUCT_ID,
        branchId: BRANCH_ID,
        batchNumber: 'BATCH-ACTIVE',
        expiryDate: '2027-01-01',
        initialQty: 2,
        remainingQty: 2,
        receivedDate: '2026-08-01',
        cost: 40000,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      };

      writeCollection(StorageKeys.productBatches, [expiredBatch, activeBatch]);

      // Requesting 5 units when only 2 non-expired units exist -> Throws error
      expect(() => deductStockFEFO(PRODUCT_ID, BRANCH_ID, 5)).toThrow(
        /Stok batch produk tidak mencukupi atau batch yang tersedia telah kadaluarsa/,
      );

      // Expired queries
      const expiredList = getExpiredBatches(BRANCH_ID);
      expect(expiredList).toHaveLength(1);
      expect(expiredList[0].batchNumber).toBe('BATCH-EXPIRED');
    });

    it('restores batch deductions correctly via restoreBatchDeductions helper', () => {
      createProductBatch(
        { productId: PRODUCT_ID, branchId: BRANCH_ID, batchNumber: 'BATCH-RESTORE', expiryDate: '2027-01-01', initialQty: 10, cost: 40000 },
        mockManager,
      );

      const result = deductStockFEFO(PRODUCT_ID, BRANCH_ID, 6);
      expect(getBatchById(result.deductedBatches[0].batchId)?.remainingQty).toBe(4);

      restoreBatchDeductions(result.deductedBatches);
      expect(getBatchById(result.deductedBatches[0].batchId)?.remainingQty).toBe(10);
    });
  });

  describe('Integration with POS Checkout', () => {
    it('deducts batch stock via FEFO upon successful checkout', () => {
      createProductBatch(
        { productId: PRODUCT_ID, branchId: BRANCH_ID, batchNumber: 'BATCH-POS-1', expiryDate: '2027-09-01', initialQty: 5, cost: 40000 },
        mockManager,
      );
      createProductBatch(
        { productId: PRODUCT_ID, branchId: BRANCH_ID, batchNumber: 'BATCH-POS-2', expiryDate: '2027-12-01', initialQty: 10, cost: 40000 },
        mockManager,
      );

      const trx = checkout({
        branchId: BRANCH_ID,
        cashierId: 'emp_bm',
        cashierName: 'Yusuf BM',
        customer: mockCustomer,
        items: [
          { kind: 'product', itemId: PRODUCT_ID, name: 'Pomade Styling', price: 75000, qty: 7 },
        ],
        method: 'QRIS',
        cashTendered: 0,
      });

      expect(trx.id).toBeDefined();

      const batches = getBatchesByProductAndBranch(PRODUCT_ID, BRANCH_ID, true);
      const batch1 = batches.find((b) => b.batchNumber === 'BATCH-POS-1');
      const batch2 = batches.find((b) => b.batchNumber === 'BATCH-POS-2');

      // 7 units purchased -> 5 from batch1 (depleted) and 2 from batch2 (8 remaining)
      expect(batch1?.remainingQty).toBe(0);
      expect(batch2?.remainingQty).toBe(8);
    });
  });
});
