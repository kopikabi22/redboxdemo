"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getBranchTargets,
  setBranchTarget,
  calculateBranchTargetProgress,
  formatRupiah,
  todayDateString,
} from "@/lib/data";
import type { BranchTargetProgress, TargetStatus } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function ManajemenTargetsPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [periodMonth, setPeriodMonth] = useState(() => todayDateString().slice(0, 7)); // e.g. "2026-08"
  const [targetVersion, setTargetVersion] = useState(0);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formBranchId, setFormBranchId] = useState("");
  const [formPeriod, setFormPeriod] = useState("");
  const [formRevenue, setFormRevenue] = useState("30000000");
  const [formTransactions, setFormTransactions] = useState("300");
  const [formNewCustomers, setFormNewCustomers] = useState("60");
  const [formMembership, setFormMembership] = useState("20");
  const [formNotes, setFormNotes] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

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

  const activeBranchId = selectedBranchId || branches[0]?.id || "";

  // Calculate active branch progress
  const activeProgress: BranchTargetProgress | null = useMemo(() => {
    if (!isClient || !activeBranchId) return null;
    void targetVersion;
    return calculateBranchTargetProgress(activeBranchId, periodMonth);
  }, [isClient, activeBranchId, periodMonth, targetVersion]);

  // Calculate all branches progress for comparison table
  const allBranchesProgress = useMemo(() => {
    if (!isClient) return [];
    void targetVersion;
    return branches.map((b) => calculateBranchTargetProgress(b.id, periodMonth));
  }, [isClient, branches, periodMonth, targetVersion]);

  function handleOpenModal(targetBranchId?: string) {
    const bId = targetBranchId || activeBranchId;
    setFormBranchId(bId);
    setFormPeriod(periodMonth);

    // Prepopulate existing if any
    const existing = getBranchTargets(bId, periodMonth)[0];
    if (existing) {
      setFormRevenue(String(existing.targetRevenue));
      setFormTransactions(String(existing.targetTransactions));
      setFormNewCustomers(String(existing.targetNewCustomers));
      setFormMembership(String(existing.targetMembershipActivations));
      setFormNotes(existing.notes || "");
    } else {
      setFormRevenue("30000000");
      setFormTransactions("300");
      setFormNewCustomers("60");
      setFormMembership("20");
      setFormNotes("");
    }

    setModalError(null);
    setModalOpen(true);
  }

  function handleSaveTarget() {
    if (!employee) return;
    setModalError(null);

    const rev = parseInt(formRevenue, 10);
    const trx = parseInt(formTransactions, 10);
    const cust = parseInt(formNewCustomers, 10);
    const mbr = parseInt(formMembership, 10);

    if (isNaN(rev) || rev < 0 || isNaN(trx) || trx < 0 || isNaN(cust) || cust < 0 || isNaN(mbr) || mbr < 0) {
      setModalError("Nilai target harus berupa angka dan tidak boleh bernilai negatif.");
      return;
    }

    try {
      setBranchTarget(
        {
          branchId: formBranchId,
          periodMonth: formPeriod,
          targetRevenue: rev,
          targetTransactions: trx,
          targetNewCustomers: cust,
          targetMembershipActivations: mbr,
          notes: formNotes.trim() || undefined,
        },
        employee,
      );

      setModalOpen(false);
      setTargetVersion((v) => v + 1);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Gagal menetapkan target cabang.");
    }
  }

  function getStatusBadge(status: TargetStatus) {
    switch (status) {
      case "achieved":
        return <Badge tone="gold">Target Tercapai</Badge>;
      case "on_track":
        return <Badge tone="ok">On Track</Badge>;
      case "at_risk":
        return <Badge tone="warn">Perlu Perhatian</Badge>;
      case "off_track":
        return <Badge tone="danger">Di Bawah Target</Badge>;
    }
  }

  function getProgressBarColor(percent: number) {
    if (percent >= 100) return "bg-gold-bright";
    if (percent >= 75) return "bg-ok";
    if (percent >= 50) return "bg-warn";
    return "bg-danger";
  }

  if (!employee || !activeProgress) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <ManajemenShell
      employee={employee}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Target & KPI Performa Cabang"
      activeNavId="targets"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Overall Health Score Card */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text-muted">
                KESEHATAN PERFORMA: <span className="text-text">{activeProgress.target.branchName}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-black text-gold-bright">
                  {activeProgress.overallPercentage.toFixed(1)}%
                </span>
                <span className="text-xs text-text-muted">Rata-rata Capaian 4 Metrik Utama</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-text-muted">Status:</span>
              {getStatusBadge(activeProgress.status)}
            </div>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full transition-all duration-500 ${getProgressBarColor(activeProgress.overallPercentage)}`}
              style={{ width: `${Math.min(activeProgress.overallPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Target Revenue */}
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">1. Target Omzet (Rp)</span>
              <span className="font-mono text-xs font-bold text-gold-bright">
                {activeProgress.revenuePercentage.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 text-lg font-bold text-text">
              {formatRupiah(activeProgress.actualRevenue)}
            </div>
            <div className="text-[11px] text-text-faint">
              Target: {formatRupiah(activeProgress.target.targetRevenue)}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full ${getProgressBarColor(activeProgress.revenuePercentage)}`}
                style={{ width: `${Math.min(activeProgress.revenuePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* 2. Target Transactions */}
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">2. Volume Transaksi</span>
              <span className="font-mono text-xs font-bold text-ok">
                {activeProgress.transactionsPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 text-lg font-bold text-text">
              {activeProgress.actualTransactions} <span className="text-xs text-text-muted">trx</span>
            </div>
            <div className="text-[11px] text-text-faint">
              Target: {activeProgress.target.targetTransactions} transaksi
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full ${getProgressBarColor(activeProgress.transactionsPercentage)}`}
                style={{ width: `${Math.min(activeProgress.transactionsPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* 3. Target New Customers */}
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">3. Pelanggan Baru</span>
              <span className="font-mono text-xs font-bold text-warn">
                {activeProgress.newCustomersPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 text-lg font-bold text-text">
              {activeProgress.actualNewCustomers} <span className="text-xs text-text-muted">orang</span>
            </div>
            <div className="text-[11px] text-text-faint">
              Target: {activeProgress.target.targetNewCustomers} orang baru
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full ${getProgressBarColor(activeProgress.newCustomersPercentage)}`}
                style={{ width: `${Math.min(activeProgress.newCustomersPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* 4. Target Membership */}
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">4. Aktivasi Member</span>
              <span className="font-mono text-xs font-bold text-gold-bright">
                {activeProgress.membershipPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 text-lg font-bold text-text">
              {activeProgress.actualMembershipActivations} <span className="text-xs text-text-muted">member</span>
            </div>
            <div className="text-[11px] text-text-faint">
              Target: {activeProgress.target.targetMembershipActivations} member baru
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full ${getProgressBarColor(activeProgress.membershipPercentage)}`}
                style={{ width: `${Math.min(activeProgress.membershipPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Bar & Month Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex items-center gap-2.5 text-xs">
            <label className="font-bold text-text-muted">PERIODE BULAN:</label>
            <input
              type="month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          {employee.role === "Owner" && (
            <Button variant="primary" onClick={() => handleOpenModal()}>
              + Tetapkan Target Cabang
            </Button>
          )}
        </div>

        {/* Branch Comparison Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <div className="border-b border-border bg-surface-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-text">
            Perbandingan Capaian Target Antar-Cabang (Periode {periodMonth})
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2/60 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5 text-right">OMZET (AKTUAL / TARGET)</th>
                <th className="px-3.5 py-2.5 text-center">TRX (AKTUAL / TGT)</th>
                <th className="px-3.5 py-2.5 text-center">CUST BARU (AKTUAL / TGT)</th>
                <th className="px-3.5 py-2.5 text-center">MEMBER (AKTUAL / TGT)</th>
                <th className="px-3.5 py-2.5 text-right">SKOR CAPAIAN</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                {employee.role === "Owner" && <th className="px-3.5 py-2.5 text-center">AKSI</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allBranchesProgress.map((p) => (
                <tr key={p.target.branchId} className="hover:bg-surface-2/60">
                  <td className="px-3.5 py-2.5 font-bold text-text">{p.target.branchName}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono">
                    <span className="font-bold text-text">{formatRupiah(p.actualRevenue)}</span>
                    <span className="text-text-faint"> / {formatRupiah(p.target.targetRevenue)}</span>
                    <div className="text-[10px] text-text-muted">({p.revenuePercentage.toFixed(1)}%)</div>
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-mono">
                    <span className="font-semibold text-text">{p.actualTransactions}</span>
                    <span className="text-text-faint"> / {p.target.targetTransactions}</span>
                    <div className="text-[10px] text-text-muted">({p.transactionsPercentage.toFixed(1)}%)</div>
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-mono">
                    <span className="font-semibold text-text">{p.actualNewCustomers}</span>
                    <span className="text-text-faint"> / {p.target.targetNewCustomers}</span>
                    <div className="text-[10px] text-text-muted">({p.newCustomersPercentage.toFixed(1)}%)</div>
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-mono">
                    <span className="font-semibold text-text">{p.actualMembershipActivations}</span>
                    <span className="text-text-faint"> / {p.target.targetMembershipActivations}</span>
                    <div className="text-[10px] text-text-muted">({p.membershipPercentage.toFixed(1)}%)</div>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-gold-bright">
                    {p.overallPercentage.toFixed(1)}%
                  </td>
                  <td className="px-3.5 py-2.5">{getStatusBadge(p.status)}</td>
                  {employee.role === "Owner" && (
                    <td className="px-3.5 py-2.5 text-center">
                      <Button
                        variant="default"
                        className="px-2 py-0.5 text-[11px]"
                        onClick={() => handleOpenModal(p.target.branchId)}
                      >
                        Ubah Target
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tetapkan Target Cabang */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        eyebrow="Manajemen Target"
        title="Tetapkan Target Performa Cabang"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveTarget}>
              Simpan Target
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {modalError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
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

            <div>
              <label className="mb-1 block font-bold text-text-muted">PERIODE BULAN</label>
              <input
                type="month"
                value={formPeriod}
                onChange={(e) => setFormPeriod(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block font-bold text-text-muted">TARGET OMZET / REVENUE (RP)</label>
              <input
                type="number"
                min="0"
                step="1000000"
                value={formRevenue}
                onChange={(e) => setFormRevenue(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-text-muted">TARGET JUMLAH TRANSAKSI (QTY)</label>
              <input
                type="number"
                min="0"
                step="10"
                value={formTransactions}
                onChange={(e) => setFormTransactions(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block font-bold text-text-muted">TARGET PELANGGAN BARU (QTY)</label>
              <input
                type="number"
                min="0"
                step="5"
                value={formNewCustomers}
                onChange={(e) => setFormNewCustomers(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-text-muted">TARGET AKTIVASI MEMBER (QTY)</label>
              <input
                type="number"
                min="0"
                step="5"
                value={formMembership}
                onChange={(e) => setFormMembership(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN STRATEGIS (OPSIONAL)</label>
            <textarea
              rows={2}
              placeholder="Misal: Target dinaikkan sehubungan dengan pembukaan promo kemerdekaan..."
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
