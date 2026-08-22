import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import type { HeldBill, TransactionCustomer, TransactionLineItem } from './types';

export function getHeldBills(branchId: string): HeldBill[] {
  return readCollection<HeldBill>(StorageKeys.heldBills)
    .filter((bill) => bill.branchId === branchId)
    .sort((a, b) => (a.savedAt < b.savedAt ? -1 : 1));
}

export interface HoldBillInput {
  branchId: string;
  customer: TransactionCustomer | null;
  items: TransactionLineItem[];
}

export function holdBill(input: HoldBillInput): HeldBill {
  if (input.items.length === 0) {
    throw new Error('Keranjang kosong, tidak ada yang disimpan.');
  }
  const bills = readCollection<HeldBill>(StorageKeys.heldBills);
  const bill: HeldBill = {
    id: generateId('hold'),
    branchId: input.branchId,
    customer: input.customer,
    items: input.items,
    savedAt: nowIso(),
  };
  bills.push(bill);
  writeCollection(StorageKeys.heldBills, bills);
  return bill;
}

/**
 * `branchId` is required (not just `billId`) so a bill can only be
 * retrieved from the branch it was held in — defense in depth, matching
 * checkout()'s "don't trust the caller" stance, even though the UI only
 * ever lists bills already filtered by getHeldBills(branchId).
 */
export function retrieveHeldBill(billId: string, branchId: string): HeldBill {
  const bills = readCollection<HeldBill>(StorageKeys.heldBills);
  const bill = bills.find((b) => b.id === billId);
  if (!bill || bill.branchId !== branchId) {
    throw new Error('Bill tidak ditemukan di cabang ini.');
  }
  writeCollection(
    StorageKeys.heldBills,
    bills.filter((b) => b.id !== billId),
  );
  return bill;
}
