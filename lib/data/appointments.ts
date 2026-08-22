import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { getEmployeeById } from './employees';
import { getServices } from './catalog';
import { HOME_SERVICE_PRICING, WEDDING_GROOMING_PRICING } from './types';
import type {
  Appointment,
  AppointmentType,
  AppointmentStatus,
  HomeServicePackage,
  WeddingPackage,
  TransactionCustomer,
} from './types';

export function getAppointments(): Appointment[] {
  return readCollection<Appointment>(StorageKeys.appointments);
}

export function getAppointmentById(id: string): Appointment | undefined {
  return getAppointments().find((a) => a.id === id);
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const normalized = Math.max(0, mins);
  const h = Math.floor(normalized / 60) % 24;
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToTimeString(timeStr: string, minutes: number): string {
  return minutesToTime(timeToMinutes(timeStr) + minutes);
}

export function checkBarberAvailability(
  barberId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string,
): boolean {
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);

  if (newStart >= newEnd) return false;

  const existingList = getAppointments().filter(
    (a) =>
      a.barberId === barberId &&
      a.date === date &&
      a.status !== 'cancelled' &&
      a.status !== 'no_show' &&
      a.id !== excludeAppointmentId,
  );

  for (const item of existingList) {
    const existStart = timeToMinutes(item.startTime);
    const existEnd = timeToMinutes(item.endTime);

    // Overlap condition: startA < endB and endA > startB
    if (newStart < existEnd && newEnd > existStart) {
      return false;
    }
  }

  return true;
}

export function generateDailyQueueNumber(branchId: string, date: string): number {
  const appts = getAppointments().filter((a) => a.branchId === branchId && a.date === date);
  const maxQueue = appts.reduce((max, a) => Math.max(max, a.queueNumber ?? 0), 0);
  return maxQueue + 1;
}

export interface CreateAppointmentInput {
  branchId: string;
  customer: TransactionCustomer;
  barberId: string;
  type: AppointmentType;
  serviceId?: string | null;
  packageType?: HomeServicePackage | WeddingPackage | null;
  paxCount?: number;
  address?: string | null;
  distanceKm?: number | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes?: number;
  notes?: string;
}

