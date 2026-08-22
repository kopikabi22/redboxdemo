import type { Employee } from './types';

/**
 * Owner manages every branch; BranchManager only their own. Used to gate
 * Employee Master scope and the "Kelola Stok" manual stock entry point.
 */
export function canManageBranch(actor: Employee, targetBranchId: string): boolean {
  if (actor.role === 'Owner') return true;
  if (actor.role === 'BranchManager') return actor.branchId === targetBranchId;
  return false;
}

/**
 * Branch Management and Product/Service Master are Holding-scope (CLAUDE.md)
 * — only Owner/HQ can create/edit/delete them. BranchManager can still view.
 */
export function canEditHoldingData(actor: Employee): boolean {
  return actor.role === 'Owner';
}

/**
 * Reward redemption approval: Customer has no branchId (Customer ID
 * tunggal, lintas cabang), so canManageBranch's "own branch only" shape
 * doesn't apply here — there's no branch to scope against. Owner and
 * BranchManager are treated as equally authorized for this operational
 * approval, the same way either can approve a leave request or a
 * refund/void. Kasir/Barber are never authorized.
 */
export function canApproveRedemption(actor: Employee): boolean {
  return actor.role === 'Owner' || actor.role === 'BranchManager';
}
