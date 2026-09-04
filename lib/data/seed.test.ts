import { describe, it, expect, beforeEach } from 'vitest';
import { ensureSeedData } from './seed';
import { StorageKeys, readCollection, readValue, businessPeriod, todayDateString } from './storage';
import { getExpiredBatches, getNearExpiryBatches, getProductBatches } from './batches';
import { getAccountsPayable, generateProfitAndLossReport } from './finance';
import { getCustomerReminderCandidates } from './reminders';
import { getAppointments } from './appointments';
import type {
  Branch,
  Employee,
  Transaction,
  Promotion,
  RewardCatalogItem,
  PurchaseOrder,
  PayrollRecord,
  AuditLogRecord,
} from './types';

describe('Fase 4 — demo seed', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('runs end-to-end without throwing on a completely fresh browser, and marks itself seeded', () => {
    expect(() => ensureSeedData()).not.toThrow();
    expect(readValue(StorageKeys.seeded, false)).toBe(true);
  });

  it('is idempotent — calling it again does not duplicate data', () => {
    ensureSeedData();
    const branchesAfterFirst = readCollection<Branch>(StorageKeys.branches).length;
    const txAfterFirst = readCollection<Transaction>(StorageKeys.transactions).length;

    ensureSeedData();
    expect(readCollection<Branch>(StorageKeys.branches)).toHaveLength(branchesAfterFirst);
    expect(readCollection<Transaction>(StorageKeys.transactions)).toHaveLength(txAfterFirst);
  });

  it('produces the demo scenarios section 13 asks for: batches, transactions, purchasing, promotion, reward, payroll', () => {
    ensureSeedData();

    // Inventory: active / near-expiry / expired batch for Pomade at Bypass.
    const pomadeBatches = getProductBatches().filter((b) => b.productId === 'prd_pomade' && b.branchId === 'br_bypass');
    expect(pomadeBatches.length).toBeGreaterThanOrEqual(3);
    expect(getExpiredBatches('br_bypass').some((b) => b.productId === 'prd_pomade')).toBe(true);
    expect(getNearExpiryBatches('br_bypass').some((b) => b.productId === 'prd_pomade')).toBe(true);

    // Transactions: normal sale, appointment-linked sale, and a refunded sale all exist.
    const transactions = readCollection<Transaction>(StorageKeys.transactions);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions.some((t) => t.appointmentId)).toBe(true);
    expect(transactions.some((t) => t.status === 'refunded')).toBe(true);
    // Audit trail exists for at least the refund.
    const audit = readCollection<AuditLogRecord>(StorageKeys.auditLogs);
    expect(audit.some((a) => a.action === 'REFUND_TRANSACTION')).toBe(true);

    // Purchasing: at least one draft PO and one received PO with a resulting outstanding AP.
    const pos = readCollection<PurchaseOrder>(StorageKeys.purchaseOrders);
    expect(pos.some((po) => po.status === 'draft')).toBe(true);
    expect(pos.some((po) => po.status === 'received')).toBe(true);
    const ap = getAccountsPayable('br_bypass');
    expect(ap.length).toBeGreaterThan(0);
    expect(ap.some((a) => a.status === 'unpaid' && a.remainingBalance > 0)).toBe(true);

    // Promotion: one active, usable promo.
    const promos = readCollection<Promotion>(StorageKeys.promotions);
    expect(promos.some((p) => p.active && p.code === 'REDBOX10')).toBe(true);

    // Reward catalog: at least one redeemable item.
    const rewards = readCollection<RewardCatalogItem>(StorageKeys.rewardCatalog);
    expect(rewards.length).toBeGreaterThanOrEqual(2);

    // Payroll: draft, approved, and paid coexist.
    const payroll = readCollection<PayrollRecord>(StorageKeys.payrollRecords);
    expect(payroll.some((p) => p.status === 'draft')).toBe(true);
    expect(payroll.some((p) => p.status === 'approved')).toBe(true);
    expect(payroll.some((p) => p.status === 'paid')).toBe(true);
  });

  it('produces a dormant AND a routine-due reminder candidate out of the box', () => {
    ensureSeedData();
    const candidates = getCustomerReminderCandidates('br_bypass');
    expect(candidates.some((c) => c.type === 'dormant_churn' && c.customer.id === 'cust_budi')).toBe(true);
    expect(candidates.some((c) => c.type === 'haircut_routine' && c.customer.id === 'cust_citra')).toBe(true);
  });

  it('Fase 5.1 — gives more than one branch real current-period activity, not just Bypass', () => {
    ensureSeedData();
    const transactions = readCollection<Transaction>(StorageKeys.transactions);
    const period = businessPeriod();
    const currentPeriodTx = transactions.filter((t) => businessPeriod(t.businessDate ?? t.timestamp) === period);

    const byBranch = (branchId: string) => currentPeriodTx.filter((t) => t.branchId === branchId).length;
    expect(byBranch('br_bypass')).toBeGreaterThan(10);
    expect(byBranch('br_samadikun')).toBeGreaterThan(0);
    expect(byBranch('br_csbmall')).toBeGreaterThan(0);
    // Sumber/Tegal deliberately stay at zero activity — "branch lain boleh minim
    // activity" per Fase 5.1 scope, not part of the curated multi-branch story.
    expect(byBranch('br_sumber')).toBe(0);
    expect(byBranch('br_tegal')).toBe(0);
  });

  it('Fase 5.1 — consolidated P&L for the current period is finite and within a believable (not absurd, not manufactured-perfect) range', () => {
    ensureSeedData();
    const pnl = generateProfitAndLossReport(undefined, businessPeriod());

    expect(Number.isFinite(pnl.totalRevenue)).toBe(true);
    expect(Number.isFinite(pnl.netProfit)).toBe(true);
    expect(Number.isFinite(pnl.netProfitMargin)).toBe(true);
    expect(pnl.totalRevenue).toBeGreaterThan(0);

    // Range rationale: the demo necessarily only has a few real business days of
    // current-period revenue to work with (checkout() always timestamps "now" —
    // see the Fase 5.1 comment in seed.ts), recognized against a full month's base
    // payroll for two Bypass employees. That structurally caps how close to
    // break-even the seed can land without inventing an implausible single-day
    // transaction volume. -500% is still nowhere near the previously-reported
    // ~-3132% bug (payroll dwarfing a near-zero revenue base); +200% would mean
    // the seed was tuned to look unrealistically profitable. Anything in between
    // is "a real, still-ramping business," which is the actual Fase 5.1 target —
    // not a specific fixed margin (explicitly not required by Fase 5.1 scope).
    expect(pnl.netProfitMargin).toBeGreaterThan(-500);
    expect(pnl.netProfitMargin).toBeLessThan(200);
  });

  it('Fase 5.1 — seeds one upcoming (future-dated, booked) appointment for a valid branch/barber/customer', () => {
    ensureSeedData();
    const today = todayDateString();
    const upcoming = getAppointments().filter((a) => a.status === 'booked' && a.date > today);
    expect(upcoming.length).toBeGreaterThan(0);

    const appt = upcoming[0];
    expect(appt.branchId).toBe('br_bypass');
    expect(appt.barberId).toBeTruthy();
    expect(appt.customer?.name).toBeTruthy();
    // Inside normal 09:00-21:00 operating hours.
    expect(appt.startTime >= '09:00').toBe(true);
    expect(appt.endTime <= '21:00').toBe(true);
  });

  it('self-heal path (already-seeded browser) still backfills a missing BranchManager without touching existing customer/transaction data', () => {
    ensureSeedData();
    const txCountBefore = readCollection<Transaction>(StorageKeys.transactions).length;

    // Simulate an old browser profile seeded before BranchManager existed in seed.ts.
    const employeesWithoutManager = readCollection<Employee>(StorageKeys.employees).filter((e) => e.role !== 'BranchManager');
    writeValueDirect(StorageKeys.employees, employeesWithoutManager);

    ensureSeedData(); // seeded flag is already true — takes the self-heal branch, not the fresh-seed branch

    const employeesAfter = readCollection<Employee>(StorageKeys.employees);
    expect(employeesAfter.some((e) => e.role === 'BranchManager')).toBe(true);
    // Self-heal must not re-run seedDemoScenarios() or touch existing collections.
    expect(readCollection<Transaction>(StorageKeys.transactions)).toHaveLength(txCountBefore);
  });
});

function writeValueDirect<T>(key: string, value: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}
