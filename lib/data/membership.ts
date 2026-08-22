import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { canApproveRedemption, canEditHoldingData } from './rbac';
import type {
  Customer,
  Employee,
  LoyaltyLedgerEntry,
  LoyaltyLedgerEntryType,
  RewardCatalogItem,
  RewardRedemption,
  Transaction,
} from './types';

const POINTS_EARN_RATE = 10000; // Rp10.000 = 1 poin
const REFERRAL_BONUS_POINTS = 10;

export function getLoyaltyLedger(customerId: string): LoyaltyLedgerEntry[] {
  return readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger)
    .filter((e) => e.customerId === customerId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export interface RecordLoyaltyLedgerEntryInput {
  customerId: string;
  type: LoyaltyLedgerEntryType;
  /** Signed — positive adds to balance, negative subtracts. */
  points: number;
  reference: string;
  note?: string;
  actorId: string;
}

/**
 * The one and only place Customer.points gets mutated — mirrors
 * recordStockMove()'s relationship to InventoryBalance, including the
 * snapshot+rollback shape: both `loyaltyLedger` and `customers` are
 * snapshotted up front and restored together if either write fails, so a
 * failed call never leaves the ledger and the cached balance disagreeing.
 *
 * Unlike recordStockMove(), which silently clamps an over-sold balance to
 * 0 (a real-world constraint — physical stock can't go negative), this
 * THROWS instead of clamping if the resulting balance would go negative.
 * Reasoning: an over-sale of stock is a routine race the system has to
 * absorb gracefully, but a negative points balance almost always means a
 * caller skipped a balance check it should have done (e.g. a redemption
 * approved without re-validating). Clamping would silently hide that bug;
 * throwing surfaces it immediately, consistent with how checkout() and
 * every other money-adjacent function in this app refuses to guess.
 */
export function recordLoyaltyLedgerEntry(input: RecordLoyaltyLedgerEntryInput): LoyaltyLedgerEntry {
  const customersSnapshot = structuredClone(readCollection<Customer>(StorageKeys.customers));
  const ledgerSnapshot = structuredClone(readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger));

  try {
    const customers = readCollection<Customer>(StorageKeys.customers);
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) {
      throw new Error('Customer tidak ditemukan.');
    }
    const newBalance = customer.points + input.points;
    if (newBalance < 0) {
      throw new Error('Saldo poin tidak boleh menjadi negatif.');
    }

    const entry: LoyaltyLedgerEntry = {
      id: generateId('loy'),
      customerId: input.customerId,
      type: input.type,
      points: input.points,
      reference: input.reference,
      note: input.note ?? '',
      actorId: input.actorId,
      timestamp: nowIso(),
    };

    const ledger = readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger);
    ledger.push(entry);
    writeCollection(StorageKeys.loyaltyLedger, ledger);

    customer.points = newBalance;
    writeCollection(StorageKeys.customers, customers);

    return entry;
  } catch (err) {
    writeCollection(StorageKeys.customers, customersSnapshot);
    writeCollection(StorageKeys.loyaltyLedger, ledgerSnapshot);
    throw err;
  }
}

/** Rp10.000 = 1 poin, floor'd, no carry-over of the remainder to future transactions. */
export function calculateEarnedPoints(subtotal: number): number {
  return Math.floor(subtotal / POINTS_EARN_RATE);
}

/**
 * Called by checkout() as part of its atomic operation (see transactions.ts
 * — this is folded into checkout()'s own snapshot/rollback, not a
 * best-effort call after the fact). No-ops entirely — not even a 0-point
 * ledger entry — for guests, and for members whose subtotal earns 0 points.
 */
export function earnPointsForTransaction(transaction: Transaction): void {
  if (transaction.customer.type !== 'member' || transaction.customer.customerId === null) {
    return;
  }
  const points = calculateEarnedPoints(transaction.subtotal);
  if (points <= 0) return;

  recordLoyaltyLedgerEntry({
    customerId: transaction.customer.customerId,
    type: 'earn',
    points,
    reference: transaction.id,
    note: 'Poin dari transaksi POS',
    actorId: transaction.cashierId,
  });
}

export interface RecordReferralBonusInput {
  referrerId: string;
  referredId: string;
  actorId: string;
}

