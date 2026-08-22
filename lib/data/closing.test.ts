import { beforeEach, describe, expect, it } from 'vitest';
import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { getExpectedTotals, createCashierClosing } from './closing';
import type { ActualByMethod } from './closing';
import type { CashierClosing, Employee, PaymentMethod, Transaction, TransactionCustomer } from './types';

const BRANCH_A = 'br_a';
const BRANCH_B = 'br_b';
const CASHIER_ID = 'emp_kasir';
const OTHER_CASHIER_ID = 'emp_kasir_other';
const PIN = '1234';

function seedEmployees() {
  writeCollection<Employee>(StorageKeys.employees, [
    { id: CASHIER_ID, name: 'Test Kasir', role: 'Kasir', branchId: BRANCH_A, pin: PIN },
    { id: OTHER_CASHIER_ID, name: 'Other Kasir', role: 'Kasir', branchId: BRANCH_B, pin: '9999' },
  ]);
}

const guestCustomer: TransactionCustomer = { type: 'guest', customerId: null, name: 'Guest', phone: '080000000', tier: null };

function makeTransaction(overrides: Partial<Transaction> & { method: PaymentMethod; total: number }): Transaction {
  return {
    id: generateId('trx'),
    branchId: BRANCH_A,
    cashierId: CASHIER_ID,
    cashierName: 'Test Kasir',
    customer: guestCustomer,
    items: [],
    subtotal: overrides.total,
    discount: 0,
    tax: 0,
    cashTendered: overrides.total,
    change: 0,
    timestamp: nowIso(),
    ...overrides,
  };
}

function seedTransactions(transactions: Transaction[]) {
  const existing = readCollection<Transaction>(StorageKeys.transactions);
  writeCollection(StorageKeys.transactions, [...existing, ...transactions]);
}

function fullActuals(overrides: ActualByMethod = {}): Required<ActualByMethod> {
  return { Cash: 0, QRIS: 0, Debit: 0, Transfer: 0, 'E-Wallet': 0, ...overrides };
}

beforeEach(() => {
  window.localStorage.clear();
  seedEmployees();
});

describe('getExpectedTotals (computeExpectedBreakdown)', () => {
  it('breaks expected down accurately per payment method, not just a combined total', () => {
    seedTransactions([
      makeTransaction({ method: 'Cash', total: 60000 }),
      makeTransaction({ method: 'Cash', total: 40000 }),
      makeTransaction({ method: 'QRIS', total: 25000 }),
      makeTransaction({ method: 'Debit', total: 100000 }),
    ]);

    const result = getExpectedTotals(CASHIER_ID, BRANCH_A);
    const byMethod = Object.fromEntries(result.breakdown.map((row) => [row.method, row.expected]));

    expect(byMethod.Cash).toBe(100000);
    expect(byMethod.QRIS).toBe(25000);
    expect(byMethod.Debit).toBe(100000);
    expect(byMethod.Transfer).toBe(0);
    expect(byMethod['E-Wallet']).toBe(0);
    expect(result.totalExpected).toBe(225000);
  });

  it('does not count another cashier\'s or another branch\'s transactions', () => {
    seedTransactions([
      makeTransaction({ method: 'Cash', total: 50000, branchId: BRANCH_A, cashierId: CASHIER_ID }),
      makeTransaction({ method: 'Cash', total: 999999, branchId: BRANCH_B, cashierId: OTHER_CASHIER_ID }),
    ]);
    const result = getExpectedTotals(CASHIER_ID, BRANCH_A);
    expect(result.totalExpected).toBe(50000);
  });
});

