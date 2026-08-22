import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
  getPromotions,
  getPromotionById,
  getPromotionByCode,
  validateAndCalculatePromo,
  incrementPromoUsage,
} from './promotions';
import { StorageKeys, readCollection, writeCollection } from './storage';
import type { Employee, Promotion, TransactionLineItem } from './types';

const ownerActor: Employee = {
  id: 'emp_owner',
  name: 'Budi Owner',
  role: 'Owner',
  branchId: 'br_bypass',
  pin: '1111',
};

const bmBypass: Employee = {
  id: 'emp_bm_bypass',
  name: 'Manager Bypass',
  role: 'BranchManager',
  branchId: 'br_bypass',
  pin: '2222',
};

const bmTegal: Employee = {
  id: 'emp_bm_tegal',
  name: 'Manager Tegal',
  role: 'BranchManager',
  branchId: 'br_tegal',
  pin: '3333',
};

const cashierActor: Employee = {
  id: 'emp_cashier',
  name: 'Kasir Satu',
  role: 'Kasir',
  branchId: 'br_bypass',
  pin: '4444',
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('Promotions — CRUD and RBAC', () => {
  it('allows Owner to create a company-wide (holding) promotion', () => {
    const promo = createPromotion(
      {
        code: 'diskon10',
        name: 'Diskon 10% Nasional',
        type: 'percentage',
        value: 10,
        scope: 'holding',
      },
      ownerActor,
    );

    expect(promo.code).toBe('DISKON10');
    expect(promo.scope).toBe('holding');
    expect(promo.branchId).toBeNull();
    expect(promo.usedCount).toBe(0);
    expect(promo.active).toBe(true);
    expect(getPromotions()).toHaveLength(1);
  });

  it('allows BranchManager to create a branch-scoped promotion for own branch', () => {
    const promo = createPromotion(
      {
        code: 'tegalopen',
        name: 'Opening Tegal',
        type: 'flat',
        value: 20000,
        scope: 'branch',
        branchId: 'br_tegal',
      },
      bmTegal,
    );

    expect(promo.code).toBe('TEGALOPEN');
    expect(promo.scope).toBe('branch');
    expect(promo.branchId).toBe('br_tegal');
  });

  it('rejects BranchManager creating a holding promotion', () => {
    expect(() =>
      createPromotion(
        {
          code: 'holdingfail',
          name: 'Promo Holding Ilegal',
          type: 'percentage',
          value: 10,
          scope: 'holding',
        },
        bmBypass,
      ),
    ).toThrow('BranchManager hanya bisa membuat promo lokal cabang sendiri.');
  });

  it('rejects BranchManager creating promo for a different branch', () => {
    expect(() =>
      createPromotion(
        {
          code: 'crossfail',
          name: 'Promo Cabang Lain',
          type: 'flat',
          value: 15000,
          scope: 'branch',
          branchId: 'br_tegal',
        },
        bmBypass,
      ),
    ).toThrow('BranchManager hanya bisa membuat promo untuk cabangnya sendiri.');
  });

  it('rejects Cashier from creating promotions', () => {
    expect(() =>
      createPromotion(
        {
          code: 'kasirfail',
          name: 'Promo Kasir',
          type: 'flat',
          value: 10000,
          scope: 'holding',
        },
        cashierActor,
      ),
    ).toThrow('Hanya Owner/HQ atau BranchManager yang bisa mengelola promosi.');
  });

  it('rejects duplicate promo codes case-insensitively', () => {
    createPromotion(
      {
        code: 'PROMO1',
        name: 'Promo Pertama',
        type: 'flat',
        value: 10000,
        scope: 'holding',
      },
      ownerActor,
    );

    expect(() =>
      createPromotion(
        {
          code: 'promo1',
          name: 'Promo Duplikat',
          type: 'flat',
          value: 15000,
          scope: 'holding',
        },
        ownerActor,
      ),
    ).toThrow('Kode promo sudah digunakan.');
  });

  it('validates promo input values and percentages', () => {
    expect(() =>
      createPromotion(
        { code: 'ERR1', name: 'Zero Value', type: 'flat', value: 0, scope: 'holding' },
        ownerActor,
      ),
    ).toThrow('Nilai diskon harus lebih besar dari 0.');

    expect(() =>
      createPromotion(
        { code: 'ERR2', name: 'Over 100 Percent', type: 'percentage', value: 105, scope: 'holding' },
        ownerActor,
      ),
    ).toThrow('Diskon persentase tidak boleh lebih dari 100%.');

    expect(() =>
      createPromotion(
        {
          code: 'ERR3',
          name: 'Bad Dates',
          type: 'percentage',
          value: 10,
          scope: 'holding',
          startDate: '2026-06-10',
          endDate: '2026-06-01',
        },
        ownerActor,
      ),
    ).toThrow('Tanggal mulai tidak boleh lebih lambat dari tanggal berakhir.');
  });

  it('updates promotion attributes and checks RBAC', () => {
    const promo = createPromotion(
      { code: 'EDITME', name: 'Original Name', type: 'flat', value: 10000, scope: 'holding' },
      ownerActor,
    );

    const updated = updatePromotion(
      promo.id,
      { name: 'New Name', value: 25000, maxDiscount: 50000, minSpend: 50000 },
      ownerActor,
    );

    expect(updated.name).toBe('New Name');
    expect(updated.value).toBe(25000);
    expect(updated.minSpend).toBe(50000);

    expect(() => updatePromotion(promo.id, { value: 30000 }, bmBypass)).toThrow('BranchManager tidak bisa mengubah promo holding.');
  });

  it('deletes promotion and checks RBAC', () => {
    const promo = createPromotion(
      { code: 'DELME', name: 'To Delete', type: 'flat', value: 10000, scope: 'holding' },
      ownerActor,
    );

    expect(getPromotions()).toHaveLength(1);
    deletePromotion(promo.id, ownerActor);
    expect(getPromotions()).toHaveLength(0);
  });
});

describe('Promotions — Validation and Calculation', () => {
  const items: TransactionLineItem[] = [
    { kind: 'service', itemId: 'svc_haircut', name: 'Gentlemen Haircut', price: 60000, qty: 1 },
    { kind: 'product', itemId: 'prod_pomade', name: 'Matte Clay', price: 100000, qty: 1 },
  ]; // subtotal = 160000

  it('calculates percentage discount accurately without cap', () => {
    createPromotion(
      { code: 'HEBOH20', name: 'Diskon 20%', type: 'percentage', value: 20, scope: 'holding' },
      ownerActor,
    );

    const result = validateAndCalculatePromo('heboh20', 'br_bypass', items);
    expect(result.discountAmount).toBe(32000); // 20% of 160000
    expect(result.appliedPromo.discountAmount).toBe(32000);
    expect(result.appliedPromo.code).toBe('HEBOH20');
  });

  it('applies maxDiscount cap for percentage promos', () => {
    createPromotion(
      {
        code: 'CAP50',
        name: 'Diskon 50% Max 20k',
        type: 'percentage',
        value: 50,
        maxDiscount: 20000,
        scope: 'holding',
      },
      ownerActor,
    );

    const result = validateAndCalculatePromo('CAP50', 'br_bypass', items);
    expect(result.discountAmount).toBe(20000); // 50% of 160k is 80k, capped at 20k
  });

  it('calculates flat discount and caps at subtotal', () => {
    createPromotion(
      { code: 'POTONG50K', name: 'Potongan 50 Ribu', type: 'flat', value: 50000, scope: 'holding' },
      ownerActor,
    );

    const result = validateAndCalculatePromo('POTONG50K', 'br_bypass', items);
    expect(result.discountAmount).toBe(50000);

    const smallItems: TransactionLineItem[] = [
      { kind: 'service', itemId: 'svc_shave', name: 'Quick Shave', price: 30000, qty: 1 },
    ];
    const smallResult = validateAndCalculatePromo('POTONG50K', 'br_bypass', smallItems);
    expect(smallResult.discountAmount).toBe(30000); // cannot discount more than subtotal
  });

  it('rejects inactive promo', () => {
    createPromotion(
      { code: 'NONAKTIF', name: 'Promo Mati', type: 'flat', value: 10000, scope: 'holding', active: false },
      ownerActor,
    );

    expect(() => validateAndCalculatePromo('NONAKTIF', 'br_bypass', items)).toThrow('sedang tidak aktif');
  });

  it('rejects promo before start date or after end date', () => {
    createPromotion(
      {
        code: 'FUTURE',
        name: 'Promo Masa Depan',
        type: 'flat',
        value: 10000,
        scope: 'holding',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      },
      ownerActor,
    );

    expect(() => validateAndCalculatePromo('FUTURE', 'br_bypass', items, '2026-08-22T00:00:00.000Z')).toThrow('belum mulai berlaku');

    createPromotion(
      {
        code: 'PAST',
        name: 'Promo Masa Lalu',
        type: 'flat',
        value: 10000,
        scope: 'holding',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
      ownerActor,
    );

    expect(() => validateAndCalculatePromo('PAST', 'br_bypass', items, '2026-08-22T00:00:00.000Z')).toThrow('sudah berakhir');
  });

  it('rejects promo applied at an ineligible branch', () => {
    createPromotion(
      {
        code: 'TEGALONLY',
        name: 'Khusus Tegal',
        type: 'flat',
        value: 15000,
        scope: 'branch',
        branchId: 'br_tegal',
      },
      bmTegal,
    );

    expect(() => validateAndCalculatePromo('TEGALONLY', 'br_bypass', items)).toThrow('hanya berlaku di cabang tertentu');
    expect(validateAndCalculatePromo('TEGALONLY', 'br_tegal', items).discountAmount).toBe(15000);
  });

  it('rejects promo when minimum spend is not met', () => {
    createPromotion(
      {
        code: 'MIN200K',
        name: 'Min Belanja 200k',
        type: 'flat',
        value: 30000,
        minSpend: 200000,
        scope: 'holding',
      },
      ownerActor,
    );

    expect(() => validateAndCalculatePromo('MIN200K', 'br_bypass', items)).toThrow('Minimal belanja untuk promo');
  });

  it('rejects promo when usage limit is reached', () => {
    const promo = createPromotion(
      {
        code: 'LIMITED',
        name: 'Kuota 1x',
        type: 'flat',
        value: 10000,
        usageLimit: 1,
        scope: 'holding',
      },
      ownerActor,
    );

    expect(validateAndCalculatePromo('LIMITED', 'br_bypass', items).discountAmount).toBe(10000);
    incrementPromoUsage(promo.id);
    expect(() => validateAndCalculatePromo('LIMITED', 'br_bypass', items)).toThrow('Kuota pemakaian promo');
  });
});
