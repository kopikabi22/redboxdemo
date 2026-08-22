import { beforeEach, describe, expect, it } from 'vitest';
import { recordStockMove, getAvailableStock } from './stock';

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
