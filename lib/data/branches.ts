import { StorageKeys, readCollection } from './storage';
import type { Branch } from './types';

export function getBranches(): Branch[] {
  return readCollection<Branch>(StorageKeys.branches);
}

export function getBranchById(branchId: string): Branch | undefined {
  return getBranches().find((b) => b.id === branchId);
}
