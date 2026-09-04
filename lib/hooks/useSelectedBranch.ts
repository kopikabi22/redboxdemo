"use client";

import { useState } from "react";
import type { Branch, Employee } from "@/lib/data";

/**
 * Which branch is "selected" for branch-scoped POV Manajemen data (Employee
 * Master list, product stock / Kelola Stok). BranchManager's is always
 * their own branch — the selector can't change it. Owner can switch
 * freely; kept as page-local state (not URL-persisted), so it resets when
 * navigating between Manajemen tabs — a deliberate simplicity trade-off for
 * this Tier 1 slice, not an oversight.
 */
export function useSelectedBranchId(
  employee: Employee | null,
  branches: Branch[],
): { selectedBranchId: string; setSelectedBranchId: (branchId: string) => void } {
  const [manualBranchId, setManualBranchId] = useState<string | null>(null);

  if (!employee) {
    return { selectedBranchId: "", setSelectedBranchId: () => {} };
  }
  const defaultBranchId = employee.branchId || (branches[0]?.id ?? "");
  const selectedBranchId =
    manualBranchId && branches.some((b) => b.id === manualBranchId)
      ? manualBranchId
      : (branches.find((b) => b.id === defaultBranchId)?.id ?? (branches[0]?.id ?? ""));

  return { selectedBranchId, setSelectedBranchId: setManualBranchId };
}
