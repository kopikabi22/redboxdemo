"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches, getEmployees, getCustomers, getServices, getProducts } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";

import { dummyRingkasan } from "@/lib/data/dummy";

export default function ManajemenOverviewPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const branches = isClient ? getBranches() : [];
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(session, branches);

  useEffect(() => {
    if (isClient && !session) {
      router.replace("/manajemen/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("manajemen");
    router.replace("/manajemen/login");
  }

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <ManajemenShell
      employee={session}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Ringkasan"
      activeNavId="overview"
      onLogout={handleLogout}
    >
      <div className="font-accent mb-1 text-xs italic text-gold-bright">Konsolidasi Semua Cabang</div>
      <div className="mb-5 font-display text-3xl tracking-wide">Ringkasan Operasional</div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Pendapatan Bulan Ini" value={`Rp ${dummyRingkasan.pendapatanBulanIni.toLocaleString("id-ID")}`} />
        <StatCard label="Total Reservasi" value={dummyRingkasan.totalReservasi} />
        <StatCard label="Pelanggan Baru" value={dummyRingkasan.pelangganBaru} />
      </div>

      <h3 className="mt-6 mb-3 font-display text-xl text-gold-bright">Performa Cabang</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dummyRingkasan.performaCabang.map((c, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <h4 className="font-bold text-lg">{c.cabang}</h4>
            <div className="mt-2 text-sm text-text-muted">Omset: Rp {c.omset.toLocaleString("id-ID")}</div>
            <div className="text-sm text-text-muted">Transaksi: {c.transaksi}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 text-xs text-text-faint">
        Finance/P&amp;L, cash review, dan Analytics &amp; BI lengkap tersedia di Tier 3/4.
      </div>
    </ManajemenShell>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="font-display text-3xl text-gold-bright">{value}</div>
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}
