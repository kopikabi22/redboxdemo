import type { Transaction } from './types';

/**
 * Single source of truth for "what does Riwayat Transaksi currently show" —
 * used by both the page's own list (app/riwayat/page.tsx) and the Excel
 * export (exportRiwayat.ts / lib/exportExcel.ts), so the two can never drift.
 * Mirrors the exact filter/sort behavior the Riwayat page already had before
 * Fase 5.1 (branch scope, status pills, search-overrides-period precedence,
 * newest-first sort) — this file only extracts it, it does not change it.
 */

export type RiwayatPeriodFilter = 'Hari Ini' | 'Kemarin' | '7 Hari' | 'Pilih Tanggal';
export type RiwayatStatusFilter = 'Semua' | 'Lunas' | 'Refunded';

export interface RiwayatFilterOptions {
  branchId: string;
  statusFilter: RiwayatStatusFilter;
  periodFilter: RiwayatPeriodFilter;
  searchQuery: string;
  /** Injected for deterministic tests; defaults to the real current time. */
  now?: Date;
}

/** BR-01: one barber lives on the transaction header now — item.barberName is a
 * legacy per-line field current checkout() never populates. Fall back to it only
 * for historical records predating BR-01 that might still have it set. */
export function transactionBarberName(tx: Transaction): string {
  return tx.barberName ?? tx.items.find((item) => item.barberName)?.barberName ?? '—';
}

export function filterAndSortRiwayatTransactions(
  transactions: Transaction[],
  options: RiwayatFilterOptions,
): Transaction[] {
  const { branchId, statusFilter, periodFilter, searchQuery, now = new Date() } = options;

  return transactions
    .filter((tx) => tx.branchId === branchId)
    .filter((tx) => {
      const status = tx.status === 'refunded' ? 'Refunded' : 'Lunas';
      if (statusFilter !== 'Semua' && status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tx.id.toLowerCase().includes(q) ||
          tx.customer.name.toLowerCase().includes(q) ||
          tx.customer.phone.includes(q) ||
          transactionBarberName(tx).toLowerCase().includes(q) ||
          tx.items.some((item) => item.name.toLowerCase().includes(q))
        );
      }

      if (periodFilter !== 'Pilih Tanggal') {
        const itemDate = new Date(tx.timestamp);
        const days = periodFilter === 'Hari Ini' ? 0 : periodFilter === 'Kemarin' ? 1 : 6;
        const start = new Date(now);
        start.setDate(now.getDate() - days);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
        if (periodFilter !== '7 Hari') {
          const end = new Date(start);
          end.setDate(start.getDate() + 1);
          if (itemDate >= end) return false;
        }
      }
      return true;
    })
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0)); // newest first
}
