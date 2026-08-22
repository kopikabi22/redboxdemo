"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  canEditHoldingData,
} from "@/lib/data";
import type { Branch } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface BranchFormState {
  id: string | null;
  name: string;
  city: string;
  province: string;
  address: string;
  phone: string;
}

const EMPTY_FORM: BranchFormState = { id: null, name: "", city: "", province: "", address: "", phone: "" };

export default function BranchManagementPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const branches = isClient ? getBranches() : [];
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(session, branches);

  const [dataVersion, setDataVersion] = useState(0);
  const [form, setForm] = useState<BranchFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  useEffect(() => {
    if (isClient && !session) {
      router.replace("/manajemen/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("manajemen");
    router.replace("/manajemen/login");
  }

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  const canEdit = canEditHoldingData(session);
  void dataVersion;
  const branchList = getBranches();

  function handleSave() {
    if (!form || !session) return;
    setFormError(null);
    try {
      if (form.id) {
        updateBranch(form.id, { name: form.name, city: form.city, province: form.province, address: form.address, phone: form.phone }, session);
      } else {
        createBranch({ name: form.name, city: form.city, province: form.province, address: form.address, phone: form.phone }, session);
      }
      setForm(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan cabang.");
    }
  }

  return (
    <ManajemenShell
      employee={session}
      branches={branchList}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Branch Management"
      activeNavId="branch"
      onLogout={handleLogout}
    >
      <div className="font-accent mb-1 text-xs italic text-gold-bright">Holding — Master Data Cabang</div>
      <div className="mb-1 font-display text-3xl tracking-wide">Branch Management</div>
      <div className="mb-4 max-w-xl text-sm text-text-muted">
        {canEdit ? "Data cabang berlaku company-wide." : "Login sebagai Owner/HQ untuk menambah/mengubah cabang."}
      </div>

      <div className="mb-3.5 flex justify-end">
        <Button variant="primary" disabled={!canEdit} onClick={() => setForm(EMPTY_FORM)}>
          + Tambah Cabang
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
              <th className="px-3 py-2 font-normal">Nama</th>
              <th className="px-3 py-2 font-normal">Kota</th>
              <th className="px-3 py-2 font-normal">Provinsi</th>
              <th className="px-3 py-2 font-normal">Telepon</th>
              <th className="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {branchList.map((branch) => (
              <tr key={branch.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 font-semibold">{branch.name}</td>
                <td className="px-3 py-2">{branch.city}</td>
                <td className="px-3 py-2">{branch.province}</td>
                <td className="px-3 py-2">{branch.phone}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="default" className="px-2.5 py-1.5 text-xs" disabled={!canEdit} onClick={() => setForm({ ...branch, id: branch.id })}>
                      Ubah
                    </Button>
                    <Button variant="danger" className="px-2.5 py-1.5 text-xs" disabled={!canEdit} onClick={() => setDeleteTarget(branch)}>
                      Hapus
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        eyebrow="Branch Management"
        title={form?.id ? "Ubah Cabang" : "Tambah Cabang"}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setForm(null)}>
              Batal
            </Button>
            <Button variant="primary" fullWidth onClick={handleSave}>
              Simpan
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-3">
            <Field label="Nama Cabang" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Kota" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="Provinsi" value={form.province} onChange={(v) => setForm({ ...form, province: v })} />
            <Field label="Alamat" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <Field label="Telepon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            {formError && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Branch Management"
        title="Hapus Cabang?"
        message={`Cabang "${deleteTarget?.name ?? ""}" dengan karyawan aktif tidak bisa dihapus. Lanjutkan?`}
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (deleteTarget && session) {
            deleteBranch(deleteTarget.id, session);
            setDataVersion((v) => v + 1);
          }
        }}
      />
    </ManajemenShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
      />
    </div>
  );
}
