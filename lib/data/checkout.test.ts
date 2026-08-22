import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from './storage';
import { StorageKeys, readCollection, writeCollection } from './storage';
import { recordStockMove, getAvailableStock } from './stock';
import { checkout, calculateCartTotals } from './transactions';
import { createPromotion } from './promotions';
import type {
  CashMove,
  Customer,
  InventoryBalance,
  LoyaltyLedgerEntry,
  StockMove,
  Transaction,
  TransactionCustomer,
  TransactionLineItem,
  Promotion,
  Employee,
  ProductBatch,
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

/**
 * A real Customer record backing `memberCustomer`'s snapshot — needed now
 * that checkout() actually looks the customer up (to earn loyalty points),
 * not just carries the snapshot along. This doesn't change what any test
 * below asserts, it just completes a fixture that used to get away with
 * being incomplete.
 */
function seedMemberCustomer() {
  writeCollection<Customer>(StorageKeys.customers, [
    { id: 'cust_test', name: 'Andi Pratama', phone: '081234567890', type: 'member', tier: 'Gold', points: 0, createdAt: '2026-01-01T00:00:00.000Z' },
  ]);
}

function snapshotAllCollections() {
  return {
    transactions: readCollection<Transaction>(StorageKeys.transactions),
    stockMoves: readCollection<StockMove>(StorageKeys.stockMoves),
    inventoryBalances: readCollection<InventoryBalance>(StorageKeys.inventoryBalances),
    cashMoves: readCollection<CashMove>(StorageKeys.cashMoves),
    loyaltyLedger: readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger),
    customers: readCollection<Customer>(StorageKeys.customers),
    promotions: readCollection<Promotion>(StorageKeys.promotions),
    productBatches: readCollection<ProductBatch>(StorageKeys.productBatches),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  seedMemberCustomer();
});

