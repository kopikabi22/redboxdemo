"use client";

import { dummyExpense } from "@/lib/data/dummy";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getExpenses,
  createExpense,
  deleteExpense,
  formatRupiah,
  todayDateString,
} from "@/lib/data";
import type { ExpenseRecord, ExpenseCategory, PaymentMethod } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Sewa Tempat & Gedung",
  utilities: "Listrik, Air & Internet",
  supplies: "Perlengkapan & Konsumsi",
  maintenance: "Maintenance Alat & Tempat",
  marketing: "Marketing & Promosi",
  other: "Beban Operasional Lainnya",
};

export default function ManajemenExpensesPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [periodMonth, setPeriodMonth] = useState(() => todayDateString().slice(0, 7)); // e.g. "2026-08"
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expenseVersion, setExpenseVersion] = useState(0);

  // Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formBranchId, setFormBranchId] = useState("");
  const [formCategory, setFormCategory] = useState<ExpenseCategory>("utilities");
  const [formAmount, setFormAmount] = useState("250000");
  const [formDate, setFormDate] = useState(() => todayDateString());
  const [formVendor, setFormVendor] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>("Cash");
  const [formNotes, setFormNotes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

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

  const allExpenses = useMemo(() => {
    if (!isClient) return [];
    void expenseVersion;
    const start = `${periodMonth}-01`;
    const end = `${periodMonth}-31`;
    const cat = selectedCategory !== "all" ? (selectedCategory as ExpenseCategory) : undefined;
    return getExpenses(selectedBranchId || undefined, cat, start, end);
  }, [isClient, selectedBranchId, selectedCategory, periodMonth, expenseVersion]);

  // Statistics
  const stats = useMemo(() => {
    const totalAmount = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const rentAmount = allExpenses.filter((e) => e.category === "rent").reduce((sum, e) => sum + e.amount, 0);
    const utilitiesAmount = allExpenses.filter((e) => e.category === "utilities").reduce((sum, e) => sum + e.amount, 0);
    const maintenanceAmount = allExpenses
      .filter((e) => e.category === "maintenance" || e.category === "supplies")
      .reduce((sum, e) => sum + e.amount, 0);

    return { totalAmount, rentAmount, utilitiesAmount, maintenanceAmount };
  }, [allExpenses]);

  function handleOpenCreate() {
    setFormBranchId(selectedBranchId || branches[0]?.id || "");
    setFormCategory("utilities");
    setFormAmount("250000");
    setFormDate(todayDateString());
    setFormVendor("");
    setFormPaymentMethod("Cash");
    setFormNotes("");
    setCreateError(null);
    setCreateModalOpen(true);
  }

  function handleSaveCreate() {
    if (!employee) return;
    setCreateError(null);

    const amountNum = parseInt(formAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCreateError("Nominal pengeluaran harus lebih dari Rp 0.");
      return;
    }

    if (!formNotes.trim()) {
      setCreateError("Catatan / keperluan pengeluaran wajib diisi.");
      return;
    }

    try {
      createExpense(
        {
          branchId: formBranchId,
          category: formCategory,
          amount: amountNum,
          date: formDate,
          recipientOrVendor: formVendor.trim() || undefined,
          paymentMethod: formPaymentMethod,
          notes: formNotes.trim(),
        },
        employee,
      );

      setCreateModalOpen(false);
      setExpenseVersion((v) => v + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal mencatat pengeluaran.");
    }
  }

  function handleDelete(exp: ExpenseRecord) {
    if (!employee) return;
    if (!confirm(`Hapus pencatatan pengeluaran ${exp.expenseNumber} (${formatRupiah(exp.amount)})?`)) {
      return;
    }

    try {
      deleteExpense(exp.id, employee);
      setExpenseVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus pengeluaran.");
    }
  }

  function getCategoryBadge(category: ExpenseCategory) {
    switch (category) {
      case "rent":
        return <Badge tone="gold">Sewa Gedung</Badge>;
      case "utilities":
        return <Badge tone="warn">Listrik &amp; Air</Badge>;
      case "supplies":
        return <Badge tone="ok">Perlengkapan</Badge>;
      case "maintenance":
        return <Badge tone="danger">Maintenance</Badge>;
      case "marketing":
        return <Badge tone="gold">Marketing</Badge>;
      case "other":
        return <Badge tone="neutral">Lainnya</Badge>;
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
      pageTitle="Beban & Pengeluaran Operasional"
      activeNavId="finance_expenses"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Beban Operasional</div>
            <div className="mt-1 text-2xl font-bold text-danger">{formatRupiah(stats.totalAmount)}</div>
            <div className="text-[11px] text-text-faint">Periode {periodMonth}</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Sewa Tempat &amp; Gedung</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{formatRupiah(stats.rentAmount)}</div>
            <div className="text-[11px] text-text-faint">Biaya sewa ruko / mall</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Listrik, Air &amp; Internet</div>
            <div className="mt-1 text-2xl font-bold text-warn">{formatRupiah(stats.utilitiesAmount)}</div>
            <div className="text-[11px] text-text-faint">Tagihan utilitas bulanan</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Maintenance &amp; Supplies</div>
            <div className="mt-1 text-2xl font-bold text-ok">{formatRupiah(stats.maintenanceAmount)}</div>
            <div className="text-[11px] text-text-faint">Perawatan alat &amp; konsumsi</div>
          </div>
        </div>

        {/* Action Bar & Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">PERIODE BULAN:</label>
              <input
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">KATEGORI:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Kategori</option>
                <option value="rent">Sewa Tempat &amp; Gedung</option>
                <option value="utilities">Listrik, Air &amp; Internet</option>
                <option value="supplies">Perlengkapan &amp; Konsumsi</option>
                <option value="maintenance">Maintenance Alat &amp; Tempat</option>
                <option value="marketing">Marketing &amp; Promosi</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
          </div>

          <Button variant="primary" onClick={handleOpenCreate}>
            + Catat Pengeluaran Baru
          </Button>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NO. EXPENSE</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">KATEGORI</th>
                <th className="px-3.5 py-2.5">PENERIMA / VENDOR</th>
                <th className="px-3.5 py-2.5">METODE</th>
                <th className="px-3.5 py-2.5 text-right">NOMINAL (RP)</th>
                <th className="px-3.5 py-2.5">CATATAN</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyExpense.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummyExpense.map((exp) => (
                  <tr key={exp.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{exp.id}</td>
                    <td className="px-3.5 py-2.5">{exp.tanggal}</td>
                    <td className="px-3.5 py-2.5">{exp.cabang}</td>
                    <td className="px-3.5 py-2.5 font-bold">{exp.kategori}</td>
                    <td className="px-3.5 py-2.5">{exp.penerima}</td>
                    <td className="px-3.5 py-2.5">{exp.metode}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-danger">{exp.nominal.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{exp.catatan}</td>
                    <td className="px-3.5 py-2.5 text-center"><button className="text-gold-bright">Detail</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Pengeluaran Baru */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        eyebrow="Biaya Operasional"
        title="Catat Pengeluaran Baru"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveCreate}>
              Simpan Pengeluaran
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {createError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {createError}
            </div>
          )}

          <div>
            <label className="mb-1 block font-bold text-text-muted">CABANG</label>
            <select
              value={formBranchId}
              onChange={(e) => setFormBranchId(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block font-bold text-text-muted">KATEGORI BEBAN</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              >
                {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-bold text-text-muted">TANGGAL</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block font-bold text-text-muted">NOMINAL (RP)</label>
              <input
                type="number"
                min="1000"
                step="10000"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-text-muted">METODE PEMBAYARAN</label>
              <select
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="Cash">Cash / Kas Kecil</option>
                <option value="Transfer">Transfer Bank</option>
                <option value="Debit">Debit</option>
                <option value="QRIS">QRIS</option>
                <option value="E-Wallet">E-Wallet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">PENERIMA / VENDOR (OPSIONAL)</label>
            <input
              type="text"
              placeholder="Misal: PLN / PDAM / Toko Bangunan Berkah..."
              value={formVendor}
              onChange={(e) => setFormVendor(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN / KEPERLUAN</label>
            <textarea
              rows={2}
              placeholder="Misal: Servis AC ruang tunggu dan ganti lampu kasir..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 p-2.5 text-xs text-text focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </ManajemenShell>
  );
}
