"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyTransfer } from "@/lib/data/dummy";

export default function ManajemenTransfersPage() {
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
      pageTitle="Transfer Stok"
      activeNavId="transfers"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">ID TRANSFER</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">ASAL</th>
                <th className="px-3.5 py-2.5">TUJUAN</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL UNIT</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL NILAI</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyTransfer.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-faint">
                    Tidak ada data transfer.
                  </td>
                </tr>
              ) : (
                dummyTransfer.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{transfer.id}</td>
                    <td className="px-3.5 py-2.5">{transfer.tanggal}</td>
                    <td className="px-3.5 py-2.5 font-bold">{transfer.asal}</td>
                    <td className="px-3.5 py-2.5 font-bold">{transfer.tujuan}</td>
                    <td className="px-3.5 py-2.5 text-right">{transfer.totalUnit}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono">
                      {transfer.totalNilai.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={transfer.status === "Selesai" ? "ok" : "warn"}>{transfer.status}</Badge>
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
