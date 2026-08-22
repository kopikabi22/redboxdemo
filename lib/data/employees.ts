import { StorageKeys, readCollection } from './storage';
import type { Employee, EmployeeRole } from './types';

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
