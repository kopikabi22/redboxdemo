import { beforeEach, describe, expect, it } from 'vitest';
import { StorageKeys, readCollection, writeCollection } from './storage';
import { recordClockIn, recordClockOut, startBreak, endBreak, getTodaysAttendance } from './attendance';
import type { AttendanceRecord, Employee } from './types';

const EMPLOYEE_ID = 'emp_test';
const BRANCH_ID = 'br_test';
const PIN = '1234';

function seedEmployee() {
  writeCollection<Employee>(StorageKeys.employees, [
    { id: EMPLOYEE_ID, name: 'Test Kasir', role: 'Kasir', branchId: BRANCH_ID, pin: PIN },
  ]);
}

function snapshotAttendance(): AttendanceRecord[] {
  return readCollection<AttendanceRecord>(StorageKeys.attendance);
}

beforeEach(() => {
  window.localStorage.clear();
  seedEmployee();
});

describe('recordClockIn', () => {
  it('creates a new record with clockIn set, clockOut null, breaks empty when PIN is correct', () => {
    const record = recordClockIn(EMPLOYEE_ID, PIN);

    expect(record.employeeId).toBe(EMPLOYEE_ID);
    expect(record.branchId).toBe(BRANCH_ID);
    expect(record.clockIn).toBeTruthy();
    expect(record.clockOut).toBeNull();
    expect(record.breaks).toEqual([]);

    const stored = snapshotAttendance();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(record);
  });

  it('throws on a wrong PIN and writes nothing to the attendance collection', () => {
    const before = snapshotAttendance();

    expect(() => recordClockIn(EMPLOYEE_ID, '9999')).toThrowError('PIN salah.');

    expect(snapshotAttendance()).toEqual(before);
    expect(snapshotAttendance()).toHaveLength(0);
  });

  it('throws "Sudah clock-in hari ini." on a second call the same day, leaving the first record unchanged', () => {
    const first = recordClockIn(EMPLOYEE_ID, PIN);

    expect(() => recordClockIn(EMPLOYEE_ID, PIN)).toThrowError('Sudah clock-in hari ini.');

    const after = snapshotAttendance();
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual(first);
  });
});

describe('recordClockOut', () => {
  it('throws when called before any clock-in today, and writes nothing', () => {
    const before = snapshotAttendance();

    expect(() => recordClockOut(EMPLOYEE_ID, PIN)).toThrowError('Belum clock-in hari ini.');

    expect(snapshotAttendance()).toEqual(before);
    expect(snapshotAttendance()).toHaveLength(0);
  });

  it('throws "Sudah clock-out hari ini." on a second call after a valid clock-in/clock-out', () => {
    recordClockIn(EMPLOYEE_ID, PIN);
    recordClockOut(EMPLOYEE_ID, PIN);

    expect(() => recordClockOut(EMPLOYEE_ID, PIN)).toThrowError('Sudah clock-out hari ini.');
  });
});

describe('startBreak', () => {
  it('throws when called before clock-in', () => {
    expect(() => startBreak(EMPLOYEE_ID)).toThrowError('Belum clock-in hari ini.');
  });

  it('throws "Sedang istirahat." when called twice in a row without an endBreak in between', () => {
    recordClockIn(EMPLOYEE_ID, PIN);
    startBreak(EMPLOYEE_ID);

    expect(() => startBreak(EMPLOYEE_ID)).toThrowError('Sedang istirahat.');
  });
});

describe('endBreak', () => {
  it('throws when no break was ever started', () => {
    recordClockIn(EMPLOYEE_ID, PIN);

    expect(() => endBreak(EMPLOYEE_ID)).toThrowError('Tidak sedang istirahat.');
  });

  it('throws when the last break already has an end (not currently on break)', () => {
    recordClockIn(EMPLOYEE_ID, PIN);
    startBreak(EMPLOYEE_ID);
    endBreak(EMPLOYEE_ID);

    expect(() => endBreak(EMPLOYEE_ID)).toThrowError('Tidak sedang istirahat.');
  });
});

describe('full valid cycle', () => {
  it('clockIn -> startBreak -> endBreak -> clockOut produces a correctly shaped final record', () => {
    recordClockIn(EMPLOYEE_ID, PIN);
    startBreak(EMPLOYEE_ID);
    endBreak(EMPLOYEE_ID);
    const final = recordClockOut(EMPLOYEE_ID, PIN);

    expect(final.clockIn).toBeTruthy();
    expect(final.clockOut).toBeTruthy();
    expect(final.breaks).toHaveLength(1);
    expect(final.breaks[0].start).toBeTruthy();
    expect(final.breaks[0].end).toBeTruthy();

    // The stored record matches what was returned — no divergence between
    // the return value and what actually ended up in localStorage.
    expect(getTodaysAttendance(EMPLOYEE_ID)).toEqual(final);
  });
});
