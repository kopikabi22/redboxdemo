import { StorageKeys, readCollection, writeCollection, generateId, nowIso, todayDateString } from './storage';
import { getCustomers, getCustomerById } from './customers';
import { getTransactions } from './transactions';
import { getAppointments } from './appointments';
import { getBranches, getBranchById } from './branches';
import { getEmployeeById } from './employees';
import type {
  CustomerReminderCandidate,
  ReminderLog,
  ReminderType,
  Employee,
  Transaction,
  Appointment,
} from './types';

export function getReminderLogs(customerId?: string): ReminderLog[] {
  const logs = readCollection<ReminderLog>(StorageKeys.reminderLogs);
  if (customerId) {
    return logs.filter((l) => l.customerId === customerId).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }
  return logs.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return '62' + digits;
  }
  return digits;
}

export function generateWhatsAppUrl(phone: string, text: string): string {
  const formatted = formatWhatsAppPhone(phone);
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
}

export function generateReminderMessage(
  type: ReminderType,
  data: {
    customerName: string;
    daysSinceLastVisit?: number;
    preferredBarberName?: string;
    branchName?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    tier?: string | null;
  },
): string {
  const name = data.customerName;
  const branch = data.branchName ? ` (${data.branchName})` : '';
  const barber = data.preferredBarberName ? ` bersama Barber ${data.preferredBarberName}` : '';

  switch (type) {
    case 'haircut_routine': {
      const days = data.daysSinceLastVisit ?? 25;
      return `Halo Kak ${name}, sudah ${days} hari sejak kunjungan terakhir Kakak di Redbox Barbershop${branch}. Saatnya rapikan rambut agar selalu tampil rapi & percaya diri${barber}. Yuk reservasi jadwal potong rambutmu sekarang!`;
    }
    case 'dormant_churn': {
      const days = data.daysSinceLastVisit ?? 50;
      return `Halo Kak ${name}, kami kangen kehadiran Kakak di Redbox Barbershop! Sudah ${days} hari sejak terakhir kali Kakak mampir. Nikmati kembali layanan grooming premium terbaik dari kami${barber}. Ditunggu kedatangannya ya Kak!`;
    }
    case 'upcoming_appointment': {
      const date = data.appointmentDate ?? 'hari ini';
      const time = data.appointmentTime ?? '10:00';
      return `Halo Kak ${name}, kami ingin mengonfirmasi jadwal reservasi grooming Kakak di Redbox Barbershop${branch} pada ${date} pukul ${time} WIB${barber}. Sampai jumpa!`;
    }
    default:
      return `Halo Kak ${name}, salam dari Redbox Barbershop!`;
  }
}

