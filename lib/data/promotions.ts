import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import type { Employee, Promotion, PromoType, PromoScope, AppliedPromoInfo, TransactionLineItem } from './types';

export function getPromotions(): Promotion[] {
  return readCollection<Promotion>(StorageKeys.promotions);
}

export function getPromotionById(id: string): Promotion | undefined {
  return getPromotions().find((p) => p.id === id);
}

export function getPromotionByCode(code: string): Promotion | undefined {
  return getPromotions().find((p) => p.code.toUpperCase() === code.trim().toUpperCase());
}

export interface CreatePromotionInput {
  code: string;
  name: string;
  type: PromoType;
  value: number;
  maxDiscount?: number | null;
  minSpend?: number;
  scope: PromoScope;
  branchId?: string | null;
  usageLimit?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
}

function checkPromoManagerRbac(actor: Employee): void {
  if (actor.role !== 'Owner' && actor.role !== 'BranchManager') {
    throw new Error('Hanya Owner/HQ atau BranchManager yang bisa mengelola promosi.');
  }
}

export function createPromotion(input: CreatePromotionInput, actor: Employee): Promotion {
  checkPromoManagerRbac(actor);

  if (actor.role === 'BranchManager') {
    if (input.scope === 'holding') {
      throw new Error('BranchManager hanya bisa membuat promo lokal cabang sendiri.');
    }
    if (input.branchId !== actor.branchId) {
      throw new Error('BranchManager hanya bisa membuat promo untuk cabangnya sendiri.');
    }
  }

  if (input.scope === 'branch' && !input.branchId) {
    throw new Error('Cabang wajib ditentukan untuk promo lokal cabang.');
  }

  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error('Kode promo wajib diisi.');

  const existing = getPromotionByCode(code);
  if (existing) throw new Error('Kode promo sudah digunakan.');

  const name = input.name.trim();
  if (!name) throw new Error('Nama promo wajib diisi.');

  if (input.value <= 0) throw new Error('Nilai diskon harus lebih besar dari 0.');
  if (input.type === 'percentage' && input.value > 100) throw new Error('Diskon persentase tidak boleh lebih dari 100%.');
  if (input.maxDiscount !== undefined && input.maxDiscount !== null && input.maxDiscount <= 0) {
    throw new Error('Batas maksimal diskon harus lebih besar dari 0.');
  }
  if (input.minSpend !== undefined && input.minSpend < 0) {
    throw new Error('Minimal belanja tidak boleh negatif.');
  }
  if (input.usageLimit !== undefined && input.usageLimit !== null && input.usageLimit <= 0) {
    throw new Error('Batas kuota pemakaian harus lebih besar dari 0.');
  }
  if (input.startDate && input.endDate && input.startDate > input.endDate) {
    throw new Error('Tanggal mulai tidak boleh lebih lambat dari tanggal berakhir.');
  }

  const promo: Promotion = {
    id: generateId('promo'),
    code,
    name,
    type: input.type,
    value: input.value,
    maxDiscount: input.maxDiscount ?? null,
    minSpend: input.minSpend ?? 0,
    scope: input.scope,
    branchId: input.scope === 'branch' ? (input.branchId ?? null) : null,
    usageLimit: input.usageLimit ?? null,
    usedCount: 0,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    active: input.active ?? true,
    createdAt: nowIso(),
  };

  const promos = getPromotions();
  promos.push(promo);
  writeCollection(StorageKeys.promotions, promos);
  return promo;
}

export type UpdatePromotionInput = Partial<CreatePromotionInput>;

