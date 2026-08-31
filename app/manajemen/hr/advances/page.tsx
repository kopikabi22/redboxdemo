"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getEmployees,
  getEmployeeAdvances,
  createEmployeeAdvance,
  approveEmployeeAdvance,
  rejectEmployeeAdvance,
  formatRupiah,
} from "@/lib/data";
import type { EmployeeAdvance, AdvanceStatus } from "@/lib/data";
import { dummyKasbon } from "@/lib/data/dummy";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function ManajemenEmployeeAdvancesPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const allEmployees = useMemo(() => (isClient ? getEmployees() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [advanceVersion, setAdvanceVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newAmount, setNewAmount] = useState("500000");
  const [newReason, setNewReason] = useState("");
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

  const eligibleEmployees = useMemo(() => {
    return allEmployees.filter((e) => (selectedBranchId ? e.branchId === selectedBranchId : true) && e.role !== "Owner");
  }, [allEmployees, selectedBranchId]);

  const allAdvances = useMemo(() => {
    if (!isClient) return [];
    void advanceVersion;
    return getEmployeeAdvances(undefined, selectedBranchId || undefined);
  }, [isClient, selectedBranchId, advanceVersion]);

  const filteredAdvances = useMemo(() => {
    return allAdvances.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [allAdvances, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = allAdvances.length;
    const pendingCount = allAdvances.filter((a) => a.status === "pending").length;
    const approvedActiveCount = allAdvances.filter((a) => a.status === "approved" && !a.deductedPayrollId).length;
    const totalActiveAmount = allAdvances
      .filter((a) => a.status === "approved" && !a.deductedPayrollId)
      .reduce((sum, a) => sum + a.amount, 0);

    return { totalCount, pendingCount, approvedActiveCount, totalActiveAmount };
  }, [allAdvances]);

  function handleOpenCreate() {
    setNewEmployeeId(eligibleEmployees[0]?.id || "");
    setNewAmount("500000");
    setNewReason("");
    setCreateError(null);
    setCreateModalOpen(true);
  }

  function handleSaveCreate() {
    if (!employee) return;
    setCreateError(null);

    const amountNum = parseInt(newAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCreateError("Nominal kasbon harus lebih dari Rp 0.");
      return;
    }

    if (!newReason.trim()) {
      setCreateError("Alasan pengajuan kasbon wajib diisi.");
      return;
    }

    try {
      createEmployeeAdvance(
        {
          employeeId: newEmployeeId,
          amount: amountNum,
          reason: newReason.trim(),
        },
        employee,
      );

      setCreateModalOpen(false);
      setAdvanceVersion((v) => v + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal mengajukan kasbon.");
    }
  }

  function handleApprove(adv: EmployeeAdvance) {
    if (!employee) return;
    try {
      approveEmployeeAdvance(adv.id, employee);
      setAdvanceVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyetujui kasbon.");
    }
  }

  function handleReject(adv: EmployeeAdvance) {
    if (!employee) return;
    try {
      rejectEmployeeAdvance(adv.id, employee);
      setAdvanceVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menolak kasbon.");
    }
  }

  function getStatusBadge(status: AdvanceStatus) {
    switch (status) {
      case "pending":
        return <Badge tone="warn">Menunggu Persetujuan</Badge>;
      case "approved":
        return <Badge tone="ok">Disetujui (Belum Terpotong)</Badge>;
      case "rejected":
        return <Badge tone="danger">Ditolak</Badge>;
      case "deducted":
        return <Badge tone="neutral">Sudah Terpotong Payroll</Badge>;
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
      pageTitle="Kasbon & Pinjaman Karyawan"
      activeNavId="advances"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Pengajuan</div>
            <div className="mt-1 text-2xl font-bold text-text">{stats.totalCount}</div>
            <div className="text-[11px] text-text-faint">Seluruh riwayat kasbon</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Menunggu Persetujuan</div>
            <div className="mt-1 text-2xl font-bold text-warn">{stats.pendingCount}</div>
            <div className="text-[11px] text-text-faint">Butuh approval Branch Manager / Owner</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Kasbon Aktif (Belum Potong)</div>
            <div className="mt-1 text-2xl font-bold text-ok">{stats.approvedActiveCount}</div>
            <div className="text-[11px] text-text-faint">Akan memotong payroll bulan ini</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Total Nilai Kasbon Aktif</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{formatRupiah(stats.totalActiveAmount)}</div>
            <div className="text-[11px] text-text-faint">Piutang kasbon karyawan</div>
          </div>
        </div>

        {/* Action Bar & Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex items-center gap-2.5 text-xs">
            <label className="font-bold text-text-muted">STATUS KASBON:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Menunggu Persetujuan</option>
              <option value="approved">Disetujui (Belum Terpotong)</option>
              <option value="deducted">Sudah Terpotong Payroll</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>

          <Button variant="primary" onClick={handleOpenCreate}>
            + Ajukan Kasbon Baru
          </Button>
        </div>

        {/* Advances Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NO. KASBON</th>
                <th className="px-3.5 py-2.5">TANGGAL</th>
                <th className="px-3.5 py-2.5">KARYAWAN</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5 text-right">NOMINAL KASBON</th>
                <th className="px-3.5 py-2.5">ALASAN / KEPERLUAN</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5 text-center">AKSI APPROVAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyKasbon.map((adv) => (
                <tr key={adv.id} className="hover:bg-surface-2/60">
                  <td className="px-3.5 py-2.5 font-mono font-bold text-gold-bright">{adv.id}</td>
                  <td className="px-3.5 py-2.5 text-text-muted">{adv.tanggal}</td>
                  <td className="px-3.5 py-2.5 font-semibold text-text">{adv.karyawan}</td>
                  <td className="px-3.5 py-2.5 text-text-muted">{adv.cabang}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-danger">
                    {formatRupiah(adv.nominal)}
                  </td>
                  <td className="max-w-xs px-3.5 py-2.5 truncate text-text-muted">{adv.alasan}</td>
                  <td className="px-3.5 py-2.5"><Badge tone="ok">{adv.status}</Badge></td>
                  <td className="px-3.5 py-2.5 text-center">
                    <span className="text-[11px] text-text-faint">
                      Disetujui oleh Owner
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajukan Kasbon */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        eyebrow="Pinjaman Staf"
        title="Ajukan Kasbon Karyawan"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveCreate}>
              Simpan &amp; Ajukan Kasbon
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          {createError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {createError}
            </div>
          )}

          <div>
            <label className="mb-1 block font-bold text-text-muted">PILIH KARYAWAN</label>
            <select
              value={newEmployeeId}
              onChange={(e) => setNewEmployeeId(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            >
              {eligibleEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">NOMINAL KASBON (RP)</label>
            <input
              type="number"
              min="50000"
              step="50000"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">ALASAN / KEPERLUAN PENGAJUAN</label>
            <textarea
              rows={3}
              placeholder="Misal: Biaya pengobatan mendesak / servis kendaraan..."
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 p-2.5 text-xs text-text focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </ManajemenShell>
  );
}
