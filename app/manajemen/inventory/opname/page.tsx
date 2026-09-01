"use client";

import { dummyOpname } from "@/lib/data/dummy";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getProducts,
  getAvailableStock,
  getStockOpnames,
  createStockOpname,
  completeStockOpname,
  cancelStockOpname,
} from "@/lib/data";
import type { StockOpname, StockOpnameStatus } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function ManajemenStockOpnamePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const products = useMemo(() => (isClient ? getProducts() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [opnameVersion, setOpnameVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Opname Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBranchId, setNewBranchId] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail Modal State
  const [detailOpname, setDetailOpname] = useState<StockOpname | null>(null);

  // Cancel Modal State
  const [cancelModalOpname, setCancelModalOpname] = useState<StockOpname | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  const allOpnames = useMemo(() => {
    if (!isClient) return [];
    void opnameVersion;
    return getStockOpnames(selectedBranchId || undefined);
  }, [isClient, selectedBranchId, opnameVersion]);

  const filteredOpnames = useMemo(() => {
    return allOpnames.filter((op) => {
      if (statusFilter !== "all" && op.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [allOpnames, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = allOpnames.length;
    const draftCount = allOpnames.filter((o) => o.status === "draft").length;
    const completedCount = allOpnames.filter((o) => o.status === "completed").length;
    const totalVarianceItems = allOpnames.reduce((sum, o) => sum + o.totalVarianceItems, 0);

    return { totalCount, draftCount, completedCount, totalVarianceItems };
  }, [allOpnames]);

  function handleOpenCreate() {
    const targetBranch = selectedBranchId || branches[0]?.id || "";
    setNewBranchId(targetBranch);
    setNewNotes("");

    // Initialize physical counts with current system quantity
    const initialCounts: Record<string, string> = {};
    const initialNotes: Record<string, string> = {};
    products.forEach((p) => {
      const currentStock = getAvailableStock(p.id, targetBranch);
      initialCounts[p.id] = String(currentStock);
      initialNotes[p.id] = "";
    });

    setPhysicalCounts(initialCounts);
    setItemNotes(initialNotes);
    setCreateError(null);
    setCreateModalOpen(true);
  }

  function handleBranchChangeInModal(branchId: string) {
    setNewBranchId(branchId);
    const updatedCounts: Record<string, string> = {};
    products.forEach((p) => {
      const currentStock = getAvailableStock(p.id, branchId);
      updatedCounts[p.id] = String(currentStock);
    });
    setPhysicalCounts(updatedCounts);
  }

  function handleSaveCreate() {
    if (!employee) return;
    setCreateError(null);

    const itemsToSubmit = [];
    for (const p of products) {
      const countStr = physicalCounts[p.id];
      const countNum = parseInt(countStr, 10);
      if (isNaN(countNum) || countNum < 0) {
        setCreateError(`Jumlah fisik untuk produk ${p.name} tidak valid.`);
        return;
      }
      itemsToSubmit.push({
        productId: p.id,
        physicalQty: countNum,
        notes: itemNotes[p.id] || undefined,
      });
    }

    try {
      createStockOpname(
        {
          branchId: newBranchId,
          items: itemsToSubmit,
          notes: newNotes || undefined,
        },
        employee,
      );

      setCreateModalOpen(false);
      setOpnameVersion((v) => v + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat sesi Stock Opname.");
    }
  }

  function handleComplete(opname: StockOpname) {
    if (!employee) return;
    try {
      completeStockOpname(opname.id, employee);
      setDetailOpname(null);
      setOpnameVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyelesaikan Stock Opname.");
    }
  }

  function handleOpenCancel(opname: StockOpname) {
    setDetailOpname(null);
    setCancelModalOpname(opname);
    setCancelReason("");
    setCancelError(null);
  }

  function handleConfirmCancel() {
    if (!employee || !cancelModalOpname) return;
    setCancelError(null);

    if (!cancelReason.trim()) {
      setCancelError("Alasan pembatalan Stock Opname wajib diisi.");
      return;
    }

    try {
      cancelStockOpname(cancelModalOpname.id, cancelReason, employee);
      setCancelModalOpname(null);
      setOpnameVersion((v) => v + 1);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Gagal membatalkan Stock Opname.");
    }
  }

  function getStatusBadge(status: StockOpnameStatus) {
    switch (status) {
      case "draft":
        return <Badge tone="warn">Draft (Belum Diselesaikan)</Badge>;
      case "completed":
        return <Badge tone="ok">Selesai (Saldo Disesuaikan)</Badge>;
      case "cancelled":
        return <Badge tone="danger">Dibatalkan</Badge>;
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
      pageTitle="Stock Opname & Variance"
      activeNavId="stock_opname"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Sesi Opname</div>
            <div className="mt-1 text-2xl font-bold text-text">{stats.totalCount}</div>
            <div className="text-[11px] text-text-faint">Histori perhitungan stok</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Sesi Draft Aktif</div>
            <div className="mt-1 text-2xl font-bold text-warn">{stats.draftCount}</div>
            <div className="text-[11px] text-text-faint">Perlu diverifikasi &amp; diselesaikan</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Opname Selesai</div>
            <div className="mt-1 text-2xl font-bold text-ok">{stats.completedCount}</div>
            <div className="text-[11px] text-text-faint">Saldo sistem telah disinkronkan</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Total Item Selisih</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{stats.totalVarianceItems}</div>
            <div className="text-[11px] text-text-faint">Kasus selisih fisik vs sistem</div>
          </div>
        </div>

        {/* Action Bar & Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex items-center gap-2.5 text-xs">
            <label className="font-bold text-text-muted">STATUS:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="draft">Draft (Aktif)</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>

          <Button variant="primary" onClick={handleOpenCreate}>
            + Buka Sesi Opname Baru
          </Button>
        </div>

        {/* Opnames Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NOMOR OPNAME</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5 text-center">TOTAL ITEM</th>
                <th className="px-3.5 py-2.5 text-center">ITEM SELISIH</th>
                <th className="px-3.5 py-2.5 text-center">NET VARIANCE</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5">PETUGAS</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyOpname.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummyOpname.map((op) => (
                  <tr key={op.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-gold-bright">{op.id}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{op.tanggal}</td>
                    <td className="px-3.5 py-2.5 font-medium text-text">{op.cabang}</td>
                    <td className="px-3.5 py-2.5 text-center font-mono">{op.totalItem}</td>
                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-warn">{op.itemSelisih} Item</td>
                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-danger">{op.netVariance.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
                    <td className="px-3.5 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${op.status === 'Selesai' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>{op.status}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-text-muted">{op.petugas}</td>
                    <td className="px-3.5 py-2.5 text-center"><button className="text-gold-bright">Detail</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buka Sesi Opname Baru */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        eyebrow="Penghitungan Stok Fisik"
        title="Buka Sesi Stock Opname"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveCreate}>
              Simpan &amp; Buka Sesi Opname
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {createError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-text-muted">CABANG</label>
              <select
                value={newBranchId}
                onChange={(e) => handleBranchChangeInModal(e.target.value)}
                disabled={employee.role !== "Owner"}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text disabled:opacity-60 focus:border-gold-bright focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">CATATAN SESI</label>
              <input
                type="text"
                placeholder="Misal: Opname akhir bulan..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded border border-border bg-surface-2 p-3 space-y-2">
            <div className="font-bold text-text mb-1">Daftar Produk &amp; Input Hitungan Fisik Riil</div>

            <div className="space-y-2.5">
              {products.map((p) => {
                const currentSystem = getAvailableStock(p.id, newBranchId);
                const physicalStr = physicalCounts[p.id] ?? String(currentSystem);
                const physicalNum = parseInt(physicalStr, 10) || 0;
                const variance = physicalNum - currentSystem;

                return (
                  <div key={p.id} className="rounded border border-border bg-surface p-2.5 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <div className="font-bold text-text">{p.name}</div>
                      <div className="text-[10px] text-text-faint">{p.sku} · {p.brand}</div>
                    </div>

                    <div className="col-span-2 text-center">
                      <div className="text-[10px] text-text-muted font-bold">SISTEM</div>
                      <div className="font-mono font-bold text-text">{currentSystem}</div>
                    </div>

                    <div className="col-span-2">
                      <div className="text-[10px] text-text-muted font-bold mb-0.5">FISIK RIIL</div>
                      <input
                        type="number"
                        min="0"
                        value={physicalStr}
                        onChange={(e) =>
                          setPhysicalCounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-center font-mono font-bold text-gold-bright focus:border-gold-bright focus:outline-none"
                      />
                    </div>

                    <div className="col-span-2 text-center">
                      <div className="text-[10px] text-text-muted font-bold">SELISIH</div>
                      <div className="font-mono font-bold">
                        {variance > 0 ? (
                          <span className="text-ok">+{variance}</span>
                        ) : variance < 0 ? (
                          <span className="text-danger">{variance}</span>
                        ) : (
                          <span className="text-text-muted">0</span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Alasan selisih..."
                        value={itemNotes[p.id] ?? ""}
                        onChange={(e) =>
                          setItemNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-[11px] text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Detail & Aksi Opname */}
      <Modal
        open={detailOpname !== null}
        onClose={() => setDetailOpname(null)}
        eyebrow="Rincian Stock Opname"
        title={`Stock Opname · ${detailOpname?.opnameNumber ?? ""}`}
        footer={
          <div className="flex w-full justify-between items-center">
            <div>
              {detailOpname?.status === "draft" && (
                <div className="flex items-center gap-2">
                  <Button variant="primary" onClick={() => handleComplete(detailOpname)}>
                    ✓ Selesaikan &amp; Sesuaikan Saldo Sistem
                  </Button>
                  <Button variant="danger" onClick={() => handleOpenCancel(detailOpname)}>
                    Batalkan Sesi
                  </Button>
                </div>
              )}
            </div>
            <Button variant="ghost" onClick={() => setDetailOpname(null)}>
              Tutup
            </Button>
          </div>
        }
      >
        {detailOpname && (
          <div className="space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
            {/* Summary details */}
            <div className="rounded border border-border bg-surface-2 p-3 grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-text-muted">Cabang:</span>{" "}
                <span className="font-bold text-text">{detailOpname.branchName}</span>
              </div>
              <div>
                <span className="text-text-muted">Status:</span> {getStatusBadge(detailOpname.status)}
              </div>
              <div>
                <span className="text-text-muted">Tanggal:</span>{" "}
                <span className="text-text">{detailOpname.opnameDate}</span>
              </div>
              <div>
                <span className="text-text-muted">Petugas:</span>{" "}
                <span className="font-semibold text-text">{detailOpname.conductedByName}</span>
              </div>
              {detailOpname.completedAt && (
                <div className="col-span-2 text-ok font-medium">
                  Diselesaikan pada: {detailOpname.completedAt.replace("T", " ").slice(0, 19)}
                </div>
              )}
              {detailOpname.cancellationReason && (
                <div className="col-span-2 text-danger font-medium">
                  Alasan Batal: {detailOpname.cancellationReason}
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-text-muted">
                  <tr>
                    <th className="px-3 py-2">PRODUK</th>
                    <th className="px-3 py-2 text-center">STOK SISTEM</th>
                    <th className="px-3 py-2 text-center">STOK FISIK</th>
                    <th className="px-3 py-2 text-center">SELISIH</th>
                    <th className="px-3 py-2">CATATAN INVESTIGASI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detailOpname.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-text">
                        <div>{item.productName}</div>
                        <div className="text-[10px] text-text-faint font-mono">{item.productSku}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{item.systemQty}</td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-gold-bright">
                        {item.physicalQty}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold">
                        {item.variance > 0 ? (
                          <span className="text-ok">+{item.variance} (Surplus)</span>
                        ) : item.variance < 0 ? (
                          <span className="text-danger">{item.variance} (Defisit)</span>
                        ) : (
                          <span className="text-text-muted">0 (Pas)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-muted italic">{item.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Batalkan Opname */}
      <Modal
        open={cancelModalOpname !== null}
        onClose={() => setCancelModalOpname(null)}
        eyebrow="Batalkan Sesi"
        title={`Batalkan Opname · ${cancelModalOpname?.opnameNumber ?? ""}`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelModalOpname(null)}>
              Tutup
            </Button>
            <Button variant="danger" onClick={handleConfirmCancel}>
              Konfirmasi Batal
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {cancelError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {cancelError}
            </div>
          )}

          <div>
            <label className="mb-1 block font-bold text-text-muted">ALASAN PEMBATALAN SESI OPNAME</label>
            <textarea
              rows={3}
              placeholder="Misal: Salah memilih cabang / salah input hitungan..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 p-2.5 text-xs text-text focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </ManajemenShell>
  );
}
