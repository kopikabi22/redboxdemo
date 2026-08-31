"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  formatRupiah,
  todayDateString,
} from "@/lib/data";
import type {
  HeatmapCellData,
} from "@/lib/data";
import { dummyProductivity } from "@/lib/data/dummy";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 9); // 9 .. 21
const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default function BarberProductivityAndUtilizationPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [periodMonth, setPeriodMonth] = useState(() => todayDateString().slice(0, 7)); // e.g. "2026-08"

  const [selectedCell, setSelectedCell] = useState<HeatmapCellData | null>(null);

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

  function getSeatStatusBadge(status: string) {
    if (status === "Optimal") {
      return <Badge tone="gold">⭐ Optimal (Padat)</Badge>;
    }
    return <Badge tone="danger">⚠️ Underutilized</Badge>;
  }

  function getHeatmapCellClass(level: number) {
    switch (level) {
      case 3:
        return "bg-danger/40 border-danger/80 text-danger-bright font-bold hover:bg-danger/60";
      case 2:
        return "bg-gold-bright/35 border-gold-bright/70 text-gold-bright font-bold hover:bg-gold-bright/50";
      case 1:
        return "bg-ok/25 border-ok/50 text-ok hover:bg-ok/40";
      default:
        return "bg-surface-2/60 border-border/40 text-text-faint hover:bg-surface-2";
    }
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
      pageTitle="Produktivitas Barber & Okupansi Kursi"
      activeNavId="analytics_productivity"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Top Controls Bar */}
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
            🖨️ Cetak Laporan Efisiensi
          </Button>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">
              Top Barber Bulan Ini
            </div>
            <div className="mt-1 truncate text-xl font-bold text-gold-bright">
              {dummyProductivity.barbers[0].nama}
            </div>
            <div className="text-[11px] text-text-faint">
              Performa output &amp; omzet tertinggi di periode ini
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Rata-rata Layanan / Hari
            </div>
            <div className="mt-1 text-2xl font-bold text-text">
              9.3 <span className="text-xs font-normal text-text-muted">layanan/hari</span>
            </div>
            <div className="text-[11px] text-text-faint">
              Output pangkas harian per barber aktif
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">
              Barber Utilization Rate
            </div>
            <div className="mt-1 text-2xl font-bold text-ok">
              81.2%
            </div>
            <div className="text-[11px] text-text-faint">
              Rasio jam aktif melayani vs jam kerja hadir
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">
              Holding Seat Okupansi
            </div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">
              68.5%
            </div>
            <div className="text-[11px] text-text-faint">
              Tingkat keterisian kursi pangkas (Seat Capacity)
            </div>
          </div>
        </div>

        {/* Section 1: Barber Productivity Leaderboard */}
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="border-b border-border pb-3">
            <div className="text-xs font-bold uppercase tracking-wider text-text">
              🏆 Leaderboard Produktivitas Barber
            </div>
            <div className="text-[11px] text-text-faint">
              Peringkat efisiensi, volume pangkas, omzet jasa, upsell retail, dan komisi barber
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-text-muted">
                <tr>
                  <th className="px-3.5 py-2.5 text-center">RANK</th>
                  <th className="px-3.5 py-2.5">NAMA BARBER &amp; CABANG</th>
                  <th className="px-3.5 py-2.5 text-center">HADIR</th>
                  <th className="px-3.5 py-2.5 text-center">OUTPUT / HARI</th>
                  <th className="px-3.5 py-2.5 text-right">OMZET JASA</th>
                  <th className="px-3.5 py-2.5 text-right">UPSELL RETAIL</th>
                  <th className="px-3.5 py-2.5 text-right">TOTAL OMZET</th>
                  <th className="px-3.5 py-2.5 text-right">KOMISI DITERIMA</th>
                  <th className="px-3.5 py-2.5 text-center">EFISIENSI WAKTU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dummyProductivity.barbers.map((b) => (
                  <tr key={b.nama} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 text-center">
                      {b.rank === 1 ? (
                        <Badge tone="gold">🥇 #1</Badge>
                      ) : b.rank === 2 ? (
                        <Badge tone="neutral">🥈 #2</Badge>
                      ) : b.rank === 3 ? (
                        <Badge tone="neutral">🥉 #3</Badge>
                      ) : (
                        <span className="font-mono font-bold text-text-faint">#{b.rank}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-text">{b.nama}</div>
                      <div className="text-[10px] text-text-faint">{b.cabang}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono text-text">
                      {b.hadir} hari
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono font-semibold text-gold-bright">
                      {b.output}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-text">
                      {formatRupiah(b.jasa)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-text-muted">
                      {formatRupiah(b.retail)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-text">
                      {formatRupiah(b.total)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-ok">
                      {formatRupiah(b.komisi)}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-gold-bright"
                            style={{ width: `${b.efisiensi}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-text">
                          {b.efisiensi}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Seat Capacity & Okupansi Kursi per Cabang */}
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="border-b border-border pb-3">
            <div className="text-xs font-bold uppercase tracking-wider text-text">
              🪑 Utilisasi &amp; Okupansi Kursi Pangkas Antar-Cabang (Seat Utilization)
            </div>
            <div className="text-[11px] text-text-faint">
              Evaluasi kapasitas kursi fisik vs total menit pangkas yang terpakai selama 12 jam operasional
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dummyProductivity.occupancy.map((b) => (
              <div
                key={b.cabang}
                className="rounded-lg border border-border bg-surface-2 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-text">{b.cabang}</div>
                  {getSeatStatusBadge(b.status)}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-text-faint">Kapasitas Kursi:</div>
                    <div className="font-mono font-bold text-text">{b.kursi} Kursi</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-faint">Okupansi Rate:</div>
                    <div className="font-mono text-base font-bold text-gold-bright">
                      {b.rate.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${
                        b.status === "Optimal"
                          ? "bg-gold-bright"
                          : "bg-danger"
                      }`}
                      style={{ width: `${b.rate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-text-faint">
                    <span>Status: {b.status}</span>
                    <span>Target: 75%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Day-Hour Traffic & Efficiency Heatmap */}
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text">
                🔥 Heatmap Kepadatan &amp; Trafik Layanan (7 Hari × 13 Jam)
              </div>
              <div className="text-[11px] text-text-faint">
                Pola sebaran jam sibuk operasional untuk penjadwalan shift dan optimasi ketersediaan barber
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center gap-3 text-[11px] text-text-muted">
              <span>Intensitas:</span>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded border border-border/40 bg-surface-2/60" />
                <span>0 trx</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded border border-ok/50 bg-ok/25" />
                <span>1-2 trx</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded border border-gold-bright/70 bg-gold-bright/35" />
                <span>3-5 trx</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded border border-danger/80 bg-danger/40" />
                <span>&gt;5 trx (Puncak)</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[700px] space-y-1.5">
              {/* Hours Header */}
              <div className="grid grid-cols-14 gap-1.5 text-center text-[10px] font-bold text-text-muted">
                <div className="text-left font-normal text-text-faint">HARI</div>
                {HOURS.map((h) => (
                  <div key={h} className="font-mono">
                    {h.toString().padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Day Rows */}
              {DAYS.map((dayName, dIdx) => (
                <div key={dayName} className="grid grid-cols-14 items-center gap-1.5">
                  <div className="text-xs font-bold text-text">{dayName}</div>
                  {HOURS.map((h) => {
                    const isBusy = (dIdx >= 4 && h >= 13 && h <= 19) || (h >= 16 && h <= 19);
                    const isPeak = (dIdx >= 5 && h >= 14 && h <= 18);
                    const trxCount = isPeak ? 6 : isBusy ? 4 : h >= 11 && h <= 20 ? 2 : 0;
                    const level = isPeak ? 3 : isBusy ? 2 : trxCount > 0 ? 1 : 0;
                    const cell: HeatmapCellData = {
                      dayIndex: dIdx,
                      dayName,
                      hour: h,
                      hourLabel: `${h}:00`,
                      transactionCount: trxCount,
                      revenue: trxCount * 125000,
                      intensityLevel: level,
                    };

                    const isSelected =
                      selectedCell?.dayIndex === cell.dayIndex &&
                      selectedCell?.hour === cell.hour;

                    return (
                      <button
                        key={`${dIdx}-${h}`}
                        onClick={() => setSelectedCell(cell)}
                        className={`flex h-8 w-full cursor-pointer flex-col items-center justify-center rounded border text-[11px] transition-all ${getHeatmapCellClass(
                          cell.intensityLevel,
                        )} ${isSelected ? "ring-2 ring-gold-bright" : ""}`}
                        title={`${dayName} ${cell.hourLabel}: ${cell.transactionCount} trx (${formatRupiah(
                          cell.revenue,
                        )})`}
                      >
                        <span className="font-mono">{cell.transactionCount > 0 ? cell.transactionCount : "-"}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Selected Cell Inspector */}
          {selectedCell && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-gold-bright/40 bg-gold-bright/10 p-3 text-xs text-text">
              <div className="flex items-center gap-3">
                <span className="font-bold text-gold-bright">
                  📍 {selectedCell.dayName}, Pukul {selectedCell.hourLabel}
                </span>
                <span className="text-text-muted">|</span>
                <span>
                  Total Transaksi: <strong className="text-text">{selectedCell.transactionCount} pesanan</strong>
                </span>
                <span className="text-text-muted">|</span>
                <span>
                  Omzet: <strong className="text-ok">{formatRupiah(selectedCell.revenue)}</strong>
                </span>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-[11px] text-text-faint hover:text-text"
              >
                ✕ Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </ManajemenShell>
  );
}
