import { beforeEach, describe, expect, it } from 'vitest';
import { StorageKeys, readCollection, writeCollection } from './storage';
import {
  activateMembership,
  MembershipActivationError,
  MEMBERSHIP_ACTIVATION_SERVICE_ID,
  getMembershipActivationFee,
} from './membershipActivation';
import { getLoyaltyLedger } from './membership';
import type { CashMove, Customer, LoyaltyLedgerEntry, Service, Transaction } from './types';

const BRANCH_ID = 'br_test';
const DEFAULT_FEE = 100000;

/**
 * Mirrors the real seed.ts record (same id) but lets each test control the
 * price directly — this is how the "not hardcoded, reads the catalog"
 * property below gets proven: change the seeded price, prove the charged
 * amount follows it.
 */
function seedActivationService(price = DEFAULT_FEE): Service {
  const service: Service = {
    id: MEMBERSHIP_ACTIVATION_SERVICE_ID,
    name: 'Aktivasi Member',
    category: 'Membership',
    durationMinutes: 5,
    price,
    commissionPercent: 0,
  };
  writeCollection<Service>(StorageKeys.services, [service]);
  return service;
}

function seedReferrer(overrides: Partial<Customer> = {}): Customer {
  const referrer: Customer = {
    id: 'cust_referrer',
    name: 'Andi Pratama',
    phone: '081234567890',
    type: 'member',
    tier: 'Gold',
    points: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  writeCollection<Customer>(StorageKeys.customers, [referrer]);
  return referrer;
}

beforeEach(() => {
  window.localStorage.clear();
  seedActivationService();
});

describe('getMembershipActivationFee — reads the catalog, not a constant', () => {
  it('returns the CURRENT seeded price', () => {
    expect(getMembershipActivationFee()).toBe(DEFAULT_FEE);
  });

  it('reflects a price change immediately (Owner/HQ edits Product & Service Master, no code change needed)', () => {
    seedActivationService(150000);
    expect(getMembershipActivationFee()).toBe(150000);
  });

  it('returns null when the seed service is missing (e.g. deleted from the catalog)', () => {
    writeCollection<Service>(StorageKeys.services, []);
    expect(getMembershipActivationFee()).toBeNull();
  });
});

describe('activateMembership — happy path', () => {
  it('collects the activation fee as a guest transaction, then creates a Bronze member with 0 points and no referral bonus', () => {
    const result = activateMembership({
      branchId: BRANCH_ID,
      cashierId: 'emp_kasir',
      cashierName: 'Dedi Kurniawan',
      name: 'Budi Santoso',
      phone: '081200002222',
      method: 'Cash',
      cashTendered: 200000,
    });

    expect(result.transaction.subtotal).toBe(DEFAULT_FEE);
    // Flat fee per CLAUDE.md — no 10% tax on top, unlike an ordinary service/product line.
    expect(result.transaction.tax).toBe(0);
    expect(result.transaction.total).toBe(DEFAULT_FEE);
    expect(result.transaction.customer.type).toBe('guest');
    expect(result.customer.type).toBe('member');
    expect(result.customer.tier).toBe('Bronze');
    expect(result.customer.points).toBe(0);

    // Guest-type activation transaction must earn ZERO points — no ledger
    // entry at all, same invariant proven for checkout() directly.
    expect(readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger)).toHaveLength(0);
  });

  it('charges whatever price is CURRENTLY in the catalog, not a fixed Rp100.000 — proves the fee is not hardcoded', () => {
    seedActivationService(150000);

    const result = activateMembership({
      branchId: BRANCH_ID,
      cashierId: 'emp_kasir',
      cashierName: 'Dedi Kurniawan',
      name: 'Budi Santoso',
      phone: '081200002222',
      method: 'Cash',
      cashTendered: 200000,
    });

    expect(result.transaction.subtotal).toBe(150000);
    expect(result.transaction.total).toBe(150000);
  });

  it('credits both sides 10 points via recordReferralBonus when a referrerId is supplied', () => {
    seedReferrer({ points: 5 });

    const result = activateMembership({
      branchId: BRANCH_ID,
      cashierId: 'emp_kasir',
      cashierName: 'Dedi Kurniawan',
      name: 'Budi Santoso',
      phone: '081200002222',
      method: 'Cash',
      cashTendered: 200000,
      referrerId: 'cust_referrer',
    });

    const customers = readCollection<Customer>(StorageKeys.customers);
    expect(customers.find((c) => c.id === 'cust_referrer')?.points).toBe(15);
    expect(customers.find((c) => c.id === result.customer.id)?.points).toBe(10);
    expect(getLoyaltyLedger('cust_referrer')).toHaveLength(1);
    expect(getLoyaltyLedger(result.customer.id)).toHaveLength(1);
  });
});

