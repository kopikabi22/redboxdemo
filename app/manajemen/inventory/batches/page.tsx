"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyBatchInventory } from "@/lib/data/dummy";

export default function ManajemenBatchesPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  useEffect(() => {
    if (!isClient) return;
    if (!session) {
      router.replace("/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("manajemen");
    router.replace("/login");
  }

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <ManajemenShell
      employee={employee}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Batch & Kadaluarsa"
      activeNavId="batches"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">SKU</th>
                <th className="px-3.5 py-2.5">PRODUK</th>
                <th className="px-3.5 py-2.5">BATCH</th>
                <th className="px-3.5 py-2.5">STOK</th>
                <th className="px-3.5 py-2.5">TANGGAL EXPIRED</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyBatchInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-text-faint">
                    Tidak ada data batch inventory.
                  </td>
                </tr>
              ) : (
                dummyBatchInventory.map((batch) => (
                  <tr key={batch.sku} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono">{batch.sku}</td>
                    <td className="px-3.5 py-2.5 font-bold">{batch.produk}</td>
                    <td className="px-3.5 py-2.5">{batch.batch}</td>
                    <td className="px-3.5 py-2.5">{batch.stok}</td>
                    <td className="px-3.5 py-2.5">{batch.expired}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={batch.status === "Aman" ? "ok" : batch.status === "Habis" ? "danger" : "warn"}>
                        {batch.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ManajemenShell>
  );
}
