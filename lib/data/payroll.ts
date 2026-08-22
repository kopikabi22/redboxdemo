import { StorageKeys, readCollection, writeCollection, generateId, nowIso, todayDateString } from './storage';
import { canManageBranch } from './rbac';
import { getEmployeeById, getEmployees } from './employees';
import { getBranchById } from './branches';
import { getServiceById } from './catalog';
import type {
  EmployeeAdvance,
  AdvanceStatus,
  PayrollRecord,
  PayrollStatus,
  Employee,
  AttendanceRecord,
  Transaction,
} from './types';

export const DEFAULT_BASE_SALARIES: Record<string, number> = {
  Barber: 2000000,
  Kasir: 2500000,
  BranchManager: 4000000,
  Owner: 6000000,
};

// ==========================================
// KASBON (EMPLOYEE ADVANCE) MODULE
// ==========================================

export function getEmployeeAdvances(
  employeeId?: string,
  branchId?: string,
  status?: AdvanceStatus,
): EmployeeAdvance[] {
  const advances = readCollection<EmployeeAdvance>(StorageKeys.employeeAdvances);
  return advances
    .filter((a) => {
      if (employeeId && a.employeeId !== employeeId) return false;
      if (branchId && a.branchId !== branchId) return false;
      if (status && a.status !== status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getEmployeeAdvanceById(id: string): EmployeeAdvance | undefined {
  return getEmployeeAdvances().find((a) => a.id === id);
}

export interface CreateEmployeeAdvanceInput {
  employeeId: string;
  amount: number;
  reason: string;
  requestDate?: string;
}

export function createEmployeeAdvance(
  input: CreateEmployeeAdvanceInput,
  actor: Employee,
): EmployeeAdvance {
  const targetEmployee = getEmployeeById(input.employeeId);
  if (!targetEmployee) {
    throw new Error('Karyawan tidak ditemukan.');
  }

  // Staff can only request advance for themselves unless manager/owner
  if ((actor.role === 'Kasir' || actor.role === 'Barber') && actor.id !== input.employeeId) {
    throw new Error('Akses ditolak: hanya bisa mengajukan kasbon untuk diri sendiri.');
  }

  if (input.amount <= 0) {
    throw new Error('Nominal kasbon harus lebih dari Rp 0.');
  }

  const cleanReason = input.reason.trim();
  if (!cleanReason) {
    throw new Error('Alasan pengajuan kasbon wajib diisi.');
  }

  const branch = getBranchById(targetEmployee.branchId);
  const advances = readCollection<EmployeeAdvance>(StorageKeys.employeeAdvances);
  const advanceNumber = `ADV-${Date.now().toString().slice(-8)}`;

  const advance: EmployeeAdvance = {
    id: generateId('adv'),
    advanceNumber,
    employeeId: targetEmployee.id,
    employeeName: targetEmployee.name,
    branchId: targetEmployee.branchId,
    branchName: branch?.name ?? targetEmployee.branchId,
    amount: input.amount,
    requestDate: input.requestDate ?? todayDateString(),
    reason: cleanReason,
    status: 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  advances.push(advance);
  writeCollection(StorageKeys.employeeAdvances, advances);
  return advance;
}

export function approveEmployeeAdvance(id: string, actor: Employee): EmployeeAdvance {
  const allowedRoles = ['Owner', 'BranchManager'];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Akses ditolak: role tidak berhak menyetujui pengajuan kasbon.');
  }

  const advances = readCollection<EmployeeAdvance>(StorageKeys.employeeAdvances);
  const advance = advances.find((a) => a.id === id);
  if (!advance) throw new Error('Pengajuan kasbon tidak ditemukan.');

  if (!canManageBranch(actor, advance.branchId)) {
    throw new Error('Tidak punya akses ke cabang karyawan ini.');
  }

  if (advance.status !== 'pending') {
    throw new Error(`Kasbon tidak dapat disetujui karena berstatus ${advance.status}.`);
  }

  advance.status = 'approved';
  advance.approvedBy = actor.id;
  advance.approvedByName = actor.name;
  advance.approvedAt = nowIso();
  advance.updatedAt = nowIso();

  writeCollection(StorageKeys.employeeAdvances, advances);
  return advance;
}

export function rejectEmployeeAdvance(id: string, actor: Employee): EmployeeAdvance {
  const allowedRoles = ['Owner', 'BranchManager'];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Akses ditolak: role tidak berhak menolak pengajuan kasbon.');
  }

  const advances = readCollection<EmployeeAdvance>(StorageKeys.employeeAdvances);
  const advance = advances.find((a) => a.id === id);
  if (!advance) throw new Error('Pengajuan kasbon tidak ditemukan.');

  if (!canManageBranch(actor, advance.branchId)) {
    throw new Error('Tidak punya akses ke cabang karyawan ini.');
  }

  if (advance.status !== 'pending') {
    throw new Error(`Kasbon tidak dapat ditolak karena berstatus ${advance.status}.`);
  }

  advance.status = 'rejected';
  advance.updatedAt = nowIso();

  writeCollection(StorageKeys.employeeAdvances, advances);
  return advance;
}

// ==========================================
// PAYROLL & COMMISSION CALCULATION MODULE
// ==========================================

export function calculateEmployeePayrollDraft(
  employeeId: string,
  periodMonth: string, // "YYYY-MM"
): PayrollRecord {
  const employee = getEmployeeById(employeeId);
  if (!employee) throw new Error(`Karyawan dengan ID ${employeeId} tidak ditemukan.`);

  const branch = getBranchById(employee.branchId);
  const baseSalary = DEFAULT_BASE_SALARIES[employee.role] ?? 2000000;

  // 1. Calculate Attendance
  const attendanceRecords = readCollection<AttendanceRecord>(StorageKeys.attendance).filter(
    (rec) => rec.employeeId === employeeId && rec.date.startsWith(periodMonth),
  );
  const attendanceDays = attendanceRecords.length;

  // 2. Calculate Commissions from Transactions
  const allTransactions = readCollection<Transaction>(StorageKeys.transactions).filter(
    (tx) => tx.timestamp.startsWith(periodMonth),
  );

  let serviceCommission = 0;
  let productCommission = 0;
  let totalServicesCompleted = 0;
  let totalProductsSold = 0;

  for (const tx of allTransactions) {
    for (const item of tx.items) {
      if (item.kind === 'service') {
        const isMatchedBarber =
          item.barberId === employeeId ||
          (!item.barberId && tx.customer.preferences?.preferredBarberId === employeeId);

        if (isMatchedBarber) {
          const service = getServiceById(item.itemId);
          const commPercent = item.commissionPercent ?? service?.commissionPercent ?? 20;
          const commAmount = item.price * (commPercent / 100) * item.qty;
          serviceCommission += commAmount;
          totalServicesCompleted += item.qty;
        }
      } else if (item.kind === 'product') {
        const isMatchedSeller = item.barberId === employeeId || tx.cashierId === employeeId;
        if (isMatchedSeller) {
          // 5% upsell product commission
          const prodComm = item.price * 0.05 * item.qty;
          productCommission += prodComm;
          totalProductsSold += item.qty;
        }
      }
    }
  }

  // 3. Calculate Approved Advance Deductions (Kasbon)
  const approvedAdvances = getEmployeeAdvances(employeeId, undefined, 'approved').filter(
    (a) => !a.deductedPayrollId,
  );
  const advanceDeduction = approvedAdvances.reduce((sum, a) => sum + a.amount, 0);

  // 4. Overtime & Allowances
  const overtimeBonus = attendanceDays >= 20 ? 200000 : attendanceDays * 10000;
  const allowances = 300000; // Uang makan / transport standar
  const lateDeduction = 0;
  const otherDeductions = 0;

  const grossPay = baseSalary + serviceCommission + productCommission + overtimeBonus + allowances;
  const totalDeductions = advanceDeduction + lateDeduction + otherDeductions;
  const takeHomePay = Math.max(0, grossPay - totalDeductions);

  return {
    id: '',
    payrollNumber: '',
    employeeId: employee.id,
    employeeName: employee.name,
    employeeRole: employee.role,
    branchId: employee.branchId,
    branchName: branch?.name ?? employee.branchId,
    periodMonth,
    attendanceDays,
    totalServicesCompleted,
    totalProductsSold,
    baseSalary,
    serviceCommission,
    productCommission,
    overtimeBonus,
    allowances,
    grossPay,
    advanceDeduction,
    lateDeduction,
    otherDeductions,
    totalDeductions,
    takeHomePay,
    status: 'draft',
    createdBy: '',
    createdByName: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function getPayrollRecords(
  branchId?: string,
  periodMonth?: string,
  status?: PayrollStatus,
  employeeId?: string,
): PayrollRecord[] {
  const records = readCollection<PayrollRecord>(StorageKeys.payrollRecords);
  return records
    .filter((r) => {
      if (branchId && r.branchId !== branchId) return false;
      if (periodMonth && r.periodMonth !== periodMonth) return false;
      if (status && r.status !== status) return false;
      if (employeeId && r.employeeId !== employeeId) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPayrollRecordById(id: string): PayrollRecord | undefined {
  return getPayrollRecords().find((r) => r.id === id);
}

export function generateMonthlyPayroll(
  branchId: string,
  periodMonth: string,
  actor: Employee,
): PayrollRecord[] {
  if (actor.role === 'Kasir' || actor.role === 'Barber') {
    throw new Error('Akses ditolak: role tidak memiliki wewenang menjalankan kalkulasi payroll.');
  }

  if (!canManageBranch(actor, branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  const allEmployees = getEmployees().filter(
    (e) => (branchId ? e.branchId === branchId : true) && e.role !== 'Owner',
  );

  const existingRecords = readCollection<PayrollRecord>(StorageKeys.payrollRecords);
  const generated: PayrollRecord[] = [];

  for (const emp of allEmployees) {
    const draft = calculateEmployeePayrollDraft(emp.id, periodMonth);
    const existingIndex = existingRecords.findIndex(
      (r) => r.employeeId === emp.id && r.periodMonth === periodMonth && r.status !== 'cancelled',
    );

    if (existingIndex >= 0) {
      const existing = existingRecords[existingIndex];
      if (existing.status === 'draft') {
        // Update draft with newest calculation
        existingRecords[existingIndex] = {
          ...draft,
          id: existing.id,
          payrollNumber: existing.payrollNumber,
          createdBy: existing.createdBy,
          createdByName: existing.createdByName,
          createdAt: existing.createdAt,
          updatedAt: nowIso(),
        };
        generated.push(existingRecords[existingIndex]);
      } else {
        generated.push(existing);
      }
    } else {
      const newRecord: PayrollRecord = {
        ...draft,
        id: generateId('pay'),
        payrollNumber: `PAY-${periodMonth.replace('-', '')}-${Date.now().toString().slice(-4)}`,
        createdBy: actor.id,
        createdByName: actor.name,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      existingRecords.push(newRecord);
      generated.push(newRecord);
    }
  }

  writeCollection(StorageKeys.payrollRecords, existingRecords);
  return generated;
}

export function approvePayrollRecord(id: string, actor: Employee): PayrollRecord {
  const allowedRoles = ['Owner', 'BranchManager'];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Akses ditolak: role tidak memiliki wewenang menyetujui payroll.');
  }

  const records = readCollection<PayrollRecord>(StorageKeys.payrollRecords);
  const record = records.find((r) => r.id === id);
  if (!record) throw new Error('Slip gaji payroll tidak ditemukan.');

  if (!canManageBranch(actor, record.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (record.status !== 'draft') {
    throw new Error(`Payroll tidak dapat disetujui karena berstatus ${record.status}.`);
  }

  record.status = 'approved';
  record.approvedBy = actor.id;
  record.approvedByName = actor.name;
  record.approvedAt = nowIso();
  record.updatedAt = nowIso();

  writeCollection(StorageKeys.payrollRecords, records);
  return record;
}

export function markPayrollPaid(id: string, actor: Employee): PayrollRecord {
  const allowedRoles = ['Owner', 'BranchManager'];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Akses ditolak: role tidak memiliki wewenang mencairkan pembayaran payroll.');
  }

  const records = readCollection<PayrollRecord>(StorageKeys.payrollRecords);
  const record = records.find((r) => r.id === id);
  if (!record) throw new Error('Slip gaji payroll tidak ditemukan.');

  if (!canManageBranch(actor, record.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (record.status !== 'approved') {
    throw new Error(`Payroll belum dapat dicairkan karena belum disetujui (Status: ${record.status}).`);
  }

  record.status = 'paid';
  record.paidBy = actor.id;
  record.paidByName = actor.name;
  record.paidAt = nowIso();
  record.updatedAt = nowIso();

  // Deduct linked approved advances for this employee
  const advances = readCollection<EmployeeAdvance>(StorageKeys.employeeAdvances);
  for (const adv of advances) {
    if (adv.employeeId === record.employeeId && adv.status === 'approved' && !adv.deductedPayrollId) {
      adv.status = 'deducted';
      adv.deductedPayrollId = record.id;
      adv.updatedAt = nowIso();
    }
  }

  writeCollection(StorageKeys.employeeAdvances, advances);
  writeCollection(StorageKeys.payrollRecords, records);
  return record;
}

export function cancelPayrollRecord(id: string, reason: string, actor: Employee): PayrollRecord {
  const records = readCollection<PayrollRecord>(StorageKeys.payrollRecords);
  const record = records.find((r) => r.id === id);
  if (!record) throw new Error('Slip gaji payroll tidak ditemukan.');

  if (!canManageBranch(actor, record.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (record.status === 'paid') {
    throw new Error('Slip gaji yang sudah berstatus Paid tidak dapat dibatalkan.');
  }

  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error('Alasan pembatalan payroll wajib diisi.');

  record.status = 'cancelled';
  record.cancellationReason = cleanReason;
  record.updatedAt = nowIso();

  writeCollection(StorageKeys.payrollRecords, records);
  return record;
}
