"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyShift } from "@/lib/data/dummy";

export default function ManajemenSchedulesPage() {
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
      pageTitle="Jadwal & Shift"
      activeNavId="schedules"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">ID SHIFT</th>
                <th className="px-3.5 py-2.5">KARYAWAN</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">SHIFT</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyShift.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-text-faint">
                    Tidak ada data shift.
                  </td>
                </tr>
              ) : (
                dummyShift.map((shift) => (
                  <tr key={shift.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono">{shift.id}</td>
                    <td className="px-3.5 py-2.5 font-bold">{shift.karyawan}</td>
                    <td className="px-3.5 py-2.5">{shift.cabang}</td>
                    <td className="px-3.5 py-2.5">{shift.tanggal}</td>
                    <td className="px-3.5 py-2.5">{shift.shift}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={shift.status === "Hadir" ? "ok" : "neutral"}>
                        {shift.status}
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
