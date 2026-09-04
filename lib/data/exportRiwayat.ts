import { businessDateString, businessTimeString } from './storage';
import { transactionBarberName } from './riwayatFilters';
import type { Transaction } from './types';

/**
 * Pure row-shaping for the Riwayat Transaksi Excel export. Deliberately
 * separate from the actual xlsx-writing/download code (lib/exportExcel.ts)
 * so this part — the part with real logic worth getting wrong — is testable
 * without touching the DOM or a real workbook library.
 */
export interface RiwayatExportRow {
  No: number;
  'No. Transaksi': string;
  Tanggal: string;
  'Waktu WIB': string;
  Cabang: string;
  Pelanggan: string;
  'Status Member': 'Member' | 'Guest';
  Barber: string;
  Kasir: string;
  Status: 'Lunas' | 'Refunded';
  'Metode Pembayaran': string;
  'Item Layanan': string;
  'Item Produk': string;
  Subtotal: number;
  Diskon: number;
  Pajak: number;
  Total: number;
  'Status Refund': 'Refunded' | '-';
  'Tanggal Refund': string;
  'Alasan Refund': string;
  'Diproses Oleh (Refund)': string;
  'Referensi Appointment': string;
}

function joinItems(tx: Transaction, kind: 'service' | 'product'): string {
  const items = tx.items.filter((item) => item.kind === kind);
  if (!items.length) return '-';
  return items.map((item) => `${item.name} (${item.qty}x)`).join(', ');
}

interface BranchLookup {
  id: string;
  name: string;
}

/**
 * Builds export rows directly from Transaction — not from the page's display-
 * mapped RiwayatItem — so numeric money fields, raw refund metadata, and the
 * WIB date/time conversion all come straight from the source record instead
 * of a lossy, already-formatted intermediate.
 *
 * `transactions` must already be the filtered + sorted list the UI is
 * currently showing (see filterAndSortRiwayatTransactions) — this function
 * does not re-derive filters, by design, so export and UI can never drift.
 */
export function buildRiwayatExportRows(
  transactions: Transaction[],
  branches: BranchLookup[],
): RiwayatExportRow[] {
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  return transactions.map((tx, index) => ({
    No: index + 1,
    'No. Transaksi': tx.id,
    Tanggal: businessDateString(tx.timestamp),
    'Waktu WIB': businessTimeString(tx.timestamp),
    Cabang: branchNameById.get(tx.branchId) ?? tx.branchId,
    Pelanggan: tx.customer.name,
    'Status Member': tx.customer.type === 'member' ? 'Member' : 'Guest',
    Barber: transactionBarberName(tx),
    Kasir: tx.cashierName,
    Status: tx.status === 'refunded' ? 'Refunded' : 'Lunas',
    'Metode Pembayaran': tx.method,
    'Item Layanan': joinItems(tx, 'service'),
    'Item Produk': joinItems(tx, 'product'),
    Subtotal: tx.subtotal,
    Diskon: tx.discount,
    Pajak: tx.tax,
    Total: tx.total,
    'Status Refund': tx.status === 'refunded' ? 'Refunded' : '-',
    'Tanggal Refund': tx.refundedAt ? `${businessDateString(tx.refundedAt)} ${businessTimeString(tx.refundedAt)}` : '-',
    'Alasan Refund': tx.refundReason ?? '-',
    'Diproses Oleh (Refund)': tx.refundedByName ?? '-',
    'Referensi Appointment': tx.appointmentId ?? '-',
  }));
}

/** Business date (WIB) used for the export filename, e.g. Redbox_Riwayat_Transaksi_2026-09-03.xlsx */
export function buildRiwayatExportFilename(referenceDate: Date | string | number = new Date()): string {
  return `Redbox_Riwayat_Transaksi_${businessDateString(referenceDate)}.xlsx`;
}
