"use client";

import { dummyTransfer } from "@/lib/data/dummy";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getProducts,
  getAvailableStock,
  getStockTransfers,
  createStockTransfer,
  dispatchStockTransfer,
  receiveStockTransfer,
  cancelStockTransfer,
  formatRupiah,
} from "@/lib/data";
import type { StockTransfer, StockTransferStatus } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface TransferItemRow {
  productId: string;
  qty: string;
}

export default function ManajemenStockTransfersPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const products = useMemo(() => (isClient ? getProducts() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [transferVersion, setTransferVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Transfer Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItemRow[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail Modal State
  const [detailTransfer, setDetailTransfer] = useState<StockTransfer | null>(null);

  // Cancel Modal State
  const [cancelModalTransfer, setCancelModalTransfer] = useState<StockTransfer | null>(null);
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

  const allTransfers = useMemo(() => {
    if (!isClient) return [];
    void transferVersion;
    return getStockTransfers(selectedBranchId || undefined);
  }, [isClient, selectedBranchId, transferVersion]);

  const filteredTransfers = useMemo(() => {
    return allTransfers.filter((tr) => {
      if (statusFilter !== "all" && tr.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [allTransfers, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = allTransfers.length;
    const inTransitCount = allTransfers.filter((t) => t.status === "in_transit").length;
    const receivedCount = allTransfers.filter((t) => t.status === "received").length;
    const totalValue = allTransfers
      .filter((t) => t.status !== "cancelled")
      .reduce((sum, t) => sum + t.totalValue, 0);

    return { totalCount, inTransitCount, receivedCount, totalValue };
  }, [allTransfers]);

  function handleOpenCreate() {
    const defaultSource = selectedBranchId || branches[0]?.id || "";
    const defaultTarget = branches.find((b) => b.id !== defaultSource)?.id || "";
    const defaultProduct = products[0];

    setSourceBranchId(defaultSource);
    setTargetBranchId(defaultTarget);
    setNotes("");
    setItems(
      defaultProduct ? [{ productId: defaultProduct.id, qty: "5" }] : [],
    );
    setCreateError(null);
    setCreateModalOpen(true);
  }

  function handleAddItemRow() {
    const defaultProduct = products[0];
    if (!defaultProduct) return;
    setItems((prev) => [...prev, { productId: defaultProduct.id, qty: "5" }]);
  }

  function handleRemoveItemRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleItemChange(index: number, field: keyof TransferItemRow, value: string) {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  const estimatedTotalValue = useMemo(() => {
    return items.reduce((sum, item) => {
      const p = products.find((prod) => prod.id === item.productId);
      const qtyNum = parseInt(item.qty, 10) || 0;
      return sum + qtyNum * (p?.cost || 0);
    }, 0);
  }, [items, products]);

  function handleSaveCreate() {
    if (!employee) return;
    setCreateError(null);

    if (items.length === 0) {
      setCreateError("Daftar item transfer tidak boleh kosong.");
      return;
    }

    const itemsToSubmit = [];
    for (const item of items) {
      const qtyNum = parseInt(item.qty, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setCreateError("Kuantitas transfer tiap produk harus lebih dari 0.");
        return;
      }
      const available = getAvailableStock(item.productId, sourceBranchId);
      if (available < qtyNum) {
        const p = products.find((prod) => prod.id === item.productId);
        setCreateError(`Stok ${p?.name ?? "produk"} tidak mencukupi di cabang asal (Tersedia: ${available}).`);
        return;
      }
      itemsToSubmit.push({
        productId: item.productId,
        qty: qtyNum,
      });
    }

    try {
      createStockTransfer(
        {
          sourceBranchId,
          targetBranchId,
          items: itemsToSubmit,
          notes: notes || undefined,
        },
        employee,
      );

      setCreateModalOpen(false);
      setTransferVersion((v) => v + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat Stock Transfer.");
    }
  }

  function handleDispatch(transfer: StockTransfer) {
    if (!employee) return;
    try {
      dispatchStockTransfer(transfer.id, employee);
      setDetailTransfer(null);
      setTransferVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengirim barang.");
    }
  }

  function handleReceive(transfer: StockTransfer) {
    if (!employee) return;
    try {
      receiveStockTransfer(transfer.id, employee);
      setDetailTransfer(null);
      setTransferVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menerima barang di cabang tujuan.");
    }
  }

  function handleOpenCancel(transfer: StockTransfer) {
    setDetailTransfer(null);
    setCancelModalTransfer(transfer);
    setCancelReason("");
    setCancelError(null);
  }

  function handleConfirmCancel() {
    if (!employee || !cancelModalTransfer) return;
    setCancelError(null);

    if (!cancelReason.trim()) {
      setCancelError("Alasan pembatalan transfer wajib diisi.");
      return;
    }

    try {
      cancelStockTransfer(cancelModalTransfer.id, cancelReason, employee);
      setCancelModalTransfer(null);
      setTransferVersion((v) => v + 1);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Gagal membatalkan Stock Transfer.");
    }
  }

  function getStatusBadge(status: StockTransferStatus) {
    switch (status) {
      case "draft":
        return <Badge tone="neutral">Draft (Belum Dikirim)</Badge>;
      case "in_transit":
        return <Badge tone="warn">🚚 Dalam Pengiriman</Badge>;
      case "received":
        return <Badge tone="ok">✓ Selesai Diterima</Badge>;
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
      pageTitle="Transfer Stok Antar-Cabang"
      activeNavId="stock_transfers"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Transfer</div>
            <div className="mt-1 text-2xl font-bold text-text">{stats.totalCount}</div>
            <div className="text-[11px] text-text-faint">Total Nilai: {formatRupiah(stats.totalValue)}</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Dalam Pengiriman (In-Transit)</div>
            <div className="mt-1 text-2xl font-bold text-warn">{stats.inTransitCount}</div>
            <div className="text-[11px] text-text-faint">Menunggu diterima cabang tujuan</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Selesai Diterima</div>
            <div className="mt-1 text-2xl font-bold text-ok">{stats.receivedCount}</div>
            <div className="text-[11px] text-text-faint">Stok telah masuk di tujuan</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Cabang Terhubung</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{branches.length} Cabang</div>
            <div className="text-[11px] text-text-faint">Distribusi stok antar-outlet</div>
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
              <option value="draft">Draft</option>
              <option value="in_transit">Dalam Pengiriman (In-Transit)</option>
              <option value="received">Selesai Diterima</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>

          <Button variant="primary" onClick={handleOpenCreate}>
            + Buat Transfer Baru
          </Button>
        </div>

        {/* Transfers Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NOMOR TRANSFER</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">CABANG ASAL</th>
                <th className="px-3.5 py-2.5">CABANG TUJUAN</th>
                <th className="px-3.5 py-2.5 text-center">TOTAL UNIT</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL NILAI</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">\n              {dummyTransfer.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummyTransfer.map((tr) => (
                  <tr key={tr.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{tr.id}</td>
                    <td className="px-3.5 py-2.5">{tr.tanggal}</td>
                    <td className="px-3.5 py-2.5 font-bold">{tr.asal}</td>
                    <td className="px-3.5 py-2.5 font-bold">{tr.tujuan}</td>
                    <td className="px-3.5 py-2.5 text-center">{tr.totalUnit}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono">{tr.totalNilai.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
                    <td className="px-3.5 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tr.status === 'Selesai' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>{tr.status}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center"><button className="text-gold-bright">Detail</button></td>
                  </tr>
                ))
              )}\n            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Transfer Baru */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        eyebrow="Mutasi Stok"
        title="Buat Stock Transfer Antar-Cabang"
        footer={
          <div className="flex w-full justify-between items-center">
            <div className="text-xs">
              <span className="text-text-muted">Total Nilai:</span>{" "}
              <span className="font-mono font-bold text-gold-bright">{formatRupiah(estimatedTotalValue)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleSaveCreate}>
                Simpan Draft Transfer
              </Button>
            </div>
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
              <label className="mb-1 block font-bold text-text-muted">CABANG ASAL (PENGIRIM)</label>
              <select
                value={sourceBranchId}
                onChange={(e) => setSourceBranchId(e.target.value)}
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
              <label className="mb-1 block font-bold text-text-muted">CABANG TUJUAN (PENERIMA)</label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              >
                {branches
                  .filter((b) => b.id !== sourceBranchId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN TRANSFER</label>
            <input
              type="text"
              placeholder="Misal: Bantuan stok pomade cabang Samadikun..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
            />
          </div>

          {/* Items Row */}
          <div className="rounded border border-border bg-surface-2 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text">Daftar Produk yang Ditransfer</span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[11px] font-bold text-gold-bright hover:underline"
              >
                + Tambah Baris Produk
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const available = getAvailableStock(item.productId, sourceBranchId);
                const p = products.find((prod) => prod.id === item.productId);

                return (
                  <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded border border-border">
                    <div className="flex-1">
                      <select
                        value={item.productId}
                        onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                        className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
                      >
                        {products.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} ({prod.brand})
                          </option>
                        ))}
                      </select>
                      <div className="text-[10px] text-text-faint mt-0.5">
                        Tersedia di asal: <span className="font-bold text-text">{available} Unit</span>
                      </div>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                        className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
                      />
                    </div>

                    <div className="w-28 text-right font-mono text-xs font-bold text-text">
                      {formatRupiah((parseInt(item.qty, 10) || 0) * (p?.cost || 0))}
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="text-danger hover:bg-danger/10 px-1.5 py-0.5 rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Detail & Aksi Transfer */}
      <Modal
        open={detailTransfer !== null}
        onClose={() => setDetailTransfer(null)}
        eyebrow="Rincian Mutasi"
        title={`Stock Transfer · ${detailTransfer?.transferNumber ?? ""}`}
        footer={
          <div className="flex w-full justify-between items-center">
            <div>
              {detailTransfer && (
                <div className="flex items-center gap-2">
                  {detailTransfer.status === "draft" && (
                    <Button variant="primary" onClick={() => handleDispatch(detailTransfer)}>
                      🚚 Kirim Barang (Dispatch)
                    </Button>
                  )}
                  {detailTransfer.status === "in_transit" && (
                    <Button variant="gold" onClick={() => handleReceive(detailTransfer)}>
                      ✓ Terima Barang di Cabang Tujuan
                    </Button>
                  )}
                  {detailTransfer.status !== "received" && detailTransfer.status !== "cancelled" && (
                    <Button variant="danger" onClick={() => handleOpenCancel(detailTransfer)}>
                      Batalkan Transfer
                    </Button>
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" onClick={() => setDetailTransfer(null)}>
              Tutup
            </Button>
          </div>
        }
      >
        {detailTransfer && (
          <div className="space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
            {/* Header info */}
            <div className="rounded border border-border bg-surface-2 p-3 grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-text-muted">Cabang Asal:</span>{" "}
                <span className="font-bold text-text">{detailTransfer.sourceBranchName}</span>
              </div>
              <div>
                <span className="text-text-muted">Cabang Tujuan:</span>{" "}
                <span className="font-bold text-text">{detailTransfer.targetBranchName}</span>
              </div>
              <div>
                <span className="text-text-muted">Status:</span> {getStatusBadge(detailTransfer.status)}
              </div>
              <div>
                <span className="text-text-muted">Total Kuantitas:</span>{" "}
                <span className="font-mono font-bold text-gold-bright">{detailTransfer.totalQty} Unit</span>
              </div>
              <div>
                <span className="text-text-muted">Dibuat Oleh:</span>{" "}
                <span className="text-text">{detailTransfer.createdByName}</span>
              </div>
              {detailTransfer.dispatchedByName && (
                <div>
                  <span className="text-text-muted">Dikirim Oleh:</span>{" "}
                  <span className="text-warn font-semibold">{detailTransfer.dispatchedByName}</span>
                </div>
              )}
              {detailTransfer.receivedByName && (
                <div>
                  <span className="text-text-muted">Diterima Oleh:</span>{" "}
                  <span className="text-ok font-semibold">{detailTransfer.receivedByName}</span>
                </div>
              )}
              {detailTransfer.cancellationReason && (
                <div className="col-span-2 text-danger">
                  <span className="font-bold">Alasan Batal:</span> {detailTransfer.cancellationReason}
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-text-muted">
                  <tr>
                    <th className="px-3 py-2">PRODUK</th>
                    <th className="px-3 py-2 text-center">JUMLAH</th>
                    <th className="px-3 py-2 text-right">HARGA MODAL</th>
                    <th className="px-3 py-2 text-right">SUBTOTAL</th>
                    {detailTransfer.status !== "draft" && <th className="px-3 py-2">BATCH ALOKASI</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detailTransfer.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-text">
                        <div>{item.productName}</div>
                        <div className="text-[10px] text-text-faint font-mono">{item.productSku}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold">{item.qty}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatRupiah(item.unitCost)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-text">
                        {formatRupiah(item.qty * item.unitCost)}
                      </td>
                      {detailTransfer.status !== "draft" && (
                        <td className="px-3 py-2 font-mono text-[11px] text-text-muted">
                          {item.deductedBatches && item.deductedBatches.length > 0 ? (
                            item.deductedBatches.map((b, i) => (
                              <div key={i}>
                                {b.batchNumber} ({b.qty} unit)
                              </div>
                            ))
                          ) : (
                            <span>Stok Umum</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-surface-2 font-bold">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right">
                      TOTAL NILAI TRANSFER:
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gold-bright">
                      {formatRupiah(detailTransfer.totalValue)}
                    </td>
                    {detailTransfer.status !== "draft" && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Batalkan Transfer */}
      <Modal
        open={cancelModalTransfer !== null}
        onClose={() => setCancelModalTransfer(null)}
        eyebrow="Batalkan Mutasi"
        title={`Batalkan Transfer · ${cancelModalTransfer?.transferNumber ?? ""}`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelModalTransfer(null)}>
              Tutup
            </Button>
            <Button variant="danger" onClick={handleConfirmCancel}>
              Konfirmasi Batal &amp; Kembalikan Stok
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

          <div className="text-[11px] text-text-faint">
            * Jika transfer sudah dalam status In-Transit, seluruh kuantitas dan batch yang dipotong dari cabang asal akan otomatis dikembalikan ke saldo cabang asal.
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">ALASAN PEMBATALAN TRANSFER</label>
            <textarea
              rows={3}
              placeholder="Misal: Salah memilih cabang tujuan / armada pengiriman dibatalkan..."
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
