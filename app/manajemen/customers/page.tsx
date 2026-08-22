"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/data";
import type { Customer, CustomerType, MembershipTier } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const TIERS: MembershipTier[] = ["Bronze", "Silver", "Gold", "Platinum"];

interface CustomerFormState {
  id: string | null;
  name: string;
  phone: string;
  type: CustomerType;
  tier: MembershipTier;
  points: string;
}
const EMPTY_FORM: CustomerFormState = { id: null, name: "", phone: "", type: "member", tier: "Bronze", points: "0" };

export default function CustomerDatabasePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const branches = isClient ? getBranches() : [];
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(session, branches);

  const [dataVersion, setDataVersion] = useState(0);
  const [form, setForm] = useState<CustomerFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

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
  const customers = getCustomers();

  function handleSave() {
    if (!form) return;
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        type: form.type,
        tier: form.type === "member" ? form.tier : null,
        points: Number(form.points || 0),
      };
      if (form.id) updateCustomer(form.id, payload);
      else createCustomer(payload);
      setForm(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan customer.");
    }
  }

  return (
    <ManajemenShell
      employee={session}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Customer Database"
      activeNavId="customers"
      onLogout={handleLogout}
    >
      <div className="font-accent mb-1 text-xs italic text-gold-bright">Customer Database (Dasar)</div>
      <div className="mb-1 font-display text-3xl tracking-wide">Customer Database</div>
      <div className="mb-4 max-w-xl text-sm text-text-muted">
        Satu tabel customer dipakai lintas POV (Quick-Lookup di POS memakai data yang sama). Segmentasi, RFM, dan loyalty
        engine lengkap tersedia di Tier 2.
      </div>

      <div className="mb-3.5 flex justify-end">
        <Button variant="primary" onClick={() => setForm(EMPTY_FORM)}>
          + Tambah Customer
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
              <th className="px-3 py-2 font-normal">Nama</th>
              <th className="px-3 py-2 font-normal">HP</th>
              <th className="px-3 py-2 font-normal">Tipe</th>
              <th className="px-3 py-2 font-normal">Tier</th>
              <th className="px-3 py-2 font-normal">Poin</th>
              <th className="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 font-semibold">{customer.name}</td>
                <td className="px-3 py-2">{customer.phone}</td>
                <td className="px-3 py-2">{customer.type === "member" ? "Member" : "Guest"}</td>
                <td className="px-3 py-2">{customer.type === "member" ? customer.tier : "-"}</td>
                <td className="px-3 py-2">{customer.points}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="default"
                      className="px-2.5 py-1.5 text-xs"
                      onClick={() =>
                        setForm({
                          id: customer.id,
                          name: customer.name,
                          phone: customer.phone,
                          type: customer.type,
                          tier: customer.tier ?? "Bronze",
                          points: String(customer.points),
                        })
                      }
                    >
                      Ubah
                    </Button>
                    <Button variant="danger" className="px-2.5 py-1.5 text-xs" onClick={() => setDeleteTarget(customer)}>
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
        eyebrow="Customer Database"
        title={form?.id ? "Ubah Customer" : "Tambah Customer"}
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
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Nama</div>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Nomor HP</div>
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/[^0-9]/g, "") })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Tipe</div>
              <select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as CustomerType })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="member">Member</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            {form.type === "member" && (
              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Tier</div>
                <select
                  value={form.tier}
                  onChange={(event) => setForm({ ...form, tier: event.target.value as MembershipTier })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
                >
                  {TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Poin</div>
              <input
                type="text"
                inputMode="numeric"
                value={form.points}
                onChange={(event) => setForm({ ...form, points: event.target.value.replace(/[^0-9]/g, "") })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            {formError && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Customer Database"
        title="Hapus Customer?"
        message="Riwayat transaksi lama tetap tersimpan walau data customer dihapus."
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (deleteTarget) {
            deleteCustomer(deleteTarget.id);
            setDataVersion((v) => v + 1);
          }
        }}
      />
    </ManajemenShell>
  );
}