export function updatePromotion(id: string, patch: UpdatePromotionInput, actor: Employee): Promotion {
  checkPromoManagerRbac(actor);

  const promos = getPromotions();
  const promo = promos.find((p) => p.id === id);
  if (!promo) throw new Error('Promo tidak ditemukan.');

  if (actor.role === 'BranchManager') {
    if (promo.scope === 'holding') {
      throw new Error('BranchManager tidak bisa mengubah promo holding.');
    }
    if (promo.branchId !== actor.branchId) {
      throw new Error('Tidak punya akses ke promo cabang lain.');
    }
    if (patch.scope === 'holding') {
      throw new Error('BranchManager tidak bisa mengubah promo menjadi scope holding.');
    }
    if (patch.branchId && patch.branchId !== actor.branchId) {
      throw new Error('BranchManager tidak bisa memindahkan promo ke cabang lain.');
    }
  }

  if (patch.code !== undefined) {
    const code = patch.code.trim().toUpperCase();
    if (!code) throw new Error('Kode promo wajib diisi.');
    const duplicate = promos.find((p) => p.id !== id && p.code.toUpperCase() === code);
    if (duplicate) throw new Error('Kode promo sudah digunakan.');
    promo.code = code;
  }

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error('Nama promo wajib diisi.');
    promo.name = name;
  }

  const targetType = patch.type ?? promo.type;
  if (patch.value !== undefined) {
    if (patch.value <= 0) throw new Error('Nilai diskon harus lebih besar dari 0.');
    if (targetType === 'percentage' && patch.value > 100) throw new Error('Diskon persentase tidak boleh lebih dari 100%.');
    promo.value = patch.value;
  }
  if (patch.type !== undefined) {
    promo.type = patch.type;
  }

  if (patch.maxDiscount !== undefined) {
    if (patch.maxDiscount !== null && patch.maxDiscount <= 0) {
      throw new Error('Batas maksimal diskon harus lebih besar dari 0.');
    }
    promo.maxDiscount = patch.maxDiscount;
  }

  if (patch.minSpend !== undefined) {
    if (patch.minSpend < 0) throw new Error('Minimal belanja tidak boleh negatif.');
    promo.minSpend = patch.minSpend;
  }

  if (patch.usageLimit !== undefined) {
    if (patch.usageLimit !== null && patch.usageLimit <= 0) {
      throw new Error('Batas kuota pemakaian harus lebih besar dari 0.');
    }
    promo.usageLimit = patch.usageLimit;
  }

  const targetStart = patch.startDate !== undefined ? patch.startDate : promo.startDate;
  const targetEnd = patch.endDate !== undefined ? patch.endDate : promo.endDate;
  if (targetStart && targetEnd && targetStart > targetEnd) {
    throw new Error('Tanggal mulai tidak boleh lebih lambat dari tanggal berakhir.');
  }
  if (patch.startDate !== undefined) promo.startDate = patch.startDate;
  if (patch.endDate !== undefined) promo.endDate = patch.endDate;

  if (patch.scope !== undefined) {
    promo.scope = patch.scope;
    if (patch.scope === 'holding') {
      promo.branchId = null;
    }
  }
  if (patch.branchId !== undefined && promo.scope === 'branch') {
    promo.branchId = patch.branchId;
  }

  if (patch.active !== undefined) promo.active = patch.active;

  writeCollection(StorageKeys.promotions, promos);
  return promo;
}

export function deletePromotion(id: string, actor: Employee): void {
  checkPromoManagerRbac(actor);

  const promos = getPromotions();
  const promo = promos.find((p) => p.id === id);
  if (!promo) throw new Error('Promo tidak ditemukan.');

  if (actor.role === 'BranchManager') {
    if (promo.scope === 'holding') {
      throw new Error('BranchManager tidak bisa menghapus promo holding.');
    }
    if (promo.branchId !== actor.branchId) {
      throw new Error('Tidak punya akses ke promo cabang lain.');
    }
  }

  writeCollection(
    StorageKeys.promotions,
    promos.filter((p) => p.id !== id),
  );
}

export function validateAndCalculatePromo(
  code: string,
  branchId: string,
  items: TransactionLineItem[],
  currentDateIso?: string,
): { promo: Promotion; discountAmount: number; appliedPromo: AppliedPromoInfo } {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new Error('Kode promo wajib diisi.');

  const promo = getPromotionByCode(normalizedCode);
  if (!promo) throw new Error(`Kode promo "${normalizedCode}" tidak ditemukan.`);
  if (!promo.active) throw new Error(`Promo "${promo.name}" sedang tidak aktif.`);

  const nowStr = (currentDateIso ? new Date(currentDateIso) : new Date()).toISOString().slice(0, 10);
  if (promo.startDate && nowStr < promo.startDate.slice(0, 10)) {
    throw new Error(`Promo "${promo.name}" belum mulai berlaku.`);
  }
  if (promo.endDate && nowStr > promo.endDate.slice(0, 10)) {
    throw new Error(`Promo "${promo.name}" sudah berakhir.`);
  }

  if (promo.scope === 'branch' && promo.branchId !== branchId) {
    throw new Error(`Promo "${promo.name}" hanya berlaku di cabang tertentu.`);
  }

  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    throw new Error(`Kuota pemakaian promo "${promo.name}" sudah habis.`);
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (subtotal < promo.minSpend) {
    throw new Error(`Minimal belanja untuk promo "${promo.name}" adalah Rp${promo.minSpend.toLocaleString('id-ID')}.`);
  }

  let discountAmount = 0;
  if (promo.type === 'percentage') {
    const rawDiscount = Math.round(subtotal * (promo.value / 100));
    discountAmount = promo.maxDiscount !== null && promo.maxDiscount > 0 ? Math.min(rawDiscount, promo.maxDiscount) : rawDiscount;
  } else if (promo.type === 'flat') {
    discountAmount = promo.value;
  }

  discountAmount = Math.min(discountAmount, subtotal);

  const appliedPromo: AppliedPromoInfo = {
    promoId: promo.id,
    code: promo.code,
    name: promo.name,
    type: promo.type,
    value: promo.value,
    discountAmount,
  };

  return { promo, discountAmount, appliedPromo };
}

export function incrementPromoUsage(promoId: string): void {
  const promos = readCollection<Promotion>(StorageKeys.promotions);
  const promo = promos.find((p) => p.id === promoId);
  if (promo) {
    promo.usedCount = (promo.usedCount || 0) + 1;
    writeCollection(StorageKeys.promotions, promos);
  }
}
