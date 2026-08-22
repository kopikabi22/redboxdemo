import { describe, it, expect, beforeEach } from 'vitest';
import { StorageKeys, writeCollection, readCollection } from './storage';
import {
  getEmployeeAdvances,
  getEmployeeAdvanceById,
  createEmployeeAdvance,
  approveEmployeeAdvance,
  rejectEmployeeAdvance,
  calculateEmployeePayrollDraft,
  getPayrollRecords,
  getPayrollRecordById,
  generateMonthlyPayroll,
  approvePayrollRecord,
  markPayrollPaid,
  cancelPayrollRecord,
} from './payroll';
import type {
  Branch,
  Employee,
  Service,
  Product,
  AttendanceRecord,
  Transaction,
  EmployeeAdvance,
} from './types';

describe('HR, Payroll & Commission Engine Data Layer', () => {
  const mockBranch: Branch = {
    id: 'br_bypass',
    name: 'Bypass Cirebon',
    city: 'Cirebon',
    province: 'Jawa Barat',
    address: 'Jl. Bypass No. 10',
    phone: '0231-11111',
  };

  const mockOwner: Employee = {
    id: 'emp_owner',
    name: 'Bpk. Herman',
    role: 'Owner',
    branchId: 'br_bypass',
    pin: '9999',
  };

  const mockBranchManager: Employee = {
    id: 'emp_bm',
    name: 'Yusuf BM',
    role: 'BranchManager',
    branchId: 'br_bypass',
    pin: '1234',
  };

  const mockBarber: Employee = {
    id: 'emp_barber_arif',
    name: 'Arif Barber',
    role: 'Barber',
    branchId: 'br_bypass',
    pin: '2222',
  };

  const mockKasir: Employee = {
    id: 'emp_kasir',
    name: 'Kasir Sari',
    role: 'Kasir',
    branchId: 'br_bypass',
    pin: '1111',
  };

  const mockServices: Service[] = [
    { id: 'svc_haircut', name: 'Haircut Reguler', category: 'Rambut', durationMinutes: 30, price: 60000, commissionPercent: 20 },
    { id: 'svc_haircut_premium', name: 'Haircut Premium', category: 'Rambut', durationMinutes: 45, price: 95000, commissionPercent: 25 },
  ];

  const mockProducts: Product[] = [
    { id: 'prd_pomade', name: 'Waterbased Pomade', sku: 'POM-01', category: 'Styling', brand: 'RedBox', cost: 40000, price: 80000, lowStockThreshold: 5 },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    writeCollection(StorageKeys.branches, [mockBranch]);
    writeCollection(StorageKeys.employees, [mockOwner, mockBranchManager, mockBarber, mockKasir]);
    writeCollection(StorageKeys.services, mockServices);
    writeCollection(StorageKeys.products, mockProducts);
    writeCollection(StorageKeys.attendance, []);
    writeCollection(StorageKeys.transactions, []);
    writeCollection(StorageKeys.employeeAdvances, []);
    writeCollection(StorageKeys.payrollRecords, []);
  });

  describe('Kasbon (Employee Advance) Module', () => {
    it('creates an advance request and approves it by Branch Manager', () => {
      const adv = createEmployeeAdvance(
        {
          employeeId: mockBarber.id,
          amount: 300000,
          reason: 'Kebutuhan mendesak keluarga',
          requestDate: '2026-08-10',
        },
        mockBarber,
      );

      expect(adv.id).toMatch(/^adv_/);
      expect(adv.status).toBe('pending');
      expect(adv.amount).toBe(300000);

      const all = getEmployeeAdvances(mockBarber.id);
      expect(all).toHaveLength(1);

      // Approve advance
      const approved = approveEmployeeAdvance(adv.id, mockBranchManager);
      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(mockBranchManager.id);
      expect(approved.approvedByName).toBe(mockBranchManager.name);
    });

    it('rejects advance request when submitted by staff for other employees', () => {
      expect(() =>
        createEmployeeAdvance(
          {
            employeeId: mockKasir.id,
            amount: 200000,
            reason: 'Pinjaman',
          },
          mockBarber, // Barber cannot request for Kasir
        ),
      ).toThrow('Akses ditolak');
    });

    it('rejects advance approval by unauthorized role (Kasir/Barber)', () => {
      const adv = createEmployeeAdvance(
        {
          employeeId: mockBarber.id,
          amount: 200000,
          reason: 'Kasbon',
        },
        mockBarber,
      );

      expect(() => approveEmployeeAdvance(adv.id, mockKasir)).toThrow('Akses ditolak');
    });
  });

  describe('Commission & Payroll Calculation Engine', () => {
    it('calculates commissions accurately from service transactions and product upselling', () => {
      // 1. Seed attendance (3 days in 2026-08)
      const attendances: AttendanceRecord[] = [
        { id: 'att_1', employeeId: mockBarber.id, branchId: mockBranch.id, date: '2026-08-01', clockIn: '2026-08-01T09:00:00Z', clockOut: '2026-08-01T17:00:00Z', breaks: [] },
        { id: 'att_2', employeeId: mockBarber.id, branchId: mockBranch.id, date: '2026-08-02', clockIn: '2026-08-02T09:00:00Z', clockOut: '2026-08-02T17:00:00Z', breaks: [] },
        { id: 'att_3', employeeId: mockBarber.id, branchId: mockBranch.id, date: '2026-08-03', clockIn: '2026-08-03T09:00:00Z', clockOut: '2026-08-03T17:00:00Z', breaks: [] },
      ];
      writeCollection(StorageKeys.attendance, attendances);

      // 2. Seed transactions:
      // - 2x Haircut Reguler @ 60.000 (20% comm = 12.000 x 2 = 24.000)
      // - 1x Haircut Premium @ 95.000 (25% comm = 23.750)
      // - 1x Pomade @ 80.000 (5% upsell comm = 4.000)
      const tx1: Transaction = {
        id: 'TRX-001',
        branchId: mockBranch.id,
        cashierId: mockKasir.id,
        cashierName: mockKasir.name,
        customer: { type: 'guest', customerId: null, name: 'Budi', phone: '0812', tier: null },
        items: [
          { kind: 'service', itemId: 'svc_haircut', name: 'Haircut Reguler', price: 60000, qty: 2, barberId: mockBarber.id, commissionPercent: 20 },
          { kind: 'service', itemId: 'svc_haircut_premium', name: 'Haircut Premium', price: 95000, qty: 1, barberId: mockBarber.id, commissionPercent: 25 },
          { kind: 'product', itemId: 'prd_pomade', name: 'Waterbased Pomade', price: 80000, qty: 1, barberId: mockBarber.id },
        ],
        subtotal: 295000,
        discount: 0,
        tax: 29500,
        total: 324500,
        method: 'Cash',
        cashTendered: 350000,
        change: 25500,
        timestamp: '2026-08-05T10:00:00Z',
      };
      writeCollection(StorageKeys.transactions, [tx1]);

      const draft = calculateEmployeePayrollDraft(mockBarber.id, '2026-08');

      expect(draft.employeeId).toBe(mockBarber.id);
      expect(draft.attendanceDays).toBe(3);
      expect(draft.totalServicesCompleted).toBe(3);
      expect(draft.totalProductsSold).toBe(1);
      expect(draft.baseSalary).toBe(2000000);
      expect(draft.serviceCommission).toBe(47750); // 24.000 + 23.750
      expect(draft.productCommission).toBe(4000); // 5% of 80.000
      expect(draft.allowances).toBe(300000);
      expect(draft.grossPay).toBe(2000000 + 47750 + 4000 + (3 * 10000) + 300000);
      expect(draft.takeHomePay).toBe(draft.grossPay);
    });

    it('deducts approved kasbon from Take-Home Pay', () => {
      // Create and approve advance
      const adv = createEmployeeAdvance(
        {
          employeeId: mockBarber.id,
          amount: 500000,
          reason: 'Kasbon sewa rumah',
          requestDate: '2026-08-05',
        },
        mockBarber,
      );
      approveEmployeeAdvance(adv.id, mockBranchManager);

      const draft = calculateEmployeePayrollDraft(mockBarber.id, '2026-08');
      expect(draft.advanceDeduction).toBe(500000);
      expect(draft.totalDeductions).toBe(500000);
      expect(draft.takeHomePay).toBe(draft.grossPay - 500000);
    });
  });

  describe('Payroll Lifecycle & Advance Auto-Deduction', () => {
    it('generates payroll run, approves it, marks it paid and auto-updates advance status to deducted', () => {
      // 1. Create and approve advance
      const adv = createEmployeeAdvance(
        {
          employeeId: mockBarber.id,
          amount: 250000,
          reason: 'Kasbon bulanan',
        },
        mockBarber,
      );
      approveEmployeeAdvance(adv.id, mockBranchManager);

      // 2. Generate monthly payroll for branch
      const generated = generateMonthlyPayroll(mockBranch.id, '2026-08', mockBranchManager);
      expect(generated.length).toBeGreaterThan(0);

      const barberRecord = generated.find((r) => r.employeeId === mockBarber.id);
      expect(barberRecord).toBeDefined();
      expect(barberRecord?.status).toBe('draft');
      expect(barberRecord?.advanceDeduction).toBe(250000);

      // 3. Approve Payroll
      const approved = approvePayrollRecord(barberRecord!.id, mockBranchManager);
      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(mockBranchManager.id);

      // Advance should still be 'approved' before payment
      expect(getEmployeeAdvanceById(adv.id)?.status).toBe('approved');

      // 4. Mark Payroll Paid
      const paid = markPayrollPaid(approved.id, mockOwner);
      expect(paid.status).toBe('paid');
      expect(paid.paidBy).toBe(mockOwner.id);
      expect(paid.paidAt).toBeDefined();

      // Check Advance is now 'deducted' with linked payroll ID
      const updatedAdv = getEmployeeAdvanceById(adv.id);
      expect(updatedAdv?.status).toBe('deducted');
      expect(updatedAdv?.deductedPayrollId).toBe(paid.id);
    });

    it('rejects payroll generation and approval by unauthorized roles (Kasir/Barber)', () => {
      expect(() =>
        generateMonthlyPayroll(mockBranch.id, '2026-08', mockKasir),
      ).toThrow('Akses ditolak');
    });

    it('cancels an unpaid payroll record with a reason', () => {
      const generated = generateMonthlyPayroll(mockBranch.id, '2026-08', mockBranchManager);
      const record = generated[0];

      const cancelled = cancelPayrollRecord(record.id, 'Revisi skema gaji', mockBranchManager);
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellationReason).toBe('Revisi skema gaji');
    });
  });
});
