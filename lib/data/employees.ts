import { StorageKeys, readCollection, writeCollection, generateId } from './storage';
import { canManageBranch } from './rbac';
import type { Branch, Employee, EmployeeRole } from './types';

const PIN_PATTERN = /^\d{4}$/;

/** Roles that grant POV Manajemen access — assigning either is Owner/HQ-only. */
const ELEVATED_ROLES: EmployeeRole[] = ['BranchManager', 'Owner', 'Finance', 'Admin'];

export function getEmployees(): Employee[] {
  return readCollection<Employee>(StorageKeys.employees);
}

export function getEmployeesByRoles(roles: EmployeeRole[]): Employee[] {
  return getEmployees().filter((e) => roles.includes(e.role));
}

export function getEmployeeById(employeeId: string): Employee | undefined {
  return getEmployees().find((e) => e.id === employeeId);
}

export function verifyEmployeePin(employeeId: string, pin: string): boolean {
  return getEmployeeById(employeeId)?.pin === pin;
}

/** Owner sees every employee; BranchManager only their own branch's. */
export function getManageableEmployees(actingEmployee: Employee): Employee[] {
  return getEmployees().filter((e) => canManageBranch(actingEmployee, e.branchId));
}

export interface CreateEmployeeInput {
  name: string;
  role: EmployeeRole;
  branchId: string;
  pin: string;
}

/**
 * `branchId` is validated directly against the branches collection (not via
 * branches.ts's own functions) to avoid a circular import with branches.ts,
 * which validates against this module's employees collection for its own
 * delete guard.
 */
export function createEmployee(input: CreateEmployeeInput, actingEmployee: Employee): Employee {
  const name = input.name.trim();
  if (!name) throw new Error('Nama karyawan wajib diisi.');
  if (!PIN_PATTERN.test(input.pin)) throw new Error('PIN harus 4 digit angka.');
  if (ELEVATED_ROLES.includes(input.role) && actingEmployee.role !== 'Owner') {
    throw new Error('Hanya Owner/HQ yang bisa menetapkan role BranchManager/Owner.');
  }
  const branchExists = readCollection<Branch>(StorageKeys.branches).some((b) => b.id === input.branchId);
  if (!branchExists) throw new Error('Cabang tidak ditemukan.');
  if (!canManageBranch(actingEmployee, input.branchId)) {
    throw new Error('Tidak punya akses untuk menambah karyawan di cabang ini.');
  }

  const employees = getEmployees();
  const employee: Employee = { id: generateId('emp'), name, role: input.role, branchId: input.branchId, pin: input.pin };
  employees.push(employee);
  writeCollection(StorageKeys.employees, employees);
  return employee;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

/**
 * BranchManager can edit name/role/PIN for employees in their own branch,
 * but can NEVER change `branchId` (inter-branch transfer stays Owner/HQ-only
 * per CLAUDE.md's "Employee Transfer antar-cabang [Holding]") — even a
 * no-op "transfer" to the same branch is rejected, the field is simply not
 * theirs to touch.
 */
export function updateEmployee(employeeId: string, patch: UpdateEmployeeInput, actingEmployee: Employee): Employee {
  const employees = getEmployees();
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) throw new Error('Karyawan tidak ditemukan.');
  if (!canManageBranch(actingEmployee, employee.branchId)) {
    throw new Error('Tidak punya akses ke karyawan ini.');
  }
  if (patch.branchId !== undefined && actingEmployee.role !== 'Owner') {
    throw new Error('Transfer cabang karyawan hanya bisa dilakukan Owner/HQ.');
  }
  if (
    patch.role !== undefined &&
    patch.role !== employee.role &&
    ELEVATED_ROLES.includes(patch.role) &&
    actingEmployee.role !== 'Owner'
  ) {
    throw new Error('Hanya Owner/HQ yang bisa menetapkan role BranchManager/Owner.');
  }
  if (patch.name !== undefined && !patch.name.trim()) {
    throw new Error('Nama karyawan wajib diisi.');
  }
  if (patch.pin !== undefined && !PIN_PATTERN.test(patch.pin)) {
    throw new Error('PIN harus 4 digit angka.');
  }
  if (patch.branchId !== undefined) {
    const branchExists = readCollection<Branch>(StorageKeys.branches).some((b) => b.id === patch.branchId);
    if (!branchExists) throw new Error('Cabang tidak ditemukan.');
  }

  Object.assign(employee, patch, patch.name !== undefined ? { name: patch.name.trim() } : {});
  writeCollection(StorageKeys.employees, employees);
  return employee;
}

/**
 * Two independent guards: an actor can never delete their own account (the
 * one they're currently logged in as), and can only delete employees in a
 * branch they manage (Owner: any; BranchManager: their own).
 */
export function deleteEmployee(employeeId: string, actingEmployee: Employee): void {
  if (employeeId === actingEmployee.id) {
    throw new Error('Tidak bisa menghapus akun sendiri yang sedang login.');
  }
  const employees = getEmployees();
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) throw new Error('Karyawan tidak ditemukan.');
  if (!canManageBranch(actingEmployee, employee.branchId)) {
    throw new Error('Tidak punya akses ke karyawan ini.');
  }
  writeCollection(
    StorageKeys.employees,
    employees.filter((e) => e.id !== employeeId),
  );
}
