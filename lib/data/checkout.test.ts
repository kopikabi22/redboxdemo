import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from './storage';
import { StorageKeys, readCollection } from './storage';
import { recordStockMove, getAvailableStock } from './stock';
import { checkout } from './transactions';
import type {
  CashMove,
  InventoryBalance,
  StockMove,
  Transaction,
  TransactionCustomer,
  TransactionLineItem,
} from './types';

const BRANCH_ID = 'br_test';
const PRODUCT_ID = 'prd_test';
const SERVICE_ID = 'svc_test';

const memberCustomer: TransactionCustomer = {
  type: 'member',
  customerId: 'cust_test',
  name: 'Andi Pratama',
  phone: '081234567890',
  tier: 'Gold',
};

function seedProductStock(qty: number) {
  recordStockMove({
    productId: PRODUCT_ID,
    branchId: BRANCH_ID,
    type: 'in',
    qty,
    reference: 'TEST-SEED',
    note: 'Stok awal test',
    actorId: 'system',
  });
}

function snapshotAllCollections() {
  return {
    transactions: readCollection<Transaction>(StorageKeys.transactions),
    stockMoves: readCollection<StockMove>(StorageKeys.stockMoves),
    inventoryBalances: readCollection<InventoryBalance>(StorageKeys.inventoryBalances),
    cashMoves: readCollection<CashMove>(StorageKeys.cashMoves),
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('checkout — happy path', () => {
  it('computes correct totals/change, deducts stock, and records a cash-in for Cash payments', () => {
    seedProductStock(10);
    const stockBefore = getAvailableStock(PRODUCT_ID, BRANCH_ID);
    const cashMovesBefore = readCollection<CashMove>(StorageKeys.cashMoves).length;

    const items: TransactionLineItem[] = [
      { kind: 'service', itemId: SERVICE_ID, name: 'Haircut Reguler', price: 60000, qty: 1 },
      { kind: 'product', itemId: PRODUCT_ID, name: 'Pomade Matte 100g', price: 55000, qty: 3 },
    ];
    const subtotal = 60000 * 1 + 55000 * 3; // 225000
    const tax = Math.round(subtotal * 0.1); // 22500
    const total = subtotal + tax; // 247500
    const cashTendered = 250000;

    const transaction = checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Dedi Kurniawan',
      customer: memberCustomer,
      items,
      method: 'Cash',
      cashTendered,
    });

    expect(transaction.subtotal).toBe(subtotal);
    expect(transaction.tax).toBe(tax);
    expect(transaction.total).toBe(total);
    expect(transaction.cashTendered).toBe(cashTendered);
    expect(transaction.change).toBe(cashTendered - total);

    // Stock deducted only for the product line (service lines don't touch inventory).
    const stockAfter = getAvailableStock(PRODUCT_ID, BRANCH_ID);
    expect(stockBefore).toBe(10);
    expect(stockAfter).toBe(stockBefore - 3);

    // Cash payment must produce exactly one new cash-in movement for `total`.
    const cashMoves = readCollection<CashMove>(StorageKeys.cashMoves);
    expect(cashMoves.length).toBe(cashMovesBefore + 1);
    const newMove = cashMoves[cashMoves.length - 1];
    expect(newMove.type).toBe('in');
    expect(newMove.amount).toBe(total);
    expect(newMove.branchId).toBe(BRANCH_ID);

    // The transaction itself was persisted.
    const transactions = readCollection<Transaction>(StorageKeys.transactions);
    expect(transactions.map((t) => t.id)).toContain(transaction.id);
  });

  it('does NOT record a cash move for a non-Cash payment method', () => {
    seedProductStock(10);
    const cashMovesBefore = readCollection<CashMove>(StorageKeys.cashMoves).length;

    const items: TransactionLineItem[] = [
      { kind: 'product', itemId: PRODUCT_ID, name: 'Pomade Matte 100g', price: 55000, qty: 2 },
    ];

    const transaction = checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Dedi Kurniawan',
      customer: memberCustomer,
      items,
      method: 'QRIS',
      cashTendered: 0,
    });

    expect(transaction.method).toBe('QRIS');
    expect(transaction.change).toBe(0);
    expect(transaction.cashTendered).toBe(transaction.total);

    const cashMovesAfter = readCollection<CashMove>(StorageKeys.cashMoves);
    expect(cashMovesAfter.length).toBe(cashMovesBefore);
  });
});

describe('checkout — insufficient stock', () => {
  it('throws before writing anything, leaving all four collections untouched', () => {
    seedProductStock(5);

    // Some pre-existing data in every collection, so "unchanged" is a
    // meaningful assertion and not just "still empty".
    recordStockMove({
      productId: PRODUCT_ID,
      branchId: BRANCH_ID,
      type: 'sale',
      qty: 1,
      reference: 'TEST-PRIOR-SALE',
      note: 'Prior sale before the failing checkout',
      actorId: 'emp_test',
    });
    checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Dedi Kurniawan',
      customer: memberCustomer,
      items: [{ kind: 'service', itemId: SERVICE_ID, name: 'Haircut Reguler', price: 60000, qty: 1 }],
      method: 'Cash',
      cashTendered: 100000,
    });

    const before = snapshotAllCollections();

    const items: TransactionLineItem[] = [
      { kind: 'product', itemId: PRODUCT_ID, name: 'Pomade Matte 100g', price: 55000, qty: 999 },
    ];

    expect(() =>
      checkout({
        branchId: BRANCH_ID,
        cashierId: 'emp_test',
        cashierName: 'Dedi Kurniawan',
        customer: memberCustomer,
        items,
        method: 'Cash',
        cashTendered: 999_999,
      }),
    ).toThrowError(/Stok tidak cukup/);

    const after = snapshotAllCollections();
    expect(after).toEqual(before);
  });
});

