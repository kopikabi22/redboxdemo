/**
 * Low-level, SSR-safe localStorage access. Every read/write in the data
 * layer goes through here so there is exactly one place that has to know
 * "are we in the browser?" — callers never touch `window` directly.
 */

const STORAGE_PREFIX = 'rb_';

export const StorageKeys = {
  branches: `${STORAGE_PREFIX}branches`,
  employees: `${STORAGE_PREFIX}employees`,
  customers: `${STORAGE_PREFIX}customers`,
  services: `${STORAGE_PREFIX}services`,
  products: `${STORAGE_PREFIX}products`,
  inventoryBalances: `${STORAGE_PREFIX}inventory_balances`,
  stockMoves: `${STORAGE_PREFIX}stock_moves`,
  transactions: `${STORAGE_PREFIX}transactions`,
  cashMoves: `${STORAGE_PREFIX}cash_moves`,
  attendance: `${STORAGE_PREFIX}attendance`,
  heldBills: `${STORAGE_PREFIX}held_bills`,
  cashierClosings: `${STORAGE_PREFIX}cashier_closings`,
  loyaltyLedger: `${STORAGE_PREFIX}loyalty_ledger`,
  rewardCatalog: `${STORAGE_PREFIX}reward_catalog`,
  rewardRedemptions: `${STORAGE_PREFIX}reward_redemptions`,
  promotions: `${STORAGE_PREFIX}promotions`,
  appointments: `${STORAGE_PREFIX}appointments`,
  schedules: `${STORAGE_PREFIX}schedules`,
  productBatches: `${STORAGE_PREFIX}product_batches`,
  reminderLogs: `${STORAGE_PREFIX}reminder_logs`,
  seeded: `${STORAGE_PREFIX}seeded_v1`,
} as const;

export type SessionNamespace = 'karyawan' | 'manajemen';

/** Login sessions are namespaced per POV so signing into one doesn't sign you into the other. */
export function sessionKey(namespace: SessionNamespace): string {
  return `${STORAGE_PREFIX}session_${namespace}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function readCollection<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch (err) {
    console.error(`[redbox] failed to read "${key}"`, err);
    return [];
  }
}

/**
 * Unlike the read* helpers, this does NOT swallow errors — a failed write
 * (e.g. quota exceeded) must surface to the caller so composite operations
 * like checkout() can detect it and roll back instead of silently
 * pretending to have succeeded.
 */
export function writeCollection<T>(key: string, value: T[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readValue<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.error(`[redbox] failed to read "${key}"`, err);
    return fallback;
  }
}

export function writeValue<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[redbox] failed to write "${key}"`, err);
  }
}

export function removeValue(key: string): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

let lastTimestampMs = 0;

/**
 * Strictly monotonically increasing — two calls within the same
 * millisecond (routine when code runs synchronously back-to-back, e.g. two
 * checkout() calls fired immediately one after another) never return equal
 * values. This matters wherever timestamps are compared with strict `<`/`>`
 * to define a boundary, such as CashierClosing's periodStart/periodEnd
 * window: without this, a transaction created in the same millisecond as a
 * closing's periodEnd could silently fall outside every window (neither
 * closing counts it) or, with a differently-drawn boundary, get double
 * counted. Nudging forward by 1ms on collision is imperceptible drift from
 * wall-clock time and never goes backwards.
 */
export function nowIso(): string {
  let ms = Date.now();
  if (ms <= lastTimestampMs) {
    ms = lastTimestampMs + 1;
  }
  lastTimestampMs = ms;
  return new Date(ms).toISOString();
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount || 0).toLocaleString('id-ID')}`;
}
