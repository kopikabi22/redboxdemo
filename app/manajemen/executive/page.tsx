"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getExecutiveHoldingSummary,
  getBranchLeaderboard,
  getHourlyPeakTraffic,
  getPaymentMethodDistribution,
  formatRupiah,
  todayDateString,
} from "@/lib/data";
import { dummyExecutiveSummary, dummyPnL } from "@/lib/data/dummy";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function ManajemenExecutivePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [periodMonth, setPeriodMonth] = useState(() => todayDateString().slice(0, 7)); // e.g. "2026-08"

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

  // Analytics Engine Queries
  const summary = useMemo(() => {
    if (!isClient) return null;
    return getExecutiveHoldingSummary(periodMonth);
  }, [isClient, periodMonth]);

  const leaderboard = useMemo(() => {
    if (!isClient) return [];
    return getBranchLeaderboard(periodMonth);
  }, [isClient, periodMonth]);

  const hourlyTraffic = useMemo(() => {
    if (!isClient) return [];
    return getHourlyPeakTraffic(selectedBranchId || undefined, periodMonth);
  }, [isClient, selectedBranchId, periodMonth]);

  const paymentDist = useMemo(() => {
    if (!isClient) return [];
    return getPaymentMethodDistribution(selectedBranchId || undefined, periodMonth);
  }, [isClient, selectedBranchId, periodMonth]);

  if (!employee || !summary) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  const maxTrafficCount = Math.max(...hourlyTraffic.map((t) => t.transactionCount), 1);
  const isProfitPositive = summary.totalNetProfit >= 0;

  function getRankBadge(rank: number) {
    if (rank === 1) return <Badge tone="gold">🏆 Juara 1</Badge>;
    if (rank === 2) return <Badge tone="neutral">🥈 Peringkat 2</Badge>;
    if (rank === 3) return <Badge tone="neutral">🥉 Peringkat 3</Badge>;
    return <span className="font-mono text-xs text-text-muted">#{rank}</span>;
  }

  return (
    <ManajemenShell
      employee={employee}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Executive Dashboard & Holding BI"
      activeNavId="executive"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">PERIODE BULAN:</label>
              <input
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>

            <div className="text-text-muted">
              Cakupan:{" "}
              <span className="font-bold text-gold-bright">
                {selectedBranchId ? branches.find((b) => b.id === selectedBranchId)?.name : "Konsolidasi Seluruh Cabang (Holding)"}
              </span>
            </div>
          </div>

          <Button variant="default" onClick={() => window.print()}>
            🖨️ Cetak Ringkasan Eksekutif
          </Button>
        </div>

        {/* 4 Main Executive KPI Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Holding Revenue */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Holding Net Revenue (Omzet)
            </div>
            <div className="mt-1 font-mono text-2xl font-black text-gold-bright">
              {formatRupiah(dummyExecutiveSummary.omzet)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
              <span>Laba Kotor: {formatRupiah(dummyPnL.grossProfit)}</span>
              <span className="font-semibold text-ok">{dummyPnL.margin}</span>
            </div>
          </div>

          {/* 2. Consolidated Net Profit */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Laba Bersih Konsolidasi
            </div>
            <div className={`mt-1 font-mono text-2xl font-black text-ok`}>
              {formatRupiah(dummyExecutiveSummary.labaBersih)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
              <span>Net Margin:</span>
              <span className={`font-bold text-ok`}>
                67.6%
              </span>
            </div>
          </div>

          {/* 3. Transactions & AOV */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Transaksi &amp; Nilai Rata-rata
            </div>
            <div className="mt-1 font-mono text-2xl font-black text-text">
              {dummyExecutiveSummary.transaksi} <span className="text-xs font-normal text-text-muted">transaksi</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
              <span>Rata-rata / AOV:</span>
              <span className="font-mono font-bold text-gold-bright">{formatRupiah(dummyExecutiveSummary.aov)}</span>
            </div>
          </div>

          {/* 4. Customer Base & Members */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Pelanggan &amp; Member Aktif
            </div>
            <div className="mt-1 font-mono text-2xl font-black text-text">
              {Math.round(dummyExecutiveSummary.memberAktif / 0.65)} <span className="text-xs font-normal text-text-muted">konsumen</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
              <span>Member Terdaftar:</span>
              <span className="font-bold text-gold-bright">
                {dummyExecutiveSummary.memberAktif} ({dummyExecutiveSummary.memberPct})
              </span>
            </div>
          </div>
        </div>

        {/* Branch Leaderboard Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <div className="border-b border-border bg-surface-2 px-4 py-3">
            <div className="font-bold uppercase tracking-wider text-text">
              🏆 Leaderboard &amp; Ranking Performa Cabang (Periode {periodMonth})
            </div>
            <div className="text-[11px] text-text-faint">
              Peringkat efektivitas omzet, volume transaksi, dan kontribusi profitabilitas tiap cabang
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2/60 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5 text-center">RANK</th>
                <th className="px-3.5 py-2.5">CABANG &amp; KOTA</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL OMZET</th>
                <th className="px-3.5 py-2.5">KONTRIBUSI OMZET (%)</th>
                <th className="px-3.5 py-2.5 text-center">VOLUME TRX</th>
                <th className="px-3.5 py-2.5 text-right">AOV CABANG</th>
                <th className="px-3.5 py-2.5 text-right">LABA BERSIH (MARGIN)</th>
                <th className="px-3.5 py-2.5 text-right">MEMBER TRX %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leaderboard.map((item) => (
                <tr key={item.branchId} className="hover:bg-surface-2/60">
                  <td className="px-3.5 py-2.5 text-center font-bold">{getRankBadge(item.rank)}</td>
                  <td className="px-3.5 py-2.5">
                    <div className="font-bold text-text">{item.branchName}</div>
                    <div className="text-[10px] text-text-faint">{item.city}</div>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-gold-bright">
                    {formatRupiah(item.revenue)}
                  </td>
                  <td className="w-44 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full bg-gold-bright"
                          style={{ width: `${Math.min(item.revenueShare, 100)}%` }}
                        />
                      </div>
                      <span className="w-10 font-mono text-[11px] text-text-muted">
                        {item.revenueShare.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-mono font-semibold text-text">
                    {item.transactions}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-text-muted">
                    {formatRupiah(item.aov)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono">
                    <span className={`font-bold ${item.netProfit >= 0 ? "text-ok" : "text-danger"}`}>
                      {formatRupiah(item.netProfit)}
                    </span>
                    <div className="text-[10px] text-text-muted">({item.netProfitMargin.toFixed(1)}%)</div>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-text">
                    {item.memberRatio.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Analytics & Traffic Breakdown Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Section A: Peak Hours Traffic */}
          <div className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-text">
                  ⏰ Pola Jam Sibuk &amp; Trafik Pelanggan (09:00 - 21:00)
                </div>
                <div className="text-[11px] text-text-faint">
                  Distribusi volume kedatangan konsumen untuk optimalisasi jam shift barber
                </div>
              </div>
              <Badge tone="gold">Traffic Analysis</Badge>
            </div>

            <div className="grid grid-cols-13 gap-1 pt-4 text-center">
              {hourlyTraffic.map((slot) => {
                const heightPercent = Math.max((slot.transactionCount / maxTrafficCount) * 100, 8);
                return (
                  <div key={slot.hour} className="flex flex-col items-center justify-end">
                    <div className="mb-1 text-[10px] font-bold text-gold-bright">
                      {slot.transactionCount > 0 ? slot.transactionCount : ""}
                    </div>
                    <div className="relative flex h-28 w-full items-end justify-center rounded bg-surface-2 p-0.5">
                      <div
                        className={`w-full rounded transition-all duration-300 ${
                          slot.isPeakHour ? "bg-red" : "bg-gold-bright/60"
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[9px] font-mono text-text-faint">{slot.hourLabel}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 text-[11px] text-text-muted">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded bg-red" />
                <span>Jam Sibuk / Rush Hours (&gt; 80% Trafik Puncak)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded bg-gold-bright/60" />
                <span>Trafik Reguler</span>
              </div>
            </div>
          </div>

          {/* Section B & C: Revenue Streams & Payment Methods */}
          <div className="space-y-4">
            {/* Revenue Stream Breakdown */}
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-text">
                💈 Komposisi Pendapatan
              </div>
              <div className="mt-3 space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">Jasa Haircut &amp; Treatment</span>
                    <span className="font-mono font-bold text-text">{formatRupiah(summary.serviceRevenue)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full bg-gold-bright"
                      style={{
                        width: `${summary.totalRevenue > 0 ? (summary.serviceRevenue / summary.totalRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">Produk Retail Grooming</span>
                    <span className="font-mono font-bold text-text">{formatRupiah(summary.productRevenue)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full bg-ok"
                      style={{
                        width: `${summary.totalRevenue > 0 ? (summary.productRevenue / summary.totalRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted">Pendaftaran Member Baru</span>
                    <span className="font-mono font-bold text-text">{formatRupiah(summary.membershipRevenue)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full bg-warn"
                      style={{
                        width: `${summary.totalRevenue > 0 ? (summary.membershipRevenue / summary.totalRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Distribution */}
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-text">
                💳 Metode Pembayaran
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {paymentDist.map((item) => (
                  <div key={item.method} className="flex items-center justify-between border-b border-border/40 pb-1.5 text-[11px]">
                    <span className="font-semibold text-text">{item.method}</span>
                    <div className="text-right">
                      <span className="font-mono text-text">{formatRupiah(item.totalAmount)}</span>
                      <span className="ml-1.5 font-mono text-[10px] text-text-faint">({item.percentage.toFixed(0)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ManajemenShell>
  );
}
