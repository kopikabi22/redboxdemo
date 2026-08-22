import { StorageKeys, readCollection } from './storage';
import type { Customer } from './types';

export function getCustomers(): Customer[] {
  return readCollection<Customer>(StorageKeys.customers);
}

/** Members only — Quick-Lookup in POS never searches guests (guests aren't persisted). */
export function searchMemberCustomers(query: string): Customer[] {
  const q = query.trim().toLowerCase();
  const members = getCustomers().filter((c) => c.type === 'member');
  if (!q) return members;
  return members.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
}
