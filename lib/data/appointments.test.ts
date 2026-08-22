import { describe, it, expect, beforeEach } from 'vitest';
import { StorageKeys, writeCollection } from './storage';
import {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
  markNoShow,
  markAppointmentPaid,
  checkBarberAvailability,
  getAppointmentsByBranchAndDate,
  getAppointmentsByBarberAndDate,
  getUpcomingQueue,
  getCompletedUnpaidAppointments,
} from './appointments';
import { HOME_SERVICE_PRICING, WEDDING_GROOMING_PRICING } from './types';
import type { Employee, Service, TransactionCustomer } from './types';

describe('Appointments & Queue Data Layer', () => {
  const mockBarber1: Employee = {
    id: 'emp_rio',
    name: 'Rio Saputra',
    role: 'Barber',
    branchId: 'br_bypass',
    pin: '2222',
  };

  const mockBarber2: Employee = {
    id: 'emp_fajar',
    name: 'Fajar Ramadhan',
    role: 'Barber',
    branchId: 'br_samadikun',
    pin: '3333',
  };

  const mockCashier: Employee = {
    id: 'emp_dedi',
    name: 'Dedi Kurniawan',
    role: 'Kasir',
    branchId: 'br_bypass',
    pin: '1111',
  };

  const mockServices: Service[] = [
    { id: 'svc_haircut', name: 'Haircut Reguler', category: 'Rambut', durationMinutes: 30, price: 60000, commissionPercent: 20 },
    { id: 'svc_haircut_premium', name: 'Haircut Premium', category: 'Rambut', durationMinutes: 45, price: 95000, commissionPercent: 25 },
  ];

  const mockMemberCustomer: TransactionCustomer = {
    type: 'member',
    customerId: 'cust_andi',
    name: 'Andi Pratama',
    phone: '081234567890',
    tier: 'Gold',
  };

  const mockGuestCustomer: TransactionCustomer = {
    type: 'guest',
    customerId: null,
    name: 'Tamu Budi',
    phone: '081999888777',
    tier: null,
  };

  beforeEach(() => {
    window.localStorage.clear();
    writeCollection(StorageKeys.employees, [mockBarber1, mockBarber2, mockCashier]);
    writeCollection(StorageKeys.services, mockServices);
    writeCollection(StorageKeys.appointments, []);
  });

  describe('CRUD & Creation Scenarios', () => {
    it('creates a regular in-store appointment with correct defaults', () => {
      const appt = createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '10:00',
      });

      expect(appt.id).toMatch(/^appt_/);
      expect(appt.type).toBe('regular');
      expect(appt.status).toBe('booked');
      expect(appt.serviceName).toBe('Haircut Reguler');
      expect(appt.price).toBe(60000);
      expect(appt.durationMinutes).toBe(30);
      expect(appt.startTime).toBe('10:00');
      expect(appt.endTime).toBe('10:30');
      expect(appt.queueNumber).toBe(1);
      expect(appt.paxCount).toBe(1);

      const all = getAppointments();
      expect(all).toHaveLength(1);
      expect(getAppointmentById(appt.id)).toEqual(appt);
    });

    it('creates a walk-in appointment starting in checked_in status with daily queue increment', () => {
      // First appointment of the day
      createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '09:00',
      });

      // Walk-in appointment
      const walkIn = createAppointment({
        branchId: 'br_bypass',
        customer: mockGuestCustomer,
        barberId: 'emp_rio',
        type: 'walk_in',
        serviceId: 'svc_haircut_premium',
        date: '2026-08-25',
        startTime: '10:00',
      });

      expect(walkIn.type).toBe('walk_in');
      expect(walkIn.status).toBe('checked_in');
      expect(walkIn.queueNumber).toBe(2);
      expect(walkIn.price).toBe(95000);
      expect(walkIn.durationMinutes).toBe(45);
      expect(walkIn.endTime).toBe('10:45');
    });

    it('creates Home Service Single with travel buffer and pricing', () => {
      const homeAppt = createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'home_service',
        packageType: 'single',
        address: 'Jl. Pemuda No. 12, Cirebon',
        distanceKm: 3.5,
        date: '2026-08-25',
        startTime: '13:00',
      });

      expect(homeAppt.type).toBe('home_service');
      expect(homeAppt.packageType).toBe('single');
      expect(homeAppt.paxCount).toBe(1);
      expect(homeAppt.price).toBe(HOME_SERVICE_PRICING.single);
      // 45m service + 30m travel buffer = 75m
      expect(homeAppt.durationMinutes).toBe(75);
      expect(homeAppt.endTime).toBe('14:15');
      expect(homeAppt.address).toBe('Jl. Pemuda No. 12, Cirebon');
      expect(homeAppt.distanceKm).toBe(3.5);
    });

    it('creates Home Service Family with min 2 pax calculation', () => {
      const familyAppt = createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'home_service',
        packageType: 'family',
        paxCount: 3,
        address: 'Jl. Kartini No. 45, Cirebon',
        distanceKm: 2,
        date: '2026-08-25',
        startTime: '15:00',
      });

      expect(familyAppt.paxCount).toBe(3);
      expect(familyAppt.price).toBe(HOME_SERVICE_PRICING.family * 3);
      // 45m * 3 + 30m buffer = 165m
      expect(familyAppt.durationMinutes).toBe(165);
      expect(familyAppt.endTime).toBe('17:45');
    });

    it('creates Wedding Grooming package tiers (Gentleman, Silver, Gold, Platinum)', () => {
      const weddingSingle = createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'wedding',
        packageType: 'gentleman',
        address: 'Hotel Aston Cirebon Ballroom',
        distanceKm: 4.5,
        date: '2026-08-26',
        startTime: '08:00',
      });
      expect(weddingSingle.price).toBe(WEDDING_GROOMING_PRICING.gentleman);
      expect(weddingSingle.paxCount).toBe(1);

      const weddingSilver = createAppointment({
        branchId: 'br_bypass',
        customer: mockGuestCustomer,
        barberId: 'emp_rio',
        type: 'wedding',
        packageType: 'silver',
        address: 'Hotel Luxton Cirebon',
        distanceKm: 2.0,
        date: '2026-08-26',
        startTime: '10:00',
      });
      expect(weddingSilver.price).toBe(WEDDING_GROOMING_PRICING.silver);
      expect(weddingSilver.paxCount).toBe(2);

      const weddingGold = createAppointment({
        branchId: 'br_bypass',
        customer: mockGuestCustomer,
        barberId: 'emp_rio',
        type: 'wedding',
        packageType: 'gold',
        address: 'Hotel Grage Cirebon',
        distanceKm: 1.5,
        date: '2026-08-26',
        startTime: '14:00',
      });
      expect(weddingGold.price).toBe(WEDDING_GROOMING_PRICING.gold);
      expect(weddingGold.paxCount).toBe(3);

      const weddingPlatinum = createAppointment({
        branchId: 'br_bypass',
        customer: mockGuestCustomer,
        barberId: 'emp_rio',
        type: 'wedding',
        packageType: 'platinum',
        address: 'Hotel Santika Cirebon',
        distanceKm: 3.0,
        date: '2026-08-26',
        startTime: '18:00',
      });
      expect(weddingPlatinum.price).toBe(WEDDING_GROOMING_PRICING.platinum);
      expect(weddingPlatinum.paxCount).toBe(4);
    });
  });

  describe('Validation & Error Scenarios', () => {
    it('throws when barber is not found or has non-Barber role', () => {
      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockMemberCustomer,
          barberId: 'emp_dedi', // Cashier
          type: 'regular',
          serviceId: 'svc_haircut',
          date: '2026-08-25',
          startTime: '10:00',
        }),
      ).toThrow('Barber tidak ditemukan atau role bukan Barber.');
    });

    it('throws when barber belongs to a different branch', () => {
      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockMemberCustomer,
          barberId: 'emp_fajar', // Samadikun barber
          type: 'regular',
          serviceId: 'svc_haircut',
          date: '2026-08-25',
          startTime: '10:00',
        }),
      ).toThrow('Barber tidak terdaftar di cabang yang dipilih.');
    });

    it('throws when regular appointment is missing serviceId', () => {
      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockMemberCustomer,
          barberId: 'emp_rio',
          type: 'regular',
          serviceId: null,
          date: '2026-08-25',
          startTime: '10:00',
        }),
      ).toThrow('Layanan (service) wajib dipilih.');
    });

    it('throws when Home Service / Wedding is missing address', () => {
      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockMemberCustomer,
          barberId: 'emp_rio',
          type: 'home_service',
          packageType: 'single',
          address: '',
          date: '2026-08-25',
          startTime: '10:00',
        }),
      ).toThrow('Alamat wajib diisi untuk layanan Home Service.');
    });

    it('throws when Home Service / Wedding distance exceeds 5 KM radius', () => {
      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockMemberCustomer,
          barberId: 'emp_rio',
          type: 'home_service',
          packageType: 'single',
          address: 'Jl. Palimanan (jauh)',
          distanceKm: 7.5,
          date: '2026-08-25',
          startTime: '10:00',
        }),
      ).toThrow('Lokasi di luar jangkauan radius maksimal 5 KM dari cabang.');
    });

    it('throws when Home Service Family has fewer than 2 pax', () => {
      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockMemberCustomer,
          barberId: 'emp_rio',
          type: 'home_service',
          packageType: 'family',
          paxCount: 1,
          address: 'Jl. Wahidin, Cirebon',
          distanceKm: 2,
          date: '2026-08-25',
          startTime: '10:00',
        }),
      ).toThrow('Paket Home Service Family minimal untuk 2 orang.');
    });
  });

  describe('Conflict Detection & Barber Availability', () => {
    it('detects slot collision when exact same time is booked', () => {
      createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut', // 10:00 to 10:30
        date: '2026-08-25',
        startTime: '10:00',
      });

      expect(checkBarberAvailability('emp_rio', '2026-08-25', '10:00', '10:30')).toBe(false);

      expect(() =>
        createAppointment({
          branchId: 'br_bypass',
          customer: mockGuestCustomer,
          barberId: 'emp_rio',
          type: 'regular',
          serviceId: 'svc_haircut',
          date: '2026-08-25',
          startTime: '10:00',
        }),
      ).toThrow(/sudah memiliki jadwal lain/);
    });

    it('detects slot collision on overlapping partial intervals', () => {
      createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut_premium', // 10:00 to 10:45
        date: '2026-08-25',
        startTime: '10:00',
      });

      // Starts inside existing slot
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '10:15', '10:45')).toBe(false);
      // Spans across existing slot
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '09:45', '10:15')).toBe(false);
      // Contained inside
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '10:10', '10:30')).toBe(false);

      // Adjacent slot (starts exactly at 10:45) is available
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '10:45', '11:15')).toBe(true);
      // Preceding slot (ends exactly at 10:00) is available
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '09:30', '10:00')).toBe(true);
    });

    it('allows booking the same time for different barber or different date', () => {
      createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '10:00',
      });

      // Different barber (in another branch)
      expect(checkBarberAvailability('emp_fajar', '2026-08-25', '10:00', '10:30')).toBe(true);

      // Same barber, different date
      expect(checkBarberAvailability('emp_rio', '2026-08-26', '10:00', '10:30')).toBe(true);
    });

    it('frees up slot when previous appointment was cancelled or marked no-show', () => {
      const appt = createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '10:00',
      });

      cancelAppointment(appt.id, 'Customer membatalkan via WA');
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '10:00', '10:30')).toBe(true);

      const appt2 = createAppointment({
        branchId: 'br_bypass',
        customer: mockGuestCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '10:00',
      });

      markNoShow(appt2.id, 'Tidak datang setelah 15 menit');
      expect(checkBarberAvailability('emp_rio', '2026-08-25', '10:00', '10:30')).toBe(true);
    });
  });

  describe('Status Transitions & Lifecycle', () => {
    it('progresses appointment from booked -> checked_in -> in_service -> completed -> paid', () => {
      const appt = createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '10:00',
      });

      expect(appt.status).toBe('booked');

      const checkedIn = updateAppointmentStatus(appt.id, 'checked_in');
      expect(checkedIn.status).toBe('checked_in');

      const inService = updateAppointmentStatus(appt.id, 'in_service');
      expect(inService.status).toBe('in_service');

      const completed = updateAppointmentStatus(appt.id, 'completed');
      expect(completed.status).toBe('completed');

      const paid = markAppointmentPaid(appt.id, 'TRX-00123');
      expect(paid.status).toBe('paid');
      expect(paid.transactionId).toBe('TRX-00123');

      // Terminal state guard: cannot update status once paid
      expect(() => updateAppointmentStatus(appt.id, 'completed')).toThrow(
        'Appointment yang sudah dibayar tidak dapat diubah statusnya.',
      );
    });

    it('handles no-show with reason required', () => {
      const appt = createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '10:00',
      });

      expect(() => markNoShow(appt.id, '  ')).toThrow('Alasan No-Show wajib dicatat.');

      const marked = markNoShow(appt.id, 'Telepon tidak diangkat');
      expect(marked.status).toBe('no_show');
      expect(marked.noShowReason).toBe('Telepon tidak diangkat');

      expect(() => updateAppointmentStatus(appt.id, 'checked_in')).toThrow(
        'Appointment berstatus No-Show tidak dapat diubah statusnya.',
      );
    });
  });

  describe('Query & Queue Helpers', () => {
    it('returns filtered and sorted appointments by branch, barber, and active queue', () => {
      const a1 = createAppointment({
        branchId: 'br_bypass',
        customer: mockMemberCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '11:00',
      });

      const a2 = createAppointment({
        branchId: 'br_bypass',
        customer: mockGuestCustomer,
        barberId: 'emp_rio',
        type: 'regular',
        serviceId: 'svc_haircut',
        date: '2026-08-25',
        startTime: '09:00',
      });

      const branchAppts = getAppointmentsByBranchAndDate('br_bypass', '2026-08-25');
      expect(branchAppts).toHaveLength(2);
      expect(branchAppts[0].id).toBe(a2.id); // 09:00 first
      expect(branchAppts[1].id).toBe(a1.id); // 11:00 second

      const barberAppts = getAppointmentsByBarberAndDate('emp_rio', '2026-08-25');
      expect(barberAppts).toHaveLength(2);

      const queue = getUpcomingQueue('br_bypass', '2026-08-25');
      expect(queue).toHaveLength(2);

      // Complete a2
      updateAppointmentStatus(a2.id, 'completed');
      expect(getCompletedUnpaidAppointments('br_bypass')).toHaveLength(1);
      expect(getCompletedUnpaidAppointments('br_bypass')[0].id).toBe(a2.id);

      // Mark a2 paid
      markAppointmentPaid(a2.id, 'TRX-999');
      expect(getCompletedUnpaidAppointments('br_bypass')).toHaveLength(0);
    });
  });
});
