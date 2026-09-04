import type { Transaction } from './types';

/** Existing established retail commission rate for each eligible participant. */
export const PRODUCT_COMMISSION_PERCENT = 5;

export interface EmployeeCommissionResult {
  serviceCommission: number;
  productCommission: number;
  totalServicesCompleted: number;
  totalProductsSold: number;
}

/** Compatibility for historical line-level snapshots created before BR-01. */
export function getActualTransactionBarberId(transaction: Transaction): string | null {
  if (transaction.barberId) return transaction.barberId;
  const legacyIds = [...new Set(transaction.items.map((item) => item.barberId).filter((id): id is string => Boolean(id)))];
  return legacyIds.length === 1 ? legacyIds[0] : null;
}

/**
 * The only calculator used by payroll and barber analytics. Service rates are
 * snapshotted on transaction lines at checkout; legacy data keeps the old
 * 20% fallback rather than deriving an altered historical amount.
 */
export function calculateEmployeeCommission(
  transaction: Transaction,
  employeeId: string,
): EmployeeCommissionResult {
  let serviceCommission = 0;
  let productCommission = 0;
  let totalServicesCompleted = 0;
  let totalProductsSold = 0;
  const barberId = getActualTransactionBarberId(transaction);

  for (const item of transaction.items) {
    if (item.kind === 'service' && barberId === employeeId) {
      const rate = item.commissionPercent ?? 20;
      serviceCommission += item.price * (rate / 100) * item.qty;
      totalServicesCompleted += item.qty;
    }
    if (item.kind === 'product') {
      const barberEarns = barberId === employeeId;
      // A malformed/legacy record may use the same ID for both roles; pay the
      // established 5% once, never twice to one employee.
      const cashierEarns = transaction.cashierId === employeeId && !barberEarns;
      if (barberEarns || cashierEarns) {
        productCommission += item.price * (PRODUCT_COMMISSION_PERCENT / 100) * item.qty;
        totalProductsSold += item.qty;
      }
    }
  }

  return { serviceCommission, productCommission, totalServicesCompleted, totalProductsSold };
}
