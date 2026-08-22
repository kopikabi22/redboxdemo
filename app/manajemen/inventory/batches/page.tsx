"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getProducts,
  getProductBatches,
  createProductBatch,
  updateProductBatch,
  deleteProductBatch,
  evaluateExpiryStatus,
  formatRupiah,
} from "@/lib/data";
import type { ProductBatch, ExpiryStatus } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface BatchFormState {
  productId: string;
  branchId: string;
  batchNumber: string;
  expiryDate: string;
  initialQty: string;
  cost: string;
  notes: string;
}

const DEFAULT_BATCH_FORM: BatchFormState = {
  productId: "",
  branchId: "",
  batchNumber: "",
  expiryDate: "",
  initialQty: "",
  cost: "",
  notes: "",
};

export default function ManajemenBatchesPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const products = useMemo(() => (isClient ? getProducts() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [batchVersion, setBatchVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<BatchFormState>(DEFAULT_BATCH_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [editBatch, setEditBatch] = useState<ProductBatch | null>(null);
  const [editBatchNumber, setEditBatchNumber] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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

  const allBatches = useMemo(() => {
    if (!isClient) return [];
    void batchVersion;
    return getProductBatches();
  }, [isClient, batchVersion]);

  const filteredBatches = useMemo(() => {
    return allBatches
      .filter((b) => {
        if (selectedBranchId && b.branchId !== selectedBranchId) {
          return false;
        }

        const status = evaluateExpiryStatus(b.expiryDate);
        if (statusFilter !== "all" && status !== statusFilter) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const prd = products.find((p) => p.id === b.productId);
          const prdName = prd ? prd.name.toLowerCase() : "";
          const matchBatchNo = b.batchNumber.toLowerCase().includes(q);
          const matchPrd = prdName.includes(q);
          if (!matchBatchNo && !matchPrd) return false;
        }

        return true;
      })
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)); // FEFO sort
  }, [allBatches, selectedBranchId, statusFilter, searchQuery, products]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const scoped = selectedBranchId
      ? allBatches.filter((b) => b.branchId === selectedBranchId)
      : allBatches;

    const totalActive = scoped.filter((b) => b.remainingQty > 0).length;
    const nearExpiry = scoped.filter(
      (b) => b.remainingQty > 0 && evaluateExpiryStatus(b.expiryDate) === "near_expiry",
    ).length;
    const expired = scoped.filter(
      (b) => b.remainingQty > 0 && evaluateExpiryStatus(b.expiryDate) === "expired",
    ).length;
    const totalRemainingUnits = scoped.reduce((sum, b) => sum + b.remainingQty, 0);

    return { totalActive, nearExpiry, expired, totalRemainingUnits };
  }, [allBatches, selectedBranchId]);

  function handleOpenCreateModal() {
    setFormData({
      ...DEFAULT_BATCH_FORM,
      branchId: selectedBranchId || (branches[0]?.id ?? ""),
      productId: products[0]?.id ?? "",
      cost: products[0] ? String(products[0].cost) : "",
    });
    setFormError(null);
    setCreateModalOpen(true);
  }

  function handleProductChange(productId: string) {
    const prd = products.find((p) => p.id === productId);
    setFormData((prev) => ({
      ...prev,
      productId,
      cost: prd ? String(prd.cost) : prev.cost,
    }));
  }

  function handleSaveNewBatch() {
    if (!employee) return;
    setFormError(null);

    const qty = parseInt(formData.initialQty, 10);
    const cost = parseInt(formData.cost, 10);

    if (isNaN(qty) || qty <= 0) {
      setFormError("Jumlah stok awal harus berupa angka lebih dari 0.");
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setFormError("Harga modal harus berupa angka positif.");
      return;
    }

    try {
      createProductBatch(
        {
          productId: formData.productId,
          branchId: formData.branchId,
          batchNumber: formData.batchNumber,
          expiryDate: formData.expiryDate,
          initialQty: qty,
          cost,
          notes: formData.notes,
        },
        employee,
      );

      setCreateModalOpen(false);
      setBatchVersion((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal membuat batch.");
    }
  }

  function handleOpenEdit(batch: ProductBatch) {
    setEditBatch(batch);
    setEditBatchNumber(batch.batchNumber);
    setEditExpiryDate(batch.expiryDate);
    setEditNotes(batch.notes ?? "");
    setEditError(null);
  }

  function handleSaveEdit() {
    if (!employee || !editBatch) return;
    setEditError(null);

    try {
      updateProductBatch(
        editBatch.id,
        {
          batchNumber: editBatchNumber,
          expiryDate: editExpiryDate,
          notes: editNotes,
        },
        employee,
      );

      setEditBatch(null);
      setBatchVersion((v) => v + 1);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui batch.");
    }
  }

  function handleDeleteConfirm() {
    if (!employee || !deleteTargetId) return;
    try {
      deleteProductBatch(deleteTargetId, employee);
      setDeleteTargetId(null);
      setBatchVersion((v) => v + 1);
    } catch (err) {
      console.error(err);
    }
  }

  function getExpiryTone(status: ExpiryStatus) {
    switch (status) {
      case "safe":
        return "ok";
      case "near_expiry":
        return "warn";
      case "expired":
        return "danger";
    }
  }

  function getExpiryLabel(status: ExpiryStatus) {
    switch (status) {
      case "safe":
        return "Aman";
      case "near_expiry":
        return "Mendekati Expired";
      case "expired":
        return "Kadaluarsa";
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
      pageTitle="Batch & Expiry Management"
      activeNavId="batches"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Batch Aktif</div>
            <div className="mt-1 text-2xl font-bold text-text">{stats.totalActive}</div>
            <div className="text-[11px] text-text-faint">{stats.totalRemainingUnits} Unit Tersedia</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Mendekati Kadaluarsa</div>
            <div className="mt-1 text-2xl font-bold text-warn">{stats.nearExpiry}</div>
            <div className="text-[11px] text-text-faint">Prioritas FEFO (≤ 30 Hari)</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">Sudah Kadaluarsa</div>
            <div className="mt-1 text-2xl font-bold text-danger">{stats.expired}</div>
            <div className="text-[11px] text-text-faint">Wajib Write-Off / Retur</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Algoritma Alokasi</div>
            <div className="mt-1 text-lg font-bold text-gold-bright">FEFO Otomatis</div>
            <div className="text-[11px] text-text-faint">First-Expired, First-Out</div>
          </div>
        </div>

        {/* Action Bar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">STATUS EXPIRED</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="safe">Aman (&gt; 30 Hari)</option>
                <option value="near_expiry">Mendekati Kadaluarsa (≤ 30 Hari)</option>
                <option value="expired">Sudah Kadaluarsa</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">CARI</label>
              <input
                type="text"
                placeholder="Cari produk / nomor lot batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded border border-border bg-surface-2 px-2.5 py-1 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <Button variant="primary" onClick={handleOpenCreateModal}>
            + Tambah Batch Masuk
          </Button>
        </div>

        {/* Table of Batches */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NOMOR BATCH / LOT</th>
                <th className="px-3.5 py-2.5">PRODUK</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">TANGGAL EXPIRED</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5 text-right">SISA / AWAL</th>
                <th className="px-3.5 py-2.5 text-right">HARGA MODAL</th>
                <th className="px-3.5 py-2.5">TGL TERIMA</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-text-faint">
                    Tidak ada batch produk yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const prd = products.find((p) => p.id === batch.productId);
                  const br = branches.find((b) => b.id === batch.branchId);
                  const status = evaluateExpiryStatus(batch.expiryDate);

                  return (
                    <tr key={batch.id} className="hover:bg-surface-2/60">
                      <td className="px-3.5 py-2.5">
                        <div className="font-mono font-bold text-gold-bright">{batch.batchNumber}</div>
                        {batch.notes && <div className="text-[10px] italic text-text-faint">{batch.notes}</div>}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-text">
                        {prd?.name ?? batch.productId}
                      </td>
                      <td className="px-3.5 py-2.5">{br?.name ?? batch.branchId}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="font-semibold text-text">{batch.expiryDate}</span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <Badge tone={getExpiryTone(status)}>{getExpiryLabel(status)}</Badge>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono">
                        <span className={`font-bold ${batch.remainingQty === 0 ? "text-text-faint" : "text-text"}`}>
                          {batch.remainingQty}
                        </span>
                        <span className="text-text-faint"> / {batch.initialQty}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-text">
                        {formatRupiah(batch.cost)}
                      </td>
                      <td className="px-3.5 py-2.5 text-text-muted">{batch.receivedDate}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(batch)}
                            className="rounded px-2 py-1 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(batch.id)}
                            className="rounded px-2 py-1 text-[11px] text-danger hover:bg-danger/10"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Batch */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        eyebrow="Penerimaan Barang"
        title="Tambah Batch Produk Masuk"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveNewBatch}>
              Simpan Batch
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {formError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {formError}
            </div>
          )}

          <div>
            <label className="mb-1 block font-bold text-text-muted">PILIH PRODUK</label>
            <select
              value={formData.productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.brand}) — SKU: {p.sku}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CABANG PENYIMPANAN</label>
            <select
              value={formData.branchId}
              onChange={(e) => setFormData((prev) => ({ ...prev, branchId: e.target.value }))}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-text-muted">NOMOR BATCH / LOT</label>
              <input
                type="text"
                placeholder="Misal: LOT-2026-08A"
                value={formData.batchNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, batchNumber: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">TANGGAL KADALUARSA</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-text-muted">JUMLAH STOK (UNIT)</label>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={formData.initialQty}
                onChange={(e) => setFormData((prev) => ({ ...prev, initialQty: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">HARGA MODAL / UNIT (RP)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={formData.cost}
                onChange={(e) => setFormData((prev) => ({ ...prev, cost: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN / SUPPLIER (OPSIONAL)</label>
            <input
              type="text"
              placeholder="Misal: Kiriman dari PT Jaya Abadi..."
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Edit Batch */}
      <Modal
        open={editBatch !== null}
        onClose={() => setEditBatch(null)}
        eyebrow="Ubah Batch"
        title={`Edit Batch · ${editBatch?.batchNumber ?? ""}`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditBatch(null)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {editError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {editError}
            </div>
          )}

          <div>
            <label className="mb-1 block font-bold text-text-muted">NOMOR BATCH</label>
            <input
              type="text"
              value={editBatchNumber}
              onChange={(e) => setEditBatchNumber(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">TANGGAL KADALUARSA</label>
            <input
              type="date"
              value={editExpiryDate}
              onChange={(e) => setEditExpiryDate(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN</label>
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        eyebrow="Hapus Batch"
        title="Hapus Batch Produk?"
        message="Apakah Anda yakin ingin menghapus data batch ini? Aksi ini tidak dapat dibatalkan."
        confirmLabel="Hapus Batch"
        onConfirm={handleDeleteConfirm}
      />
    </ManajemenShell>
  );
}
