"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyReminder } from "@/lib/data/dummy";

export default function ManajemenRemindersPage() {
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
      pageTitle="Customer Reminders"
      activeNavId="reminders"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">ID REMINDER</th>
                <th className="px-3.5 py-2.5">CUSTOMER</th>
                <th className="px-3.5 py-2.5">TIER</th>
                <th className="px-3.5 py-2.5">KUNJUNGAN TERAKHIR</th>
                <th className="px-3.5 py-2.5">BARBER</th>
                <th className="px-3.5 py-2.5">TIPE</th>
                <th className="px-3.5 py-2.5">PESAN</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyReminder.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Tidak ada data reminder.
                  </td>
                </tr>
              ) : (
                dummyReminder.map((reminder) => (
                  <tr key={reminder.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{reminder.id}</td>
                    <td className="px-3.5 py-2.5 font-bold">{reminder.customer}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={reminder.tier === "Gold" ? "gold" : "neutral"}>{reminder.tier}</Badge>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-text-muted">{reminder.terakhir}</td>
                    <td className="px-3.5 py-2.5">{reminder.barber}</td>
                    <td className="px-3.5 py-2.5">{reminder.tipe}</td>
                    <td className="px-3.5 py-2.5 text-text-muted truncate max-w-xs" title={reminder.pesan}>{reminder.pesan}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={reminder.status === "Aman" ? "ok" : "warn"}>{reminder.status}</Badge>
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
