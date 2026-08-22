import { describe, it, expect, beforeEach } from 'vitest';
import {
  getServiceVelocityMetrics,
  getProductVelocityMetrics,
  getTopCrossSellingPairs,
  getMenuEngineeringSummary,
} from './velocityAnalytics';
import { StorageKeys, writeCollection } from './storage';
import type { Service, Product, Transaction, InventoryBalance } from './types';

const mockServices: Service[] = [
  {
    id: 'svc_haircut',
    name: 'Executive Haircut',
    category: 'Haircut',
    durationMinutes: 45,
    price: 100000,
    commissionPercent: 35,
  },
  {
    id: 'svc_beard',
    name: 'Beard Trim & Shave',
    category: 'Grooming',
    durationMinutes: 30,
    price: 50000,
    commissionPercent: 35,
  },
  {
    id: 'svc_spa',
    name: 'Premium Scalp Spa',
    category: 'Treatment',
    durationMinutes: 60,
    price: 150000,
    commissionPercent: 35,
  },
];

const mockProducts: Product[] = [
  {
    id: 'prod_clay',
    sku: 'SKU-CLAY-01',
    name: 'Redbox Matte Clay',
    category: 'Hair Styling',
    brand: 'Redbox',
    cost: 50000,
    price: 100000,
    lowStockThreshold: 5,
  },
  {
    id: 'prod_oil',
    sku: 'SKU-OIL-01',
    name: 'Redbox Beard Oil',
    category: 'Beard Care',
    brand: 'Redbox',
    cost: 30000,
    price: 70000,
    lowStockThreshold: 3,
  },
  {
    id: 'prod_dead',
    sku: 'SKU-DEAD-01',
    name: 'Old Formula Wax',
    category: 'Hair Styling',
    brand: 'Other',
    cost: 40000,
    price: 80000,
    lowStockThreshold: 2,
  },
];

const mockInventory: InventoryBalance[] = [
  {
    branchId: 'br_cirebon_bypass',
    productId: 'prod_clay',
    qty: 25,
  },
  {
    branchId: 'br_cirebon_bypass',
    productId: 'prod_oil',
    qty: 10,
  },
  {
    branchId: 'br_cirebon_bypass',
    productId: 'prod_dead',
    qty: 15,
  },
];

