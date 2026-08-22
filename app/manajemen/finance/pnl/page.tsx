"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  generateProfitAndLossReport,
  generateCashFlowReport,
  formatRupiah,
  todayDateString,
} from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function ManajemenPnLPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [periodMonth, setPeriodMonth] = useState(() => todayDateString().slice(0, 7)); // e.g. "2026-08"
  const [activeTab, setActiveTab] = useState<"pnl" | "cashflow">("pnl");

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

  const pnlReport = useMemo(() => {
    if (!isClient) return null;
    return generateProfitAndLossReport(selectedBranchId || undefined, periodMonth);
  }, [isClient, selectedBranchId, periodMonth]);

  const cfReport = useMemo(() => {
    if (!isClient) return null;
    return generateCashFlowReport(selectedBranchId || undefined, periodMonth);
  }, [isClient, selectedBranchId, periodMonth]);

  if (!employee || !pnlReport || !cfReport) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  const isSurplus = pnlReport.netProfit >= 0;

  return (
    <ManajemenShell
      employee={employee}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Laporan Laba Rugi & Arus Kas"
      activeNavId="finance_pnl"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Revenue (Omzet)</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{formatRupiah(pnlReport.totalRevenue)}</div>
            <div className="text-[11px] text-text-faint">{pnlReport.transactionCount} transaksi di {periodMonth}</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Laba Kotor (Gross Profit)</div>
            <div className="mt-1 text-2xl font-bold text-ok">{formatRupiah(pnlReport.grossProfit)}</div>
            <div className="text-[11px] text-ok">Margin: {pnlReport.grossProfitMargin.toFixed(1)}%</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">Total OPEX (Beban Operasional)</div>
            <div className="mt-1 text-2xl font-bold text-danger">{formatRupiah(pnlReport.totalOpex)}</div>
            <div className="text-[11px] text-text-faint">Expense + Beban Payroll</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text">Laba Bersih (Net Profit)</div>
            <div className={`mt-1 text-2xl font-black ${isSurplus ? "text-gold-bright" : "text-danger"}`}>
              {formatRupiah(pnlReport.netProfit)}
            </div>
            <div className={`text-[11px] font-semibold ${isSurplus ? "text-gold-bright" : "text-danger"}`}>
              Margin Bersih: {pnlReport.netProfitMargin.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Action Bar & Month Selector */}
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

            <div className="flex items-center rounded border border-border bg-surface-2 p-0.5">
              <button
                onClick={() => setActiveTab("pnl")}
                className={`rounded px-3 py-1 font-bold transition-colors ${
                  activeTab === "pnl" ? "bg-red text-white" : "text-text-muted hover:text-text"
                }`}
              >
                Laba Rugi (P&amp;L)
              </button>
              <button
                onClick={() => setActiveTab("cashflow")}
                className={`rounded px-3 py-1 font-bold transition-colors ${
                  activeTab === "cashflow" ? "bg-red text-white" : "text-text-muted hover:text-text"
                }`}
              >
                Arus Kas (Cash Flow)
              </button>
            </div>
          </div>

          <Button variant="default" onClick={() => window.print()}>
            🖨️ Cetak Laporan
          </Button>
        </div>

        {/* TAB 1: P&L Statement */}
        {activeTab === "pnl" && (
          <div className="rounded-lg border border-border bg-surface p-4 text-xs">
            {/* Header Statement */}
            <div className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-heading text-xl tracking-wider text-gold-bright">REDBOX BARBERSHOP</div>
                  <div className="text-sm font-bold text-text">LAPORAN LABA RUGI OPERASIONAL (P&amp;L)</div>
                  <div className="text-[11px] text-text-faint">
                    Cabang: <span className="font-semibold text-text">{pnlReport.branchName}</span> · Periode: {pnlReport.periodMonth}
                  </div>
                </div>
                <div className="text-right">
                  {isSurplus ? (
                    <Badge tone="ok">SURPLUS OPERASIONAL</Badge>
                  ) : (
                    <Badge tone="danger">DEFISIT OPERASIONAL</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Rows */}
            <div className="mt-4 space-y-4">
              {/* 1. Pendapatan */}
              <div>
                <div className="mb-1.5 font-bold uppercase tracking-wider text-ok">
                  1. PENDAPATAN OPERASIONAL (REVENUE)
                </div>
                <div className="space-y-1 divide-y divide-border/40 rounded border border-border bg-surface-2 p-3">
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Penjualan Jasa Haircut &amp; Treatment</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.serviceRevenue)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Penjualan Produk Retail POS</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.productRevenue)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Pendaftaran &amp; Aktivasi Member Baru</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.membershipRevenue)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Potongan Diskon Promosi &amp; Voucher</span>
                    <span className="font-mono text-danger">-{formatRupiah(pnlReport.totalDiscount)}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-text">
                    <span>Total Pendapatan Bersih (Net Revenue)</span>
                    <span className="font-mono text-gold-bright">{formatRupiah(pnlReport.totalRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* 2. HPP */}
              <div>
                <div className="mb-1.5 font-bold uppercase tracking-wider text-warn">
                  2. HARGA POKOK PENJUALAN (COGS / HPP)
                </div>
                <div className="space-y-1 divide-y divide-border/40 rounded border border-border bg-surface-2 p-3">
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Modal Pokok Barang Retail Terjual</span>
                    <span className="font-mono text-danger">-{formatRupiah(pnlReport.cogs)}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-ok">
                    <span>Laba Kotor (Gross Profit)</span>
                    <span className="font-mono">{formatRupiah(pnlReport.grossProfit)} ({pnlReport.grossProfitMargin.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              {/* 3. Beban Operasional */}
              <div>
                <div className="mb-1.5 font-bold uppercase tracking-wider text-danger">
                  3. BEBAN OPERASIONAL (OPEX)
                </div>
                <div className="space-y-1 divide-y divide-border/40 rounded border border-border bg-surface-2 p-3">
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Beban Sewa Tempat &amp; Gedung</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.expensesByCategory.rent)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Beban Listrik, Air &amp; Internet</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.expensesByCategory.utilities)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Beban Perlengkapan &amp; Kebersihan</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.expensesByCategory.supplies)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Beban Maintenance &amp; Perawatan Alat</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.expensesByCategory.maintenance)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Beban Marketing &amp; Promosi</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.expensesByCategory.marketing)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Beban Operasional Lainnya</span>
                    <span className="font-mono text-text">{formatRupiah(pnlReport.expensesByCategory.other)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-semibold text-text">
                    <span>Beban Gaji Pokok &amp; Komisi Karyawan (Payroll)</span>
                    <span className="font-mono text-danger">-{formatRupiah(pnlReport.payrollExpenses)}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-danger">
                    <span>Total Beban Operasional (OPEX)</span>
                    <span className="font-mono">-{formatRupiah(pnlReport.totalOpex)}</span>
                  </div>
                </div>
              </div>

              {/* 4. Net Profit */}
              <div className={`rounded-lg border p-4 text-center ${
                isSurplus
                  ? "border-gold-bright/40 bg-gold-bright/10"
                  : "border-danger/40 bg-danger/10"
              }`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  LABA BERSIH OPERASIONAL (NET PROFIT)
                </div>
                <div className={`mt-1 font-mono text-3xl font-black ${
                  isSurplus ? "text-gold-bright" : "text-danger"
                }`}>
                  {formatRupiah(pnlReport.netProfit)}
                </div>
                <div className="mt-1 text-xs font-semibold text-text-muted">
                  Margin Laba Bersih: <span className={isSurplus ? "text-gold-bright" : "text-danger"}>{pnlReport.netProfitMargin.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Cash Flow Statement */}
        {activeTab === "cashflow" && (
          <div className="rounded-lg border border-border bg-surface p-4 text-xs">
            <div className="border-b border-border pb-3">
              <div className="font-heading text-xl tracking-wider text-gold-bright">REDBOX BARBERSHOP</div>
              <div className="text-sm font-bold text-text">LAPORAN ARUS KAS MASUK &amp; KELUAR (CASH FLOW)</div>
              <div className="text-[11px] text-text-faint">
                Cabang: <span className="font-semibold text-text">{cfReport.branchName}</span> · Periode: {cfReport.periodMonth}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Inflow */}
              <div className="rounded-lg border border-border bg-surface-2 p-3.5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ok">
                  1. ARUS KAS MASUK (CASH INFLOWS)
                </div>
                <div className="space-y-1.5 divide-y divide-border/60">
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Penerimaan Kasir POS (Tunai / Cash)</span>
                    <span className="font-mono font-medium text-text">{formatRupiah(cfReport.posCashInflow)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Penerimaan Kasir Digital (QRIS, Debit, Transfer)</span>
                    <span className="font-mono font-medium text-text">{formatRupiah(cfReport.posDigitalInflow)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Modal / Setoran Kas Masuk Manual</span>
                    <span className="font-mono font-medium text-text">{formatRupiah(cfReport.manualCashIn)}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-ok">
                    <span>Total Kas Masuk</span>
                    <span className="font-mono text-ok">{formatRupiah(cfReport.totalInflow)}</span>
                  </div>
                </div>
              </div>

              {/* Outflow */}
              <div className="rounded-lg border border-border bg-surface-2 p-3.5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-danger">
                  2. ARUS KAS KELUAR (CASH OUTFLOWS)
                </div>
                <div className="space-y-1.5 divide-y divide-border/60">
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Pengeluaran Beban Operasional (Expenses)</span>
                    <span className="font-mono font-medium text-text">{formatRupiah(cfReport.expenseOutflow)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Pembayaran Hutang Supplier (AP)</span>
                    <span className="font-mono font-medium text-text">{formatRupiah(cfReport.apPaymentOutflow)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Pencairan Gaji &amp; Komisi Karyawan (Paid)</span>
                    <span className="font-mono font-medium text-text">{formatRupiah(cfReport.payrollPaidOutflow)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Pengeluaran Kas Kecil Manual</span>
                    <span className="font-mono font-medium text-text">{formatRupiah(cfReport.manualCashOut)}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-danger">
                    <span>Total Kas Keluar</span>
                    <span className="font-mono text-danger">-{formatRupiah(cfReport.totalOutflow)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Cash Flow Box */}
            <div className={`mt-4 rounded-lg border p-4 text-center ${
              cfReport.netCashFlow >= 0
                ? "border-ok/40 bg-ok/10"
                : "border-danger/40 bg-danger/10"
            }`}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                ARUS KAS BERSIH (NET CASH FLOW)
              </div>
              <div className={`mt-1 font-mono text-3xl font-black ${
                cfReport.netCashFlow >= 0 ? "text-ok" : "text-danger"
              }`}>
                {formatRupiah(cfReport.netCashFlow)}
              </div>
            </div>
          </div>
        )}
      </div>
    </ManajemenShell>
  );
}
