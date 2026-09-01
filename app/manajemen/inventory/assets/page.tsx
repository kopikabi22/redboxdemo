"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { dummyAssets } from "@/lib/data/dummy";

export default function ManajemenAssetsPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [kondisiFilter, setKondisiFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  // Summary Metrics
  const totalAssets = dummyAssets.length;
  const totalBaik = dummyAssets.filter((a) => a.kondisi === "Baik").length;
  const totalService = dummyAssets.filter((a) => a.kondisi === "Service").length;
  const totalRusak = dummyAssets.filter((a) => a.kondisi === "Rusak").length;

  const filteredAssets = useMemo(() => {
    return dummyAssets.filter((asset) => {
      // Branch filter if specific branch is selected
      if (selectedBranchId) {
        const branchObj = branches.find((b) => b.id === selectedBranchId);
        if (branchObj && asset.cabang.toLowerCase() !== branchObj.name.toLowerCase()) {
          if (asset.cabang !== "HQ") {
            return false;
          }
        }
      }

      // Condition filter
      if (kondisiFilter !== "all" && asset.kondisi.toLowerCase() !== kondisiFilter.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          asset.kode.toLowerCase().includes(q) ||
          asset.nama.toLowerCase().includes(q) ||
          asset.pic.toLowerCase().includes(q) ||
          asset.kategori.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [selectedBranchId, branches, kondisiFilter, searchQuery]);

  function getKondisiBadge(kondisi: string) {
    switch (kondisi.toLowerCase()) {
      case "baik":
        return <Badge tone="ok">Baik</Badge>;
      case "service":
        return <Badge tone="warn">Service</Badge>;
      case "rusak":
        return <Badge tone="danger">Rusak</Badge>;
      default:
        return <Badge tone="neutral">{kondisi}</Badge>;
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
      pageTitle="MANAJEMEN ASET & ALAT KERJA"
      activeNavId="assets"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Aset Terdata</div>
            <div className="mt-1 text-2xl font-bold text-text">{totalAssets} Unit</div>
            <div className="text-[11px] text-text-faint">Inventaris peralatan &amp; furnitur</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Kondisi Baik</div>
            <div className="mt-1 text-2xl font-bold text-ok">{totalBaik} Unit</div>
            <div className="text-[11px] text-ok">Siap pakai operasional</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Dalam Service</div>
            <div className="mt-1 text-2xl font-bold text-warn">{totalService} Unit</div>
            <div className="text-[11px] text-text-faint">Perawatan &amp; perbaikan rutin</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">Kondisi Rusak</div>
            <div className="mt-1 text-2xl font-bold text-danger">{totalRusak} Unit</div>
            <div className="text-[11px] text-text-faint">Perlu penggantian unit baru</div>
          </div>
        </div>

        {/* Filter & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">KONDISI:</label>
              <select
                value={kondisiFilter}
                onChange={(event) => setKondisiFilter(event.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Kondisi</option>
                <option value="baik">Baik</option>
                <option value="service">Service</option>
                <option value="rusak">Rusak</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">CARI ASET:</label>
              <input
                type="text"
                placeholder="Kode, Nama Aset, PIC..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-60 rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>

            <div className="text-[11px] text-text-muted">
              Menampilkan <span className="font-bold text-text">{filteredAssets.length}</span> aset
            </div>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700"
          >
            <span>+ Tambah Aset Baru</span>
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">KODE ASET</th>
                <th className="px-3.5 py-2.5">NAMA ASET</th>
                <th className="px-3.5 py-2.5">KATEGORI</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">PENANGGUNG JAWAB (PIC)</th>
                <th className="px-3.5 py-2.5">TANGGAL BELI</th>
                <th className="px-3.5 py-2.5 text-center">KONDISI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-faint">
                    Tidak ada data aset yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.kode} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-gold-bright">{asset.kode}</td>
                    <td className="px-3.5 py-2.5 font-bold text-text">{asset.nama}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{asset.kategori}</td>
                    <td className="px-3.5 py-2.5 text-text">{asset.cabang}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-text">{asset.pic}</td>
                    <td className="px-3.5 py-2.5 font-mono text-text-muted">{asset.tanggalBeli}</td>
                    <td className="px-3.5 py-2.5 text-center">{getKondisiBadge(asset.kondisi)}</td>
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