/**
 * Fires once, right after a referred person's member activation succeeds.
 * Called by the POS page directly (NOT by checkout()) — this is a
 * data-completeness concern, not a money-safety one, so it doesn't need
 * checkout()'s atomicity guarantee for the *cart*. It still needs its own
 * atomicity for the *pair of bonuses* though: this makes two separate
 * recordLoyaltyLedgerEntry() calls, and each of those already has its own
 * inner snapshot/rollback — but that only protects each call individually.
 * Without an outer safety net here, a referrerId that's valid but a
 * referredId that isn't would leave the referrer holding a bonus for a
 * referral that never actually completed. So this function snapshots
 * `customers`/`loyaltyLedger` itself too and rolls both back to
 * "before either call" if either of the two inner calls throws — same
 * two-layer pattern as checkout(), applied to a two-write operation instead
 * of a six-write one.
 *
 * Three explicit guards, in order:
 *  1. Self-referral (referrerId === referredId) is rejected before any
 *     write happens — a customer cannot earn a bonus by "referring"
 *     themselves.
 *  2. An invalid referrerId or referredId throws — recordLoyaltyLedgerEntry
 *     already throws "Customer tidak ditemukan." for a missing customer, and
 *     because of the outer rollback above that failure undoes BOTH writes,
 *     not just the one that happened to fail first (there is no path where
 *     only one side of a referral pair ends up with points).
 *  3. Double-processing the SAME referral pair is rejected: before writing
 *     anything, this checks whether a 'referral_bonus' entry already links
 *     these two customer IDs (in either direction) and throws if so. This
 *     makes the function itself idempotent for a given (referrerId,
 *     referredId) pair — the caller (the future POS "Daftar Member Baru"
 *     flow) does NOT need to be the one preventing a double-click or retry
 *     from paying the bonus twice; the data layer already refuses it.
 */
