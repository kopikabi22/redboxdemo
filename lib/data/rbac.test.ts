import { describe, expect, it } from 'vitest';
import { canManageBranch, canEditHoldingData, canApproveRedemption } from './rbac';
import type { Employee } from './types';

const owner: Employee = { id: 'emp_owner', name: 'Owner', role: 'Owner', branchId: 'br_a', pin: '9999' };
const managerA: Employee = { id: 'emp_mgr_a', name: 'Manager A', role: 'BranchManager', branchId: 'br_a', pin: '1111' };
const kasir: Employee = { id: 'emp_kasir', name: 'Kasir', role: 'Kasir', branchId: 'br_a', pin: '1234' };

describe('canManageBranch', () => {
  it('Owner can manage any branch', () => {
    expect(canManageBranch(owner, 'br_a')).toBe(true);
    expect(canManageBranch(owner, 'br_b')).toBe(true);
  });

  it('BranchManager can manage only their own branch', () => {
    expect(canManageBranch(managerA, 'br_a')).toBe(true);
    expect(canManageBranch(managerA, 'br_b')).toBe(false);
  });

  it('a non-Owner/BranchManager role (e.g. Kasir) cannot manage any branch', () => {
    expect(canManageBranch(kasir, 'br_a')).toBe(false);
    expect(canManageBranch(kasir, 'br_b')).toBe(false);
  });
});

describe('canEditHoldingData', () => {
  it('true only for Owner', () => {
    expect(canEditHoldingData(owner)).toBe(true);
    expect(canEditHoldingData(managerA)).toBe(false);
    expect(canEditHoldingData(kasir)).toBe(false);
  });
});

describe('canApproveRedemption', () => {
  it('true for Owner and BranchManager, false for Kasir', () => {
    expect(canApproveRedemption(owner)).toBe(true);
    expect(canApproveRedemption(managerA)).toBe(true);
    expect(canApproveRedemption(kasir)).toBe(false);
  });
});
