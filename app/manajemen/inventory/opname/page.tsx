"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyOpname } from "@/lib/data/dummy";

export default function ManajemenOpnamePage() {
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
      pageTitle="Stock Opname"
      activeNavId="opname"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">ID OPNAME</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL ITEM</th>
                <th className="px-3.5 py-2.5 text-right">SELISIH</th>
                <th className="px-3.5 py-2.5 text-right">NET VARIANCE</th>
                <th className="px-3.5 py-2.5">PETUGAS</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyOpname.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Tidak ada data opname.
                  </td>
                </tr>
              ) : (
                dummyOpname.map((opname) => (
                  <tr key={opname.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{opname.id}</td>
                    <td className="px-3.5 py-2.5">{opname.tanggal}</td>
                    <td className="px-3.5 py-2.5">{opname.cabang}</td>
                    <td className="px-3.5 py-2.5 text-right">{opname.totalItem}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-danger">{opname.itemSelisih}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-danger">
                      {opname.netVariance.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold">{opname.petugas}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={opname.status === "Selesai" ? "ok" : "warn"}>{opname.status}</Badge>
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
