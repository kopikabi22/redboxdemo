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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<typeof dummyAssets[0] | null>(null);

  // Pagination state (Immutable .slice)
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 10;

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

  useEffect(() => {
    setCurrentPage(0);
  }, [selectedBranchId, kondisiFilter, searchQuery]);

  const totalPages = Math.ceil(filteredAssets.length / pageSize) || 1;
  const paginatedAssets = useMemo(() => {
    return filteredAssets.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  }, [filteredAssets, currentPage, pageSize]);

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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="cursor-pointer flex items-center gap-1.5 rounded border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-surface hover:border-gold-bright"
            >
              <span>🖨️ Cetak / Export</span>
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="cursor-pointer flex items-center gap-1.5 rounded bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700"
            >
              <span>+ Tambah Aset Baru</span>
            </button>
          </div>
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
                <th className="px-3.5 py-2.5 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Tidak ada data aset yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                paginatedAssets.map((asset) => (
                  <tr key={asset.kode} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-gold-bright">{asset.kode}</td>
                    <td className="px-3.5 py-2.5 font-bold text-text">{asset.nama}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{asset.kategori}</td>
                    <td className="px-3.5 py-2.5 text-text">{asset.cabang}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-text">{asset.pic}</td>
                    <td className="px-3.5 py-2.5 font-mono text-text-muted">{asset.tanggalBeli}</td>
                    <td className="px-3.5 py-2.5 text-center">{getKondisiBadge(asset.kondisi)}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditAsset(asset)}
                          className="cursor-pointer rounded border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-gold-bright transition-colors hover:bg-surface hover:text-white"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => alert('Fitur Hapus dinonaktifkan pada mode UAT Demo untuk melindungi integritas data.')}
                          className="cursor-pointer rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3 text-xs">
              <div className="text-text-muted">
                Menampilkan <span className="font-bold text-text">{currentPage * pageSize + 1}</span> - <span className="font-bold text-text">{Math.min((currentPage + 1) * pageSize, filteredAssets.length)}</span> dari <span className="font-bold text-text">{filteredAssets.length}</span> aset
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="cursor-pointer rounded border border-border bg-surface px-3 py-1.5 font-semibold text-text transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ◀ Sebelumnya
                </button>
                <span className="font-mono font-bold text-gold-bright">
                  Halaman {currentPage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="cursor-pointer rounded border border-border bg-surface px-3 py-1.5 font-semibold text-text transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Selanjutnya ▶
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Tambah Aset Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text">Tambah Aset &amp; Alat Kerja Baru</h3>
                <p className="text-[11px] text-text-muted">Masukkan data inventaris peralatan cabang</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert("Aset berhasil ditambahkan ke dalam sistem!");
                setIsModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="mb-1 block font-bold text-text-muted">NAMA ASET <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Clipper Cordless Gold Edition"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-text-muted">KATEGORI <span className="text-red-500">*</span></label>
                <select
                  required
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text focus:border-gold-bright focus:outline-none"
                >
                  <option value="Peralatan Barbershop">Peralatan Barbershop</option>
                  <option value="Furnitur &amp; Interior">Furnitur &amp; Interior</option>
                  <option value="Elektronik &amp; IT">Elektronik &amp; IT</option>
                  <option value="Sanitasi &amp; Sterilisasi">Sanitasi &amp; Sterilisasi</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-text-muted">PENANGGUNG JAWAB (PIC) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi (Barber Leader)"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-border bg-surface-2 px-4 py-2 font-semibold text-text-muted transition-colors hover:bg-surface hover:text-text"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("Aset berhasil ditambahkan ke dalam sistem!");
                    setIsModalOpen(false);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white shadow-sm transition-colors hover:bg-red-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Aset */}
      {editAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text">Ubah Data Aset &amp; Alat Kerja</h3>
                <p className="text-[11px] text-text-muted">Kode: <span className="font-mono text-gold-bright">{editAsset.kode}</span></p>
              </div>
              <button
                type="button"
                onClick={() => setEditAsset(null)}
                className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert("Perubahan data aset berhasil disimpan!");
                setEditAsset(null);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="mb-1 block font-bold text-text-muted">NAMA ASET <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  defaultValue={editAsset.nama}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-text-muted">KATEGORI <span className="text-red-500">*</span></label>
                <select
                  required
                  defaultValue={editAsset.kategori}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text focus:border-gold-bright focus:outline-none"
                >
                  <option value="Peralatan Barbershop">Peralatan Barbershop</option>
                  <option value="Furnitur &amp; Interior">Furnitur &amp; Interior</option>
                  <option value="Elektronik &amp; IT">Elektronik &amp; IT</option>
                  <option value="Sanitasi &amp; Sterilisasi">Sanitasi &amp; Sterilisasi</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-text-muted">PENANGGUNG JAWAB (PIC) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  defaultValue={editAsset.pic}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-text-muted">KONDISI <span className="text-red-500">*</span></label>
                <select
                  required
                  defaultValue={editAsset.kondisi}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text focus:border-gold-bright focus:outline-none"
                >
                  <option value="Baik">Baik</option>
                  <option value="Service">Service</option>
                  <option value="Rusak">Rusak</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditAsset(null)}
                  className="cursor-pointer rounded-lg border border-border bg-surface-2 px-4 py-2 font-semibold text-text-muted transition-colors hover:bg-surface hover:text-text"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-gold-bright px-4 py-2 font-bold text-black shadow-sm transition-colors hover:bg-yellow-400"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ManajemenShell>
  );
}
