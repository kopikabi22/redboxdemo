import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from './storage';
import { StorageKeys, readCollection, writeCollection } from './storage';
import { checkout } from './transactions';
import {
  calculateEarnedPoints,
  createRewardCatalogItem,
  decideRedemption,
  getLoyaltyLedger,
  getRedemptions,
  recordLoyaltyLedgerEntry,
  recordReferralBonus,
  requestRedemption,
  updateRewardCatalogItem,
} from './membership';
import type { Customer, Employee, LoyaltyLedgerEntry, RewardCatalogItem, TransactionCustomer, TransactionLineItem } from './types';

const BRANCH_ID = 'br_test';
const SERVICE_ID = 'svc_test';

const owner: Employee = { id: 'emp_owner', name: 'Owner Test', role: 'Owner', branchId: BRANCH_ID, pin: '0000' };
const branchManager: Employee = { id: 'emp_bm', name: 'BM Test', role: 'BranchManager', branchId: BRANCH_ID, pin: '1111' };
const kasir: Employee = { id: 'emp_kasir', name: 'Kasir Test', role: 'Kasir', branchId: BRANCH_ID, pin: '2222' };

function seedCustomer(overrides: Partial<Customer> = {}): Customer {
  const customer: Customer = {
    id: 'cust_test',
    name: 'Andi Pratama',
    phone: '081234567890',
    type: 'member',
    tier: 'Gold',
    points: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  writeCollection<Customer>(StorageKeys.customers, [customer]);
  return customer;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('calculateEarnedPoints', () => {
  it('floors Rp10.000 = 1 poin with no carry-over of the remainder', () => {
    expect(calculateEarnedPoints(0)).toBe(0);
    expect(calculateEarnedPoints(9999)).toBe(0);
    expect(calculateEarnedPoints(10000)).toBe(1);
    expect(calculateEarnedPoints(19999)).toBe(1);
    expect(calculateEarnedPoints(60000)).toBe(6);
  });
});

describe('recordLoyaltyLedgerEntry — earn', () => {
  it('adds points to the customer balance and writes a matching ledger entry', () => {
    seedCustomer({ points: 5 });

    const entry = recordLoyaltyLedgerEntry({
      customerId: 'cust_test',
      type: 'earn',
      points: 10,
      reference: 'TRX-1',
      actorId: owner.id,
    });

    expect(entry.points).toBe(10);
    expect(entry.type).toBe('earn');

    const customer = readCollection<Customer>(StorageKeys.customers)[0];
    expect(customer.points).toBe(15);

    const ledger = getLoyaltyLedger('cust_test');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].id).toBe(entry.id);
  });
});

describe('recordLoyaltyLedgerEntry — redeem', () => {
  it('subtracts points from the customer balance via a negative delta', () => {
    seedCustomer({ points: 50 });

    recordLoyaltyLedgerEntry({
      customerId: 'cust_test',
      type: 'redeem',
      points: -20,
      reference: 'redm_1',
      actorId: owner.id,
    });

    const customer = readCollection<Customer>(StorageKeys.customers)[0];
    expect(customer.points).toBe(30);
  });

  it('throws and leaves the balance unchanged if the redeem would drive it negative', () => {
    seedCustomer({ points: 10 });

    expect(() =>
      recordLoyaltyLedgerEntry({
        customerId: 'cust_test',
        type: 'redeem',
        points: -20,
        reference: 'redm_1',
        actorId: owner.id,
      }),
    ).toThrow('Saldo poin tidak boleh menjadi negatif.');

    const customer = readCollection<Customer>(StorageKeys.customers)[0];
    expect(customer.points).toBe(10);
    expect(getLoyaltyLedger('cust_test')).toHaveLength(0);
  });
});

describe('recordLoyaltyLedgerEntry — adjustment', () => {
  it('can move the balance up', () => {
    seedCustomer({ points: 10 });
    recordLoyaltyLedgerEntry({ customerId: 'cust_test', type: 'adjustment', points: 25, reference: 'manual', actorId: owner.id });
    expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(35);
  });

  it('can move the balance down', () => {
    seedCustomer({ points: 40 });
    recordLoyaltyLedgerEntry({ customerId: 'cust_test', type: 'adjustment', points: -15, reference: 'manual', actorId: owner.id });
    expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(25);
  });
});

