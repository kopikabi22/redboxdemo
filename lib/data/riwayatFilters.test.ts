import { describe, it, expect } from 'vitest';
import { filterAndSortRiwayatTransactions, transactionBarberName } from './riwayatFilters';
import type { Transaction } from './types';

function makeTx(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'timestamp'>): Transaction {
  return {
    branchId: 'br_bypass',
    cashierId: 'emp_dedi',
    cashierName: 'Dedi',
    customer: { type: 'guest', customerId: null, name: 'Guest', phone: '0810000000', tier: null },
    items: [{ kind: 'service', itemId: 'svc_haircut', name: 'Haircut Reguler', price: 60000, qty: 1 }],
    subtotal: 60000,
    discount: 0,
    tax: 6000,
    total: 66000,
    method: 'Cash',
    cashTendered: 66000,
    change: 0,
    status: 'completed',
    ...overrides,
  };
}

describe('filterAndSortRiwayatTransactions', () => {
  it('scopes to the given branch only', () => {
    const txs = [
      makeTx({ id: 'a', timestamp: '2026-09-03T05:00:00.000Z', branchId: 'br_bypass' }),
      makeTx({ id: 'b', timestamp: '2026-09-03T05:00:00.000Z', branchId: 'br_samadikun' }),
    ];
    const result = filterAndSortRiwayatTransactions(txs, {
      branchId: 'br_bypass',
      statusFilter: 'Semua',
      periodFilter: 'Pilih Tanggal',
      searchQuery: '',
    });
    expect(result.map((t) => t.id)).toEqual(['a']);
  });

  it('filters by status (Lunas excludes Refunded, and vice versa)', () => {
    const txs = [
      makeTx({ id: 'lunas', timestamp: '2026-09-03T05:00:00.000Z', status: 'completed' }),
      makeTx({ id: 'refunded', timestamp: '2026-09-03T06:00:00.000Z', status: 'refunded' }),
    ];
    const opts = { branchId: 'br_bypass', periodFilter: 'Pilih Tanggal' as const, searchQuery: '' };

    expect(filterAndSortRiwayatTransactions(txs, { ...opts, statusFilter: 'Lunas' }).map((t) => t.id)).toEqual(['lunas']);
    expect(filterAndSortRiwayatTransactions(txs, { ...opts, statusFilter: 'Refunded' }).map((t) => t.id)).toEqual(['refunded']);
    expect(filterAndSortRiwayatTransactions(txs, { ...opts, statusFilter: 'Semua' }).map((t) => t.id).sort()).toEqual(['lunas', 'refunded']);
  });

  it('search matches id, customer name, phone, barber, or item name — and overrides the period filter (existing UI precedence)', () => {
    const txs = [
      makeTx({
        id: 'trx_findme',
        timestamp: '2026-01-01T00:00:00.000Z', // far outside any period window
        customer: { type: 'guest', customerId: null, name: 'Andi Pratama', phone: '081234567890', tier: null },
        barberName: 'Rio Saputra',
      }),
    ];
    const result = filterAndSortRiwayatTransactions(txs, {
      branchId: 'br_bypass',
      statusFilter: 'Semua',
      periodFilter: 'Hari Ini', // would normally exclude a Jan 1 transaction
      searchQuery: 'andi',
      now: new Date('2026-09-03T12:00:00.000Z'),
    });
    expect(result.map((t) => t.id)).toEqual(['trx_findme']);
  });

  it('"Hari Ini" keeps only today\'s transactions (device-local calendar day, matching the pre-existing UI behavior)', () => {
    // Deliberately not testing right at a midnight boundary — this filter is
    // documented (Fase 5 audit) as using the device's local calendar day, so a
    // boundary-adjacent fixture would make this test's outcome depend on the
    // test runner's own timezone. A 2-day gap is unambiguous in any timezone.
    const now = new Date('2026-09-03T12:00:00.000Z');
    const txs = [
      makeTx({ id: 'today', timestamp: '2026-09-03T10:00:00.000Z' }),
      makeTx({ id: 'two_days_ago', timestamp: '2026-09-01T10:00:00.000Z' }),
    ];
    const result = filterAndSortRiwayatTransactions(txs, {
      branchId: 'br_bypass',
      statusFilter: 'Semua',
      periodFilter: 'Hari Ini',
      searchQuery: '',
      now,
    });
    expect(result.map((t) => t.id)).toEqual(['today']);
  });

  it('sorts newest-first', () => {
    const txs = [
      makeTx({ id: 'oldest', timestamp: '2026-09-01T00:00:00.000Z' }),
      makeTx({ id: 'newest', timestamp: '2026-09-03T00:00:00.000Z' }),
      makeTx({ id: 'middle', timestamp: '2026-09-02T00:00:00.000Z' }),
    ];
    const result = filterAndSortRiwayatTransactions(txs, {
      branchId: 'br_bypass',
      statusFilter: 'Semua',
      periodFilter: '7 Hari',
      searchQuery: '',
      now: new Date('2026-09-03T12:00:00.000Z'),
    });
    expect(result.map((t) => t.id)).toEqual(['newest', 'middle', 'oldest']);
  });
});

describe('transactionBarberName (BR-01)', () => {
  it('prefers the header-level barberName', () => {
    const tx = makeTx({ id: 'a', timestamp: '2026-09-03T00:00:00.000Z', barberName: 'Rio Saputra' });
    expect(transactionBarberName(tx)).toBe('Rio Saputra');
  });

  it('falls back to a legacy per-line barberName when the header field is absent', () => {
    const tx = makeTx({
      id: 'a',
      timestamp: '2026-09-03T00:00:00.000Z',
      barberName: undefined,
      items: [{ kind: 'service', itemId: 'svc_haircut', name: 'Haircut', price: 60000, qty: 1, barberName: 'Legacy Barber' }],
    });
    expect(transactionBarberName(tx)).toBe('Legacy Barber');
  });

  it('falls back to an em dash when no barber name is available anywhere', () => {
    const tx = makeTx({ id: 'a', timestamp: '2026-09-03T00:00:00.000Z', barberName: undefined });
    expect(transactionBarberName(tx)).toBe('—');
  });
});
