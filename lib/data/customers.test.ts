import { beforeEach, describe, expect, it } from 'vitest';
import { StorageKeys, writeCollection } from './storage';
import {
  getCustomers,
  getCustomerById,
  getCustomerPreferences,
  createCustomer,
  updateCustomer,
  updateCustomerPreferences,
  deleteCustomer,
} from './customers';
import { DEFAULT_CUSTOMER_PREFERENCES } from './types';
import type { Customer, Employee } from './types';

const barberRio: Employee = {
  id: 'emp_rio',
  name: 'Rio Saputra',
  role: 'Barber',
  branchId: 'br_bypass',
  pin: '2222',
};

const kasirDedi: Employee = {
  id: 'emp_dedi',
  name: 'Dedi Kurniawan',
  role: 'Kasir',
  branchId: 'br_bypass',
  pin: '1111',
};

function seedEmployees() {
  writeCollection<Employee>(StorageKeys.employees, [barberRio, kasirDedi]);
}

function seedCustomer(overrides: Partial<Customer> = {}): Customer {
  const customer: Customer = {
    id: 'cust_andi',
    name: 'Andi Pratama',
    phone: '081234567890',
    type: 'member',
    tier: 'Gold',
    points: 340,
    createdAt: '2026-01-01T00:00:00.000Z',
    preferences: { ...DEFAULT_CUSTOMER_PREFERENCES },
    ...overrides,
  };
  writeCollection<Customer>(StorageKeys.customers, [customer]);
  return customer;
}

beforeEach(() => {
  window.localStorage.clear();
  seedEmployees();
});

describe('Customer Preferences — Fallback & Normalization (Backward Compatibility)', () => {
  it('returns DEFAULT_CUSTOMER_PREFERENCES for legacy customer records lacking the preferences field', () => {
    // Simulasi data lama di storage yang belum memiliki key `preferences`
    const rawLegacy = {
      id: 'cust_legacy',
      name: 'Legacy Member',
      phone: '081199887766',
      type: 'member' as const,
      tier: 'Silver' as const,
      points: 100,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    writeCollection(StorageKeys.customers, [rawLegacy]);

    const retrieved = getCustomerById('cust_legacy');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.preferences).toEqual(DEFAULT_CUSTOMER_PREFERENCES);

    const preferences = getCustomerPreferences('cust_legacy');
    expect(preferences).toEqual(DEFAULT_CUSTOMER_PREFERENCES);
  });

  it('createCustomer without preferences assigns DEFAULT_CUSTOMER_PREFERENCES', () => {
    const created = createCustomer({
      name: 'Budi Santoso',
      phone: '081322114478',
      type: 'member',
      tier: 'Bronze',
      points: 0,
    });

    expect(created.preferences).toEqual(DEFAULT_CUSTOMER_PREFERENCES);
    expect(getCustomerPreferences(created.id)).toEqual(DEFAULT_CUSTOMER_PREFERENCES);
  });

  it('getCustomerById returns null for nonexistent customer', () => {
    expect(getCustomerById('cust_nonexistent')).toBeNull();
  });

  it('getCustomerPreferences throws if customer does not exist', () => {
    expect(() => getCustomerPreferences('cust_nonexistent')).toThrowError('Customer tidak ditemukan.');
  });
});

describe('createCustomer with initial preferences', () => {
  it('stores provided preferences and sanitizes string whitespace', () => {
    const created = createCustomer({
      name: 'Citra Dewi',
      phone: '085777901123',
      type: 'member',
      tier: 'Platinum',
      points: 50,
      preferences: {
        preferredBarberId: 'emp_rio',
        preferredStyle: '  Layer Cut  ',
        preferredProduct: '  Hair Tonic  ',
        notes: '  Kulit kepala sensitif  ',
      },
    });

    expect(created.preferences).toEqual({
      preferredBarberId: 'emp_rio',
      preferredStyle: 'Layer Cut',
      preferredProduct: 'Hair Tonic',
      notes: 'Kulit kepala sensitif',
    });
  });

  it('validates preferredBarberId during createCustomer', () => {
    expect(() =>
      createCustomer({
        name: 'Citra Dewi',
        phone: '085777901123',
        type: 'member',
        tier: 'Platinum',
        points: 0,
        preferences: { preferredBarberId: 'emp_unknown' },
      }),
    ).toThrowError('Barber tidak ditemukan.');

    expect(() =>
      createCustomer({
        name: 'Citra Dewi',
        phone: '085777901123',
        type: 'member',
        tier: 'Platinum',
        points: 0,
        preferences: { preferredBarberId: 'emp_dedi' },
      }),
    ).toThrowError('Employee yang dipilih bukan merupakan Barber.');
  });
});

