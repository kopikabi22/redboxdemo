import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { getEmployeeById, getEmployees } from './employees';
import { getBranchById } from './branches';
import { canEditHoldingData } from './rbac';
import { SHIFT_TIMES } from './types';
import type { ShiftSchedule, ShiftType, Employee } from './types';

export function getSchedules(): ShiftSchedule[] {
  return readCollection<ShiftSchedule>(StorageKeys.schedules);
}

export function getScheduleById(id: string): ShiftSchedule | undefined {
  return getSchedules().find((s) => s.id === id);
}

export function getSchedulesByBranchAndDate(branchId: string, date: string): ShiftSchedule[] {
  return getSchedules().filter((s) => s.branchId === branchId && s.date === date);
}

export function getSchedulesByBranchAndDateRange(
  branchId: string,
  startDate: string,
  endDate: string,
): ShiftSchedule[] {
  return getSchedules().filter(
    (s) => s.branchId === branchId && s.date >= startDate && s.date <= endDate,
  );
}

export function getEmployeeSchedule(employeeId: string, date: string): ShiftSchedule | undefined {
  return getSchedules().find((s) => s.employeeId === employeeId && s.date === date);
}

function assertCanManageSchedule(branchId: string, actingEmployee: Employee): void {
  if (canEditHoldingData(actingEmployee)) {
    return; // Owner/HQ can manage all branches
  }
  if (actingEmployee.role === 'BranchManager') {
    if (actingEmployee.branchId !== branchId) {
      throw new Error('Branch Manager hanya berhak mengelola jadwal di cabang sendiri.');
    }
    return;
  }
  throw new Error('Hanya Owner atau Branch Manager yang berhak mengelola jadwal kerja.');
}

export interface UpsertScheduleInput {
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export function validateMinimumBarberCoverage(
  branchId: string,
  date: string,
  targetEmployeeId: string,
  targetShiftType: ShiftType,
  existingSchedules: ShiftSchedule[],
): void {
  const employee = getEmployeeById(targetEmployeeId);
  if (!employee || employee.role !== 'Barber') {
    return; // Coverage rule only applies to Barbers
  }

  if (targetShiftType !== 'off' && targetShiftType !== 'cuti') {
    return; // Setting to active shift won't violate minimum coverage
  }

  const branch = getBranchById(branchId);
  const minCoverage = branch?.minBarberCoverage ?? 1;

  // All barbers assigned to this branch
  const branchBarbers = getEmployees().filter(
    (e) => e.role === 'Barber' && e.branchId === branchId,
  );

  if (branchBarbers.length === 0) return;

  // Count how many barbers will be on-duty (pagi, siang, full) on this date
  let activeBarberCount = 0;

  for (const barber of branchBarbers) {
    if (barber.id === targetEmployeeId) {
      // This barber is being set to targetShiftType (off / cuti), so not active
      continue;
    }

    const scheduled = existingSchedules.find(
      (s) => s.employeeId === barber.id && s.date === date,
    );

    // If scheduled as pagi/siang/full -> active
    // If not explicitly scheduled in rolling schedule yet, treat as active (default work day) unless off/cuti
    if (!scheduled || (scheduled.shiftType !== 'off' && scheduled.shiftType !== 'cuti')) {
      activeBarberCount++;
    }
  }

  if (activeBarberCount < minCoverage) {
    throw new Error(
      `Tidak dapat mengatur status ${targetShiftType.toUpperCase()}. Minimal ${minCoverage} barber wajib bertugas di cabang ${branch?.name ?? branchId} pada tanggal ${date}.`,
    );
  }
}

export function upsertEmployeeSchedule(
  input: UpsertScheduleInput,
  actingEmployee: Employee,
): ShiftSchedule {
  const employee = getEmployeeById(input.employeeId);
  if (!employee) {
    throw new Error('Karyawan tidak ditemukan.');
  }

  assertCanManageSchedule(employee.branchId, actingEmployee);

  const schedules = getSchedules();

  // Validate coverage rule before writing
  validateMinimumBarberCoverage(
    employee.branchId,
    input.date,
    input.employeeId,
    input.shiftType,
    schedules,
  );

  const shiftConfig = SHIFT_TIMES[input.shiftType];
  const startTime = input.startTime ?? shiftConfig.startTime;
  const endTime = input.endTime ?? shiftConfig.endTime;

  const existingIndex = schedules.findIndex(
    (s) => s.employeeId === input.employeeId && s.date === input.date,
  );

  let result: ShiftSchedule;

  if (existingIndex >= 0) {
    const existing = schedules[existingIndex];
    result = {
      ...existing,
      shiftType: input.shiftType,
      startTime,
      endTime,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      updatedAt: nowIso(),
    };
    schedules[existingIndex] = result;
  } else {
    result = {
      id: generateId('sch'),
      branchId: employee.branchId,
      employeeId: employee.id,
      employeeName: employee.name,
      role: employee.role,
      date: input.date,
      shiftType: input.shiftType,
      startTime,
      endTime,
      notes: input.notes ?? '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    schedules.push(result);
  }

  writeCollection(StorageKeys.schedules, schedules);
  return result;
}

export function bulkUpsertSchedules(
  inputs: UpsertScheduleInput[],
  actingEmployee: Employee,
): ShiftSchedule[] {
  const results: ShiftSchedule[] = [];
  for (const input of inputs) {
    results.push(upsertEmployeeSchedule(input, actingEmployee));
  }
  return results;
}

export function deleteSchedule(id: string, actingEmployee: Employee): void {
  const schedules = getSchedules();
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) {
    throw new Error('Jadwal tidak ditemukan.');
  }

  assertCanManageSchedule(schedule.branchId, actingEmployee);

  const filtered = schedules.filter((s) => s.id !== id);
  writeCollection(StorageKeys.schedules, filtered);
}