export function createAppointment(input: CreateAppointmentInput): Appointment {
  const barber = getEmployeeById(input.barberId);
  if (!barber || barber.role !== 'Barber') {
    throw new Error('Barber tidak ditemukan atau role bukan Barber.');
  }
  if (barber.branchId !== input.branchId) {
    throw new Error('Barber tidak terdaftar di cabang yang dipilih.');
  }

  if (!input.date || !input.startTime) {
    throw new Error('Tanggal dan jam mulai layanan wajib diisi.');
  }

  let durationMinutes = 30;
  let price = 0;
  let serviceName = '';
  let paxCount = 1;

  if (input.type === 'regular' || input.type === 'walk_in') {
    if (!input.serviceId) {
      throw new Error('Layanan (service) wajib dipilih.');
    }
    const service = getServices().find((s) => s.id === input.serviceId);
    if (!service) {
      throw new Error('Layanan tidak ditemukan di katalog.');
    }
    durationMinutes = input.durationMinutes ?? service.durationMinutes;
    price = service.price;
    serviceName = service.name;
    paxCount = 1;
  } else if (input.type === 'home_service') {
    if (!input.packageType || (input.packageType !== 'single' && input.packageType !== 'family')) {
      throw new Error('Paket Home Service harus dipilih (single atau family).');
    }
    paxCount = input.paxCount ?? (input.packageType === 'single' ? 1 : 2);
    if (input.packageType === 'single' && paxCount !== 1) {
      throw new Error('Paket Home Service Single hanya untuk 1 orang.');
    }
    if (input.packageType === 'family' && paxCount < 2) {
      throw new Error('Paket Home Service Family minimal untuk 2 orang.');
    }
    price = input.packageType === 'single' ? HOME_SERVICE_PRICING.single : HOME_SERVICE_PRICING.family * paxCount;
    serviceName = `Home Service (${input.packageType === 'single' ? 'Single' : 'Family'})`;

    // 45 mins per pax + 30 mins travel buffer
    durationMinutes = input.durationMinutes ?? 45 * paxCount + 30;

    if (!input.address || !input.address.trim()) {
      throw new Error('Alamat wajib diisi untuk layanan Home Service.');
    }
    if (input.distanceKm !== undefined && input.distanceKm !== null && input.distanceKm > 5) {
      throw new Error('Lokasi di luar jangkauan radius maksimal 5 KM dari cabang.');
    }
  } else if (input.type === 'wedding') {
    if (!input.packageType || !['gentleman', 'silver', 'gold', 'platinum'].includes(input.packageType)) {
      throw new Error('Paket Wedding Grooming harus dipilih.');
    }
    const pkg = input.packageType as WeddingPackage;
    paxCount = pkg === 'gentleman' ? 1 : pkg === 'silver' ? 2 : pkg === 'gold' ? 3 : 4;
    price = WEDDING_GROOMING_PRICING[pkg];
    serviceName = `Wedding Grooming (${pkg.toUpperCase()})`;

    // 45 mins per pax + 45 mins prep/travel buffer
    durationMinutes = input.durationMinutes ?? 45 * paxCount + 45;

    if (!input.address || !input.address.trim()) {
      throw new Error('Alamat wajib diisi untuk layanan Wedding Grooming.');
    }
    if (input.distanceKm !== undefined && input.distanceKm !== null && input.distanceKm > 5) {
      throw new Error('Lokasi di luar jangkauan radius maksimal 5 KM dari cabang.');
    }
  }

  const endTime = addMinutesToTimeString(input.startTime, durationMinutes);

  const isAvailable = checkBarberAvailability(input.barberId, input.date, input.startTime, endTime);
  if (!isAvailable) {
    throw new Error(`Barber ${barber.name} sudah memiliki jadwal lain pada slot waktu tersebut (${input.startTime} - ${endTime}).`);
  }

  const queueNumber = generateDailyQueueNumber(input.branchId, input.date);

  const appointment: Appointment = {
    id: generateId('appt'),
    branchId: input.branchId,
    customer: input.customer,
    barberId: input.barberId,
    barberName: barber.name,
    type: input.type,
    serviceId: input.serviceId ?? null,
    serviceName,
    packageType: input.packageType ?? null,
    paxCount,
    price,
    address: input.address?.trim() ?? null,
    distanceKm: input.distanceKm ?? null,
    date: input.date,
    startTime: input.startTime,
    endTime,
    durationMinutes,
    queueNumber,
    status: input.type === 'walk_in' ? 'checked_in' : 'booked',
    notes: input.notes?.trim() ?? '',
    noShowReason: null,
    transactionId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const appointments = getAppointments();
  appointments.push(appointment);
  writeCollection(StorageKeys.appointments, appointments);
  return appointment;
}

export function updateAppointmentStatus(
  id: string,
  newStatus: AppointmentStatus,
  metadata?: { notes?: string; noShowReason?: string },
): Appointment {
  const appointments = getAppointments();
  const appointment = appointments.find((a) => a.id === id);
  if (!appointment) {
    throw new Error('Appointment tidak ditemukan.');
  }

  if (appointment.status === 'paid') {
    throw new Error('Appointment yang sudah dibayar tidak dapat diubah statusnya.');
  }
  if (appointment.status === 'cancelled') {
    throw new Error('Appointment yang sudah dibatalkan tidak dapat diubah statusnya.');
  }
  if (appointment.status === 'no_show') {
    throw new Error('Appointment berstatus No-Show tidak dapat diubah statusnya.');
  }

  if (newStatus === 'no_show') {
    if (!metadata?.noShowReason || !metadata.noShowReason.trim()) {
      throw new Error('Alasan No-Show wajib dicatat.');
    }
    appointment.noShowReason = metadata.noShowReason.trim();
  }

  if (metadata?.notes !== undefined) {
    appointment.notes = metadata.notes;
  }

  appointment.status = newStatus;
  appointment.updatedAt = nowIso();

  writeCollection(StorageKeys.appointments, appointments);
  return appointment;
}

export function cancelAppointment(id: string, reason?: string): Appointment {
  return updateAppointmentStatus(id, 'cancelled', { notes: reason });
}

export function markNoShow(id: string, reason: string): Appointment {
  return updateAppointmentStatus(id, 'no_show', { noShowReason: reason });
}

export function markAppointmentPaid(id: string, transactionId: string): Appointment {
  const appointments = getAppointments();
  const appointment = appointments.find((a) => a.id === id);
  if (!appointment) {
    throw new Error('Appointment tidak ditemukan.');
  }

  appointment.status = 'paid';
  appointment.transactionId = transactionId;
  appointment.updatedAt = nowIso();

  writeCollection(StorageKeys.appointments, appointments);
  return appointment;
}

export function getAppointmentsByBranchAndDate(branchId: string, date: string): Appointment[] {
  return getAppointments()
    .filter((a) => a.branchId === branchId && a.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getAppointmentsByBarberAndDate(barberId: string, date: string): Appointment[] {
  return getAppointments()
    .filter((a) => a.barberId === barberId && a.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getUpcomingQueue(branchId: string, date: string): Appointment[] {
  return getAppointments()
    .filter(
      (a) =>
        a.branchId === branchId &&
        a.date === date &&
        (a.status === 'booked' || a.status === 'checked_in' || a.status === 'in_service'),
    )
    .sort((a, b) => (a.queueNumber ?? 0) - (b.queueNumber ?? 0));
}

export function getCompletedUnpaidAppointments(branchId: string): Appointment[] {
  return getAppointments().filter(
    (a) => a.branchId === branchId && a.status === 'completed' && !a.transactionId,
  );
}
