"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyPromo } from "@/lib/data/dummy";

export default function ManajemenPromotionsPage() {
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
      pageTitle="Promo & Voucher"
      activeNavId="promotions"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">KODE PROMO</th>
                <th className="px-3.5 py-2.5">NAMA</th>
                <th className="px-3.5 py-2.5">DISKON</th>
                <th className="px-3.5 py-2.5">SCOPE (CABANG)</th>
                <th className="px-3.5 py-2.5">KUOTA</th>
                <th className="px-3.5 py-2.5">PERIODE</th>
                <th className="px-3.5 py-2.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyPromo.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-faint">
                    Tidak ada data promo.
                  </td>
                </tr>
              ) : (
                dummyPromo.map((promo) => (
                  <tr key={promo.kode} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-gold-bright">{promo.kode}</td>
                    <td className="px-3.5 py-2.5 font-bold">{promo.nama}</td>
                    <td className="px-3.5 py-2.5 font-mono text-ok">{promo.diskon}</td>
                    <td className="px-3.5 py-2.5">{promo.scope}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{promo.kuota}</td>
                    <td className="px-3.5 py-2.5">{promo.periode}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={promo.status === "Aktif" ? "ok" : "warn"}>{promo.status}</Badge>
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