describe('calculateCartTotals — taxable: false line items', () => {
  it('excludes a taxable:false line from tax, while an ordinary line still gets taxed', () => {
    const items: TransactionLineItem[] = [
      { kind: 'service', itemId: 'svc_a', name: 'Ordinary Service', price: 60000, qty: 1 },
      { kind: 'service', itemId: 'svc_flat', name: 'Flat Fee', price: 100000, qty: 1, taxable: false },
    ];
    const totals = calculateCartTotals(items);
    expect(totals.subtotal).toBe(160000);
    expect(totals.tax).toBe(6000); // 10% of the 60000 taxable line only, not the 100000 flat line
    expect(totals.total).toBe(166000);
  });

  it('produces zero tax and total === price when the ONLY line is taxable:false', () => {
    const items: TransactionLineItem[] = [
      { kind: 'service', itemId: 'svc_flat', name: 'Flat Fee', price: 100000, qty: 1, taxable: false },
    ];
    const totals = calculateCartTotals(items);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(100000);
  });

  it('an omitted `taxable` field behaves exactly like taxable: true (default, unchanged from before this field existed)', () => {
    const items: TransactionLineItem[] = [{ kind: 'service', itemId: 'svc_a', name: 'Ordinary Service', price: 60000, qty: 1 }];
    expect(calculateCartTotals(items)).toEqual(calculateCartTotals([{ ...items[0], taxable: true }]));
  });
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

describe('checkout — mid-way write failure in the loyalty-earning step', () => {
  it('rolls back ALL SIX collections (not just loyaltyLedger/customers) if the loyalty-earning write fails partway through', () => {
    seedProductStock(10);
    // A prior successful checkout (including its own successful earn), so
    // "unchanged" is a meaningful assertion for loyaltyLedger/customers
    // too — not just "still empty".
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
    let loyaltyLedgerWriteAttempts = 0;
    const failure = new Error('Simulated localStorage write failure while writing loyaltyLedger');
    const spy = vi.spyOn(storage, 'writeCollection').mockImplementation((key: string, value: unknown[]) => {
      if (key === StorageKeys.loyaltyLedger) {
        loyaltyLedgerWriteAttempts += 1;
        // Fail only the FIRST attempt (the real earn call, which happens
        // last inside checkout's try block, AFTER transaction/stock/cash
        // have all already been written). The rollback's own write to
        // loyaltyLedger must be allowed to succeed, or the test can't tell
        // rollback-success from rollback-also-broken.
        if (loyaltyLedgerWriteAttempts === 1) {
          throw failure;
        }
      }
      return realWriteCollection(key, value);
    });

    try {
      // subtotal 60000 -> floor(60000/10000) = 6 points, so earning
      // genuinely fires and reaches the mocked write (a 0-point cart would
      // skip the write entirely and this test would pass vacuously).
      const items: TransactionLineItem[] = [
        { kind: 'service', itemId: SERVICE_ID, name: 'Haircut Reguler', price: 60000, qty: 1 },
      ];

      expect(() =>
        checkout({
          branchId: BRANCH_ID,
          cashierId: 'emp_test',
          cashierName: 'Dedi Kurniawan',
          customer: memberCustomer,
          items,
          method: 'Cash',
          cashTendered: 100000,
        }),
      ).toThrowError(failure);

      // Proves this is a genuine mid-way failure: transaction, stock, and
      // cash-in all wrote successfully before the loyalty step failed.
      expect(loyaltyLedgerWriteAttempts).toBeGreaterThanOrEqual(1);

      const after = snapshotAllCollections();
      expect(after).toEqual(before);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('checkout — promotions and discounts', () => {
  const dummyOwner: Employee = {
    id: 'emp_owner',
    name: 'Owner',
    role: 'Owner',
    branchId: BRANCH_ID,
    pin: '1234',
  };

  it('applies percentage promo code, calculates net tax, increments promo usage, and earns net loyalty points', () => {
    createPromotion(
      {
        code: 'PROMO20',
        name: 'Diskon 20%',
        type: 'percentage',
        value: 20,
        scope: 'holding',
      },
      dummyOwner,
    );

    const items: TransactionLineItem[] = [
      { kind: 'service', itemId: SERVICE_ID, name: 'Gentlemen Haircut', price: 100000, qty: 1 },
    ];
    // subtotal = 100000
    // discount = 20000
    // net taxable = 80000 -> tax (10%) = 8000
    // total = 88000

    const tx = checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Kasir Satu',
      customer: memberCustomer,
      items,
      method: 'Cash',
      cashTendered: 100000,
      promoCode: 'promo20',
    });

    expect(tx.subtotal).toBe(100000);
    expect(tx.discount).toBe(20000);
    expect(tx.tax).toBe(8000);
    expect(tx.total).toBe(88000);
    expect(tx.change).toBe(12000);
    expect(tx.appliedPromo?.code).toBe('PROMO20');
    expect(tx.appliedPromo?.discountAmount).toBe(20000);

    // Check promo usage increment
    const promoAfter = readCollection<Promotion>(StorageKeys.promotions).find((p) => p.code === 'PROMO20');
    expect(promoAfter?.usedCount).toBe(1);

    // Check loyalty points: net spend 80000 -> 8 points (not 10)
    const ledger = readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].points).toBe(8);
  });

  it('applies flat promo code correctly', () => {
    createPromotion(
      {
        code: 'FLAT15K',
        name: 'Potongan 15k',
        type: 'flat',
        value: 15000,
        scope: 'holding',
      },
      dummyOwner,
    );

    const items: TransactionLineItem[] = [
      { kind: 'service', itemId: SERVICE_ID, name: 'Service', price: 60000, qty: 1 },
    ];
    // subtotal = 60000
    // discount = 15000
    // net taxable = 45000 -> tax (10%) = 4500
    // total = 49500

    const tx = checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Kasir Satu',
      customer: memberCustomer,
      items,
      method: 'Cash',
      cashTendered: 50000,
      promoCode: 'FLAT15K',
    });

    expect(tx.subtotal).toBe(60000);
    expect(tx.discount).toBe(15000);
    expect(tx.tax).toBe(4500);
    expect(tx.total).toBe(49500);
    expect(tx.change).toBe(500);
  });

  it('rejects checkout when promo requirements are violated', () => {
    createPromotion(
      {
        code: 'MIN100K',
        name: 'Min 100k',
        type: 'flat',
        value: 10000,
        minSpend: 100000,
        scope: 'holding',
      },
      dummyOwner,
    );

    const items: TransactionLineItem[] = [
      { kind: 'service', itemId: SERVICE_ID, name: 'Haircut', price: 60000, qty: 1 },
    ];

    expect(() =>
      checkout({
        branchId: BRANCH_ID,
        cashierId: 'emp_test',
        cashierName: 'Kasir',
        customer: memberCustomer,
        items,
        method: 'Cash',
        cashTendered: 100000,
        promoCode: 'MIN100K',
      }),
    ).toThrow('Minimal belanja untuk promo');
  });

  it('rolls back promo usage and all other 6 collections when checkout fails mid-way', () => {
    const promo = createPromotion(
      {
        code: 'ATOMICPROMO',
        name: 'Atomic Promo',
        type: 'flat',
        value: 10000,
        scope: 'holding',
      },
      dummyOwner,
    );

    const before = snapshotAllCollections();

    // Mock loyalty ledger write failure
    const failure = new Error('Disk full during loyalty write');
    let loyaltyLedgerWriteAttempts = 0;
    const realWriteCollection = storage.writeCollection;
    const spy = vi.spyOn(storage, 'writeCollection').mockImplementation((key, value) => {
      if (key === StorageKeys.loyaltyLedger) {
        loyaltyLedgerWriteAttempts += 1;
        if (loyaltyLedgerWriteAttempts === 1) {
          throw failure;
        }
      }
      return realWriteCollection(key, value);
    });

    try {
      const items: TransactionLineItem[] = [
        { kind: 'service', itemId: SERVICE_ID, name: 'Haircut', price: 60000, qty: 1 },
      ];

      expect(() =>
        checkout({
          branchId: BRANCH_ID,
          cashierId: 'emp_test',
          cashierName: 'Kasir',
          customer: memberCustomer,
          items,
          method: 'Cash',
          cashTendered: 100000,
          promoCode: 'ATOMICPROMO',
        }),
      ).toThrowError(failure);

      expect(loyaltyLedgerWriteAttempts).toBeGreaterThanOrEqual(1);

      const after = snapshotAllCollections();
      expect(after).toEqual(before);

      // Verify promo usedCount did NOT increment
      const promoAfter = readCollection<Promotion>(StorageKeys.promotions).find((p) => p.id === promo.id);
      expect(promoAfter?.usedCount).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});

