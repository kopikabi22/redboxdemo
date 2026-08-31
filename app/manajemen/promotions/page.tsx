"use client";

import { dummyPromo } from "@/lib/data/dummy";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  formatRupiah,
} from "@/lib/data";
import type { Promotion, PromoType, PromoScope, CreatePromotionInput, UpdatePromotionInput } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface PromoFormState {
  id: string | null;
  code: string;
  name: string;
  type: PromoType;
  value: string;
  maxDiscount: string;
  minSpend: string;
  scope: PromoScope;
  branchId: string;
  usageLimit: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

const EMPTY_FORM: PromoFormState = {
  id: null,
  code: "",
  name: "",
  type: "percentage",
  value: "",
  maxDiscount: "",
  minSpend: "0",
  scope: "holding",
  branchId: "",
  usageLimit: "",
  startDate: "",
  endDate: "",
  active: true,
};

export default function PromotionsManagementPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const branches = isClient ? getBranches() : [];
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(session, branches);

  const [dataVersion, setDataVersion] = useState(0);
  const [form, setForm] = useState<PromoFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);

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

  void dataVersion;
  const allPromos = getPromotions();

  // Filter for display: Owner sees everything, BranchManager sees holding + own branch
  const visiblePromos = allPromos.filter((p) => {
    if (session.role === "Owner") return true;
    return p.scope === "holding" || p.branchId === session.branchId;
  });

  function canManagePromo(promo: Promotion): boolean {
    if (session?.role === "Owner") return true;
    if (session?.role === "BranchManager") {
      return promo.scope === "branch" && promo.branchId === session.branchId;
    }
    return false;
  }

  function handleOpenCreate() {
    setFormError(null);
    setForm({
      ...EMPTY_FORM,
      scope: session?.role === "BranchManager" ? "branch" : "holding",
      branchId: session?.role === "BranchManager" ? session.branchId : (branches[0]?.id ?? ""),
    });
  }

  function handleOpenEdit(promo: Promotion) {
    setFormError(null);
    setForm({
      id: promo.id,
      code: promo.code,
      name: promo.name,
      type: promo.type,
      value: String(promo.value),
      maxDiscount: promo.maxDiscount !== null ? String(promo.maxDiscount) : "",
      minSpend: String(promo.minSpend),
      scope: promo.scope,
      branchId: promo.branchId ?? (branches[0]?.id ?? ""),
      usageLimit: promo.usageLimit !== null ? String(promo.usageLimit) : "",
      startDate: promo.startDate ?? "",
      endDate: promo.endDate ?? "",
      active: promo.active,
    });
  }

  function handleSave() {
    if (!form || !session) return;
    setFormError(null);
    try {
      const payload: CreatePromotionInput = {
        code: form.code,
        name: form.name,
        type: form.type,
        value: Number(form.value) || 0,
        maxDiscount: form.type === "percentage" && form.maxDiscount ? Number(form.maxDiscount) : null,
        minSpend: Number(form.minSpend) || 0,
        scope: form.scope,
        branchId: form.scope === "branch" ? form.branchId : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        active: form.active,
      };

      if (form.id) {
        updatePromotion(form.id, payload as UpdatePromotionInput, session);
      } else {
        createPromotion(payload, session);
      }

      setForm(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan promosi.");
    }
  }

  return (
    <ManajemenShell
      employee={session}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Promosi & Diskon"
      activeNavId="promotions"
      onLogout={handleLogout}
    >
      <div className="font-accent mb-1 text-xs italic text-gold-bright">Promotion & Campaign</div>
      <div className="mb-1 font-display text-3xl tracking-wide">Promosi & Diskon</div>
      <div className="mb-4 max-w-xl text-sm text-text-muted">
        Kelola voucher dan kampanye diskon company-wide (Holding) maupun promosi lokal cabang. Diskon langsung diterapkan saat transaksi kasir di POS.
      </div>

      <div className="mb-3.5 flex justify-end">
        <Button variant="primary" onClick={handleOpenCreate}>
          + Tambah Promosi
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
              <th className="px-3 py-2 font-normal">Kode Promo</th>
              <th className="px-3 py-2 font-normal">Nama Promosi</th>
              <th className="px-3 py-2 font-normal">Diskon</th>
              <th className="px-3 py-2 font-normal">Scope Cabang</th>
              <th className="px-3 py-2 font-normal">Kuota Terpakai</th>
              <th className="px-3 py-2 font-normal">Periode</th>
              <th className="px-3 py-2 font-normal">Status</th>
              <th className="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>\n              {dummyPromo.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummyPromo.map((pr) => (
                  <tr key={pr.kode} className="hover:bg-surface-2/60">
                    <td className="px-3 py-2 font-mono font-bold text-gold-bright">{pr.kode}</td>
                    <td className="px-3 py-2 font-bold">{pr.nama}</td>
                    <td className="px-3 py-2 font-mono text-ok">{pr.diskon}</td>
                    <td className="px-3 py-2">{pr.scope}</td>
                    <td className="px-3 py-2 text-text-muted">{pr.kuota}</td>
                    <td className="px-3 py-2">{pr.periode}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pr.status === 'Aktif' ? 'bg-ok/10 text-ok' : 'bg-neutral-800 text-text-muted'}`}>{pr.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right"><button className="text-gold-bright">Edit</button></td>
                  </tr>
                ))
              )}\n            </tbody>
        </table>
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        eyebrow="Promosi & Diskon"
        title={form?.id ? "Ubah Promosi" : "Tambah Promosi"}
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
            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Kode Promo (Kupon)</div>
              <input
                type="text"
                placeholder="Misal: MERDEKA20"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-sm uppercase text-text focus:border-gold-bright focus:outline-none placeholder:font-sans placeholder:normal-case placeholder:text-text-faint"
              />
            </div>

            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Nama Promosi</div>
              <input
                type="text"
                placeholder="Misal: Promo Diskon Kemerdekaan"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none placeholder:text-text-faint"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Tipe Diskon</div>
                <select
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value as PromoType })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
                >
                  <option value="percentage">Persentase (%)</option>
                  <option value="flat">Potongan Flat (Rp)</option>
                </select>
              </div>

              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">
                  {form.type === "percentage" ? "Nilai Persen (%)" : "Nominal Potongan (Rp)"}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={form.type === "percentage" ? "20" : "15000"}
                  value={form.value}
                  onChange={(event) => setForm({ ...form, value: event.target.value.replace(/[^0-9]/g, "") })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
                />
              </div>
            </div>

            {form.type === "percentage" && (
              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">
                  Batas Maksimal Diskon (Rp, opsional)
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Kosongkan jika tanpa batas maksimal"
                  value={form.maxDiscount}
                  onChange={(event) => setForm({ ...form, maxDiscount: event.target.value.replace(/[^0-9]/g, "") })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none placeholder:text-text-faint"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Minimal Belanja (Rp)</div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.minSpend}
                  onChange={(event) => setForm({ ...form, minSpend: event.target.value.replace(/[^0-9]/g, "") })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Batas Kuota Pemakaian</div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Kosongkan jika unlimited"
                  value={form.usageLimit}
                  onChange={(event) => setForm({ ...form, usageLimit: event.target.value.replace(/[^0-9]/g, "") })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none placeholder:text-text-faint"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Scope Promosi</div>
                <select
                  value={form.scope}
                  disabled={session.role === "BranchManager"}
                  onChange={(event) => setForm({ ...form, scope: event.target.value as PromoScope })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none disabled:opacity-60"
                >
                  <option value="holding">Holding (Semua Cabang)</option>
                  <option value="branch">Khusus Cabang Tertentu</option>
                </select>
              </div>

              {form.scope === "branch" && (
                <div>
                  <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Pilih Cabang</div>
                  <select
                    value={form.branchId}
                    disabled={session.role === "BranchManager"}
                    onChange={(event) => setForm({ ...form, branchId: event.target.value })}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none disabled:opacity-60"
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Tanggal Mulai (opsional)</div>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-gold-bright focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Tanggal Berakhir (opsional)</div>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-gold-bright focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="promo-active"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
                className="h-4 w-4 rounded border-border bg-surface text-gold-bright accent-gold-bright"
              />
              <label htmlFor="promo-active" className="text-sm font-semibold text-text cursor-pointer select-none">
                Status Promosi Aktif
              </label>
            </div>

            {formError && (
              <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {formError}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Promosi & Diskon"
        title="Hapus Promosi?"
        message={`Promosi "${deleteTarget?.name}" (${deleteTarget?.code}) akan dihapus permanen. Transaksi terdahulu yang menggunakan promo ini tetap aman.`}
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (deleteTarget && session) {
            deletePromotion(deleteTarget.id, session);
            setDataVersion((v) => v + 1);
          }
        }}
      />
    </ManajemenShell>
  );
}
