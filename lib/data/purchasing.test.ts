import { describe, it, expect, beforeEach } from 'vitest';
import { StorageKeys, writeCollection, readCollection } from './storage';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from './purchasing';
import { getProductBatches } from './batches';
import { getAvailableStock } from './stock';
import type { Branch, Employee, Product } from './types';

describe('Purchasing & Supplier Management Data Layer', () => {
  const mockBranch: Branch = {
    id: 'br_bypass',
    name: 'Bypass Cirebon',
    city: 'Cirebon',
    province: 'Jawa Barat',
    address: 'Jl. Bypass No. 10',
    phone: '0231-11111',
  };

  const mockOtherBranch: Branch = {
    id: 'br_samadikun',
    name: 'Samadikun Cirebon',
    city: 'Cirebon',
    province: 'Jawa Barat',
    address: 'Jl. Samadikun No. 20',
    phone: '0231-22222',
  };

  const mockProduct: Product = {
    id: 'prd_pomade_oil',
    name: 'Oilbased Pomade Heavy',
    sku: 'POM-OIL-01',
    category: 'Hair Styling',
    brand: 'RedBox Classic',
    cost: 45000,
    price: 85000,
    lowStockThreshold: 5,
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

  const mockOtherBranchManager: Employee = {
    id: 'emp_bm_other',
    name: 'Rudi BM',
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
    writeCollection(StorageKeys.branches, [mockBranch, mockOtherBranch]);
    writeCollection(StorageKeys.employees, [mockOwner, mockBranchManager, mockOtherBranchManager, mockKasir]);
    writeCollection(StorageKeys.products, [mockProduct]);
    writeCollection(StorageKeys.suppliers, []);
    writeCollection(StorageKeys.purchaseOrders, []);
    writeCollection(StorageKeys.productBatches, []);
    writeCollection(StorageKeys.inventoryBalances, []);
    writeCollection(StorageKeys.stockMoves, []);
  });

  describe('Master Supplier CRUD', () => {
    it('creates, updates, and deletes a supplier by authorized staff', () => {
      const supplier = createSupplier(
        {
          name: 'PT Pomade Jaya Makmur',
          contactPerson: 'Budi Santoso',
          phone: '081234567890',
          email: 'order@pomadejaya.com',
          address: 'Jl. Industri No. 45, Bandung',
          paymentTerms: 'Net 30',
          notes: 'Supplier resmi styling pomade',
        },
        mockOwner,
      );

      expect(supplier.id).toMatch(/^sup_/);
      expect(supplier.name).toBe('PT Pomade Jaya Makmur');
      expect(supplier.isActive).toBe(true);

      const all = getSuppliers();
      expect(all).toHaveLength(1);

      // Update
      const updated = updateSupplier(
        supplier.id,
        { paymentTerms: 'Net 14', phone: '081299998888' },
        mockBranchManager,
      );
      expect(updated.paymentTerms).toBe('Net 14');
      expect(updated.phone).toBe('081299998888');

      // Delete
      deleteSupplier(supplier.id, mockOwner);
      expect(getSupplierById(supplier.id)).toBeUndefined();
    });

    it('rejects supplier management from unauthorized roles (Kasir/Barber)', () => {
      expect(() =>
        createSupplier(
          {
            name: 'Supplier Ilegal',
            contactPerson: 'Anon',
            phone: '081111',
            address: 'Jl. Rahasia',
            paymentTerms: 'COD',
          },
          mockKasir,
        ),
      ).toThrow('Akses ditolak');
    });
  });

  describe('Purchase Order Lifecycle & Approvals', () => {
    let testSupplierId: string;

    beforeEach(() => {
      const supplier = createSupplier(
        {
          name: 'CV Barber Supply Indo',
          contactPerson: 'Hendra',
          phone: '081333444555',
          address: 'Jakarta Barat',
          paymentTerms: 'Net 14',
        },
        mockOwner,
      );
      testSupplierId = supplier.id;
    });

    it('creates a draft PO, submits it, and approves it', () => {
      const po = createPurchaseOrder(
        {
          branchId: 'br_bypass',
          supplierId: testSupplierId,
          items: [{ productId: mockProduct.id, qtyOrdered: 20, unitCost: 45000 }],
          notes: 'Restock bulanan cabang Bypass',
        },
        mockBranchManager,
      );

      expect(po.id).toMatch(/^po_/);
      expect(po.status).toBe('draft');
      expect(po.subtotal).toBe(900000);
      expect(po.totalAmount).toBe(900000);

      // Submit PO
      const submitted = submitPurchaseOrder(po.id, mockBranchManager);
      expect(submitted.status).toBe('submitted');

      // Approve PO
      const approved = approvePurchaseOrder(po.id, mockOwner);
      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(mockOwner.id);
      expect(approved.approvedByName).toBe(mockOwner.name);
      expect(approved.approvedAt).toBeDefined();
    });

    it('rejects PO creation for cross-branch when user lacks permission', () => {
      expect(() =>
        createPurchaseOrder(
          {
            branchId: 'br_bypass',
            supplierId: testSupplierId,
            items: [{ productId: mockProduct.id, qtyOrdered: 10, unitCost: 45000 }],
          },
          mockOtherBranchManager,
        ),
      ).toThrow('Tidak punya akses ke cabang ini.');
    });

    it('rejects PO approval from unauthorized role (Kasir)', () => {
      const po = createPurchaseOrder(
        {
          branchId: 'br_bypass',
          supplierId: testSupplierId,
          items: [{ productId: mockProduct.id, qtyOrdered: 10, unitCost: 45000 }],
          submitNow: true,
        },
        mockBranchManager,
      );

      expect(() => approvePurchaseOrder(po.id, mockKasir)).toThrow('Akses ditolak');
    });

    it('cancels a PO with a valid reason', () => {
      const po = createPurchaseOrder(
        {
          branchId: 'br_bypass',
          supplierId: testSupplierId,
          items: [{ productId: mockProduct.id, qtyOrdered: 10, unitCost: 45000 }],
          submitNow: true,
        },
        mockBranchManager,
      );

      const cancelled = cancelPurchaseOrder(po.id, 'Supplier kehabisan stok item', mockBranchManager);
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellationReason).toBe('Supplier kehabisan stok item');
    });
  });

  describe('Receiving PO & FEFO / Inventory Integration', () => {
    it('receives an approved PO, registers ProductBatch FEFO, and updates stock balance automatically', () => {
      const supplier = createSupplier(
        {
          name: 'PT Distributor Utama',
          contactPerson: 'Agus',
          phone: '081222333444',
          address: 'Cirebon',
          paymentTerms: 'COD',
        },
        mockOwner,
      );

      const po = createPurchaseOrder(
        {
          branchId: 'br_bypass',
          supplierId: supplier.id,
          items: [{ productId: mockProduct.id, qtyOrdered: 25, unitCost: 45000 }],
          submitNow: true,
        },
        mockBranchManager,
      );

      approvePurchaseOrder(po.id, mockOwner);

      // Initially, stock is 0
      expect(getAvailableStock(mockProduct.id, 'br_bypass')).toBe(0);

      // Perform receiving
      const received = receivePurchaseOrder(
        po.id,
        [
          {
            itemId: po.items[0].id,
            qtyReceived: 25,
            batchNumber: 'LOT-SUP-2026-08',
            expiryDate: '2027-12-31',
          },
        ],
        mockBranchManager,
      );

      expect(received.status).toBe('received');
      expect(received.receivedBy).toBe(mockBranchManager.id);
      expect(received.items[0].qtyReceived).toBe(25);
      expect(received.items[0].batchNumber).toBe('LOT-SUP-2026-08');

      // Check automatically created ProductBatch
      const batches = getProductBatches();
      expect(batches).toHaveLength(1);
      expect(batches[0].batchNumber).toBe('LOT-SUP-2026-08');
      expect(batches[0].expiryDate).toBe('2027-12-31');
      expect(batches[0].initialQty).toBe(25);
      expect(batches[0].remainingQty).toBe(25);

      // Check stock balance is now 25
      expect(getAvailableStock(mockProduct.id, 'br_bypass')).toBe(25);
    });

    it('rejects receiving on a PO that is not yet Approved', () => {
      const supplier = createSupplier(
        {
          name: 'Supplier X',
          contactPerson: 'X',
          phone: '081999',
          address: 'Alamat',
          paymentTerms: 'COD',
        },
        mockOwner,
      );

      const po = createPurchaseOrder(
        {
          branchId: 'br_bypass',
          supplierId: supplier.id,
          items: [{ productId: mockProduct.id, qtyOrdered: 10, unitCost: 45000 }],
          submitNow: false, // draft
        },
        mockBranchManager,
      );

      expect(() =>
        receivePurchaseOrder(
          po.id,
          [{ itemId: po.items[0].id, qtyReceived: 10, batchNumber: 'LOT-X', expiryDate: '2027-01-01' }],
          mockBranchManager,
        ),
      ).toThrow('wajib Approved');
    });
  });
});
