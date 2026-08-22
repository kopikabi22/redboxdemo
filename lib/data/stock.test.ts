import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from './storage';
import { StorageKeys, readCollection } from './storage';
import { recordStockMove, getAvailableStock } from './stock';
import type { InventoryBalance, StockMove } from './types';

const PRODUCT_ID = 'prd_test';
const BRANCH_ID = 'br_test';

beforeEach(() => {
  window.localStorage.clear();
});

describe('recordStockMove — type "in"', () => {
  it('adds to a balance starting from 0', () => {
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'in', qty: 10, reference: 'TEST', actorId: 'system' });
    expect(getAvailableStock(PRODUCT_ID, BRANCH_ID)).toBe(10);
  });

  it('adds on top of an existing balance', () => {
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'in', qty: 10, reference: 'TEST', actorId: 'system' });
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'in', qty: 5, reference: 'TEST', actorId: 'system' });
    expect(getAvailableStock(PRODUCT_ID, BRANCH_ID)).toBe(15);
  });
});

describe('recordStockMove — type "opname_set"', () => {
  it('overwrites the balance to the given quantity, unlike "in" which adds', () => {
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'in', qty: 10, reference: 'TEST', actorId: 'system' });
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'opname_set', qty: 3, reference: 'OPNAME', actorId: 'system' });
    // If this behaved like "in" the balance would be 13, not 3.
    expect(getAvailableStock(PRODUCT_ID, BRANCH_ID)).toBe(3);
  });

  it('can set a higher balance than what was there before (also an overwrite, not an add)', () => {
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'in', qty: 2, reference: 'TEST', actorId: 'system' });
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'opname_set', qty: 50, reference: 'OPNAME', actorId: 'system' });
    expect(getAvailableStock(PRODUCT_ID, BRANCH_ID)).toBe(50);
  });
});

describe('recordStockMove — balance never goes negative', () => {
  it('clamps to 0 when "out" qty exceeds the current balance', () => {
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'in', qty: 5, reference: 'TEST', actorId: 'system' });
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'out', qty: 999, reference: 'TEST', actorId: 'system' });
    expect(getAvailableStock(PRODUCT_ID, BRANCH_ID)).toBe(0);
  });

  it('clamps to 0 rather than going negative when starting balance is already 0', () => {
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'out', qty: 7, reference: 'TEST', actorId: 'system' });
    expect(getAvailableStock(PRODUCT_ID, BRANCH_ID)).toBe(0);
  });
});

describe('recordStockMove — internal rollback', () => {
  it('rolls back the already-written stockMoves entry if the inventoryBalances write fails, and rethrows', () => {
    recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'in', qty: 10, reference: 'PRIOR', actorId: 'system' });

    const movesBefore = readCollection<StockMove>(StorageKeys.stockMoves);
    const balancesBefore = readCollection<InventoryBalance>(StorageKeys.inventoryBalances);

    const realWriteCollection = storage.writeCollection;
    let balancesWriteAttempts = 0;
    const failure = new Error('Simulated localStorage write failure while writing inventoryBalances');
    const spy = vi.spyOn(storage, 'writeCollection').mockImplementation((key: string, value: unknown[]) => {
      if (key === StorageKeys.inventoryBalances) {
        balancesWriteAttempts += 1;
        // Fail only the first attempt (the real balance update inside this
        // call). The rollback's own write to inventoryBalances must be
        // allowed to succeed, or the test can't tell rollback-success from
        // rollback-also-broken.
        if (balancesWriteAttempts === 1) {
          throw failure;
        }
      }
      return realWriteCollection(key, value);
    });

    try {
      expect(() =>
        recordStockMove({ productId: PRODUCT_ID, branchId: BRANCH_ID, type: 'in', qty: 5, reference: 'FAILING', actorId: 'system' }),
      ).toThrowError(failure);

      // The stockMoves write (step 1) DID succeed before the simulated
      // failure — proving this is a genuine mid-way failure.
      expect(balancesWriteAttempts).toBeGreaterThanOrEqual(1);

      // The ledger entry from the failed call must NOT be left dangling —
      // stockMoves is rolled back too, not just inventoryBalances.
      const movesAfter = readCollection<StockMove>(StorageKeys.stockMoves);
      const balancesAfter = readCollection<InventoryBalance>(StorageKeys.inventoryBalances);
      expect(movesAfter).toEqual(movesBefore);
      expect(balancesAfter).toEqual(balancesBefore);
      expect(getAvailableStock(PRODUCT_ID, BRANCH_ID)).toBe(10);
    } finally {
      spy.mockRestore();
    }
  });
});
