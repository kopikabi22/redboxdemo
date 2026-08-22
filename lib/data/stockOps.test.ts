import { describe, it, expect, beforeEach } from 'vitest';
import { StorageKeys, writeCollection, readCollection } from './storage';
import {
  getStockOpnames,
  getStockOpnameById,
  createStockOpname,
  completeStockOpname,
  cancelStockOpname,
  getStockTransfers,
  getStockTransferById,
  createStockTransfer,
  dispatchStockTransfer,
  receiveStockTransfer,
  cancelStockTransfer,
} from './stockOps';
import { getAvailableStock, recordStockMove } from './stock';
import { createProductBatch, getProductBatches, getBatchesByProductAndBranch } from './batches';
import type { Branch, Employee, Product, StockMove } from './types';

describe('Stock Opname & Inter-Branch Transfer Data Layer', () => {
  const mockBranchA: Branch = {
    id: 'br_bypass',
    name: 'Bypass Cirebon',
    city: 'Cirebon',
    province: 'Jawa Barat',
    address: 'Jl. Bypass No. 10',
    phone: '0231-11111',
  };

  const mockBranchB: Branch = {
    id: 'br_samadikun',
    name: 'Samadikun Cirebon',
    city: 'Cirebon',
    province: 'Jawa Barat',
    address: 'Jl. Samadikun No. 20',
    phone: '0231-22222',
  };

  const mockProduct: Product = {
    id: 'prd_shampoo_menthol',
    name: 'Menthol Refresh Shampoo',
    sku: 'SHP-MNT-01',
    category: 'Hair Care',
    brand: 'RedBox Care',
    cost: 30000,
    price: 60000,
    lowStockThreshold: 5,
  };

  const mockOwner: Employee = {
    id: 'emp_owner',
    name: 'Bpk. Herman',
    role: 'Owner',
    branchId: 'br_bypass',
    pin: '9999',
  };

  const mockBranchManagerA: Employee = {
    id: 'emp_bm_a',
    name: 'Yusuf BM Bypass',
    role: 'BranchManager',
    branchId: 'br_bypass',
    pin: '1234',
  };

  const mockBranchManagerB: Employee = {
    id: 'emp_bm_b',
    name: 'Rudi BM Samadikun',
    role: 'BranchManager',
    branchId: 'br_samadikun',
    pin: '5678',
  };

  const mockKasir: Employee = {
    id: 'emp_kasir',
    name: 'Kasir Sari',
    role: 'Kasir',
    branchId: 'br_bypass',
    pin: '1111',
  };

  beforeEach(() => {
    window.localStorage.clear();
    writeCollection(StorageKeys.branches, [mockBranchA, mockBranchB]);
    writeCollection(StorageKeys.employees, [mockOwner, mockBranchManagerA, mockBranchManagerB, mockKasir]);
    writeCollection(StorageKeys.products, [mockProduct]);
    writeCollection(StorageKeys.inventoryBalances, []);
    writeCollection(StorageKeys.stockMoves, []);
    writeCollection(StorageKeys.productBatches, []);
    writeCollection(StorageKeys.stockOpnames, []);
    writeCollection(StorageKeys.stockTransfers, []);
  });

  describe('Stock Opname Flow', () => {
    it('creates draft opname, calculates variance, completes opname and updates InventoryBalance', () => {
      // Seed initial stock of 20 at Bypass
      recordStockMove({
        productId: mockProduct.id,
        branchId: mockBranchA.id,
        type: 'in',
        qty: 20,
        reference: 'INITIAL_SEED',
        actorId: mockOwner.id,
      });

      expect(getAvailableStock(mockProduct.id, mockBranchA.id)).toBe(20);

      // Create Opname with physical count 18 (variance -2)
      const opname = createStockOpname(
        {
          branchId: mockBranchA.id,
          items: [{ productId: mockProduct.id, physicalQty: 18, notes: '2 botol bocor saat display' }],
          notes: 'Opname rutin bulanan',
        },
        mockBranchManagerA,
      );

      expect(opname.id).toMatch(/^opn_/);
      expect(opname.status).toBe('draft');
      expect(opname.items[0].systemQty).toBe(20);
      expect(opname.items[0].physicalQty).toBe(18);
      expect(opname.items[0].variance).toBe(-2);
      expect(opname.totalVarianceItems).toBe(1);
      expect(opname.totalVarianceQty).toBe(-2);

      // Complete Opname
      const completed = completeStockOpname(opname.id, mockBranchManagerA);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();

      // Check Inventory Balance is updated to 18
      expect(getAvailableStock(mockProduct.id, mockBranchA.id)).toBe(18);

      // Check StockMove recorded
      const moves = readCollection<StockMove>(StorageKeys.stockMoves);
      const opnameMove = moves.find((m) => m.type === 'opname_set');
      expect(opnameMove).toBeDefined();
      expect(opnameMove?.qty).toBe(18);
      expect(opnameMove?.reference).toBe(opname.opnameNumber);
    });

    it('cancels a draft opname and rejects cancellation of completed opname', () => {
      const opname = createStockOpname(
        {
          branchId: mockBranchA.id,
          items: [{ productId: mockProduct.id, physicalQty: 10 }],
        },
        mockBranchManagerA,
      );

      const cancelled = cancelStockOpname(opname.id, 'Data hitungan keliru', mockBranchManagerA);
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellationReason).toBe('Data hitungan keliru');

      // Re-create and complete another opname
      const opname2 = createStockOpname(
        {
          branchId: mockBranchA.id,
          items: [{ productId: mockProduct.id, physicalQty: 10 }],
        },
        mockBranchManagerA,
      );
      completeStockOpname(opname2.id, mockBranchManagerA);

      expect(() => cancelStockOpname(opname2.id, 'Coba batalkan', mockBranchManagerA)).toThrow(
        'sudah completed',
      );
    });

    it('rejects opname creation from unauthorized roles (Kasir)', () => {
      expect(() =>
        createStockOpname(
          {
            branchId: mockBranchA.id,
            items: [{ productId: mockProduct.id, physicalQty: 5 }],
          },
          mockKasir,
        ),
      ).toThrow('Akses ditolak');
    });
  });

  describe('Inter-Branch Stock Transfer Flow', () => {
    beforeEach(() => {
      // Seed 30 items in Branch A with FEFO Batch
      createProductBatch(
        {
          productId: mockProduct.id,
          branchId: mockBranchA.id,
          batchNumber: 'LOT-SHP-2026-01',
          expiryDate: '2027-06-30',
          initialQty: 30,
          cost: mockProduct.cost,
          notes: 'Batch awal',
        },
        mockOwner,
      );
    });

    it('transfers stock from Branch A to Branch B (create -> dispatch -> receive)', () => {
      expect(getAvailableStock(mockProduct.id, mockBranchA.id)).toBe(30);
      expect(getAvailableStock(mockProduct.id, mockBranchB.id)).toBe(0);

      // 1. Create Transfer Draft
      const transfer = createStockTransfer(
        {
          sourceBranchId: mockBranchA.id,
          targetBranchId: mockBranchB.id,
          items: [{ productId: mockProduct.id, qty: 10 }],
          notes: 'Bantuan stok Samadikun',
        },
        mockBranchManagerA,
      );

      expect(transfer.id).toMatch(/^trf_/);
      expect(transfer.status).toBe('draft');
      expect(transfer.totalQty).toBe(10);
      expect(transfer.totalValue).toBe(300000);

      // 2. Dispatch (In-Transit)
      const inTransit = dispatchStockTransfer(transfer.id, mockBranchManagerA);
      expect(inTransit.status).toBe('in_transit');
      expect(inTransit.dispatchedBy).toBe(mockBranchManagerA.id);
      expect(inTransit.items[0].deductedBatches).toHaveLength(1);
      expect(inTransit.items[0].deductedBatches?.[0].batchNumber).toBe('LOT-SHP-2026-01');

      // Stock at Branch A should now be 20, Branch B still 0
      expect(getAvailableStock(mockProduct.id, mockBranchA.id)).toBe(20);
      expect(getAvailableStock(mockProduct.id, mockBranchB.id)).toBe(0);

      // 3. Receive at Destination Branch B
      const received = receiveStockTransfer(transfer.id, mockBranchManagerB);
      expect(received.status).toBe('received');
      expect(received.receivedBy).toBe(mockBranchManagerB.id);

      // Stock at Branch B is now 10
      expect(getAvailableStock(mockProduct.id, mockBranchB.id)).toBe(10);

      // Check Batch in Branch B
      const batchesBranchB = getBatchesByProductAndBranch(mockProduct.id, mockBranchB.id);
      expect(batchesBranchB).toHaveLength(1);
      expect(batchesBranchB[0].batchNumber).toBe('LOT-SHP-2026-01');
      expect(batchesBranchB[0].remainingQty).toBe(10);
      expect(batchesBranchB[0].expiryDate).toBe('2027-06-30');
    });

    it('cancels an in-transit transfer and restores stock/batch to source branch', () => {
      const transfer = createStockTransfer(
        {
          sourceBranchId: mockBranchA.id,
          targetBranchId: mockBranchB.id,
          items: [{ productId: mockProduct.id, qty: 15 }],
        },
        mockBranchManagerA,
      );

      dispatchStockTransfer(transfer.id, mockBranchManagerA);
      expect(getAvailableStock(mockProduct.id, mockBranchA.id)).toBe(15);

      // Cancel while in_transit
      const cancelled = cancelStockTransfer(
        transfer.id,
        'Driver kecelakaan/batal kirim',
        mockBranchManagerA,
      );

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellationReason).toBe('Driver kecelakaan/batal kirim');

      // Stock at Branch A should be restored back to 30
      expect(getAvailableStock(mockProduct.id, mockBranchA.id)).toBe(30);

      // Batch remainingQty in Branch A restored to 30
      const batches = getBatchesByProductAndBranch(mockProduct.id, mockBranchA.id);
      expect(batches[0].remainingQty).toBe(30);
    });

    it('rejects transfer when source and target branches are identical or stock is insufficient', () => {
      expect(() =>
        createStockTransfer(
          {
            sourceBranchId: mockBranchA.id,
            targetBranchId: mockBranchA.id,
            items: [{ productId: mockProduct.id, qty: 5 }],
          },
          mockBranchManagerA,
        ),
      ).toThrow('tidak boleh sama');

      expect(() =>
        createStockTransfer(
          {
            sourceBranchId: mockBranchA.id,
            targetBranchId: mockBranchB.id,
            items: [{ productId: mockProduct.id, qty: 999 }],
          },
          mockBranchManagerA,
        ),
      ).toThrow('tidak mencukupi');
    });

    it('rejects branch manager from creating transfer for unauthorized source branch', () => {
      expect(() =>
        createStockTransfer(
          {
            sourceBranchId: mockBranchB.id,
            targetBranchId: mockBranchA.id,
            items: [{ productId: mockProduct.id, qty: 5 }],
          },
          mockBranchManagerA, // BM of Branch A cannot dispatch from Branch B
        ),
      ).toThrow('Tidak punya akses');
    });
  });
});
