"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyAuditLog } from "@/lib/data/dummy";

export default function ManajemenAuditPage() {
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
      pageTitle="Audit Trail & Log"
      activeNavId="audit"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">ID LOG</th>
                <th className="px-3.5 py-2.5">WAKTU</th>
                <th className="px-3.5 py-2.5">PETUGAS</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">JENIS</th>
                <th className="px-3.5 py-2.5">ENTITAS</th>
                <th className="px-3.5 py-2.5">DESKRIPSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyAuditLog.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-faint">
                    Tidak ada data log.
                  </td>
                </tr>
              ) : (
                dummyAuditLog.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{log.id}</td>
                    <td className="px-3.5 py-2.5">{log.waktu}</td>
                    <td className="px-3.5 py-2.5 font-bold">{log.petugas}</td>
                    <td className="px-3.5 py-2.5">{log.cabang}</td>
                    <td className="px-3.5 py-2.5">{log.jenis}</td>
                    <td className="px-3.5 py-2.5">{log.entitas}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{log.deskripsi}</td>
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
