import { readValue, writeValue, removeValue, sessionKey, type SessionNamespace } from './storage';
import { getEmployeeById } from './employees';
import type { Employee } from './types';

export type { SessionNamespace } from './storage';

/**
 * Re-reads the employee from the master list rather than trusting the
 * stored snapshot, so a session survives an Employee Master edit (role
 * change, branch transfer) made in the POV Manajemen side.
 */
export function getSessionEmployee(namespace: SessionNamespace): Employee | null {
  const stored = readValue<Employee | null>(sessionKey(namespace), null);
  if (!stored) return null;
  return getEmployeeById(stored.id) ?? null;
}

export function setSessionEmployee(namespace: SessionNamespace, employee: Employee): void {
  writeValue(sessionKey(namespace), employee);
}

export function clearSession(namespace: SessionNamespace): void {
  removeValue(sessionKey(namespace));
}
