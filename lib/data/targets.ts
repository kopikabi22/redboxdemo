import { StorageKeys, readCollection, writeCollection, generateId, nowIso, todayDateString } from './storage';
import { getBranchById } from './branches';
import { recordAuditLog } from './audit';
import type {
  BranchTarget,
  BranchTargetProgress,
  TargetStatus,
  Employee,
  Transaction,
  Customer,
} from './types';

export function getBranchTargets(branchId?: string, periodMonth?: string): BranchTarget[] {
  const targets = readCollection<BranchTarget>(StorageKeys.branchTargets);
  return targets
    .filter((t) => {
      if (branchId && t.branchId !== branchId) return false;
      if (periodMonth && t.periodMonth !== periodMonth) return false;
      return true;
    })
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth) || a.branchName.localeCompare(b.branchName));
}

export function getBranchTargetById(id: string): BranchTarget | undefined {
  return getBranchTargets().find((t) => t.id === id);
}

export interface SetBranchTargetInput {
  branchId: string;
  periodMonth: string; // "YYYY-MM"
  targetRevenue: number;
  targetTransactions: number;
  targetNewCustomers: number;
  targetMembershipActivations: number;
  notes?: string;
}

export function setBranchTarget(input: SetBranchTargetInput, actor: Employee): BranchTarget {
  if (actor.role !== 'Owner') {
    throw new Error('Akses ditolak: hanya Owner yang berhak menetapkan target performa cabang.');
  }

  const branch = getBranchById(input.branchId);
  if (!branch) {
    throw new Error('Cabang tidak ditemukan.');
  }

  if (
    input.targetRevenue < 0 ||
    input.targetTransactions < 0 ||
    input.targetNewCustomers < 0 ||
    input.targetMembershipActivations < 0
  ) {
    throw new Error('Target tidak boleh bernilai negatif.');
  }

  const targets = readCollection<BranchTarget>(StorageKeys.branchTargets);
  const existingIndex = targets.findIndex(
    (t) => t.branchId === input.branchId && t.periodMonth === input.periodMonth,
  );

  let target: BranchTarget;

  if (existingIndex >= 0) {
    target = {
      ...targets[existingIndex],
      targetRevenue: input.targetRevenue,
      targetTransactions: input.targetTransactions,
      targetNewCustomers: input.targetNewCustomers,
      targetMembershipActivations: input.targetMembershipActivations,
      notes: input.notes?.trim() || undefined,
      updatedAt: nowIso(),
    };
    targets[existingIndex] = target;
  } else {
    target = {
      id: generateId('tgt'),
      branchId: input.branchId,
      branchName: branch.name,
      periodMonth: input.periodMonth,
      targetRevenue: input.targetRevenue,
      targetTransactions: input.targetTransactions,
      targetNewCustomers: input.targetNewCustomers,
      targetMembershipActivations: input.targetMembershipActivations,
      notes: input.notes?.trim() || undefined,
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    targets.push(target);
  }

  writeCollection(StorageKeys.branchTargets, targets);

  // Record System Audit Log
  recordAuditLog({
    actor,
    branchId: input.branchId,
    action: 'SET_BRANCH_TARGET',
    entityType: 'BranchTarget',
    entityId: target.id,
    details: `Menetapkan target performa cabang ${branch.name} periode ${input.periodMonth}`,
    metadata: {
      targetRevenue: input.targetRevenue,
      targetTransactions: input.targetTransactions,
      targetNewCustomers: input.targetNewCustomers,
      targetMembershipActivations: input.targetMembershipActivations,
    },
  });

  return target;
}

export function calculateBranchTargetProgress(
  branchId: string,
  periodMonth?: string,
): BranchTargetProgress {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const branch = getBranchById(branchId);
  const branchName = branch ? branch.name : branchId;

  const existingTarget = getBranchTargets(branchId, targetMonth)[0];
  const target: BranchTarget = existingTarget || {
    id: '',
    branchId,
    branchName,
    periodMonth: targetMonth,
    targetRevenue: 25000000,
    targetTransactions: 250,
    targetNewCustomers: 50,
    targetMembershipActivations: 15,
    createdBy: '',
    createdByName: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  // 1. Transactions Aggregation
  const transactions = readCollection<Transaction>(StorageKeys.transactions).filter(
    (tx) => tx.timestamp.startsWith(targetMonth) && tx.branchId === branchId,
  );

  const actualRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
  const actualTransactions = transactions.length;

  let actualMembershipActivations = 0;
  for (const tx of transactions) {
    for (const item of tx.items) {
      if (item.itemId === 'svc_membership_activation') {
        actualMembershipActivations += item.qty;
      }
    }
  }

  // 2. New Customers Aggregation
  const customers = readCollection<Customer>(StorageKeys.customers).filter(
    (c) => c.createdAt.startsWith(targetMonth),
  );
  const actualNewCustomers = customers.length;

  // 3. Percentages
  const revenuePercentage = target.targetRevenue > 0 ? (actualRevenue / target.targetRevenue) * 100 : 0;
  const transactionsPercentage =
    target.targetTransactions > 0 ? (actualTransactions / target.targetTransactions) * 100 : 0;
  const newCustomersPercentage =
    target.targetNewCustomers > 0 ? (actualNewCustomers / target.targetNewCustomers) * 100 : 0;
  const membershipPercentage =
    target.targetMembershipActivations > 0
      ? (actualMembershipActivations / target.targetMembershipActivations) * 100
      : 0;

  const overallPercentage =
    (revenuePercentage + transactionsPercentage + newCustomersPercentage + membershipPercentage) / 4;

  // 4. Status determination
  let status: TargetStatus;
  if (overallPercentage >= 100) {
    status = 'achieved';
  } else if (overallPercentage >= 75) {
    status = 'on_track';
  } else if (overallPercentage >= 50) {
    status = 'at_risk';
  } else {
    status = 'off_track';
  }

  return {
    target,
    actualRevenue,
    actualTransactions,
    actualNewCustomers,
    actualMembershipActivations,
    revenuePercentage,
    transactionsPercentage,
    newCustomersPercentage,
    membershipPercentage,
    overallPercentage,
    status,
  };
}
