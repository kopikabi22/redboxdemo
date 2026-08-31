"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyPayroll } from "@/lib/data/dummy";

export default function ManajemenPayrollPage() {
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
      pageTitle="Gaji & Komisi"
      activeNavId="payroll"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">ID SLIP</th>
                <th className="px-3.5 py-2.5">NAMA KARYAWAN</th>
                <th className="px-3.5 py-2.5">PERIODE</th>
                <th className="px-3.5 py-2.5 text-right">GAJI POKOK</th>
                <th className="px-3.5 py-2.5 text-right">KOMISI</th>
                <th className="px-3.5 py-2.5 text-right">POTONGAN</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL (THP)</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyPayroll.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Tidak ada data payroll.
                  </td>
                </tr>
              ) : (
                dummyPayroll.map((payroll) => (
                  <tr key={payroll.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{payroll.id}</td>
                    <td className="px-3.5 py-2.5 font-bold">{payroll.karyawan}</td>
                    <td className="px-3.5 py-2.5">{payroll.periode}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono">
                      {payroll.gajiPokok.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-ok">
                      {payroll.komisi.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-danger">
                      {payroll.potongan > 0 ? `-${payroll.potongan.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}` : "Rp 0"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-gold-bright">
                      {payroll.total.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={payroll.status === "Lunas" ? "gold" : payroll.status === "Draft" ? "neutral" : "ok"}>
                        {payroll.status}
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