function getTomorrowDateString(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCustomerReminderCandidates(
  branchId?: string,
  targetType?: ReminderType,
): CustomerReminderCandidate[] {
  const today = todayDateString();
  const tomorrow = getTomorrowDateString();

  const customers = getCustomers();
  const transactions = getTransactions();
  const appointments = getAppointments();
  const branches = getBranches();
  const reminderLogs = getReminderLogs();

  const candidates: CustomerReminderCandidate[] = [];

  for (const customer of customers) {
    // 1. Find all transactions & completed appointments for this customer
    const custTrxs = transactions.filter(
      (t: Transaction) => t.customer.customerId === customer.id || t.customer.phone === customer.phone,
    );
    const custCompletedAppts = appointments.filter(
      (a: Appointment) =>
        (a.customer.customerId === customer.id || a.customer.phone === customer.phone) &&
        (a.status === 'completed' || a.status === 'paid'),
    );

    // 2. Find upcoming appointments (H-0 or H-1)
    const upcomingAppt = appointments.find(
      (a: Appointment) =>
        (a.customer.customerId === customer.id || a.customer.phone === customer.phone) &&
        (a.status === 'booked' || a.status === 'checked_in') &&
        (a.date === today || a.date === tomorrow),
    );

    // 3. Determine last visit date
    const visitDates: string[] = [
      ...custTrxs.map((t: Transaction) => t.timestamp.split('T')[0]),
      ...custCompletedAppts.map((a: Appointment) => a.date),
    ];

    let lastVisitDate: string;
    if (visitDates.length > 0) {
      visitDates.sort((a, b) => b.localeCompare(a));
      lastVisitDate = visitDates[0];
    } else {
      lastVisitDate = customer.createdAt.split('T')[0] || today;
    }

    const diffMs = new Date(today).getTime() - new Date(lastVisitDate).getTime();
    const daysSinceLastVisit = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    // 4. Resolve last branch
    let lastBranchId = branchId;
    if (upcomingAppt) {
      lastBranchId = upcomingAppt.branchId;
    } else if (custTrxs.length > 0) {
      lastBranchId = custTrxs[custTrxs.length - 1].branchId;
    } else if (custCompletedAppts.length > 0) {
      lastBranchId = custCompletedAppts[custCompletedAppts.length - 1].branchId;
    } else {
      lastBranchId = branches[0]?.id;
    }

    // Branch filter
    if (branchId && lastBranchId !== branchId) {
      continue;
    }

    const branchObj = branches.find((b) => b.id === lastBranchId);

    // Preferred barber
    let preferredBarberName: string | undefined;
    if (upcomingAppt) {
      preferredBarberName = upcomingAppt.barberName;
    } else if (customer.preferences?.preferredBarberId) {
      const emp = getEmployeeById(customer.preferences.preferredBarberId);
      if (emp) preferredBarberName = emp.name;
    }

    // 5. Evaluate candidate type
    let type: ReminderType | null = null;
    let upcomingDate: string | undefined;
    let upcomingTime: string | undefined;
    let upcomingId: string | undefined;

    if (upcomingAppt) {
      type = 'upcoming_appointment';
      upcomingDate = upcomingAppt.date;
      upcomingTime = upcomingAppt.startTime;
      upcomingId = upcomingAppt.id;
    } else if (daysSinceLastVisit >= 21 && daysSinceLastVisit <= 35) {
      type = 'haircut_routine';
    } else if (daysSinceLastVisit > 45) {
      type = 'dormant_churn';
    }

    if (!type) {
      continue; // Not a candidate right now
    }

    if (targetType && type !== targetType) {
      continue;
    }

    // 6. Anti-Spam Frequency Cap (Check reminder logs in last 7 days)
    const custLogs = reminderLogs.filter(
      (l) => l.customerId === customer.id || l.customerPhone === customer.phone,
    );
    const recentLog = custLogs.find((l) => {
      const logTime = new Date(l.sentAt).getTime();
      const nowTime = new Date().getTime();
      const diffDays = (nowTime - logTime) / (1000 * 60 * 60 * 24);
      return diffDays < 7;
    });

    let isEligible = true;
    let ineligibilityReason: string | undefined;

    if (recentLog) {
      isEligible = false;
      ineligibilityReason = 'Sudah dikirim reminder dalam 7 hari terakhir';
    }

    const suggestedMessage = generateReminderMessage(type, {
      customerName: customer.name,
      daysSinceLastVisit,
      preferredBarberName,
      branchName: branchObj?.name,
      appointmentDate: upcomingDate,
      appointmentTime: upcomingTime,
      tier: customer.tier,
    });

    candidates.push({
      customer,
      type,
      lastVisitDate,
      daysSinceLastVisit,
      preferredBarberName,
      lastBranchName: branchObj?.name,
      lastBranchId,
      upcomingAppointmentDate: upcomingDate,
      upcomingAppointmentTime: upcomingTime,
      upcomingAppointmentId: upcomingId,
      suggestedMessage,
      lastRemindedAt: custLogs[0]?.sentAt ?? null,
      isEligible,
      ineligibilityReason,
    });
  }

  // Sort: Eligible first, then by days since last visit desc
  return candidates.sort((a, b) => {
    if (a.isEligible !== b.isEligible) {
      return a.isEligible ? -1 : 1;
    }
    return b.daysSinceLastVisit - a.daysSinceLastVisit;
  });
}

export function recordReminderSent(
  customerId: string,
  type: ReminderType,
  message: string,
  actor: Employee,
): ReminderLog {
  const customer = getCustomerById(customerId);
  if (!customer) {
    throw new Error('Customer tidak ditemukan.');
  }

  const logs = readCollection<ReminderLog>(StorageKeys.reminderLogs);
  const log: ReminderLog = {
    id: generateId('rem'),
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    type,
    message,
    sentAt: nowIso(),
    actorId: actor.id,
    actorName: actor.name,
  };

  logs.push(log);
  writeCollection(StorageKeys.reminderLogs, logs);
  return log;
}