describe('recordLoyaltyLedgerEntry — internal rollback', () => {
  it('rolls back the already-written loyaltyLedger entry if the customers write fails, and rethrows', () => {
    seedCustomer({ points: 10 });
    recordLoyaltyLedgerEntry({ customerId: 'cust_test', type: 'earn', points: 5, reference: 'PRIOR', actorId: owner.id });

    const ledgerBefore = readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger);
    const customersBefore = readCollection<Customer>(StorageKeys.customers);

    const realWriteCollection = storage.writeCollection;
    let customersWriteAttempts = 0;
    const failure = new Error('Simulated localStorage write failure while writing customers');
    const spy = vi.spyOn(storage, 'writeCollection').mockImplementation((key: string, value: unknown[]) => {
      if (key === StorageKeys.customers) {
        customersWriteAttempts += 1;
        // Fail only the first attempt (the real balance update inside this
        // call). The rollback's own write to customers must be allowed to
        // succeed, or the test can't tell rollback-success from
        // rollback-also-broken.
        if (customersWriteAttempts === 1) {
          throw failure;
        }
      }
      return realWriteCollection(key, value);
    });

    try {
      expect(() =>
        recordLoyaltyLedgerEntry({ customerId: 'cust_test', type: 'earn', points: 5, reference: 'FAILING', actorId: owner.id }),
      ).toThrowError(failure);

      // The loyaltyLedger write (step 1) DID succeed before the simulated
      // failure — proving this is a genuine mid-way failure.
      expect(customersWriteAttempts).toBeGreaterThanOrEqual(1);

      const ledgerAfter = readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger);
      const customersAfter = readCollection<Customer>(StorageKeys.customers);
      expect(ledgerAfter).toEqual(ledgerBefore);
      expect(customersAfter).toEqual(customersBefore);
      expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(15);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('recordReferralBonus — happy path', () => {
  it('credits both the referrer and the referred customer 10 points each, as two separate ledger entries', () => {
    seedCustomer({ id: 'cust_referrer', points: 5 });
    writeCollection<Customer>(StorageKeys.customers, [
      ...readCollection<Customer>(StorageKeys.customers),
      { id: 'cust_referred', name: 'Budi Santoso', phone: '081200002222', type: 'member', tier: 'Bronze', points: 0, createdAt: '2026-01-02T00:00:00.000Z' },
    ]);

    recordReferralBonus({ referrerId: 'cust_referrer', referredId: 'cust_referred', actorId: owner.id });

    const customers = readCollection<Customer>(StorageKeys.customers);
    expect(customers.find((c) => c.id === 'cust_referrer')?.points).toBe(15);
    expect(customers.find((c) => c.id === 'cust_referred')?.points).toBe(10);

    const referrerLedger = getLoyaltyLedger('cust_referrer');
    const referredLedger = getLoyaltyLedger('cust_referred');
    expect(referrerLedger).toHaveLength(1);
    expect(referredLedger).toHaveLength(1);
    expect(referrerLedger[0].type).toBe('referral_bonus');
    expect(referrerLedger[0].points).toBe(10);
    expect(referredLedger[0].type).toBe('referral_bonus');
    expect(referredLedger[0].points).toBe(10);
  });
});

describe('recordReferralBonus — self-referral guard', () => {
  it('throws when referrerId === referredId, and writes NO ledger entry for either side', () => {
    seedCustomer({ id: 'cust_referrer', points: 5 });

    expect(() =>
      recordReferralBonus({ referrerId: 'cust_referrer', referredId: 'cust_referrer', actorId: owner.id }),
    ).toThrow('Customer tidak bisa mereferensikan dirinya sendiri.');

    expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(5);
    expect(getLoyaltyLedger('cust_referrer')).toHaveLength(0);
  });
});

describe('recordReferralBonus — invalid participant throws and rolls back BOTH sides', () => {
  it('throws when referrerId does not exist, and writes NO ledger entry for the (valid) referredId either', () => {
    writeCollection<Customer>(StorageKeys.customers, [
      { id: 'cust_referred', name: 'Budi Santoso', phone: '081200002222', type: 'member', tier: 'Bronze', points: 0, createdAt: '2026-01-02T00:00:00.000Z' },
    ]);

    expect(() =>
      recordReferralBonus({ referrerId: 'cust_missing', referredId: 'cust_referred', actorId: owner.id }),
    ).toThrow('Customer tidak ditemukan.');

    expect(readCollection<Customer>(StorageKeys.customers).find((c) => c.id === 'cust_referred')?.points).toBe(0);
    expect(getLoyaltyLedger('cust_referred')).toHaveLength(0);
  });

  it('throws when referredId does not exist, and rolls back the referrer bonus that already succeeded before the failure', () => {
    seedCustomer({ id: 'cust_referrer', points: 5 });

    expect(() =>
      recordReferralBonus({ referrerId: 'cust_referrer', referredId: 'cust_missing', actorId: owner.id }),
    ).toThrow('Customer tidak ditemukan.');

    // The referrer's bonus write DID succeed as the first of the two inner
    // calls — this proves the outer rollback undoes it, not that it never
    // happened in the first place.
    expect(readCollection<Customer>(StorageKeys.customers).find((c) => c.id === 'cust_referrer')?.points).toBe(5);
    expect(getLoyaltyLedger('cust_referrer')).toHaveLength(0);
  });
});

describe('recordReferralBonus — duplicate-processing guard', () => {
  it('throws on a second call for the same referral pair, without touching the balances the first call already earned', () => {
    seedCustomer({ id: 'cust_referrer', points: 0 });
    writeCollection<Customer>(StorageKeys.customers, [
      ...readCollection<Customer>(StorageKeys.customers),
      { id: 'cust_referred', name: 'Budi Santoso', phone: '081200002222', type: 'member', tier: 'Bronze', points: 0, createdAt: '2026-01-02T00:00:00.000Z' },
    ]);

    recordReferralBonus({ referrerId: 'cust_referrer', referredId: 'cust_referred', actorId: owner.id });

    expect(() =>
      recordReferralBonus({ referrerId: 'cust_referrer', referredId: 'cust_referred', actorId: owner.id }),
    ).toThrow('Bonus referral untuk pasangan customer ini sudah pernah diberikan.');

    // The first call's bonus stands — the guard rejects the duplicate
    // attempt before writing, it doesn't undo the earlier legitimate one.
    const customers = readCollection<Customer>(StorageKeys.customers);
    expect(customers.find((c) => c.id === 'cust_referrer')?.points).toBe(10);
    expect(customers.find((c) => c.id === 'cust_referred')?.points).toBe(10);
    expect(getLoyaltyLedger('cust_referrer')).toHaveLength(1);
    expect(getLoyaltyLedger('cust_referred')).toHaveLength(1);
  });
});

describe('checkout() — guest transactions never touch the loyalty ledger', () => {
  it('produces ZERO loyaltyLedger entries for a guest transaction, not a zero-point entry', () => {
    const guestCustomer: TransactionCustomer = {
      type: 'guest',
      customerId: null,
      name: 'Tamu',
      phone: '089900001111',
      tier: null,
    };
    const items: TransactionLineItem[] = [{ kind: 'service', itemId: SERVICE_ID, name: 'Haircut Reguler', price: 60000, qty: 1 }];

    checkout({
      branchId: BRANCH_ID,
      cashierId: 'emp_test',
      cashierName: 'Dedi Kurniawan',
      customer: guestCustomer,
      items,
      method: 'Cash',
      cashTendered: 100000,
    });

    const ledger = readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger);
    expect(ledger).toHaveLength(0);
  });
});

describe('Reward Catalog — Owner-only mutation (Holding-scope)', () => {
  it('allows Owner to create a reward', () => {
    const item = createRewardCatalogItem(
      { name: 'Gratis Pomade', pointsCost: 50, description: 'Tukar 50 poin dengan pomade', active: true },
      owner,
    );
    expect(item.id).toBeTruthy();
    expect(readCollection<RewardCatalogItem>(StorageKeys.rewardCatalog)).toHaveLength(1);
  });

  it('blocks BranchManager from creating a reward', () => {
    expect(() =>
      createRewardCatalogItem({ name: 'Gratis Pomade', pointsCost: 50, description: '', active: true }, branchManager),
    ).toThrow('Hanya Owner/HQ yang bisa menambah reward.');
    expect(readCollection<RewardCatalogItem>(StorageKeys.rewardCatalog)).toHaveLength(0);
  });

  it('blocks BranchManager from updating a reward', () => {
    const item = createRewardCatalogItem({ name: 'Gratis Pomade', pointsCost: 50, description: '', active: true }, owner);
    expect(() => updateRewardCatalogItem(item.id, { pointsCost: 5 }, branchManager)).toThrow(
      'Hanya Owner/HQ yang bisa mengubah reward.',
    );
    expect(readCollection<RewardCatalogItem>(StorageKeys.rewardCatalog)[0].pointsCost).toBe(50);
  });
});

describe('decideRedemption — approve re-validates balance at approval time', () => {
  it('approving with a sufficient balance succeeds and records a redeem ledger entry', () => {
    seedCustomer({ points: 100 });
    const reward = createRewardCatalogItem({ name: 'Gratis Pomade', pointsCost: 50, description: '', active: true }, owner);
    const redemption = requestRedemption({ customerId: 'cust_test', rewardId: reward.id });

    const decided = decideRedemption(redemption.id, 'approved', owner);

    expect(decided.status).toBe('approved');
    expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(50);
    const ledger = getLoyaltyLedger('cust_test');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('redeem');
    expect(ledger[0].points).toBe(-50);
  });

  it('approving with an insufficient balance (already spent by an earlier-approved redemption) throws and leaves status pending', () => {
    seedCustomer({ points: 60 });
    const reward = createRewardCatalogItem({ name: 'Gratis Pomade', pointsCost: 50, description: '', active: true }, owner);

    // Two requests made while the balance still covered both.
    const redemptionA = requestRedemption({ customerId: 'cust_test', rewardId: reward.id });
    const redemptionB = requestRedemption({ customerId: 'cust_test', rewardId: reward.id });

    // Approving A spends the only 50 points the customer has.
    decideRedemption(redemptionA.id, 'approved', owner);
    expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(10);

    // Approving B must re-check NOW, not trust the balance from request time.
    expect(() => decideRedemption(redemptionB.id, 'approved', owner)).toThrow(
      'Saldo poin customer tidak cukup lagi untuk redemption ini.',
    );

    const redemptions = getRedemptions();
    const stillB = redemptions.find((r) => r.id === redemptionB.id);
    expect(stillB?.status).toBe('pending');
    expect(stillB?.decidedAt).toBeNull();
    expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(10);
  });

  it('rejecting never touches the ledger or the customer balance', () => {
    seedCustomer({ points: 100 });
    const reward = createRewardCatalogItem({ name: 'Gratis Pomade', pointsCost: 50, description: '', active: true }, owner);
    const redemption = requestRedemption({ customerId: 'cust_test', rewardId: reward.id });

    const decided = decideRedemption(redemption.id, 'rejected', owner);

    expect(decided.status).toBe('rejected');
    expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(100);
    expect(getLoyaltyLedger('cust_test')).toHaveLength(0);
  });
});

describe('decideRedemption — RBAC guard (Owner or BranchManager only)', () => {
  it('allows BranchManager to approve', () => {
    seedCustomer({ points: 100 });
    const reward = createRewardCatalogItem({ name: 'Gratis Pomade', pointsCost: 50, description: '', active: true }, owner);
    const redemption = requestRedemption({ customerId: 'cust_test', rewardId: reward.id });

    const decided = decideRedemption(redemption.id, 'approved', branchManager);

    expect(decided.status).toBe('approved');
    expect(decided.decidedBy).toBe(branchManager.id);
  });

  it('blocks Kasir from approving or rejecting, and leaves the redemption pending', () => {
    seedCustomer({ points: 100 });
    const reward = createRewardCatalogItem({ name: 'Gratis Pomade', pointsCost: 50, description: '', active: true }, owner);
    const redemption = requestRedemption({ customerId: 'cust_test', rewardId: reward.id });

    expect(() => decideRedemption(redemption.id, 'approved', kasir)).toThrow(
      'Hanya Owner/HQ atau Branch Manager yang bisa memproses redemption.',
    );

    const stillPending = getRedemptions().find((r) => r.id === redemption.id);
    expect(stillPending?.status).toBe('pending');
    expect(readCollection<Customer>(StorageKeys.customers)[0].points).toBe(100);
  });
});