describe('activateMembership — missing catalog service (nothing charged)', () => {
  it('throws a PLAIN Error (not MembershipActivationError) and writes NO transaction at all when the service is missing', () => {
    writeCollection<Service>(StorageKeys.services, []);

    let caught: unknown;
    try {
      activateMembership({
        branchId: BRANCH_ID,
        cashierId: 'emp_kasir',
        cashierName: 'Dedi Kurniawan',
        name: 'Budi Santoso',
        phone: '081200002222',
        method: 'Cash',
        cashTendered: 200000,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(MembershipActivationError);
    expect((caught as Error).message).toBe('Service Aktivasi Member tidak ditemukan di katalog. Hubungi Owner/HQ untuk mengatur ulang.');

    // Nothing was ever charged — checkout() never ran.
    expect(readCollection<Transaction>(StorageKeys.transactions)).toHaveLength(0);
    expect(readCollection<CashMove>(StorageKeys.cashMoves)).toHaveLength(0);
  });
});

describe('activateMembership — no rollback of an already-collected payment', () => {
  it('throws MembershipActivationError carrying the EXACT committed transaction when createCustomer() fails, and leaves checkout()\'s own writes (transaction + cash-in) exactly as checkout() left them', () => {
    let caught: unknown;
    try {
      activateMembership({
        branchId: BRANCH_ID,
        cashierId: 'emp_kasir',
        cashierName: 'Dedi Kurniawan',
        name: '   ', // blank after trim -> createCustomer() throws
        phone: '081200002222',
        method: 'Cash',
        cashTendered: 200000,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(MembershipActivationError);
    const activationError = caught as MembershipActivationError;
    expect(activationError.message).toBe('Nama customer wajib diisi.');
    expect(activationError.committedTransaction.subtotal).toBe(DEFAULT_FEE);

    // Not just "a transaction with a matching id" — the FULL committed
    // transaction object, byte-for-byte, is exactly what's in storage.
    // This is the proof that activateMembership() does NOT roll back
    // checkout()'s writes: it returns/throws with the SAME transaction that
    // checkout() already persisted, not a snapshot-reverted one.
    const transactions = readCollection<Transaction>(StorageKeys.transactions);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual(activationError.committedTransaction);

    // checkout()'s Cash payment also recorded a cash-in — that write is
    // NOT rolled back either. If activateMembership() had (wrongly) undone
    // checkout()'s effects, this would be empty.
    const cashMoves = readCollection<CashMove>(StorageKeys.cashMoves);
    expect(cashMoves).toHaveLength(1);
    expect(cashMoves[0].amount).toBe(DEFAULT_FEE);
    expect(cashMoves[0].note).toContain(activationError.committedTransaction.id);

    // But no member was created — the caller must be told to follow up manually.
    expect(readCollection<Customer>(StorageKeys.customers)).toHaveLength(0);
  });

  it('throws MembershipActivationError but leaves BOTH the transaction AND the new customer committed when recordReferralBonus() fails, only the bonus itself is missing', () => {
    let caught: unknown;
    try {
      activateMembership({
        branchId: BRANCH_ID,
        cashierId: 'emp_kasir',
        cashierName: 'Dedi Kurniawan',
        name: 'Budi Santoso',
        phone: '081200002222',
        method: 'Cash',
        cashTendered: 200000,
        referrerId: 'cust_missing', // does not exist -> recordLoyaltyLedgerEntry throws
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(MembershipActivationError);
    const activationError = caught as MembershipActivationError;
    expect(activationError.message).toBe('Customer tidak ditemukan.');

    const transactions = readCollection<Transaction>(StorageKeys.transactions);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual(activationError.committedTransaction);

    const cashMoves = readCollection<CashMove>(StorageKeys.cashMoves);
    expect(cashMoves).toHaveLength(1);

    const customers = readCollection<Customer>(StorageKeys.customers);
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe('Budi Santoso');
    expect(customers[0].points).toBe(0);
    expect(getLoyaltyLedger(customers[0].id)).toHaveLength(0);
  });
});
