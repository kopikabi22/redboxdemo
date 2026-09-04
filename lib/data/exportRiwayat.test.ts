import { describe, it, expect } from 'vitest';
import { buildRiwayatExportRows, buildRiwayatExportFilename } from './exportRiwayat';
import type { Transaction } from './types';

const branches = [
  { id: 'br_bypass', name: 'Bypass' },
  { id: 'br_samadikun', name: 'Samadikun' },
];

function makeTx(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'timestamp'>): Transaction {
  return {
    branchId: 'br_bypass',
    cashierId: 'emp_dedi',
    cashierName: 'Dedi Kurniawan',
    barberId: 'emp_rio',
    barberName: 'Rio Saputra',
    customer: { type: 'guest', customerId: null, name: 'Andi Guest', phone: '081234567890', tier: null },
    items: [
      { kind: 'service', itemId: 'svc_haircut', name: 'Haircut Reguler', price: 60000, qty: 1 },
      { kind: 'product', itemId: 'prd_pomade', name: 'Pomade Matte 100g', price: 55000, qty: 1 },
    ],
    subtotal: 115000,
    discount: 5000,
    tax: 11000,
    total: 121000,
    method: 'Cash',
    cashTendered: 150000,
    change: 29000,
    status: 'completed',
    ...overrides,
  };
}

describe('buildRiwayatExportRows', () => {
  it('does not re-derive filters — it exports exactly the transactions it is given, in the order given', () => {
    const txs = [makeTx({ id: 'trx_2', timestamp: '2026-09-03T05:00:00.000Z' }), makeTx({ id: 'trx_1', timestamp: '2026-09-02T05:00:00.000Z' })];
    const rows = buildRiwayatExportRows(txs, branches);
    expect(rows.map((r) => r['No. Transaksi'])).toEqual(['trx_2', 'trx_1']);
    expect(rows.map((r) => r.No)).toEqual([1, 2]);
  });

  it('shapes numeric money fields as real numbers, not formatted strings', () => {
    const rows = buildRiwayatExportRows([makeTx({ id: 'trx_1', timestamp: '2026-09-03T05:00:00.000Z' })], branches);
    const row = rows[0];
    expect(row.Subtotal).toBe(115000);
    expect(row.Diskon).toBe(5000);
    expect(row.Pajak).toBe(11000);
    expect(row.Total).toBe(121000);
    expect(typeof row.Subtotal).toBe('number');
    expect(typeof row.Total).toBe('number');
  });

  it('uses transaction.barberName, falling back to a legacy per-line barberName (BR-01), consistent with the Riwayat UI', () => {
    const headerBarber = buildRiwayatExportRows([makeTx({ id: 'a', timestamp: '2026-09-03T05:00:00.000Z', barberName: 'Rio Saputra' })], branches);
    expect(headerBarber[0].Barber).toBe('Rio Saputra');

    const legacyBarber = buildRiwayatExportRows(
      [
        makeTx({
          id: 'b',
          timestamp: '2026-09-03T05:00:00.000Z',
          barberName: undefined,
          items: [{ kind: 'service', itemId: 'svc_haircut', name: 'Haircut', price: 60000, qty: 1, barberName: 'Legacy Barber' }],
        }),
      ],
      branches,
    );
    expect(legacyBarber[0].Barber).toBe('Legacy Barber');
  });

  it('keeps a refunded transaction in the export (never excludes it) with full refund metadata', () => {
    const rows = buildRiwayatExportRows(
      [
        makeTx({
          id: 'trx_refund',
          timestamp: '2026-09-03T05:00:00.000Z',
          status: 'refunded',
          refundedAt: '2026-09-03T08:30:00.000Z', // 15:30 WIB
          refundedByName: 'Hendra Wijaya',
          refundReason: 'Layanan tidak sesuai',
        }),
      ],
      branches,
    );
    const row = rows[0];
    expect(row.Status).toBe('Refunded');
    expect(row['Status Refund']).toBe('Refunded');
    expect(row['Tanggal Refund']).toBe('2026-09-03 15:30:00');
    expect(row['Alasan Refund']).toBe('Layanan tidak sesuai');
    expect(row['Diproses Oleh (Refund)']).toBe('Hendra Wijaya');
  });

  it('uses "-" (never blank/undefined) for absent optional fields on a normal (non-refunded) sale', () => {
    const rows = buildRiwayatExportRows([makeTx({ id: 'a', timestamp: '2026-09-03T05:00:00.000Z' })], branches);
    const row = rows[0];
    expect(row['Status Refund']).toBe('-');
    expect(row['Tanggal Refund']).toBe('-');
    expect(row['Alasan Refund']).toBe('-');
    expect(row['Diproses Oleh (Refund)']).toBe('-');
    expect(row['Referensi Appointment']).toBe('-');
  });

  it('resolves branch id to branch name via the provided lookup', () => {
    const rows = buildRiwayatExportRows([makeTx({ id: 'a', timestamp: '2026-09-03T05:00:00.000Z', branchId: 'br_samadikun' })], branches);
    expect(rows[0].Cabang).toBe('Samadikun');
  });

  it('converts the transaction timestamp to WIB date/time, not raw UTC', () => {
    const rows = buildRiwayatExportRows([makeTx({ id: 'a', timestamp: '2026-09-03T20:15:30.000Z' })], branches); // 03:15:30 WIB, next day
    expect(rows[0].Tanggal).toBe('2026-09-04');
    expect(rows[0]['Waktu WIB']).toBe('03:15:30');
  });

  it('labels member vs guest customers correctly', () => {
    const member = buildRiwayatExportRows(
      [makeTx({ id: 'a', timestamp: '2026-09-03T05:00:00.000Z', customer: { type: 'member', customerId: 'cust_1', name: 'Andi', phone: '081', tier: 'Gold' } })],
      branches,
    );
    expect(member[0]['Status Member']).toBe('Member');

    const guest = buildRiwayatExportRows([makeTx({ id: 'b', timestamp: '2026-09-03T05:00:00.000Z' })], branches);
    expect(guest[0]['Status Member']).toBe('Guest');
  });

  it('joins service and product items separately, comma-separated with quantities', () => {
    const rows = buildRiwayatExportRows([makeTx({ id: 'a', timestamp: '2026-09-03T05:00:00.000Z' })], branches);
    expect(rows[0]['Item Layanan']).toBe('Haircut Reguler (1x)');
    expect(rows[0]['Item Produk']).toBe('Pomade Matte 100g (1x)');
  });

  it('returns an empty array for an empty input (caller is responsible for the "nothing to export" UI message)', () => {
    expect(buildRiwayatExportRows([], branches)).toEqual([]);
  });
});

describe('buildRiwayatExportFilename', () => {
  it('embeds the WIB business date, not the raw UTC date', () => {
    // 2026-09-03 20:15 UTC = 2026-09-04 03:15 WIB.
    expect(buildRiwayatExportFilename('2026-09-03T20:15:00.000Z')).toBe('Redbox_Riwayat_Transaksi_2026-09-04.xlsx');
  });
});
