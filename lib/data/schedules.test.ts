import { describe, it, expect, beforeEach } from 'vitest';
import { StorageKeys, writeCollection } from './storage';
import {
  getSchedules,
  getScheduleById,
  getSchedulesByBranchAndDate,
  getSchedulesByBranchAndDateRange,
  getEmployeeSchedule,
  upsertEmployeeSchedule,
  bulkUpsertSchedules,
  deleteSchedule,
} from './schedules';
import { createAppointment, checkBarberAvailability } from './appointments';
import type { Branch, Employee, Service, TransactionCustomer } from './types';

describe('Rolling Schedule & Shift Management Data Layer', () => {
  const mockBranches: Branch[] = [
    {
      id: 'br_bypass',
      name: 'Bypass Cirebon',
      city: 'Cirebon',
      province: 'Jawa Barat',
      address: 'Jl. Bypass',
      phone: '0231-11111',
      minBarberCoverage: 1,
    },
    {
      id: 'br_samadikun',
      name: 'Samadikun Cirebon',
      city: 'Cirebon',
      province: 'Jawa Barat',
      address: 'Jl. Samadikun',
      phone: '0231-22222',
      minBarberCoverage: 2,
    },
  ];

  const mockOwner: Employee = {
    id: 'emp_owner',
    name: 'Bpk. Herman',
    role: 'Owner',
    branchId: 'br_bypass',
    pin: '9999',
  };

  const mockBMBypass: Employee = {
    id: 'emp_bm_bypass',
    name: 'Yusuf BM',
    role: 'BranchManager',
    branchId: 'br_bypass',
    pin: '5555',
  };

  const mockBMSamadikun: Employee = {
    id: 'emp_bm_samadikun',
    name: 'Rudi BM',
    role: 'BranchManager',
    branchId: 'br_samadikun',
    pin: '6666',
  };

  const mockBarber1Bypass: Employee = {
    id: 'emp_rio',
    name: 'Rio Barber',
    role: 'Barber',
    branchId: 'br_bypass',
    pin: '2222',
  };

  const mockBarber2Bypass: Employee = {
    id: 'emp_agus',
    name: 'Agus Barber',
    role: 'Barber',
    branchId: 'br_bypass',
    pin: '7777',
  };

  const mockBarber1Samadikun: Employee = {
    id: 'emp_fajar',
    name: 'Fajar Barber',
    role: 'Barber',
    branchId: 'br_samadikun',
    pin: '3333',
  };

  const mockBarber2Samadikun: Employee = {
    id: 'emp_hendra',
    name: 'Hendra Barber',
    role: 'Barber',
    branchId: 'br_samadikun',
    pin: '8888',
  };

  const mockServices: Service[] = [
    { id: 'svc_haircut', name: 'Haircut Reguler', category: 'Rambut', durationMinutes: 30, price: 60000, commissionPercent: 20 },
  ];

  const mockCustomer: TransactionCustomer = {
    type: 'member',
    customerId: 'cust_andi',
    name: 'Andi Pratama',
    phone: '081234567890',
    tier: 'Gold',
  };

  beforeEach(() => {
    window.localStorage.clear();
    writeCollection(StorageKeys.branches, mockBranches);
    writeCollection(StorageKeys.employees, [
      mockOwner,
      mockBMBypass,
      mockBMSamadikun,
      mockBarber1Bypass,
      mockBarber2Bypass,
      mockBarber1Samadikun,
      mockBarber2Samadikun,
    ]);
    writeCollection(StorageKeys.services, mockServices);
    writeCollection(StorageKeys.schedules, []);
    writeCollection(StorageKeys.appointments, []);
  });

  describe('CRUD & Upsert Operations', () => {
    it('creates and updates a single shift schedule for an employee', () => {
      const schedule = upsertEmployeeSchedule(
        {
          employeeId: 'emp_rio',
          date: '2026-08-25',
          shiftType: 'pagi',
          notes: 'Shift pagi standby 09:00',
        },
        mockBMBypass,
      );

      expect(schedule.id).toMatch(/^sch_/);
      expect(schedule.employeeId).toBe('emp_rio');
      expect(schedule.branchId).toBe('br_bypass');
      expect(schedule.shiftType).toBe('pagi');
      expect(schedule.startTime).toBe('09:00');
      expect(schedule.endTime).toBe('15:00');
      expect(schedule.notes).toBe('Shift pagi standby 09:00');

      // Update same employee and date to siang
      const updated = upsertEmployeeSchedule(
        {
          employeeId: 'emp_rio',
          date: '2026-08-25',
          shiftType: 'siang',
        },
        mockBMBypass,
      );

      expect(updated.id).toBe(schedule.id);
      expect(updated.shiftType).toBe('siang');
      expect(updated.startTime).toBe('15:00');
      expect(updated.endTime).toBe('21:00');

      const all = getSchedules();
      expect(all).toHaveLength(1);
    });

    it('bulk upserts a weekly schedule across employees', () => {
      const inputs = [
        { employeeId: 'emp_rio', date: '2026-08-24', shiftType: 'pagi' as const },
        { employeeId: 'emp_rio', date: '2026-08-25', shiftType: 'pagi' as const },
        { employeeId: 'emp_agus', date: '2026-08-24', shiftType: 'siang' as const },
        { employeeId: 'emp_agus', date: '2026-08-25', shiftType: 'siang' as const },
      ];

      const results = bulkUpsertSchedules(inputs, mockOwner);
      expect(results).toHaveLength(4);
      expect(getSchedules()).toHaveLength(4);

      const range = getSchedulesByBranchAndDateRange('br_bypass', '2026-08-24', '2026-08-25');
      expect(range).toHaveLength(4);
    });

    it('deletes a shift schedule', () => {
      const sch = upsertEmployeeSchedule(
        {
          employeeId: 'emp_rio',
          date: '2026-08-25',
          shiftType: 'full',
        },
        mockBMBypass,
      );

      expect(getScheduleById(sch.id)).toBeDefined();
      deleteSchedule(sch.id, mockBMBypass);
      expect(getScheduleById(sch.id)).toBeUndefined();
    });
  });

  describe('RBAC Guards', () => {
    it('allows Owner to manage schedules in any branch', () => {
      expect(() =>
        upsertEmployeeSchedule(
          { employeeId: 'emp_fajar', date: '2026-08-25', shiftType: 'pagi' },
          mockOwner,
        ),
      ).not.toThrow();
    });

    it('allows Branch Manager to manage schedules only in their own branch', () => {
      // BM Bypass manages Barber Bypass -> OK
      expect(() =>
        upsertEmployeeSchedule(
          { employeeId: 'emp_rio', date: '2026-08-25', shiftType: 'pagi' },
          mockBMBypass,
        ),
      ).not.toThrow();

      // BM Bypass tries to manage Barber Samadikun -> Throws Error
      expect(() =>
        upsertEmployeeSchedule(
          { employeeId: 'emp_fajar', date: '2026-08-25', shiftType: 'pagi' },
          mockBMBypass,
        ),
      ).toThrow('Branch Manager hanya berhak mengelola jadwal di cabang sendiri.');
    });

    it('throws error when non-manager employee tries to manage schedules', () => {
      expect(() =>
        upsertEmployeeSchedule(
          { employeeId: 'emp_rio', date: '2026-08-25', shiftType: 'pagi' },
          mockBarber1Bypass,
        ),
      ).toThrow('Hanya Owner atau Branch Manager yang berhak mengelola jadwal kerja.');
    });
  });

  describe('Minimum Barber Coverage Validation', () => {
    it('enforces minimum coverage of 1 barber on duty (prevents all barbers from being OFF simultaneously)', () => {
      // Bypass has 2 barbers: emp_rio and emp_agus. minBarberCoverage = 1.
      // Set emp_rio to OFF -> OK (emp_agus is active)
      expect(() =>
        upsertEmployeeSchedule(
          { employeeId: 'emp_rio', date: '2026-08-25', shiftType: 'off' },
          mockBMBypass,
        ),
      ).not.toThrow();

      // Now try to set emp_agus to OFF on same date -> Throws error because 0 active barbers remain
      expect(() =>
        upsertEmployeeSchedule(
          { employeeId: 'emp_agus', date: '2026-08-25', shiftType: 'off' },
          mockBMBypass,
        ),
      ).toThrow(/Minimal 1 barber wajib bertugas/);
    });

    it('enforces minimum coverage of 2 barbers in Samadikun branch', () => {
      // Samadikun has 2 barbers: emp_fajar and emp_hendra. minBarberCoverage = 2.
      // Trying to set even 1 barber to OFF or CUTI violates min coverage (requires both active)
      expect(() =>
        upsertEmployeeSchedule(
          { employeeId: 'emp_fajar', date: '2026-08-25', shiftType: 'cuti' },
          mockBMSamadikun,
        ),
      ).toThrow(/Minimal 2 barber wajib bertugas/);
    });
  });

  describe('Integration with Appointment Availability', () => {
    it('allows booking within scheduled shift hours and rejects outside shift hours', () => {
      // Set Rio to Shift Pagi (09:00 - 15:00)
      upsertEmployeeSchedule(
        { employeeId: 'emp_rio', date: '2026-08-25', shiftType: 'pagi' },
        mockBMBypass,
      );

      // 10:00 - 10:30 is within 09:00 - 15:00 -> Available
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '10:00', '10:30')).toBe(true);

      // Create appointment at 10:00 -> Success
      const appt = createAppointment({
        branchId: 'br_bypass',
        customer: mockCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '10:00',
      });
      expect(appt.id).toBeDefined();

      // 16:00 - 16:30 is outside Shift Pagi (ends at 15:00) -> Unavailable
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '16:00', '16:30')).toBe(false);

      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockCustomer,
          barberId: 'emp_rio',
          type: 'regular',
          serviceId: 'svc_haircut',
          date: '2026-08-25',
          startTime: '16:00',
        }),
      ).toThrow(/sudah memiliki jadwal lain/);
    });

    it('rejects booking when barber is scheduled as OFF or CUTI', () => {
      // Set Rio to OFF
      upsertEmployeeSchedule(
        { employeeId: 'emp_rio', date: '2026-08-25', shiftType: 'off' },
        mockBMBypass,
      );

      expect(checkBarberAvailability('emp_rio', '2026-08-25', '10:00', '10:30')).toBe(false);

      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockCustomer,
          barberId: 'emp_rio',
          type: 'regular',
          serviceId: 'svc_haircut',
          date: '2026-08-25',
          startTime: '10:00',
        }),
      ).toThrow(/sudah memiliki jadwal lain/);
    });
  });
});
