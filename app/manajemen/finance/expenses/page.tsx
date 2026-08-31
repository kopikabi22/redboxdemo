"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { dummyExpense } from "@/lib/data/dummy";

export default function ManajemenExpensesPage() {
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
      pageTitle="Pengeluaran & Biaya"
      activeNavId="expenses"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">ID EXPENSE</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">KATEGORI</th>
                <th className="px-3.5 py-2.5">PENERIMA</th>
                <th className="px-3.5 py-2.5">METODE</th>
                <th className="px-3.5 py-2.5 text-right">NOMINAL</th>
                <th className="px-3.5 py-2.5">CATATAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyExpense.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Tidak ada data pengeluaran.
                  </td>
                </tr>
              ) : (
                dummyExpense.map((expense) => (
                  <tr key={expense.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{expense.id}</td>
                    <td className="px-3.5 py-2.5">{expense.tanggal}</td>
                    <td className="px-3.5 py-2.5">{expense.cabang}</td>
                    <td className="px-3.5 py-2.5 font-bold">{expense.kategori}</td>
                    <td className="px-3.5 py-2.5">{expense.penerima}</td>
                    <td className="px-3.5 py-2.5">{expense.metode}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-danger">
                      {expense.nominal.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
                    </td>
                    <td className="px-3.5 py-2.5 text-text-muted">{expense.catatan}</td>
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