export function recordReferralBonus(input: RecordReferralBonusInput): void {
  if (input.referrerId === input.referredId) {
    throw new Error('Customer tidak bisa mereferensikan dirinya sendiri.');
  }

  const alreadyRewarded = readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger).some(
    (entry) =>
      entry.type === 'referral_bonus' &&
      ((entry.customerId === input.referrerId && entry.reference === input.referredId) ||
        (entry.customerId === input.referredId && entry.reference === input.referrerId)),
  );
  if (alreadyRewarded) {
    throw new Error('Bonus referral untuk pasangan customer ini sudah pernah diberikan.');
  }

  const customersSnapshot = structuredClone(readCollection<Customer>(StorageKeys.customers));
  const ledgerSnapshot = structuredClone(readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger));

  try {
    recordLoyaltyLedgerEntry({
      customerId: input.referrerId,
      type: 'referral_bonus',
      points: REFERRAL_BONUS_POINTS,
      reference: input.referredId,
      note: 'Bonus referral — mengajak member baru',
      actorId: input.actorId,
    });
    recordLoyaltyLedgerEntry({
      customerId: input.referredId,
      type: 'referral_bonus',
      points: REFERRAL_BONUS_POINTS,
      reference: input.referrerId,
      note: 'Bonus referral — diajak oleh member lain',
      actorId: input.actorId,
    });
  } catch (err) {
    writeCollection(StorageKeys.customers, customersSnapshot);
    writeCollection(StorageKeys.loyaltyLedger, ledgerSnapshot);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reward Catalog — Holding-scope, Owner/HQ-only to mutate (same rule as
// Branch Management / Product & Service Master).
// ---------------------------------------------------------------------------

export function getRewardCatalog(): RewardCatalogItem[] {
  return readCollection<RewardCatalogItem>(StorageKeys.rewardCatalog);
}

export interface CreateRewardCatalogItemInput {
  name: string;
  pointsCost: number;
  description: string;
  active: boolean;
}

function validateRewardInput(input: Partial<CreateRewardCatalogItemInput>): void {
  if (input.name !== undefined && !input.name.trim()) throw new Error('Nama reward wajib diisi.');
  if (input.pointsCost !== undefined && input.pointsCost <= 0) throw new Error('Biaya poin harus lebih dari 0.');
}

export function createRewardCatalogItem(input: CreateRewardCatalogItemInput, actingEmployee: Employee): RewardCatalogItem {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa menambah reward.');
  validateRewardInput(input);

  const catalog = getRewardCatalog();
  const item: RewardCatalogItem = { id: generateId('rwd'), ...input, name: input.name.trim() };
  catalog.push(item);
  writeCollection(StorageKeys.rewardCatalog, catalog);
  return item;
}

export type UpdateRewardCatalogItemInput = Partial<CreateRewardCatalogItemInput>;

export function updateRewardCatalogItem(
  rewardId: string,
  patch: UpdateRewardCatalogItemInput,
  actingEmployee: Employee,
): RewardCatalogItem {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa mengubah reward.');
  validateRewardInput(patch);

  const catalog = getRewardCatalog();
  const item = catalog.find((r) => r.id === rewardId);
  if (!item) throw new Error('Reward tidak ditemukan.');
  Object.assign(item, patch, patch.name !== undefined ? { name: patch.name.trim() } : {});
  writeCollection(StorageKeys.rewardCatalog, catalog);
  return item;
}

export function deleteRewardCatalogItem(rewardId: string, actingEmployee: Employee): void {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa menghapus reward.');
  writeCollection(
    StorageKeys.rewardCatalog,
    getRewardCatalog().filter((r) => r.id !== rewardId),
  );
}

// ---------------------------------------------------------------------------
// Redemption — request (no ledger touch) then approve/reject. Not wired to
// POS/checkout in this round — this is the POV Manajemen approval flow
// CLAUDE.md describes, not a "pay with points" register feature.
// ---------------------------------------------------------------------------

export function getRedemptions(): RewardRedemption[] {
  return readCollection<RewardRedemption>(StorageKeys.rewardRedemptions);
}

export function getRedemptionsForCustomer(customerId: string): RewardRedemption[] {
  return getRedemptions().filter((r) => r.customerId === customerId);
}

export interface RequestRedemptionInput {
  customerId: string;
  rewardId: string;
}

/**
 * Creates a pending request only — no ledger entry, no points touched yet.
 * The balance check here is a soft/early one so an obviously-doomed
 * request doesn't even get created; it is NOT the authoritative check —
 * decideRedemption() re-validates for real at approval time, since the
 * balance can drift between request and approval.
 */
export function requestRedemption(input: RequestRedemptionInput): RewardRedemption {
  const customer = readCollection<Customer>(StorageKeys.customers).find((c) => c.id === input.customerId);
  if (!customer) throw new Error('Customer tidak ditemukan.');

  const reward = getRewardCatalog().find((r) => r.id === input.rewardId);
  if (!reward) throw new Error('Reward tidak ditemukan.');
  if (!reward.active) throw new Error('Reward ini sudah tidak aktif.');
  if (customer.points < reward.pointsCost) {
    throw new Error('Saldo poin customer tidak cukup untuk reward ini.');
  }

  const redemption: RewardRedemption = {
    id: generateId('redm'),
    customerId: input.customerId,
    rewardId: reward.id,
    rewardName: reward.name,
    pointsCost: reward.pointsCost,
    status: 'pending',
    requestedAt: nowIso(),
    decidedAt: null,
    decidedBy: null,
  };

  const redemptions = getRedemptions();
  redemptions.push(redemption);
  writeCollection(StorageKeys.rewardRedemptions, redemptions);
  return redemption;
}

export type RedemptionDecision = 'approved' | 'rejected';

/**
 * Approving is the ONLY path that ever touches the loyalty ledger, and it
 * re-validates the customer's CURRENT balance right here — not the balance
 * from request time, which may be stale (e.g. spent on a different
 * redemption approved in between). If the balance check fails, this
 * throws BEFORE `redemptions` is written at all, so the request is left
 * exactly as it was (still 'pending'), not silently marked approved.
 * Rejecting never touches points — nothing was ever spent.
 *
 * Owner or BranchManager only (canApproveRedemption) — Kasir/Barber cannot
 * approve or reject. Checked before the redemption lookup, same ordering
 * as the Reward Catalog mutators above.
 */
export function decideRedemption(
  redemptionId: string,
  decision: RedemptionDecision,
  actingEmployee: Employee,
): RewardRedemption {
  if (!canApproveRedemption(actingEmployee)) {
    throw new Error('Hanya Owner/HQ atau Branch Manager yang bisa memproses redemption.');
  }

  const redemptions = getRedemptions();
  const redemption = redemptions.find((r) => r.id === redemptionId);
  if (!redemption) throw new Error('Redemption tidak ditemukan.');
  if (redemption.status !== 'pending') {
    throw new Error('Redemption ini sudah diputuskan sebelumnya.');
  }

  if (decision === 'approved') {
    const customer = readCollection<Customer>(StorageKeys.customers).find((c) => c.id === redemption.customerId);
    if (!customer) throw new Error('Customer tidak ditemukan.');
    if (customer.points < redemption.pointsCost) {
      throw new Error('Saldo poin customer tidak cukup lagi untuk redemption ini.');
    }
    recordLoyaltyLedgerEntry({
      customerId: redemption.customerId,
      type: 'redeem',
      points: -redemption.pointsCost,
      reference: redemption.id,
      note: `Redeem reward: ${redemption.rewardName}`,
      actorId: actingEmployee.id,
    });
  }

  redemption.status = decision;
  redemption.decidedAt = nowIso();
  redemption.decidedBy = actingEmployee.id;
  writeCollection(StorageKeys.rewardRedemptions, redemptions);
  return redemption;
}
