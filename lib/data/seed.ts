import { StorageKeys, readValue, writeCollection, writeValue } from './storage';
import { recordStockMove } from './stock';
import type { Branch, Employee, Customer, Service, Product } from './types';

const branches: Branch[] = [
  { id: 'br_bypass', name: 'Bypass', city: 'Cirebon', province: 'Jawa Barat', address: 'Jl. Bypass Ir. H. Juanda', phone: '0231-500001' },
  { id: 'br_samadikun', name: 'Samadikun', city: 'Cirebon', province: 'Jawa Barat', address: 'Jl. Samadikun', phone: '0231-500002' },
  { id: 'br_csbmall', name: 'CSB Mall', city: 'Cirebon', province: 'Jawa Barat', address: 'CSB Mall Lt. 1', phone: '0231-500003' },
  { id: 'br_sumber', name: 'Sumber', city: 'Kabupaten Cirebon', province: 'Jawa Barat', address: 'Jl. Raya Sumber', phone: '0231-500004' },
  { id: 'br_tegal', name: 'Tegal', city: 'Kota Tegal', province: 'Jawa Tengah', address: 'Jl. Diponegoro, Tegal', phone: '0283-500005' },
];

const employees: Employee[] = [
  { id: 'emp_dedi', name: 'Dedi Kurniawan', role: 'Kasir', branchId: 'br_bypass', pin: '1111' },
  { id: 'emp_rio', name: 'Rio Saputra', role: 'Barber', branchId: 'br_bypass', pin: '2222' },
  { id: 'emp_fajar', name: 'Fajar Ramadhan', role: 'Barber', branchId: 'br_samadikun', pin: '3333' },
  { id: 'emp_nita', name: 'Nita Amelia', role: 'Kasir', branchId: 'br_samadikun', pin: '4444' },
  { id: 'emp_manager_bypass', name: 'Yusuf Hidayat', role: 'BranchManager', branchId: 'br_bypass', pin: '5555' },
  { id: 'emp_owner', name: 'Bpk. Herman (Owner)', role: 'Owner', branchId: 'br_bypass', pin: '9999' },
];

const customers: Customer[] = [
  { id: 'cust_andi', name: 'Andi Pratama', phone: '081234567890', type: 'member', tier: 'Gold', points: 340, createdAt: new Date().toISOString() },
  { id: 'cust_budi', name: 'Budi Santoso', phone: '081322114478', type: 'member', tier: 'Silver', points: 120, createdAt: new Date().toISOString() },
  { id: 'cust_citra', name: 'Citra Dewi', phone: '085777901123', type: 'member', tier: 'Platinum', points: 980, createdAt: new Date().toISOString() },
  { id: 'cust_reza', name: 'Reza Firmansyah', phone: '082144569902', type: 'member', tier: 'Bronze', points: 15, createdAt: new Date().toISOString() },
];

const services: Service[] = [
  { id: 'svc_haircut', name: 'Haircut Reguler', category: 'Rambut', durationMinutes: 30, price: 60000, commissionPercent: 20 },
  { id: 'svc_haircut_premium', name: 'Haircut Premium + Styling', category: 'Rambut', durationMinutes: 45, price: 95000, commissionPercent: 25 },
  { id: 'svc_shave', name: 'Shaving Klasik', category: 'Cukur', durationMinutes: 20, price: 45000, commissionPercent: 20 },
  { id: 'svc_coloring', name: 'Hair Coloring', category: 'Rambut', durationMinutes: 60, price: 150000, commissionPercent: 20 },
  { id: 'svc_facial', name: 'Facial Treatment', category: 'Perawatan', durationMinutes: 30, price: 80000, commissionPercent: 20 },
];

const products: Product[] = [
  { id: 'prd_pomade', sku: 'SKU-0001', name: 'Pomade Matte 100g', category: 'Styling', brand: 'RedBox Grooming', cost: 25000, price: 55000, lowStockThreshold: 10 },
  { id: 'prd_shampoo', sku: 'SKU-0002', name: 'Shampoo Anti Ketombe 200ml', category: 'Perawatan Rambut', brand: 'RedBox Grooming', cost: 18000, price: 40000, lowStockThreshold: 10 },
  { id: 'prd_beardoil', sku: 'SKU-0003', name: 'Beard Oil 30ml', category: 'Grooming', brand: 'RedBox Grooming', cost: 30000, price: 65000, lowStockThreshold: 5 },
  { id: 'prd_wax', sku: 'SKU-0004', name: 'Hair Wax Strong Hold', category: 'Styling', brand: 'RedBox Grooming', cost: 22000, price: 50000, lowStockThreshold: 10 },
];

/**
 * Populates localStorage with demo data the first time the app runs in a
 * given browser. No-ops on every subsequent call (guarded by the
 * `rb_seeded_v1` flag) and on the server (readValue/writeValue are
 * no-ops outside the browser).
 */
export function ensureSeedData(): void {
  if (readValue(StorageKeys.seeded, false)) return;

  writeCollection(StorageKeys.branches, branches);
  writeCollection(StorageKeys.employees, employees);
  writeCollection(StorageKeys.customers, customers);
  writeCollection(StorageKeys.services, services);
  writeCollection(StorageKeys.products, products);
  writeCollection(StorageKeys.stockMoves, []);
  writeCollection(StorageKeys.transactions, []);
  writeCollection(StorageKeys.cashMoves, []);
  writeCollection(StorageKeys.attendance, []);

  branches.forEach((branch) => {
    products.forEach((product) => {
      const startQty = product.id === 'prd_beardoil' ? 4 : product.id === 'prd_wax' ? 8 : 30;
      recordStockMove({
        productId: product.id,
        branchId: branch.id,
        type: 'in',
        qty: startQty,
        reference: 'SEED',
        note: 'Stok awal demo',
        actorId: 'system',
      });
    });
  });

  writeValue(StorageKeys.seeded, true);
}
