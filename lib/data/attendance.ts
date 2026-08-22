import { StorageKeys, readCollection, writeCollection, generateId, nowIso, todayDateString } from './storage';
import { getEmployeeById, verifyEmployeePin } from './employees';
import type { AttendanceRecord } from './types';

export function getTodaysAttendance(employeeId: string): AttendanceRecord | undefined {
  const today = todayDateString();
  return readCollection<AttendanceRecord>(StorageKeys.attendance).find(
    (record) => record.employeeId === employeeId && record.date === today,
  );
}

export function getAttendanceHistory(employeeId: string, days = 7): AttendanceRecord[] {
  return readCollection<AttendanceRecord>(StorageKeys.attendance)
    .filter((record) => record.employeeId === employeeId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, days);
}

/**
 * `branchId` is deliberately NOT a parameter — it's looked up from the
 * employee's own master record, never trusted from the caller. This is the
 * "auto branch-scoping" architecture rule: an Employee's branch is fixed
 * data, not something a POV Karyawan call site can pass in and have it
 * silently accepted for a different branch.
 */
export function recordClockIn(employeeId: string, pin: string): AttendanceRecord {
  if (!verifyEmployeePin(employeeId, pin)) {
    throw new Error('PIN salah.');
  }
  const employee = getEmployeeById(employeeId);
  if (!employee) {
    throw new Error('Employee tidak ditemukan.');
  }
  if (getTodaysAttendance(employeeId)) {
    throw new Error('Sudah clock-in hari ini.');
  }

  const records = readCollection<AttendanceRecord>(StorageKeys.attendance);
  const record: AttendanceRecord = {
    id: generateId('att'),
    employeeId,
    branchId: employee.branchId,
    date: todayDateString(),
    clockIn: nowIso(),
    clockOut: null,
    breaks: [],
  };
  records.push(record);
  writeCollection(StorageKeys.attendance, records);
  return record;
}

export function recordClockOut(employeeId: string, pin: string): AttendanceRecord {
  if (!verifyEmployeePin(employeeId, pin)) {
    throw new Error('PIN salah.');
  }
  const records = readCollection<AttendanceRecord>(StorageKeys.attendance);
  const today = todayDateString();
  const record = records.find((r) => r.employeeId === employeeId && r.date === today);
  if (!record) {
    throw new Error('Belum clock-in hari ini.');
  }
  if (record.clockOut) {
    throw new Error('Sudah clock-out hari ini.');
  }
  record.clockOut = nowIso();
  writeCollection(StorageKeys.attendance, records);
  return record;
}

export function startBreak(employeeId: string): AttendanceRecord {
  const records = readCollection<AttendanceRecord>(StorageKeys.attendance);
  const today = todayDateString();
  const record = records.find((r) => r.employeeId === employeeId && r.date === today);
  if (!record) {
    throw new Error('Belum clock-in hari ini.');
  }
  if (record.clockOut) {
    throw new Error('Sudah clock-out, tidak bisa mulai istirahat.');
  }
  const lastBreak = record.breaks[record.breaks.length - 1];
  if (lastBreak && lastBreak.end === null) {
    throw new Error('Sedang istirahat.');
  }
  record.breaks.push({ start: nowIso(), end: null });
  writeCollection(StorageKeys.attendance, records);
  return record;
}

export function endBreak(employeeId: string): AttendanceRecord {
  const records = readCollection<AttendanceRecord>(StorageKeys.attendance);
  const today = todayDateString();
  const record = records.find((r) => r.employeeId === employeeId && r.date === today);
  if (!record) {
    throw new Error('Belum clock-in hari ini.');
  }
  const lastBreak = record.breaks[record.breaks.length - 1];
  if (!lastBreak || lastBreak.end !== null) {
    throw new Error('Tidak sedang istirahat.');
  }
  lastBreak.end = nowIso();
  writeCollection(StorageKeys.attendance, records);
  return record;
}
