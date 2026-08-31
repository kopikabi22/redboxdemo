"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummySupplier } from "@/lib/data/dummy";

export default function ManajemenSuppliersPage() {
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
      pageTitle="Data Supplier"
      activeNavId="suppliers"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">ID SUPPLIER</th>
                <th className="px-3.5 py-2.5">NAMA</th>
                <th className="px-3.5 py-2.5">PIC</th>
                <th className="px-3.5 py-2.5">KONTAK</th>
                <th className="px-3.5 py-2.5">ALAMAT</th>
                <th className="px-3.5 py-2.5">TERMIN</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummySupplier.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-faint">
                    Tidak ada data supplier.
                  </td>
                </tr>
              ) : (
                dummySupplier.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{supplier.id}</td>
                    <td className="px-3.5 py-2.5 font-bold">{supplier.nama}</td>
                    <td className="px-3.5 py-2.5">{supplier.pic}</td>
                    <td className="px-3.5 py-2.5 font-mono">{supplier.kontak}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{supplier.alamat}</td>
                    <td className="px-3.5 py-2.5">{supplier.termin}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={supplier.status === "Aktif" ? "ok" : "neutral"}>{supplier.status}</Badge>
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
