import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import type { Customer, CustomerType, MembershipTier } from './types';

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

export interface CreateCustomerInput {
  name: string;
  phone: string;
  type: CustomerType;
  tier: MembershipTier | null;
  points: number;
}

/**
 * No phone-number uniqueness/dedup check here on purpose — duplicate
 * detection & merge is explicit Tier 2 scope in CLAUDE.md, not built yet.
 */
export function createCustomer(input: CreateCustomerInput): Customer {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name) throw new Error('Nama customer wajib diisi.');
  if (!phone) throw new Error('Nomor HP wajib diisi.');

  const customers = getCustomers();
  const customer: Customer = { id: generateId('cust'), ...input, name, phone, createdAt: nowIso() };
  customers.push(customer);
  writeCollection(StorageKeys.customers, customers);
  return customer;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export function updateCustomer(customerId: string, patch: UpdateCustomerInput): Customer {
  const customers = getCustomers();
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) throw new Error('Customer tidak ditemukan.');
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Nama customer wajib diisi.');
  if (patch.phone !== undefined && !patch.phone.trim()) throw new Error('Nomor HP wajib diisi.');

  Object.assign(
    customer,
    patch,
    patch.name !== undefined ? { name: patch.name.trim() } : {},
    patch.phone !== undefined ? { phone: patch.phone.trim() } : {},
  );
  writeCollection(StorageKeys.customers, customers);
  return customer;
}

/**
 * No guard needed — Transaction.customer is a point-in-time snapshot
 * (TransactionCustomer), never a live join back to this Customer record, so
 * deleting one can never corrupt historical transaction data.
 */
export function deleteCustomer(customerId: string): void {
  writeCollection(
    StorageKeys.customers,
    getCustomers().filter((c) => c.id !== customerId),
  );
}
