import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { getEmployeeById } from './employees';
import { DEFAULT_CUSTOMER_PREFERENCES } from './types';
import type { Customer, CustomerPreferences, CustomerType, MembershipTier } from './types';

/**
 * Memastikan customer memiliki objek `preferences` lengkap.
 * Memberikan fallback ke DEFAULT_CUSTOMER_PREFERENCES jika data lama di localStorage belum memilikinya.
 */
export function normalizeCustomer(customer: Customer): Customer {
  return {
    ...customer,
    preferences: {
      preferredBarberId: customer.preferences?.preferredBarberId ?? DEFAULT_CUSTOMER_PREFERENCES.preferredBarberId,
      preferredStyle: customer.preferences?.preferredStyle ?? DEFAULT_CUSTOMER_PREFERENCES.preferredStyle,
      preferredProduct: customer.preferences?.preferredProduct ?? DEFAULT_CUSTOMER_PREFERENCES.preferredProduct,
      notes: customer.preferences?.notes ?? DEFAULT_CUSTOMER_PREFERENCES.notes,
    },
  };
}

export function getCustomers(): Customer[] {
  return readCollection<Customer>(StorageKeys.customers).map(normalizeCustomer);
}

export function getCustomerById(customerId: string): Customer | null {
  const customer = getCustomers().find((c) => c.id === customerId);
  return customer ?? null;
}

/** Members only — Quick-Lookup in POS never searches guests (guests aren't persisted). */
export function searchMemberCustomers(query: string): Customer[] {
  const q = query.trim().toLowerCase();
  const members = getCustomers().filter((c) => c.type === 'member');
  if (!q) return members;
  return members.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
}

export function getCustomerPreferences(customerId: string): CustomerPreferences {
  const customer = getCustomerById(customerId);
  if (!customer) throw new Error('Customer tidak ditemukan.');
  return customer.preferences ?? { ...DEFAULT_CUSTOMER_PREFERENCES };
}

function sanitizePreferences(
  patch: Partial<CustomerPreferences>,
  current: CustomerPreferences = DEFAULT_CUSTOMER_PREFERENCES,
): CustomerPreferences {
  let preferredBarberId = current.preferredBarberId;
  if (patch.preferredBarberId !== undefined) {
    if (patch.preferredBarberId === null || patch.preferredBarberId.trim() === '') {
      preferredBarberId = null;
    } else {
      const barberId = patch.preferredBarberId.trim();
      const employee = getEmployeeById(barberId);
      if (!employee) {
        throw new Error('Barber tidak ditemukan.');
      }
      if (employee.role !== 'Barber') {
        throw new Error('Employee yang dipilih bukan merupakan Barber.');
      }
      preferredBarberId = employee.id;
    }
  }

  return {
    preferredBarberId,
    preferredStyle: patch.preferredStyle !== undefined ? patch.preferredStyle.trim() : current.preferredStyle,
    preferredProduct: patch.preferredProduct !== undefined ? patch.preferredProduct.trim() : current.preferredProduct,
    notes: patch.notes !== undefined ? patch.notes.trim() : current.notes,
  };
}

export function updateCustomerPreferences(customerId: string, patch: Partial<CustomerPreferences>): Customer {
  const customers = getCustomers();
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) throw new Error('Customer tidak ditemukan.');

  const nextPreferences = sanitizePreferences(patch, customer.preferences ?? DEFAULT_CUSTOMER_PREFERENCES);
  customer.preferences = nextPreferences;

  writeCollection(StorageKeys.customers, customers);
  return customer;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  type: CustomerType;
  tier: MembershipTier | null;
  points: number;
  preferences?: Partial<CustomerPreferences>;
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

  const preferences = input.preferences
    ? sanitizePreferences(input.preferences, DEFAULT_CUSTOMER_PREFERENCES)
    : { ...DEFAULT_CUSTOMER_PREFERENCES };

  const customers = getCustomers();
  const customer: Customer = {
    id: generateId('cust'),
    name,
    phone,
    type: input.type,
    tier: input.tier,
    points: input.points,
    preferences,
    createdAt: nowIso(),
  };
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

  if (patch.preferences !== undefined) {
    customer.preferences = sanitizePreferences(patch.preferences, customer.preferences ?? DEFAULT_CUSTOMER_PREFERENCES);
  }

  if (patch.name !== undefined) customer.name = patch.name.trim();
  if (patch.phone !== undefined) customer.phone = patch.phone.trim();
  if (patch.type !== undefined) customer.type = patch.type;
  if (patch.tier !== undefined) customer.tier = patch.tier;
  if (patch.points !== undefined) customer.points = patch.points;

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
