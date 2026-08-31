"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyAP } from "@/lib/data/dummy";

export default function ManajemenAPPage() {
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
      pageTitle="Accounts Payable"
      activeNavId="ap"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NO PO</th>
                <th className="px-3.5 py-2.5">SUPPLIER</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">TGL TERIMA</th>
                <th className="px-3.5 py-2.5">JATUH TEMPO</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL TAGIHAN</th>
                <th className="px-3.5 py-2.5 text-right">TERBAYAR</th>
                <th className="px-3.5 py-2.5 text-right">SISA HUTANG</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyAP.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-text-faint">
                    Tidak ada data hutang.
                  </td>
                </tr>
              ) : (
                dummyAP.map((ap) => (
                  <tr key={ap.po} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{ap.po}</td>
                    <td className="px-3.5 py-2.5 font-bold">{ap.supplier}</td>
                    <td className="px-3.5 py-2.5">{ap.cabang}</td>
                    <td className="px-3.5 py-2.5">{ap.tglTerima}</td>
                    <td className="px-3.5 py-2.5 font-bold text-danger">{ap.jatuhTempo}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-text">
                      {ap.totalTagihan.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-ok">
                      {ap.terbayar.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-danger">
                      {ap.sisaHutang.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={ap.status === "Lunas" ? "ok" : "danger"}>{ap.status}</Badge>
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
