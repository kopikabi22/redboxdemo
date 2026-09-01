"use client";

import { dummySupplier } from "@/lib/data/dummy";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/lib/data";
import type { Supplier, CreateSupplierInput } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const DEFAULT_FORM: CreateSupplierInput = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  paymentTerms: "Net 30",
  notes: "",
};

export default function ManajemenSuppliersPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [supplierVersion, setSupplierVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreateSupplierInput>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [editSupplierState, setEditSupplierState] = useState<Supplier | null>(null);
  const [editFormData, setEditFormData] = useState<CreateSupplierInput & { isActive: boolean }>({
    ...DEFAULT_FORM,
    isActive: true,
  });
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

  const allSuppliers = useMemo(() => {
    if (!isClient) return [];
    void supplierVersion;
    return getSuppliers();
  }, [isClient, supplierVersion]);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return allSuppliers;
    const q = searchQuery.toLowerCase();
    return allSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.paymentTerms.toLowerCase().includes(q),
    );
  }, [allSuppliers, searchQuery]);

  function handleOpenCreate() {
    setFormData(DEFAULT_FORM);
    setFormError(null);
    setCreateModalOpen(true);
  }

  function handleSaveCreate() {
    if (!employee) return;
    setFormError(null);

    try {
      createSupplier(formData, employee);
      setCreateModalOpen(false);
      setSupplierVersion((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal membuat supplier.");
    }
  }

  function handleOpenEdit(supplier: Supplier) {
    setEditSupplierState(supplier);
    setEditFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email ?? "",
      address: supplier.address,
      paymentTerms: supplier.paymentTerms,
      notes: supplier.notes ?? "",
      isActive: supplier.isActive,
    });
    setEditError(null);
  }

  function handleSaveEdit() {
    if (!employee || !editSupplierState) return;
    setEditError(null);

    try {
      updateSupplier(editSupplierState.id, editFormData, employee);
      setEditSupplierState(null);
      setSupplierVersion((v) => v + 1);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui data supplier.");
    }
  }

  function handleDeleteConfirm() {
    if (!employee || !deleteTargetId) return;
    try {
      deleteSupplier(deleteTargetId, employee);
      setDeleteTargetId(null);
      setSupplierVersion((v) => v + 1);
    } catch (err) {
      console.error(err);
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
      pageTitle="Master Supplier & Vendor"
      activeNavId="suppliers"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Action Header & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex items-center gap-2.5">
            <input
              type="text"
              placeholder="Cari nama supplier, PIC, no. HP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
            />
            <span className="text-xs text-text-faint">Total {filteredSuppliers.length} Supplier</span>
          </div>

          <Button variant="primary" onClick={handleOpenCreate}>
            + Tambah Supplier Baru
          </Button>
        </div>

        {/* Suppliers Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NAMA SUPPLIER</th>
                <th className="px-3.5 py-2.5">PIC / KONTAK</th>
                <th className="px-3.5 py-2.5">NO. TELEPON / WA</th>
                <th className="px-3.5 py-2.5">ALAMAT</th>
                <th className="px-3.5 py-2.5">TERMIN BAYAR</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummySupplier.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummySupplier.map((sup) => (
                  <tr key={sup.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-bold">{sup.nama}</td>
                    <td className="px-3.5 py-2.5">{sup.pic}</td>
                    <td className="px-3.5 py-2.5 font-mono">{sup.kontak}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{sup.alamat}</td>
                    <td className="px-3.5 py-2.5">{sup.termin}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-ok/10 text-ok">{sup.status}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center"><button className="text-gold-bright">Detail</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Supplier */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        eyebrow="Master Data"
        title="Tambah Supplier Baru"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveCreate}>
              Simpan Supplier
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
            <label className="mb-1 block font-bold text-text-muted">NAMA SUPPLIER / PERUSAHAAN</label>
            <input
              type="text"
              placeholder="Misal: PT Pomade Jaya Makmur"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-text-muted">NAMA PIC / CONTACT PERSON</label>
              <input
                type="text"
                placeholder="Misal: Budi Santoso"
                value={formData.contactPerson}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">NO. TELEPON / WHATSAPP</label>
              <input
                type="text"
                placeholder="Misal: 08123456789"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-text-muted">EMAIL (OPSIONAL)</label>
              <input
                type="email"
                placeholder="order@supplier.com"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">TERMIN PEMBAYARAN</label>
              <select
                value={formData.paymentTerms}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Cash Advance">Cash in Advance / Bayar Dimuka</option>
                <option value="Net 7">Net 7 Hari</option>
                <option value="Net 14">Net 14 Hari</option>
                <option value="Net 30">Net 30 Hari</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">ALAMAT SUPPLIER</label>
            <textarea
              rows={2}
              placeholder="Jl. Raya No. 123, Bandung, Jawa Barat"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full rounded border border-border bg-surface-2 p-2 text-xs text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN TAMBAHAN</label>
            <input
              type="text"
              placeholder="Misal: Distributor resmi produk Uppercut..."
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Edit Supplier */}
      <Modal
        open={editSupplierState !== null}
        onClose={() => setEditSupplierState(null)}
        eyebrow="Ubah Data"
        title={`Edit Supplier · ${editSupplierState?.name ?? ""}`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditSupplierState(null)}>
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
            <label className="mb-1 block font-bold text-text-muted">NAMA SUPPLIER</label>
            <input
              type="text"
              value={editFormData.name}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-text-muted">NAMA PIC</label>
              <input
                type="text"
                value={editFormData.contactPerson}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, contactPerson: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">NO. TELEPON</label>
              <input
                type="text"
                value={editFormData.phone}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-text-muted">TERMIN PEMBAYARAN</label>
              <select
                value={editFormData.paymentTerms}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Cash Advance">Cash in Advance / Bayar Dimuka</option>
                <option value="Net 7">Net 7 Hari</option>
                <option value="Net 14">Net 14 Hari</option>
                <option value="Net 30">Net 30 Hari</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold text-text-muted">STATUS AKTIF</label>
              <select
                value={editFormData.isActive ? "true" : "false"}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">ALAMAT</label>
            <textarea
              rows={2}
              value={editFormData.address}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full rounded border border-border bg-surface-2 p-2 text-xs text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN</label>
            <input
              type="text"
              value={editFormData.notes}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        eyebrow="Hapus Supplier"
        title="Hapus Master Supplier?"
        message="Apakah Anda yakin ingin menghapus data supplier ini dari sistem?"
        confirmLabel="Hapus Supplier"
        onConfirm={handleDeleteConfirm}
      />
    </ManajemenShell>
  );
}
