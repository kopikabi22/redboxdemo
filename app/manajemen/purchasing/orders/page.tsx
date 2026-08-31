"use client";

import { dummyPO } from "@/lib/data/dummy";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getSuppliers,
  getProducts,
  getPurchaseOrders,
  createPurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  formatRupiah,
  todayDateString,
} from "@/lib/data";
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  ReceivingDetailInput,
} from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface FormItemState {
  productId: string;
  qtyOrdered: string;
  unitCost: string;
}

export default function ManajemenPurchaseOrdersPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const suppliers = useMemo(() => (isClient ? getSuppliers() : []), [isClient]);
  const products = useMemo(() => (isClient ? getProducts() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [poVersion, setPoVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create PO Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBranchId, setNewBranchId] = useState("");
  const [newSupplierId, setNewSupplierId] = useState("");
  const [newOrderDate, setNewOrderDate] = useState(todayDateString());
  const [newExpectedDate, setNewExpectedDate] = useState("");
  const [newPaymentTerms, setNewPaymentTerms] = useState("Net 30");
  const [newNotes, setNewNotes] = useState("");
  const [newSubmitNow, setNewSubmitNow] = useState(true);
  const [newItems, setNewItems] = useState<FormItemState[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail Modal State
  const [detailPo, setDetailPo] = useState<PurchaseOrder | null>(null);

  // Receive Modal State
  const [receiveModalPo, setReceiveModalPo] = useState<PurchaseOrder | null>(null);
  const [receiveInputs, setReceiveInputs] = useState<
    Record<string, { qtyReceived: string; batchNumber: string; expiryDate: string }>
  >({});
  const [receiveError, setReceiveError] = useState<string | null>(null);

  // Cancel Modal State
  const [cancelModalPo, setCancelModalPo] = useState<PurchaseOrder | null>(null);
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

  const allPOs = useMemo(() => {
    if (!isClient) return [];
    void poVersion;
    return getPurchaseOrders(selectedBranchId || undefined);
  }, [isClient, selectedBranchId, poVersion]);

  const filteredPOs = useMemo(() => {
    return allPOs.filter((po) => {
      if (statusFilter !== "all" && po.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPoNo = po.poNumber.toLowerCase().includes(q);
        const matchSupplier = po.supplierName.toLowerCase().includes(q);
        if (!matchPoNo && !matchSupplier) return false;
      }
      return true;
    });
  }, [allPOs, statusFilter, searchQuery]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const totalCount = allPOs.length;
    const submittedCount = allPOs.filter((p) => p.status === "submitted").length;
    const approvedCount = allPOs.filter((p) => p.status === "approved").length;
    const receivedCount = allPOs.filter((p) => p.status === "received").length;
    const totalValue = allPOs
      .filter((p) => p.status !== "cancelled")
      .reduce((sum, p) => sum + p.totalAmount, 0);

    return { totalCount, submittedCount, approvedCount, receivedCount, totalValue };
  }, [allPOs]);

  function handleOpenCreateModal() {
    const defaultBranch = selectedBranchId || branches[0]?.id || "";
    const defaultSupplier = suppliers[0]?.id || "";
    const defaultProduct = products[0];

    setNewBranchId(defaultBranch);
    setNewSupplierId(defaultSupplier);
    setNewOrderDate(todayDateString());
    setNewExpectedDate("");
    setNewPaymentTerms(suppliers[0]?.paymentTerms || "Net 30");
    setNewNotes("");
    setNewSubmitNow(true);
    setNewItems(
      defaultProduct
        ? [{ productId: defaultProduct.id, qtyOrdered: "10", unitCost: String(defaultProduct.cost) }]
        : [],
    );
    setCreateError(null);
    setCreateModalOpen(true);
  }

  function handleAddItemRow() {
    const defaultProduct = products[0];
    if (!defaultProduct) return;
    setNewItems((prev) => [
      ...prev,
      { productId: defaultProduct.id, qtyOrdered: "5", unitCost: String(defaultProduct.cost) },
    ]);
  }

  function handleRemoveItemRow(index: number) {
    setNewItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleItemChange(index: number, field: keyof FormItemState, value: string) {
    setNewItems((prev) => {
      const updated = [...prev];
      if (field === "productId") {
        const prd = products.find((p) => p.id === value);
        updated[index] = {
          ...updated[index],
          productId: value,
          unitCost: prd ? String(prd.cost) : updated[index].unitCost,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  }

  const newPoTotal = useMemo(() => {
    return newItems.reduce((sum, item) => {
      const qty = parseInt(item.qtyOrdered, 10) || 0;
      const cost = parseInt(item.unitCost, 10) || 0;
      return sum + qty * cost;
    }, 0);
  }, [newItems]);

  function handleSaveCreatePO() {
    if (!employee) return;
    setCreateError(null);

    if (newItems.length === 0) {
      setCreateError("Daftar item pesanan PO tidak boleh kosong.");
      return;
    }

    const itemsToSubmit = [];
    for (const item of newItems) {
      const qty = parseInt(item.qtyOrdered, 10);
      const cost = parseInt(item.unitCost, 10);
      if (isNaN(qty) || qty <= 0) {
        setCreateError("Jumlah unit pesanan harus lebih dari 0.");
        return;
      }
      if (isNaN(cost) || cost < 0) {
        setCreateError("Harga modal satuan tidak valid.");
        return;
      }
      itemsToSubmit.push({
        productId: item.productId,
        qtyOrdered: qty,
        unitCost: cost,
      });
    }

    try {
      createPurchaseOrder(
        {
          branchId: newBranchId,
          supplierId: newSupplierId,
          orderDate: newOrderDate,
          expectedDate: newExpectedDate || undefined,
          paymentTerms: newPaymentTerms,
          notes: newNotes || undefined,
          items: itemsToSubmit,
          submitNow: newSubmitNow,
        },
        employee,
      );

      setCreateModalOpen(false);
      setPoVersion((v) => v + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat Purchase Order.");
    }
  }

  function handleSubmitPO(po: PurchaseOrder) {
    if (!employee) return;
    try {
      submitPurchaseOrder(po.id, employee);
      setDetailPo(null);
      setPoVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengajukan PO.");
    }
  }

  function handleApprovePO(po: PurchaseOrder) {
    if (!employee) return;
    try {
      approvePurchaseOrder(po.id, employee);
      setDetailPo(null);
      setPoVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyetujui PO.");
    }
  }

  function handleOpenReceiveModal(po: PurchaseOrder) {
    setDetailPo(null);
    setReceiveModalPo(po);

    const initialInputs: Record<string, { qtyReceived: string; batchNumber: string; expiryDate: string }> = {};
    const defaultBatchLot = `LOT-${po.poNumber.slice(-4)}-${todayDateString().slice(5).replace("-", "")}`;

    // Default expiry 1 year from now
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const defaultExp = nextYear.toISOString().split("T")[0];

    po.items.forEach((item) => {
      initialInputs[item.id] = {
        qtyReceived: String(item.qtyOrdered),
        batchNumber: defaultBatchLot,
        expiryDate: defaultExp,
      };
    });

    setReceiveInputs(initialInputs);
    setReceiveError(null);
  }

  function handleConfirmReceive() {
    if (!employee || !receiveModalPo) return;
    setReceiveError(null);

    const details: ReceivingDetailInput[] = [];

    for (const item of receiveModalPo.items) {
      const input = receiveInputs[item.id];
      if (!input) continue;

      const qty = parseInt(input.qtyReceived, 10);
      if (isNaN(qty) || qty <= 0) {
        setReceiveError(`Jumlah diterima untuk ${item.productName} harus lebih dari 0.`);
        return;
      }
      if (!input.batchNumber.trim()) {
        setReceiveError(`Nomor batch wajib diisi untuk item ${item.productName}.`);
        return;
      }
      if (!input.expiryDate) {
        setReceiveError(`Tanggal kadaluarsa wajib diisi untuk item ${item.productName}.`);
        return;
      }

      details.push({
        itemId: item.id,
        qtyReceived: qty,
        batchNumber: input.batchNumber.trim(),
        expiryDate: input.expiryDate,
      });
    }

    try {
      receivePurchaseOrder(receiveModalPo.id, details, employee);
      setReceiveModalPo(null);
      setPoVersion((v) => v + 1);
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : "Gagal memproses penerimaan barang.");
    }
  }

  function handleOpenCancelModal(po: PurchaseOrder) {
    setDetailPo(null);
    setCancelModalPo(po);
    setCancelReason("");
    setCancelError(null);
  }

  function handleConfirmCancel() {
    if (!employee || !cancelModalPo) return;
    setCancelError(null);

    if (!cancelReason.trim()) {
      setCancelError("Alasan pembatalan PO wajib diisi.");
      return;
    }

    try {
      cancelPurchaseOrder(cancelModalPo.id, cancelReason, employee);
      setCancelModalPo(null);
      setPoVersion((v) => v + 1);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Gagal membatalkan PO.");
    }
  }

  function getStatusBadge(status: PurchaseOrderStatus) {
    switch (status) {
      case "draft":
        return <Badge tone="neutral">Draft</Badge>;
      case "submitted":
        return <Badge tone="warn">Diajukan</Badge>;
      case "approved":
        return <Badge tone="ok">Disetujui</Badge>;
      case "received":
        return <Badge tone="gold">Selesai Diterima</Badge>;
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
      pageTitle="Purchase Orders & Pengadaan"
      activeNavId="purchase_orders"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Purchase Order</div>
            <div className="mt-1 text-2xl font-bold text-text">{stats.totalCount}</div>
            <div className="text-[11px] text-text-faint">Total Nilai: {formatRupiah(stats.totalValue)}</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Menunggu Persetujuan</div>
            <div className="mt-1 text-2xl font-bold text-warn">{stats.submittedCount}</div>
            <div className="text-[11px] text-text-faint">Butuh Approval Owner / BM</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Disetujui (Siap Kirim)</div>
            <div className="mt-1 text-2xl font-bold text-ok">{stats.approvedCount}</div>
            <div className="text-[11px] text-text-faint">Menunggu Penerimaan Gudang</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Selesai Diterima</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{stats.receivedCount}</div>
            <div className="text-[11px] text-text-faint">Stok &amp; Batch Masuk</div>
          </div>
        </div>

        {/* Action Bar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">STATUS PO</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Diajukan (Pending Approval)</option>
                <option value="approved">Disetujui</option>
                <option value="received">Selesai Diterima</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">CARI</label>
              <input
                type="text"
                placeholder="Cari nomor PO / supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-52 rounded border border-border bg-surface-2 px-2.5 py-1 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <Button variant="primary" onClick={handleOpenCreateModal}>
            + Buat PO Baru
          </Button>
        </div>

        {/* Table of POs */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NOMOR PO</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">CABANG TUJUAN</th>
                <th className="px-3.5 py-2.5">SUPPLIER</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL NILAI</th>
                <th className="px-3.5 py-2.5">TERMIN</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">\n              {dummyPO.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummyPO.map((po) => (
                  <tr key={po.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{po.id}</td>
                    <td className="px-3.5 py-2.5">{po.tanggal}</td>
                    <td className="px-3.5 py-2.5">{po.cabang}</td>
                    <td className="px-3.5 py-2.5 font-bold">{po.supplier}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-ok">{po.totalNilai.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
                    <td className="px-3.5 py-2.5">{po.termin}</td>
                    <td className="px-3.5 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${po.status === 'Selesai' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>{po.status}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center"><button className="text-gold-bright">Detail</button></td>
                  </tr>
                ))
              )}\n            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat PO Baru */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        eyebrow="Pengadaan Barang"
        title="Buat Purchase Order Baru"
        footer={
          <div className="flex w-full justify-between items-center">
            <div className="text-xs">
              <span className="text-text-muted">Total Estimasi:</span>{" "}
              <span className="font-mono font-bold text-gold-bright">{formatRupiah(newPoTotal)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleSaveCreatePO}>
                {newSubmitNow ? "Buat & Ajukan PO" : "Simpan Draft PO"}
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
              <label className="mb-1 block font-bold text-text-muted">CABANG TUJUAN</label>
              <select
                value={newBranchId}
                onChange={(e) => setNewBranchId(e.target.value)}
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
              <label className="mb-1 block font-bold text-text-muted">PILIH SUPPLIER</label>
              <select
                value={newSupplierId}
                onChange={(e) => {
                  setNewSupplierId(e.target.value);
                  const s = suppliers.find((sup) => sup.id === e.target.value);
                  if (s) setNewPaymentTerms(s.paymentTerms);
                }}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.contactPerson})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-bold text-text-muted">TANGGAL PESAN</label>
              <input
                type="date"
                value={newOrderDate}
                onChange={(e) => setNewOrderDate(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">ESTIMASI TIBA (OPSIONAL)</label>
              <input
                type="date"
                value={newExpectedDate}
                onChange={(e) => setNewExpectedDate(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">TERMIN PEMBAYARAN</label>
              <input
                type="text"
                value={newPaymentTerms}
                onChange={(e) => setNewPaymentTerms(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded border border-border bg-surface-2 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text">Daftar Item Pesanan Produk</span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[11px] font-bold text-gold-bright hover:underline"
              >
                + Tambah Baris Produk
              </button>
            </div>

            <div className="space-y-2">
              {newItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded border border-border">
                  <div className="flex-1">
                    <select
                      value={item.productId}
                      onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                      className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.brand})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.qtyOrdered}
                      onChange={(e) => handleItemChange(idx, "qtyOrdered", e.target.value)}
                      className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      min="0"
                      placeholder="Harga Modal"
                      value={item.unitCost}
                      onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                      className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
                    />
                  </div>
                  <div className="w-28 text-right font-mono text-xs font-bold text-text">
                    {formatRupiah((parseInt(item.qtyOrdered, 10) || 0) * (parseInt(item.unitCost, 10) || 0))}
                  </div>
                  {newItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
                      className="text-danger hover:bg-danger/10 px-1.5 py-0.5 rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN PO</label>
            <input
              type="text"
              placeholder="Misal: Mohon kirim packing kayu..."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="submitNow"
              checked={newSubmitNow}
              onChange={(e) => setNewSubmitNow(e.target.checked)}
              className="rounded border-border text-gold-bright focus:ring-0"
            />
            <label htmlFor="submitNow" className="cursor-pointer text-text">
              Langsung ajukan (Submit) PO ini untuk persetujuan Owner / Branch Manager
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal Detail & Aksi PO */}
      <Modal
        open={detailPo !== null}
        onClose={() => setDetailPo(null)}
        eyebrow="Rincian Pesanan"
        title={`Purchase Order · ${detailPo?.poNumber ?? ""}`}
        footer={
          <div className="flex w-full justify-between items-center">
            <div>
              {detailPo && (
                <div className="flex items-center gap-2">
                  {detailPo.status === "draft" && (
                    <Button variant="primary" onClick={() => handleSubmitPO(detailPo)}>
                      Ajukan (Submit) PO
                    </Button>
                  )}
                  {detailPo.status === "submitted" && (
                    <Button variant="primary" onClick={() => handleApprovePO(detailPo)}>
                      Setujui (Approve) PO
                    </Button>
                  )}
                  {detailPo.status === "approved" && (
                    <Button variant="gold" onClick={() => handleOpenReceiveModal(detailPo)}>
                      📦 Terima Barang (Receive)
                    </Button>
                  )}
                  {detailPo.status !== "received" && detailPo.status !== "cancelled" && (
                    <Button variant="danger" onClick={() => handleOpenCancelModal(detailPo)}>
                      Batalkan PO
                    </Button>
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" onClick={() => setDetailPo(null)}>
              Tutup
            </Button>
          </div>
        }
      >
        {detailPo && (
          <div className="space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
            {/* Header info */}
            <div className="rounded border border-border bg-surface-2 p-3 grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-text-muted">Supplier:</span>{" "}
                <span className="font-bold text-text">{detailPo.supplierName}</span>
              </div>
              <div>
                <span className="text-text-muted">Status:</span> {getStatusBadge(detailPo.status)}
              </div>
              <div>
                <span className="text-text-muted">Tanggal Pesan:</span>{" "}
                <span className="text-text">{detailPo.orderDate}</span>
              </div>
              <div>
                <span className="text-text-muted">Termin:</span>{" "}
                <span className="font-semibold text-gold-bright">{detailPo.paymentTerms}</span>
              </div>
              <div>
                <span className="text-text-muted">Dibuat Oleh:</span>{" "}
                <span className="text-text">{detailPo.createdByName}</span>
              </div>
              {detailPo.approvedByName && (
                <div>
                  <span className="text-text-muted">Disetujui Oleh:</span>{" "}
                  <span className="text-ok font-semibold">{detailPo.approvedByName}</span>
                </div>
              )}
              {detailPo.receivedByName && (
                <div>
                  <span className="text-text-muted">Diterima Oleh:</span>{" "}
                  <span className="text-gold-bright font-semibold">{detailPo.receivedByName}</span>
                </div>
              )}
              {detailPo.cancellationReason && (
                <div className="col-span-2 text-danger">
                  <span className="font-bold">Alasan Batal:</span> {detailPo.cancellationReason}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-text-muted">
                  <tr>
                    <th className="px-3 py-2">PRODUK</th>
                    <th className="px-3 py-2 text-right">PESAN</th>
                    <th className="px-3 py-2 text-right">TERIMA</th>
                    <th className="px-3 py-2 text-right">HARGA MODAL</th>
                    <th className="px-3 py-2 text-right">SUBTOTAL</th>
                    {detailPo.status === "received" && <th className="px-3 py-2">LOT / EXPIRED</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detailPo.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-text">{item.productName}</td>
                      <td className="px-3 py-2 text-right font-mono">{item.qtyOrdered}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gold-bright">
                        {item.qtyReceived}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatRupiah(item.unitCost)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-text">
                        {formatRupiah(item.subtotal)}
                      </td>
                      {detailPo.status === "received" && (
                        <td className="px-3 py-2 font-mono text-[11px] text-text-muted">
                          {item.batchNumber} ({item.expiryDate})
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-surface-2 font-bold">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right">
                      TOTAL PEMBELIAN:
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gold-bright">
                      {formatRupiah(detailPo.totalAmount)}
                    </td>
                    {detailPo.status === "received" && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Terima Barang (Receive) */}
      <Modal
        open={receiveModalPo !== null}
        onClose={() => setReceiveModalPo(null)}
        eyebrow="Penerimaan Barang"
        title={`Terima Barang · ${receiveModalPo?.poNumber ?? ""}`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setReceiveModalPo(null)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleConfirmReceive}>
              Konfirmasi &amp; Catat Stok Masuk
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {receiveError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {receiveError}
            </div>
          )}

          <div className="text-[11px] text-text-faint">
            * Silakan input kuantitas riil yang diterima, nomor batch/lot fisik dari kemasan supplier, dan tanggal kadaluarsa untuk pencatatan FEFO.
          </div>

          <div className="space-y-3">
            {receiveModalPo?.items.map((item) => {
              const input = receiveInputs[item.id] || {
                qtyReceived: String(item.qtyOrdered),
                batchNumber: "",
                expiryDate: "",
              };

              return (
                <div key={item.id} className="rounded border border-border bg-surface-2 p-3 space-y-2">
                  <div className="flex justify-between items-center font-bold text-text">
                    <span>{item.productName}</span>
                    <span className="text-text-muted text-[11px]">Dipesan: {item.qtyOrdered} Unit</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-muted">JUMLAH DITERIMA</label>
                      <input
                        type="number"
                        min="1"
                        value={input.qtyReceived}
                        onChange={(e) =>
                          setReceiveInputs((prev) => ({
                            ...prev,
                            [item.id]: { ...input, qtyReceived: e.target.value },
                          }))
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-muted">NOMOR BATCH / LOT</label>
                      <input
                        type="text"
                        placeholder="LOT-2026-08A"
                        value={input.batchNumber}
                        onChange={(e) =>
                          setReceiveInputs((prev) => ({
                            ...prev,
                            [item.id]: { ...input, batchNumber: e.target.value },
                          }))
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-xs font-mono text-text focus:border-gold-bright focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-muted">TANGGAL EXPIRED</label>
                      <input
                        type="date"
                        value={input.expiryDate}
                        onChange={(e) =>
                          setReceiveInputs((prev) => ({
                            ...prev,
                            [item.id]: { ...input, expiryDate: e.target.value },
                          }))
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Modal Batalkan PO */}
      <Modal
        open={cancelModalPo !== null}
        onClose={() => setCancelModalPo(null)}
        eyebrow="Batalkan Pesanan"
        title={`Batalkan PO · ${cancelModalPo?.poNumber ?? ""}`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelModalPo(null)}>
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
            <label className="mb-1 block font-bold text-text-muted">ALASAN PEMBATALAN PO</label>
            <textarea
              rows={3}
              placeholder="Misal: Supplier menaikkan harga di luar kesepakatan / stok habis..."
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