describe('createCashierClosing — anti double-counting', () => {
  it('the second closing only covers transactions made AFTER the first closing, not a re-count of everything', () => {
    seedTransactions([
      makeTransaction({ method: 'Cash', total: 60000 }),
      makeTransaction({ method: 'QRIS', total: 45000 }),
      makeTransaction({ method: 'Cash', total: 30000 }),
    ]);
    // First closing: expected = 90000 Cash + 45000 QRIS = 135000
    const first = createCashierClosing(CASHIER_ID, {
      pin: PIN,
      actualByMethod: fullActuals({ Cash: 90000, QRIS: 45000 }),
    });
    expect(first.totalExpected).toBe(135000);

    // A 4th transaction happens AFTER the first closing.
    seedTransactions([makeTransaction({ method: 'Cash', total: 15000 })]);

    const second = createCashierClosing(CASHIER_ID, {
      pin: PIN,
      actualByMethod: fullActuals({ Cash: 15000 }),
    });

    // Must reflect ONLY the 4th transaction — not 90000+15000=105000, just 15000.
    const secondCash = second.breakdown.find((row) => row.method === 'Cash');
    expect(secondCash?.expected).toBe(15000);
    expect(second.totalExpected).toBe(15000);
    expect(second.periodStart).toBe(first.periodEnd);
  });
});

describe('createCashierClosing — PIN validation', () => {
  it('throws on wrong PIN and writes nothing', () => {
    seedTransactions([makeTransaction({ method: 'Cash', total: 50000 })]);
    const before = readCollection<CashierClosing>(StorageKeys.cashierClosings);

    expect(() =>
      createCashierClosing(CASHIER_ID, { pin: '0000', actualByMethod: fullActuals({ Cash: 50000 }) }),
    ).toThrowError('PIN salah.');

    expect(readCollection<CashierClosing>(StorageKeys.cashierClosings)).toEqual(before);
  });
});

describe('createCashierClosing — actual validation', () => {
  it('throws when a method\'s actual is negative, and writes nothing', () => {
    seedTransactions([makeTransaction({ method: 'Cash', total: 50000 })]);
    const before = readCollection<CashierClosing>(StorageKeys.cashierClosings);

    expect(() =>
      createCashierClosing(CASHIER_ID, { pin: PIN, actualByMethod: fullActuals({ Cash: -1 }) }),
    ).toThrowError(/tidak boleh negatif/);

    expect(readCollection<CashierClosing>(StorageKeys.cashierClosings)).toEqual(before);
  });

  it('throws when a method is missing from actualByMethod entirely, and writes nothing', () => {
    const before = readCollection<CashierClosing>(StorageKeys.cashierClosings);
    const incomplete: ActualByMethod = { Cash: 0, QRIS: 0, Debit: 0, Transfer: 0 }; // 'E-Wallet' missing

    expect(() => createCashierClosing(CASHIER_ID, { pin: PIN, actualByMethod: incomplete })).toThrowError(
      /E-Wallet wajib diisi/,
    );
    expect(readCollection<CashierClosing>(StorageKeys.cashierClosings)).toEqual(before);
  });
});

describe('createCashierClosing — variance calculation', () => {
  it('computes variance as actual - expected, including the negative case (actual < expected)', () => {
    seedTransactions([makeTransaction({ method: 'Cash', total: 100000 }), makeTransaction({ method: 'QRIS', total: 50000 })]);

    const closing = createCashierClosing(CASHIER_ID, {
      pin: PIN,
      actualByMethod: fullActuals({ Cash: 95000, QRIS: 50000 }), // Cash short by 5000
    });

    const cashRow = closing.breakdown.find((row) => row.method === 'Cash');
    const qrisRow = closing.breakdown.find((row) => row.method === 'QRIS');
    expect(cashRow?.variance).toBe(-5000);
    expect(qrisRow?.variance).toBe(0);
    expect(closing.totalVariance).toBe(-5000);
  });
});

describe('createCashierClosing — branchId comes from employee master', () => {
  it('the stored branchId matches the cashier\'s master record, not a caller-supplied value (there is no branchId parameter at all)', () => {
    const closing = createCashierClosing(CASHIER_ID, { pin: PIN, actualByMethod: fullActuals() });
    expect(closing.branchId).toBe(BRANCH_A);
  });
});