describe('updateCustomerPreferences — Happy Path', () => {
  it('updates preferences partially while preserving untouched fields', () => {
    const customer = seedCustomer({
      preferences: {
        preferredBarberId: 'emp_rio',
        preferredStyle: 'Side Part',
        preferredProduct: 'Matte Pomade',
        notes: 'Garis pinggir rapi',
      },
    });

    const updated = updateCustomerPreferences(customer.id, {
      preferredStyle: 'Undercut Fade',
    });

    expect(updated.preferences).toEqual({
      preferredBarberId: 'emp_rio',
      preferredStyle: 'Undercut Fade',
      preferredProduct: 'Matte Pomade',
      notes: 'Garis pinggir rapi',
    });
  });

  it('assigns a valid barber with role Barber', () => {
    const customer = seedCustomer();
    const updated = updateCustomerPreferences(customer.id, {
      preferredBarberId: 'emp_rio',
    });

    expect(updated.preferences?.preferredBarberId).toBe('emp_rio');
    expect(getCustomerPreferences(customer.id).preferredBarberId).toBe('emp_rio');
  });

  it('clears preferredBarberId when passed null or empty string', () => {
    const customer = seedCustomer({
      preferences: { ...DEFAULT_CUSTOMER_PREFERENCES, preferredBarberId: 'emp_rio' },
    });

    const clearedNull = updateCustomerPreferences(customer.id, { preferredBarberId: null });
    expect(clearedNull.preferences?.preferredBarberId).toBeNull();

    // Set ulang lalu kosongkan kembali dengan string spasi
    updateCustomerPreferences(customer.id, { preferredBarberId: 'emp_rio' });
    const clearedEmpty = updateCustomerPreferences(customer.id, { preferredBarberId: '   ' });
    expect(clearedEmpty.preferences?.preferredBarberId).toBeNull();
  });

  it('updates all preference fields simultaneously with trimmed strings', () => {
    const customer = seedCustomer();
    const updated = updateCustomerPreferences(customer.id, {
      preferredBarberId: 'emp_rio',
      preferredStyle: '  French Crop  ',
      preferredProduct: '  Water-based Pomade  ',
      notes: '  Jangan pakai pisau cukur di leher  ',
    });

    expect(updated.preferences).toEqual({
      preferredBarberId: 'emp_rio',
      preferredStyle: 'French Crop',
      preferredProduct: 'Water-based Pomade',
      notes: 'Jangan pakai pisau cukur di leher',
    });
  });
});

describe('updateCustomerPreferences — Validation Guards & Errors', () => {
  it('throws when updating a customer that does not exist', () => {
    expect(() =>
      updateCustomerPreferences('cust_missing', { preferredStyle: 'Fade' }),
    ).toThrowError('Customer tidak ditemukan.');
  });

  it('throws when preferredBarberId is not found in employee list', () => {
    const customer = seedCustomer();
    expect(() =>
      updateCustomerPreferences(customer.id, { preferredBarberId: 'emp_ghost' }),
    ).toThrowError('Barber tidak ditemukan.');
  });

  it('throws when preferredBarberId belongs to an employee with a non-Barber role', () => {
    const customer = seedCustomer();
    expect(() =>
      updateCustomerPreferences(customer.id, { preferredBarberId: 'emp_dedi' }),
    ).toThrowError('Employee yang dipilih bukan merupakan Barber.');
  });

  it('leaves storage unmodified when validation throws an error', () => {
    const customer = seedCustomer({
      preferences: {
        preferredBarberId: null,
        preferredStyle: 'Original Style',
        preferredProduct: '',
        notes: '',
      },
    });

    expect(() =>
      updateCustomerPreferences(customer.id, {
        preferredBarberId: 'emp_dedi',
        preferredStyle: 'New Style',
      }),
    ).toThrowError();

    const current = getCustomerById(customer.id);
    expect(current?.preferences?.preferredStyle).toBe('Original Style');
  });
});

describe('updateCustomer & deleteCustomer integration', () => {
  it('updateCustomer updates preferences when provided in patch', () => {
    const customer = seedCustomer();
    const updated = updateCustomer(customer.id, {
      name: 'Andi P. Baru',
      preferences: { preferredStyle: 'Buzz Cut' },
    });

    expect(updated.name).toBe('Andi P. Baru');
    expect(updated.preferences?.preferredStyle).toBe('Buzz Cut');
  });

  it('deleteCustomer removes customer and their preferences', () => {
    const customer = seedCustomer();
    deleteCustomer(customer.id);

    expect(getCustomerById(customer.id)).toBeNull();
    expect(() => getCustomerPreferences(customer.id)).toThrowError('Customer tidak ditemukan.');
  });
});
