import { checkout } from './transactions';
import { createCustomer } from './customers';
import { recordReferralBonus } from './membership';
import { getServices } from './catalog';
import type { Customer, PaymentMethod, Transaction } from './types';

/**
 * Sits above transactions.ts, customers.ts, and membership.ts on purpose —
 * membership.ts already gets imported BY transactions.ts (for
 * earnPointsForTransaction), so if this orchestration lived inside
 * membership.ts and imported checkout() from transactions.ts, that would be
 * a circular import. A separate file that only ever gets imported by pages
 * avoids that. (catalog.ts has no such cycle — it only imports storage,
 * rbac, stock, branches — so importing getServices() here is safe.)
 */

/**
 * Fixed seed id (seed.ts) for the "Aktivasi Member" Service record — NOT a
 * hardcoded fee. The price is read from this Service's `price` field every
 * time, so Owner/HQ can change it via Product & Service Master like any
 * other price in the system, without a code change or redeploy. Rp100.000
 * is only the CLAUDE.md-specified seed default, not a ceiling or a constant
 * baked into this module.
 */
export const MEMBERSHIP_ACTIVATION_SERVICE_ID = 'svc_membership_activation';

/**
 * Returns null (not a fallback number) if the seed service is missing —
 * e.g. an Owner deleted it from Product & Service Master, since
 * deleteService() has no special protection against removing this
 * particular row. Callers must handle null explicitly rather than silently
 * charging a guessed amount.
 */
export function getMembershipActivationFee(): number | null {
  const service = getServices().find((s) => s.id === MEMBERSHIP_ACTIVATION_SERVICE_ID);
  return service ? service.price : null;
}

export interface ActivateMembershipInput {
  branchId: string;
  cashierId: string;
  cashierName: string;
  name: string;
  phone: string;
  method: PaymentMethod;
  cashTendered: number;
  /** Already resolved + confirmed by the UI (phone lookup) before this is called — not a raw phone string. */
  referrerId?: string;
}

export interface ActivateMembershipResult {
  transaction: Transaction;
  customer: Customer;
}

/**
 * Thrown when the activation fee's checkout() already committed before
 * createCustomer() or recordReferralBonus() failed. Carries the committed
 * transaction so the caller can distinguish "nothing happened, safe to let
 * the cashier retry" (a plain Error from checkout() itself failing) from
 * "money was already collected, do NOT retry blindly — that would
 * double-charge, this needs manual follow-up instead" (this class).
 */
export class MembershipActivationError extends Error {
  committedTransaction: Transaction;

  constructor(message: string, committedTransaction: Transaction) {
    super(message);
    this.name = 'MembershipActivationError';
    this.committedTransaction = committedTransaction;
  }
}

/**
 * The activation fee is collected as its own checkout() — a single "Aktivasi
 * Member" line, customer recorded as guest (the member doesn't exist yet
 * while checkout() runs), which is why an activation transaction never
 * earns loyalty points: earnPointsForTransaction() no-ops for guest-type
 * transactions, and that's a deliberate consequence of this ordering, not
 * an oversight.
 *
 * IMPORTANT — no rollback of the checkout() once it succeeds. Unlike
 * checkout()'s own internal rollback (pure database state, safe to undo),
 * once this function's checkout() call returns, the cashier has physically
 * collected Rp100.000 from the customer — there is no way to "un-collect"
 * that from here. So if createCustomer() or recordReferralBonus() throws
 * AFTER the checkout() succeeded, this function does NOT try to reverse the
 * payment; it lets the error propagate with the transaction already
 * committed, so the caller (the POS page) can tell the cashier plainly
 * "pembayaran sudah diterima, tapi member gagal dibuat — transaksi #X,
 * perlu ditindaklanjuti manual" instead of the payment silently vanishing
 * with no record at all. It also logs the full failure (transaction id,
 * name, phone, reason) via console.error at the moment it happens, so
 * there's a trail in DevTools/browser logs even if the cashier reloads the
 * page before acting on the on-screen banner.
 */
export function activateMembership(input: ActivateMembershipInput): ActivateMembershipResult {
  const fee = getMembershipActivationFee();
  if (fee === null) {
    // Nothing charged yet — a plain Error, NOT MembershipActivationError.
    throw new Error('Service Aktivasi Member tidak ditemukan di katalog. Hubungi Owner/HQ untuk mengatur ulang.');
  }

  const transaction = checkout({
    branchId: input.branchId,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    customer: { type: 'guest', customerId: null, name: input.name, phone: input.phone, tier: null },
    items: [
      {
        kind: 'service',
        itemId: MEMBERSHIP_ACTIVATION_SERVICE_ID,
        name: 'Aktivasi Member',
        price: fee,
        qty: 1,
        // Flat fee per CLAUDE.md — not a taxable goods/service sale.
        taxable: false,
      },
    ],
    method: input.method,
    cashTendered: input.cashTendered,
  });

  try {
    const customer = createCustomer({ name: input.name, phone: input.phone, type: 'member', tier: 'Bronze', points: 0 });

    if (input.referrerId) {
      recordReferralBonus({ referrerId: input.referrerId, referredId: customer.id, actorId: input.cashierId });
    }

    return { transaction, customer };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyelesaikan pendaftaran member.';
    console.error(
      '[redbox] Aktivasi member: pembayaran SUDAH diterima tapi pendaftaran gagal diselesaikan.',
      { transactionId: transaction.id, name: input.name, phone: input.phone, referrerId: input.referrerId ?? null, reason: message },
    );
    throw new MembershipActivationError(message, transaction);
  }
}
