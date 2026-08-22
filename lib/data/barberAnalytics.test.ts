import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBarberProductivityMetrics,
  getBranchSeatUtilization,
  getEfficiencyHeatmapData,
  getBarberEfficiencySummary,
} from './barberAnalytics';
import { StorageKeys, writeCollection } from './storage';
import type { Employee, Branch, Service, Transaction, AttendanceRecord } from './types';

const mockBranches: Branch[] = [
  {
    id: 'br_cirebon_bypass',
    name: 'Redbox Bypass Cirebon',
    address: 'Jl. Dharsono 12',
    city: 'Cirebon',
    province: 'Jawa Barat',
    phone: '0231-111',
  },
  {
    id: 'br_cirebon_csb',
    name: 'Redbox CSB Mall',
    address: 'CSB Mall Lt 2',
    city: 'Cirebon',
    province: 'Jawa Barat',
    phone: '0231-222',
  },
];

const mockBarbers: Employee[] = [
  {
    id: 'emp_barber_1',
    name: 'Ahmad Top Barber',
    role: 'Barber',
    branchId: 'br_cirebon_bypass',
    pin: '1234',
  },
  {
    id: 'emp_barber_2',
    name: 'Bima Barber',
    role: 'Barber',
    branchId: 'br_cirebon_csb',
    pin: '5678',
  },
];

const mockServices: Service[] = [
  {
    id: 'svc_haircut',
    name: 'Executive Haircut',
    category: 'Haircut',
    durationMinutes: 45,
    price: 100000,
    commissionPercent: 35,
  },
];

