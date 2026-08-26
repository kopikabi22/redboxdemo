import type { Employee } from './types';

/**
 * Owner, Admin, and Finance manage every branch; BranchManager only their own. Used to gate
 * Employee Master scope and the "Kelola Stok" manual stock entry point.
 */
export function canManageBranch(actor: Employee, targetBranchId: string): boolean {
  if (actor.role === 'Owner' || actor.role === 'Admin' || actor.role === 'Finance') return true;
  if (actor.role === 'BranchManager') return actor.branchId === targetBranchId;
  return false;
}

/**
 * Branch Management and Product/Service Master are Holding-scope (CLAUDE.md)
 * — Owner/HQ and Admin can create/edit/delete them.
 */
export function canEditHoldingData(actor: Employee): boolean {
  return actor.role === 'Owner' || actor.role === 'Admin';
}

/**
 * Reward redemption approval: Customer has no branchId (Customer ID
 * tunggal, lintas cabang), so canManageBranch's "own branch only" shape
 * doesn't apply here — there's no branch to scope against. Owner, Admin,
 * Finance, and BranchManager are treated as authorized for this operational
 * approval.
 */
export function canApproveRedemption(actor: Employee): boolean {
  return (
    actor.role === 'Owner' ||
    actor.role === 'Admin' ||
    actor.role === 'Finance' ||
    actor.role === 'BranchManager'
  );
}