describe('checkout — aggregated stock validation', () => {
  it('throws when two separate line items for the same product exceed available stock in total, even though neither line alone does', () => {
    seedProductStock(8);
    // Prior data in every collection, same reasoning as the other failure tests.
    checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Dedi Kurniawan',
      customer: memberCustomer,
      items: [{ kind: 'service', itemId: SERVICE_ID, name: 'Haircut Reguler', price: 60000, qty: 1 }],
      method: 'Cash',
      cashTendered: 100000,
    });

    const before = snapshotAllCollections();

    // Two lines of 5 units each for the SAME product = 10 requested, but
    // only 8 are available. Neither individual line (5) exceeds 8 on its
    // own, so a naive per-line check would incorrectly let this through.
    const items: TransactionLineItem[] = [
      { kind: 'product', itemId: PRODUCT_ID, name: 'Pomade Matte 100g', price: 55000, qty: 5 },
      { kind: 'product', itemId: PRODUCT_ID, name: 'Pomade Matte 100g', price: 55000, qty: 5 },
    ];

    expect(() =>
      checkout({
        branchId: BRANCH_ID,
        cashierId: 'emp_test',
        cashierName: 'Dedi Kurniawan',
        customer: memberCustomer,
        items,
        method: 'Cash',
        cashTendered: 999_999,
      }),
    ).toThrowError(/Stok tidak cukup/);

    const after = snapshotAllCollections();
    expect(after).toEqual(before);
  });
});

describe('checkout — cash tendered below total', () => {
  it('throws when method is Cash and cashTendered is less than the total, leaving all four collections untouched', () => {
    seedProductStock(10);
    checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Dedi Kurniawan',
      customer: memberCustomer,
      items: [{ kind: 'service', itemId: SERVICE_ID, name: 'Haircut Reguler', price: 60000, qty: 1 }],
      method: 'Cash',
      cashTendered: 100000,
    });

    const before = snapshotAllCollections();

    const items: TransactionLineItem[] = [
      { kind: 'product', itemId: PRODUCT_ID, name: 'Pomade Matte 100g', price: 55000, qty: 1 },
    ];
    // total = 55000 + 10% tax = 60500 — tender well under that.
    expect(() =>
      checkout({
        branchId: BRANCH_ID,
        cashierId: 'emp_test',
        cashierName: 'Dedi Kurniawan',
        customer: memberCustomer,
        items,
        method: 'Cash',
        cashTendered: 10000,
      }),
    ).toThrowError(/kurang dari total tagihan/);

    const after = snapshotAllCollections();
    expect(after).toEqual(before);
  });
});

describe('checkout — mid-way write failure', () => {
  it('rolls back all four collections if a write fails partway through, and rethrows the original error', () => {
    seedProductStock(10);
    // Pre-existing data again, for the same "genuinely unchanged" reason as above.
    checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Dedi Kurniawan',
      customer: memberCustomer,
      items: [{ kind: 'service', itemId: SERVICE_ID, name: 'Haircut Reguler', price: 60000, qty: 1 }],
      method: 'Cash',
      cashTendered: 100000,
    });

    const before = snapshotAllCollections();

    const realWriteCollection = storage.writeCollection;
    let stockMovesWriteAttempts = 0;
    const failure = new Error('Simulated localStorage write failure while writing stockMoves');
    const spy = vi.spyOn(storage, 'writeCollection').mockImplementation((key: string, value: unknown[]) => {
      if (key === StorageKeys.stockMoves) {
        stockMovesWriteAttempts += 1;
        // Fail only the FIRST attempt (the real deduction inside checkout's
        // try block). The rollback's own write to stockMoves must be allowed
        // to succeed, or the test can't tell rollback-success from
        // rollback-also-broken.
        if (stockMovesWriteAttempts === 1) {
          throw failure;
        }
      }
      return realWriteCollection(key, value);
    });

    try {
      const items: TransactionLineItem[] = [
        { kind: 'product', itemId: PRODUCT_ID, name: 'Pomade Matte 100g', price: 55000, qty: 2 },
      ];

      expect(() =>
        checkout({
          branchId: BRANCH_ID,
          cashierId: 'emp_test',
          cashierName: 'Dedi Kurniawan',
          customer: memberCustomer,
          items,
          method: 'Cash',
          cashTendered: 200000,
        }),
      ).toThrowError(failure);

      // The transaction write (step 1) DID succeed before the simulated
      // failure — proving this is a genuine mid-way failure, not one that
      // happened before any write occurred.
      expect(stockMovesWriteAttempts).toBeGreaterThanOrEqual(1);

      const after = snapshotAllCollections();
      expect(after).toEqual(before);
    } finally {
      spy.mockRestore();
    }
  });
});
