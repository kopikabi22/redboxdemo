import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { getEmployeeById, verifyEmployeePin } from './employees';
import type { CashierClosing, PaymentMethod, PaymentMethodBreakdown, Transaction } from './types';

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'QRIS', 'Debit', 'Transfer', 'E-Wallet'];

export function getLastClosing(cashierId: string, branchId: string): CashierClosing | undefined {
  return readCollection<CashierClosing>(StorageKeys.cashierClosings)
    .filter((c) => c.cashierId === cashierId && c.branchId === branchId)
    .sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : -1))[0];
}

export interface ExpectedBreakdownResult {
  periodStart: string;
  periodEnd: string;
  /** `actual`/`variance` are always 0 here — only `expected` is meaningful before a closing is actually submitted. */
  breakdown: PaymentMethodBreakdown[];
  totalExpected: number;
}

/**
 * Shared by getExpectedTotals() (a live preview for the UI, computed at
 * whatever moment the page happens to read it) and createCashierClosing()
 * (the authoritative computation at submit time) — one function, so the
 * two can never disagree about what "expected" means.
 *
 * No `closingId` flag on Transaction, no schema change there at all:
 * double-counting is prevented purely by window bounds — this closing's
 * period starts exactly where the cashier's last closing's period ended
 * (or from the epoch if they've never closed before), and ends "now". The
 * previous closing already counted everything up to and including its own
 * periodEnd, so this window starts strictly *after* that instant.
 */
function computeExpectedBreakdown(cashierId: string, branchId: string): ExpectedBreakdownResult {
  const lastClosing = getLastClosing(cashierId, branchId);
  const periodStart = lastClosing?.periodEnd ?? new Date(0).toISOString();
  const periodEnd = nowIso();

  const transactionsInWindow = readCollection<Transaction>(StorageKeys.transactions).filter(
    (t) => t.branchId === branchId && t.cashierId === cashierId && t.timestamp > periodStart && t.timestamp <= periodEnd,
  );

  const breakdown: PaymentMethodBreakdown[] = PAYMENT_METHODS.map((method) => ({
    method,
    expected: transactionsInWindow.filter((t) => t.method === method).reduce((sum, t) => sum + t.total, 0),
    actual: 0,
    variance: 0,
  }));

  return {
    periodStart,
    periodEnd,
    breakdown,
    totalExpected: breakdown.reduce((sum, row) => sum + row.expected, 0),
  };
}

/** Live preview for the UI — NOT authoritative. createCashierClosing() recomputes its own fresh copy at submit time. */
export function getExpectedTotals(cashierId: string, branchId: string): ExpectedBreakdownResult {
  return computeExpectedBreakdown(cashierId, branchId);
}

export type ActualByMethod = Partial<Record<PaymentMethod, number>>;

export interface CreateCashierClosingInput {
  actualByMethod: ActualByMethod;
  pin: string;
}

/**
 * `branchId` is deliberately NOT a parameter — derived from the cashier's
 * own master record (same "auto branch-scoping" rule recordClockIn()
 * follows), never trusted from the caller. `actualByMethod` is validated
 * field-by-field (all 5 methods present, each a non-negative finite
 * number) before anything is written, and expected is recomputed from
 * scratch here rather than trusting whatever the UI last displayed.
 */
export function createCashierClosing(cashierId: string, input: CreateCashierClosingInput): CashierClosing {
  if (!verifyEmployeePin(cashierId, input.pin)) {
    throw new Error('PIN salah.');
  }
  const employee = getEmployeeById(cashierId);
  if (!employee) {
    throw new Error('Employee tidak ditemukan.');
  }
  for (const method of PAYMENT_METHODS) {
    const actual = input.actualByMethod[method];
    if (typeof actual !== 'number' || !Number.isFinite(actual) || actual < 0) {
      throw new Error(`Actual untuk ${method} wajib diisi dan tidak boleh negatif.`);
    }
  }

  const { periodStart, periodEnd, breakdown: expectedBreakdown, totalExpected } = computeExpectedBreakdown(
    cashierId,
    employee.branchId,
  );

  const breakdown: PaymentMethodBreakdown[] = expectedBreakdown.map((row) => {
    const actual = input.actualByMethod[row.method] as number;
    return { ...row, actual, variance: actual - row.expected };
  });
  const totalActual = breakdown.reduce((sum, row) => sum + row.actual, 0);

  const closing: CashierClosing = {
    id: generateId('close'),
    branchId: employee.branchId,
    cashierId: employee.id,
    cashierName: employee.name,
    periodStart,
    periodEnd,
    breakdown,
    totalExpected,
    totalActual,
    totalVariance: totalActual - totalExpected,
    createdAt: nowIso(),
  };

  const closings = readCollection<CashierClosing>(StorageKeys.cashierClosings);
  closings.push(closing);
  writeCollection(StorageKeys.cashierClosings, closings);
  return closing;
}

export function getClosingHistory(cashierId: string, branchId: string, limit = 10): CashierClosing[] {
  return readCollection<CashierClosing>(StorageKeys.cashierClosings)
    .filter((c) => c.cashierId === cashierId && c.branchId === branchId)
    .sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : -1))
    .slice(0, limit);
}