describe('Service & Product Velocity / Menu Engineering Module', () => {
  beforeEach(() => {
    writeCollection(StorageKeys.services, mockServices);
    writeCollection(StorageKeys.products, mockProducts);
    writeCollection(StorageKeys.inventoryBalances, mockInventory);
    writeCollection(StorageKeys.transactions, []);
  });

  describe('getServiceVelocityMetrics', () => {
    it('calculates volume, margins, and classifies services into menu engineering quadrants', () => {
      const mockTxs: Transaction[] = [
        // 5 Executive Haircuts (High Volume)
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'A', phone: '081', tier: null },
          subtotal: 500000,
          discount: 0,
          tax: 0,
          total: 500000,
          method: 'Cash',
          cashTendered: 500000,
          change: 0,
          timestamp: '2026-08-10T10:00:00Z',
          items: [{ itemId: 'svc_haircut', name: 'Executive Haircut', price: 100000, qty: 5, kind: 'service' }],
        },
        // 1 Premium Scalp Spa (Low Volume, High Margin)
        {
          id: 'tx_2',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'B', phone: '082', tier: null },
          subtotal: 150000,
          discount: 0,
          tax: 0,
          total: 150000,
          method: 'QRIS',
          cashTendered: 150000,
          change: 0,
          timestamp: '2026-08-11T11:00:00Z',
          items: [{ itemId: 'svc_spa', name: 'Premium Scalp Spa', price: 150000, qty: 1, kind: 'service' }],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const metrics = getServiceVelocityMetrics(undefined, '2026-08');

      expect(metrics).toHaveLength(3);

      const haircut = metrics.find((s) => s.serviceId === 'svc_haircut');
      expect(haircut).toBeDefined();
      expect(haircut?.quantitySold).toBe(5);
      expect(haircut?.totalRevenue).toBe(500000);
      expect(haircut?.quadrant).toBe('stars'); // High volume & good margin

      const spa = metrics.find((s) => s.serviceId === 'svc_spa');
      expect(spa?.quantitySold).toBe(1);
      expect(spa?.quadrant).toBe('puzzles'); // Low volume & high price/margin

      const beard = metrics.find((s) => s.serviceId === 'svc_beard');
      expect(beard?.quantitySold).toBe(0);
      expect(beard?.quadrant).toBe('dogs'); // 0 volume & low margin
    });
  });

  describe('getProductVelocityMetrics', () => {
    it('classifies product velocity into Fast Moving, Medium/Slow Moving, and Dead Stock', () => {
      const mockTxs: Transaction[] = [
        // 12 Matte Clay (Fast Moving)
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'A', phone: '081', tier: null },
          subtotal: 1200000,
          discount: 0,
          tax: 0,
          total: 1200000,
          method: 'Cash',
          cashTendered: 1200000,
          change: 0,
          timestamp: '2026-08-05T10:00:00Z',
          items: [{ itemId: 'prod_clay', name: 'Redbox Matte Clay', price: 100000, qty: 12, kind: 'product' }],
        },
        // 2 Beard Oil (Slow Moving)
        {
          id: 'tx_2',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'B', phone: '082', tier: null },
          subtotal: 140000,
          discount: 0,
          tax: 0,
          total: 140000,
          method: 'Cash',
          cashTendered: 140000,
          change: 0,
          timestamp: '2026-08-06T10:00:00Z',
          items: [{ itemId: 'prod_oil', name: 'Redbox Beard Oil', price: 70000, qty: 2, kind: 'product' }],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const metrics = getProductVelocityMetrics(undefined, '2026-08');

      expect(metrics).toHaveLength(3);

      const clay = metrics.find((p) => p.productId === 'prod_clay');
      expect(clay?.velocity).toBe('fast_moving');
      expect(clay?.quantitySold).toBe(12);
      expect(clay?.totalRevenue).toBe(1200000);
      expect(clay?.totalGrossProfit).toBe(600000); // 12 * 50.000 margin

      const oil = metrics.find((p) => p.productId === 'prod_oil');
      expect(oil?.velocity).toBe('slow_moving');
      expect(oil?.quantitySold).toBe(2);

      const dead = metrics.find((p) => p.productId === 'prod_dead');
      expect(dead?.velocity).toBe('dead_stock');
      expect(dead?.quantitySold).toBe(0);
      expect(dead?.currentStock).toBe(15);
    });
  });

  describe('getTopCrossSellingPairs & getMenuEngineeringSummary', () => {
    it('detects mixed-basket cross-selling pairs and generates complete summary', () => {
      const mockTxs: Transaction[] = [
        // Haircut + Clay
        {
          id: 'tx_mix1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'A', phone: '081', tier: null },
          subtotal: 200000,
          discount: 0,
          tax: 0,
          total: 200000,
          method: 'Cash',
          cashTendered: 200000,
          change: 0,
          timestamp: '2026-08-01T10:00:00Z',
          items: [
            { itemId: 'svc_haircut', name: 'Executive Haircut', price: 100000, qty: 1, kind: 'service' },
            { itemId: 'prod_clay', name: 'Redbox Matte Clay', price: 100000, qty: 1, kind: 'product' },
          ],
        },
        // Haircut only
        {
          id: 'tx_svc_only',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'B', phone: '082', tier: null },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-02T10:00:00Z',
          items: [{ itemId: 'svc_haircut', name: 'Executive Haircut', price: 100000, qty: 1, kind: 'service' }],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const pairs = getTopCrossSellingPairs(undefined, '2026-08');

      expect(pairs).toHaveLength(1);
      expect(pairs[0].serviceName).toBe('Executive Haircut');
      expect(pairs[0].productName).toBe('Redbox Matte Clay');
      expect(pairs[0].pairCount).toBe(1);
      expect(pairs[0].crossSellRate).toBe(50); // 1 out of 2 haircut transactions

      const summary = getMenuEngineeringSummary(undefined, '2026-08');
      expect(summary.totalServicesAnalyzed).toBe(3);
      expect(summary.totalProductsAnalyzed).toBe(3);
      expect(summary.topCrossSells).toHaveLength(1);
    });
  });
});