describe('Barber Productivity, Seat Utilization & Efficiency Heatmap Module', () => {
  beforeEach(() => {
    writeCollection(StorageKeys.branches, mockBranches);
    writeCollection(StorageKeys.employees, mockBarbers);
    writeCollection(StorageKeys.services, mockServices);
    writeCollection(StorageKeys.attendance, []);
    writeCollection(StorageKeys.transactions, []);
  });

  describe('getBarberProductivityMetrics', () => {
    it('calculates barber services completed, revenue, upsell, commissions, and utilization rate', () => {
      // Seed attendance (2 days for barber 1, 1 day for barber 2)
      const mockAtt: AttendanceRecord[] = [
        {
          id: 'att_1',
          employeeId: 'emp_barber_1',
          branchId: 'br_cirebon_bypass',
          date: '2026-08-01',
          clockIn: '2026-08-01T09:00:00Z',
          clockOut: '2026-08-01T17:00:00Z',
          breaks: [],
        },
        {
          id: 'att_2',
          employeeId: 'emp_barber_1',
          branchId: 'br_cirebon_bypass',
          date: '2026-08-02',
          clockIn: '2026-08-02T09:00:00Z',
          clockOut: '2026-08-02T17:00:00Z',
          breaks: [],
        },
      ];
      writeCollection(StorageKeys.attendance, mockAtt);

      // Seed transactions
      const mockTxs: Transaction[] = [
        // Barber 1: 4 haircuts (400k) + 1 product upsell (100k) = 500k total
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_c1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'A', phone: '081', tier: null },
          subtotal: 500000,
          discount: 0,
          tax: 0,
          total: 500000,
          method: 'Cash',
          cashTendered: 500000,
          change: 0,
          timestamp: '2026-08-01T10:00:00Z',
          items: [
            {
              itemId: 'svc_haircut',
              name: 'Executive Haircut',
              price: 100000,
              qty: 4,
              kind: 'service',
              barberId: 'emp_barber_1',
              barberName: 'Ahmad Top Barber',
            },
            {
              itemId: 'prod_clay',
              name: 'Matte Clay',
              price: 100000,
              qty: 1,
              kind: 'product',
              barberId: 'emp_barber_1',
              barberName: 'Ahmad Top Barber',
            },
          ],
        },
        // Barber 2: 1 haircut (100k)
        {
          id: 'tx_2',
          branchId: 'br_cirebon_csb',
          cashierId: 'emp_c2',
          cashierName: 'Kasir 2',
          customer: { type: 'guest', customerId: null, name: 'B', phone: '082', tier: null },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'QRIS',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-01T11:00:00Z',
          items: [
            {
              itemId: 'svc_haircut',
              name: 'Executive Haircut',
              price: 100000,
              qty: 1,
              kind: 'service',
              barberId: 'emp_barber_2',
              barberName: 'Bima Barber',
            },
          ],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const metrics = getBarberProductivityMetrics(undefined, '2026-08');

      expect(metrics).toHaveLength(2);

      // Rank 1: Ahmad
      const ahmad = metrics[0];
      expect(ahmad.barberId).toBe('emp_barber_1');
      expect(ahmad.rank).toBe(1);
      expect(ahmad.attendanceDays).toBe(2);
      expect(ahmad.servicesCompleted).toBe(4);
      expect(ahmad.servicesPerDay).toBe(2); // 4 / 2
      expect(ahmad.serviceRevenue).toBe(400000);
      expect(ahmad.productRevenue).toBe(100000);
      expect(ahmad.totalRevenue).toBe(500000);
      // Commission: 35% of 400k (140k) + 5% of 100k (5k) = 145k
      expect(ahmad.totalCommission).toBe(145000);
      // Occupied: 4 * 45 = 180 mins. Available = 2 * 480 = 960 mins. Utilization = 180 / 960 * 100 = 19%
      expect(ahmad.occupiedMinutes).toBe(180);
      expect(ahmad.utilizationRate).toBe(19);

      // Rank 2: Bima
      const bima = metrics[1];
      expect(bima.barberId).toBe('emp_barber_2');
      expect(bima.rank).toBe(2);
      expect(bima.servicesCompleted).toBe(1);
    });
  });

  describe('getBranchSeatUtilization', () => {
    it('calculates seat utilization percentage and status per branch', () => {
      const mockTxs: Transaction[] = [
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_c1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'A', phone: '081', tier: null },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-01T10:00:00Z',
          items: [{ itemId: 'svc_haircut', name: 'Executive Haircut', price: 100000, qty: 10, kind: 'service' }],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const seatMetrics = getBranchSeatUtilization('2026-08');

      expect(seatMetrics).toHaveLength(2);

      const bypass = seatMetrics.find((b) => b.branchId === 'br_cirebon_bypass');
      expect(bypass).toBeDefined();
      expect(bypass?.seatCapacity).toBe(5);
      // 5 seats * 720 * 30 = 108,000 mins
      expect(bypass?.totalAvailableMinutes).toBe(108000);
      // 10 * 45 = 450 mins
      expect(bypass?.actualOccupiedMinutes).toBe(450);
      expect(bypass?.status).toBe('underutilized');
    });
  });

  describe('getEfficiencyHeatmapData & getBarberEfficiencySummary', () => {
    it('populates 7x13 heatmap matrix and produces executive efficiency summary', () => {
      const mockTxs: Transaction[] = [
        {
          id: 'tx_1',
          branchId: 'br_cirebon_bypass',
          cashierId: 'emp_c1',
          cashierName: 'Kasir',
          customer: { type: 'guest', customerId: null, name: 'A', phone: '081', tier: null },
          subtotal: 100000,
          discount: 0,
          tax: 0,
          total: 100000,
          method: 'Cash',
          cashTendered: 100000,
          change: 0,
          timestamp: '2026-08-03T10:30:00Z', // 2026-08-03 is Monday (Senin), 10:00
          items: [{ itemId: 'svc_haircut', name: 'Executive Haircut', price: 100000, qty: 1, kind: 'service' }],
        },
      ];
      writeCollection(StorageKeys.transactions, mockTxs);

      const heatmap = getEfficiencyHeatmapData(undefined, '2026-08');

      // 7 days x 13 hours = 91 cells
      expect(heatmap).toHaveLength(91);

      const senin10 = heatmap.find((c) => c.dayName === 'Senin' && c.hour === 10);
      expect(senin10).toBeDefined();
      expect(senin10?.transactionCount).toBe(1);
      expect(senin10?.revenue).toBe(100000);
      expect(senin10?.intensityLevel).toBe(1);

      const summary = getBarberEfficiencySummary(undefined, '2026-08');
      expect(summary.totalBarbers).toBe(2);
      expect(summary.topBarberName).toBe('Ahmad Top Barber');
      expect(summary.branchSeats).toHaveLength(2);
      expect(summary.heatmap).toHaveLength(91);
    });
  });
});
