import { describe, it, expect, beforeEach } from 'vitest';
import { StorageKeys, writeCollection, todayDateString } from './storage';
import {
  formatWhatsAppPhone,
  generateWhatsAppUrl,
  generateReminderMessage,
  getCustomerReminderCandidates,
  recordReminderSent,
  getReminderLogs,
} from './reminders';
import type { Customer, Transaction, Appointment, Branch, Employee, ReminderLog } from './types';

function daysAgoDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('Customer Reminder & WhatsApp Follow-up Data Layer', () => {
  const mockBranch: Branch = {
    id: 'br_bypass',
    name: 'Bypass Cirebon',
    city: 'Cirebon',
    province: 'Jawa Barat',
    address: 'Jl. Bypass',
    phone: '0231-11111',
  };

  const mockEmployee: Employee = {
    id: 'emp_owner',
    name: 'Bpk. Herman',
    role: 'Owner',
    branchId: 'br_bypass',
    pin: '9999',
  };

  const mockBarber: Employee = {
    id: 'emp_rio',
    name: 'Rio Barber',
    role: 'Barber',
    branchId: 'br_bypass',
    pin: '1234',
  };

  const mockCustomers: Customer[] = [
    {
      id: 'cust_routine',
      name: 'Andi Routine',
      phone: '081234567890',
      type: 'member',
      tier: 'Gold',
      points: 15,
      createdAt: '2026-01-01T00:00:00.000Z',
      preferences: {
        preferredBarberId: 'emp_rio',
        preferredStyle: 'Fade Pompadour',
        preferredProduct: 'Waterbased Pomade',
        notes: '',
      },
    },
    {
      id: 'cust_dormant',
      name: 'Budi Dormant',
      phone: '081987654321',
      type: 'member',
      tier: 'Silver',
      points: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'cust_upcoming',
      name: 'Citra Booking',
      phone: '+628555444333',
      type: 'member',
      tier: 'Platinum',
      points: 50,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'cust_fresh',
      name: 'Doni Baru Datang',
      phone: '081200001111',
      type: 'member',
      tier: 'Bronze',
      points: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    writeCollection(StorageKeys.branches, [mockBranch]);
    writeCollection(StorageKeys.employees, [mockEmployee, mockBarber]);
    writeCollection(StorageKeys.customers, mockCustomers);
    writeCollection(StorageKeys.transactions, []);
    writeCollection(StorageKeys.appointments, []);
    writeCollection(StorageKeys.reminderLogs, []);
  });

  describe('WhatsApp Phone Formatting & URL Generator', () => {
    it('normalizes local 08xx, +628xx, and clean 628xx phone numbers', () => {
      expect(formatWhatsAppPhone('081234567890')).toBe('6281234567890');
      expect(formatWhatsAppPhone('+62 812-3456-7890')).toBe('6281234567890');
      expect(formatWhatsAppPhone('6281234567890')).toBe('6281234567890');
      expect(formatWhatsAppPhone('81234567890')).toBe('6281234567890');
    });

    it('generates direct WhatsApp Click-to-Chat URL with encoded message', () => {
      const url = generateWhatsAppUrl('081234567890', 'Halo Kak Andi, apa kabar?');
      expect(url).toContain('https://wa.me/6281234567890?text=');
      expect(url).toContain(encodeURIComponent('Halo Kak Andi, apa kabar?'));
    });
  });

  describe('Message Template Generator', () => {
    it('generates personalized message for haircut_routine', () => {
      const msg = generateReminderMessage('haircut_routine', {
        customerName: 'Andi',
        daysSinceLastVisit: 25,
        branchName: 'Bypass Cirebon',
        preferredBarberName: 'Rio',
      });
      expect(msg).toContain('Halo Kak Andi');
      expect(msg).toContain('25 hari');
      expect(msg).toContain('Bypass Cirebon');
      expect(msg).toContain('Barber Rio');
    });

    it('generates personalized message for dormant_churn', () => {
      const msg = generateReminderMessage('dormant_churn', {
        customerName: 'Budi',
        daysSinceLastVisit: 50,
      });
      expect(msg).toContain('Halo Kak Budi');
      expect(msg).toContain('50 hari');
      expect(msg).toContain('kami kangen kehadiran Kakak');
    });

    it('generates personalized message for upcoming_appointment', () => {
      const msg = generateReminderMessage('upcoming_appointment', {
        customerName: 'Citra',
        appointmentDate: '2026-08-25',
        appointmentTime: '14:00',
        branchName: 'Bypass Cirebon',
        preferredBarberName: 'Rio',
      });
      expect(msg).toContain('Halo Kak Citra');
      expect(msg).toContain('2026-08-25');
      expect(msg).toContain('14:00 WIB');
      expect(msg).toContain('Barber Rio');
    });
  });

  describe('Candidate Scanner & Categorization', () => {
    it('categorizes customers based on visit interval and upcoming appointments', () => {
      const today = todayDateString();
      const routineDate = daysAgoDateString(25);
      const dormantDate = daysAgoDateString(50);
      const freshDate = daysAgoDateString(3);

      // Andi: transaction 25 days ago
      const trx1: Transaction = {
        id: 'TRX-001',
        branchId: 'br_bypass',
        cashierId: 'emp_owner',
        cashierName: 'Herman',
        customer: { type: 'member', customerId: 'cust_routine', name: 'Andi Routine', phone: '081234567890', tier: 'Gold' },
        items: [{ kind: 'service', itemId: 'svc_1', name: 'Haircut', price: 60000, qty: 1 }],
        subtotal: 60000,
        discount: 0,
        tax: 6000,
        total: 66000,
        method: 'Cash',
        cashTendered: 70000,
        change: 4000,
        appliedPromo: null,
        timestamp: `${routineDate}T10:00:00.000Z`,
      };

      // Budi: transaction 50 days ago
      const trx2: Transaction = {
        id: 'TRX-002',
        branchId: 'br_bypass',
        cashierId: 'emp_owner',
        cashierName: 'Herman',
        customer: { type: 'member', customerId: 'cust_dormant', name: 'Budi Dormant', phone: '081987654321', tier: 'Silver' },
        items: [{ kind: 'service', itemId: 'svc_1', name: 'Haircut', price: 60000, qty: 1 }],
        subtotal: 60000,
        discount: 0,
        tax: 6000,
        total: 66000,
        method: 'Cash',
        cashTendered: 70000,
        change: 4000,
        appliedPromo: null,
        timestamp: `${dormantDate}T10:00:00.000Z`,
      };

      // Doni: transaction 3 days ago (not eligible)
      const trx3: Transaction = {
        id: 'TRX-003',
        branchId: 'br_bypass',
        cashierId: 'emp_owner',
        cashierName: 'Herman',
        customer: { type: 'member', customerId: 'cust_fresh', name: 'Doni Baru Datang', phone: '081200001111', tier: 'Bronze' },
        items: [{ kind: 'service', itemId: 'svc_1', name: 'Haircut', price: 60000, qty: 1 }],
        subtotal: 60000,
        discount: 0,
        tax: 6000,
        total: 66000,
        method: 'Cash',
        cashTendered: 70000,
        change: 4000,
        appliedPromo: null,
        timestamp: `${freshDate}T10:00:00.000Z`,
      };

      // Citra: upcoming appointment today
      const appt1: Appointment = {
        id: 'apt_001',
        branchId: 'br_bypass',
        customer: { type: 'member', customerId: 'cust_upcoming', name: 'Citra Booking', phone: '+628555444333', tier: 'Platinum' },
        barberId: 'emp_rio',
        barberName: 'Rio Barber',
        type: 'regular',
        serviceId: 'svc_1',
        serviceName: 'Haircut Premium',
        paxCount: 1,
        price: 75000,
        date: today,
        startTime: '14:00',
        endTime: '14:30',
        durationMinutes: 30,
        queueNumber: 1,
        status: 'booked',
        createdAt: `${today}T08:00:00.000Z`,
        updatedAt: `${today}T08:00:00.000Z`,
      };

      writeCollection(StorageKeys.transactions, [trx1, trx2, trx3]);
      writeCollection(StorageKeys.appointments, [appt1]);

      const candidates = getCustomerReminderCandidates('br_bypass');

      expect(candidates).toHaveLength(3); // Andi (routine), Budi (dormant), Citra (upcoming)

      const andi = candidates.find((c) => c.customer.id === 'cust_routine');
      const budi = candidates.find((c) => c.customer.id === 'cust_dormant');
      const citra = candidates.find((c) => c.customer.id === 'cust_upcoming');

      expect(andi?.type).toBe('haircut_routine');
      expect(andi?.daysSinceLastVisit).toBe(25);
      expect(andi?.preferredBarberName).toBe('Rio Barber');

      expect(budi?.type).toBe('dormant_churn');
      expect(budi?.daysSinceLastVisit).toBe(50);

      expect(citra?.type).toBe('upcoming_appointment');
      expect(citra?.upcomingAppointmentDate).toBe(today);
      expect(citra?.upcomingAppointmentTime).toBe('14:00');
    });
  });

  describe('Anti-Spam Frequency Cap (7-Day Rule)', () => {
    it('marks candidate as ineligible if reminded within the last 7 days', () => {
      const routineDate = daysAgoDateString(25);
      const trx1: Transaction = {
        id: 'TRX-001',
        branchId: 'br_bypass',
        cashierId: 'emp_owner',
        cashierName: 'Herman',
        customer: { type: 'member', customerId: 'cust_routine', name: 'Andi Routine', phone: '081234567890', tier: 'Gold' },
        items: [{ kind: 'service', itemId: 'svc_1', name: 'Haircut', price: 60000, qty: 1 }],
        subtotal: 60000,
        discount: 0,
        tax: 6000,
        total: 66000,
        method: 'Cash',
        cashTendered: 70000,
        change: 4000,
        appliedPromo: null,
        timestamp: `${routineDate}T10:00:00.000Z`,
      };
      writeCollection(StorageKeys.transactions, [trx1]);

      // Record a reminder sent 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const recentLog: ReminderLog = {
        id: 'rem_001',
        customerId: 'cust_routine',
        customerName: 'Andi Routine',
        customerPhone: '081234567890',
        type: 'haircut_routine',
        message: 'Reminder text',
        sentAt: twoDaysAgo.toISOString(),
        actorId: 'emp_owner',
        actorName: 'Bpk. Herman',
      };
      writeCollection(StorageKeys.reminderLogs, [recentLog]);

      const candidates = getCustomerReminderCandidates('br_bypass');
      const andi = candidates.find((c) => c.customer.id === 'cust_routine');

      expect(andi).toBeDefined();
      expect(andi?.isEligible).toBe(false);
      expect(andi?.ineligibilityReason).toContain('7 hari');
    });

    it('marks candidate as eligible if last reminder was more than 7 days ago', () => {
      const routineDate = daysAgoDateString(25);
      const trx1: Transaction = {
        id: 'TRX-001',
        branchId: 'br_bypass',
        cashierId: 'emp_owner',
        cashierName: 'Herman',
        customer: { type: 'member', customerId: 'cust_routine', name: 'Andi Routine', phone: '081234567890', tier: 'Gold' },
        items: [{ kind: 'service', itemId: 'svc_1', name: 'Haircut', price: 60000, qty: 1 }],
        subtotal: 60000,
        discount: 0,
        tax: 6000,
        total: 66000,
        method: 'Cash',
        cashTendered: 70000,
        change: 4000,
        appliedPromo: null,
        timestamp: `${routineDate}T10:00:00.000Z`,
      };
      writeCollection(StorageKeys.transactions, [trx1]);

      // Record a reminder sent 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const oldLog: ReminderLog = {
        id: 'rem_002',
        customerId: 'cust_routine',
        customerName: 'Andi Routine',
        customerPhone: '081234567890',
        type: 'haircut_routine',
        message: 'Reminder text',
        sentAt: tenDaysAgo.toISOString(),
        actorId: 'emp_owner',
        actorName: 'Bpk. Herman',
      };
      writeCollection(StorageKeys.reminderLogs, [oldLog]);

      const candidates = getCustomerReminderCandidates('br_bypass');
      const andi = candidates.find((c) => c.customer.id === 'cust_routine');

      expect(andi).toBeDefined();
      expect(andi?.isEligible).toBe(true);
      expect(andi?.lastRemindedAt).toBe(oldLog.sentAt);
    });
  });

  describe('Reminder Log Recording', () => {
    it('records a new reminder sent log into storage and retrieves it', () => {
      const log = recordReminderSent(
        'cust_routine',
        'haircut_routine',
        'Halo Kak Andi, saatnya potong rambut!',
        mockEmployee,
      );

      expect(log.id).toMatch(/^rem_/);
      expect(log.customerId).toBe('cust_routine');
      expect(log.actorName).toBe('Bpk. Herman');

      const allLogs = getReminderLogs();
      expect(allLogs).toHaveLength(1);

      const customerLogs = getReminderLogs('cust_routine');
      expect(customerLogs).toHaveLength(1);
    });
  });
});
