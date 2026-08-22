import { StorageKeys, readCollection, writeCollection, generateId } from './storage';
import { canEditHoldingData } from './rbac';
import type { Branch, Employee } from './types';

export function getBranches(): Branch[] {
  return readCollection<Branch>(StorageKeys.branches);
}

export function getBranchById(branchId: string): Branch | undefined {
  return getBranches().find((b) => b.id === branchId);
}

export interface CreateBranchInput {
  name: string;
  city: string;
  province: string;
  address: string;
  phone: string;
}

export type UpdateBranchInput = Partial<CreateBranchInput>;

export function createBranch(input: CreateBranchInput, actingEmployee: Employee): Branch {
  if (!canEditHoldingData(actingEmployee)) {
    throw new Error('Hanya Owner/HQ yang bisa menambah cabang.');
  }
  const name = input.name.trim();
  if (!name) throw new Error('Nama cabang wajib diisi.');

  const branches = getBranches();
  const branch: Branch = { id: generateId('br'), ...input, name };
  branches.push(branch);
  writeCollection(StorageKeys.branches, branches);
  return branch;
}

export function updateBranch(branchId: string, patch: UpdateBranchInput, actingEmployee: Employee): Branch {
  if (!canEditHoldingData(actingEmployee)) {
    throw new Error('Hanya Owner/HQ yang bisa mengubah data cabang.');
  }
  if (patch.name !== undefined && !patch.name.trim()) {
    throw new Error('Nama cabang wajib diisi.');
  }

  const branches = getBranches();
  const branch = branches.find((b) => b.id === branchId);
  if (!branch) throw new Error('Cabang tidak ditemukan.');

  Object.assign(branch, patch, patch.name !== undefined ? { name: patch.name.trim() } : {});
  writeCollection(StorageKeys.branches, branches);
  return branch;
}

/**
 * `branchId` is looked up directly from the employees collection (not via
 * employees.ts's own functions) to avoid a circular import — employees.ts
 * itself validates a new employee's branchId against this same module.
 */
export function deleteBranch(branchId: string, actingEmployee: Employee): void {
  if (!canEditHoldingData(actingEmployee)) {
    throw new Error('Hanya Owner/HQ yang bisa menghapus cabang.');
  }
  const hasEmployees = readCollection<Employee>(StorageKeys.employees).some((e) => e.branchId === branchId);
  if (hasEmployees) {
    throw new Error('Tidak bisa menghapus cabang yang masih punya karyawan aktif.');
  }
  writeCollection(
    StorageKeys.branches,
    getBranches().filter((b) => b.id !== branchId),
  );
}
