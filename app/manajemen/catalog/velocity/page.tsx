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
import { dummyMenuVelocity } from "@/lib/data/dummy";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function MenuAndProductVelocityPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [periodMonth, setPeriodMonth] = useState(() => todayDateString().slice(0, 7)); // e.g. "2026-08"

  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");

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

  const filteredServices = useMemo(() => {
    if (serviceFilter === "all") return dummyMenuVelocity.services;
    return dummyMenuVelocity.services.filter((s) => s.kuadran.toLowerCase() === serviceFilter.toLowerCase());
  }, [serviceFilter]);

  const filteredProducts = useMemo(() => {
    if (productFilter === "all") return dummyMenuVelocity.retail;
    return dummyMenuVelocity.retail.filter((p) => p.velocity.toLowerCase() === productFilter.toLowerCase());
  }, [productFilter]);

  function getServiceQuadrantBadge(quadrant: string) {
    switch (quadrant.toLowerCase()) {
      case "stars":
        return <Badge tone="gold">⭐ Stars</Badge>;
      case "workhorses":
        return <Badge tone="ok">🐎 Workhorses</Badge>;
      case "puzzles":
        return <Badge tone="neutral">🧩 Puzzles</Badge>;
      case "dogs":
        return <Badge tone="danger">🐕 Dogs</Badge>;
      default:
        return <Badge tone="neutral">{quadrant}</Badge>;
    }
  }

  function getProductVelocityBadge(velocity: string) {
    switch (velocity.toLowerCase()) {
      case "fast moving":
        return <Badge tone="gold">🚀 Fast Moving</Badge>;
      case "medium moving":
        return <Badge tone="ok">📦 Medium</Badge>;
      case "slow moving":
        return <Badge tone="neutral">⏳ Slow Moving</Badge>;
      case "dead stock":
        return <Badge tone="danger">💀 Dead Stock</Badge>;
      default:
        return <Badge tone="neutral">{velocity}</Badge>;
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
      pageTitle="Menu Engineering & Product Velocity"
      activeNavId="catalog_velocity"
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
            🖨️ Cetak Laporan Velocity
          </Button>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Menu &amp; Produk Dianalisis
            </div>
            <div className="mt-1 text-2xl font-bold text-text">
              7
            </div>
            <div className="text-[11px] text-text-faint">
              4 Layanan · 3 Retail SKU
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">
              Layanan Stars (Bintang)
            </div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">
              1 <span className="text-xs font-normal text-text-muted">layanan</span>
            </div>
            <div className="text-[11px] text-text-faint">Volume tinggi &amp; margin profit maksimal</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">
              Produk Fast Moving
            </div>
            <div className="mt-1 text-2xl font-bold text-ok">
              1 <span className="text-xs font-normal text-text-muted">produk</span>
            </div>
            <div className="text-[11px] text-text-faint">Penjualan retail &ge; 10 pcs/bulan</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">
              Peringatan Dead Stock
            </div>
            <div className="mt-1 text-2xl font-bold text-danger">
              1 <span className="text-xs font-normal text-text-muted">produk</span>
            </div>
            <div className="text-[11px] text-text-faint">0 penjualan dalam 60 hari terakhir</div>
          </div>
        </div>

        {/* Section 1: Menu Engineering Layanan (Services Matrix) */}
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text">
                💈 Matriks Menu Engineering Layanan (Kasavana &amp; Smith Matrix)
              </div>
              <div className="text-[11px] text-text-faint">
                Klasifikasi kuadran profitabilitas vs popularitas pesanan layanan pangkas &amp; perawatan
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(["all", "stars", "workhorses", "puzzles", "dogs"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setServiceFilter(q)}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                    serviceFilter === q
                      ? "bg-gold-bright text-bg"
                      : "bg-surface-2 text-text-muted hover:text-text"
                  }`}
                >
                  {q === "all" ? "Semua Kuadran" : q}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-text-muted">
                <tr>
                  <th className="px-3.5 py-2.5">LAYANAN</th>
                  <th className="px-3.5 py-2.5 text-right">HARGA JUAL</th>
                  <th className="px-3.5 py-2.5 text-right">MARGIN %</th>
                  <th className="px-3.5 py-2.5 text-center">TERJUAL (QTY)</th>
                  <th className="px-3.5 py-2.5 text-right">TOTAL OMZET</th>
                  <th className="px-3.5 py-2.5 text-right">TOTAL LABA</th>
                  <th className="px-3.5 py-2.5 text-center">KUADRAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredServices.map((s, idx) => (
                  <tr key={idx} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-bold text-text">
                      {s.layanan}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-text">
                      {formatRupiah(s.harga)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-gold-bright">
                      {s.margin}
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-text">
                      {s.terjual}x
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-text">
                      {formatRupiah(s.harga * s.terjual)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-ok">
                      {formatRupiah(s.laba)}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {getServiceQuadrantBadge(s.kuadran)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Product Velocity & Inventory Matrix */}
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text">
                📦 Analisis Kecepatan Produk Retail (Product Velocity)
              </div>
              <div className="text-[11px] text-text-faint">
                Perputaran stok ritel grooming, margin HPP, dan deteksi dini barang macet (Dead Stock)
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(["all", "fast moving", "medium moving", "dead stock"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setProductFilter(v)}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                    productFilter === v
                      ? "bg-gold-bright text-bg"
                      : "bg-surface-2 text-text-muted hover:text-text"
                  }`}
                >
                  {v === "all" ? "Semua Kecepatan" : v}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-text-muted">
                <tr>
                  <th className="px-3.5 py-2.5">NAMA PRODUK</th>
                  <th className="px-3.5 py-2.5 text-right">HARGA JUAL</th>
                  <th className="px-3.5 py-2.5 text-right">MARGIN %</th>
                  <th className="px-3.5 py-2.5 text-center">TERJUAL</th>
                  <th className="px-3.5 py-2.5 text-right">TOTAL OMZET</th>
                  <th className="px-3.5 py-2.5 text-center">SISA STOK</th>
                  <th className="px-3.5 py-2.5 text-center">VELOCITY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((p, idx) => (
                  <tr key={idx} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-bold text-text">
                      {p.produk}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-text">
                      {formatRupiah(p.harga)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-gold-bright">
                      {p.margin}
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-text">
                      {p.terjual} pcs
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-text">
                      {formatRupiah(p.harga * p.terjual)}
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono">
                      <span className={`font-bold ${p.stok <= 15 ? "text-danger" : "text-text"}`}>
                        {p.stok} pcs
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {getProductVelocityBadge(p.velocity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Cross-Selling & Basket Affinity Insights */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="border-b border-border pb-3">
            <div className="text-xs font-bold uppercase tracking-wider text-text">
              🤝 Pola Cross-Selling &amp; Keranjang Belanja Campuran (Basket Affinity)
            </div>
            <div className="text-[11px] text-text-faint">
              Kombinasi layanan dan produk retail yang paling sering dibeli bersamaan oleh konsumen
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { serviceName: "Haircut Premium + Styling", productName: "Pomade Matte 100g", rate: 68, count: 165 },
              { serviceName: "Haircut Reguler", productName: "Shampoo Anti Ketombe 200ml", rate: 35, count: 140 },
              { serviceName: "Hair Coloring", productName: "Beard Oil 30ml", rate: 22, count: 33 }
            ].map((pair, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-surface-2 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gold-bright">#{idx + 1} Best Pair</span>
                  <Badge tone="ok">{pair.rate}% Konversi</Badge>
                </div>

                <div className="mt-2.5 space-y-1 text-xs">
                  <div className="font-bold text-text">{pair.serviceName}</div>
                  <div className="text-[11px] text-text-muted">↳ direkomendasikan bersama:</div>
                  <div className="font-semibold text-gold-bright">{pair.productName}</div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-text-faint">
                  <span>Frekuensi Transaksi:</span>
                  <span className="font-mono font-bold text-text">{pair.count}x bersama</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ManajemenShell>
  );
}
