"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getPayrollRecords,
  getPayrollRecordById,
  generateMonthlyPayroll,
  approvePayrollRecord,
  markPayrollPaid,
  cancelPayrollRecord,
  formatRupiah,
  todayDateString,
} from "@/lib/data";
import type { PayrollRecord, PayrollStatus } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function ManajemenPayrollPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [periodMonth, setPeriodMonth] = useState(() => todayDateString().slice(0, 7)); // e.g. "2026-08"
  const [payrollVersion, setPayrollVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Cancel Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

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

  const allRecords = useMemo(() => {
    if (!isClient) return [];
    void payrollVersion;
    return getPayrollRecords(selectedBranchId || undefined, periodMonth);
  }, [isClient, selectedBranchId, periodMonth, payrollVersion]);

  const filteredRecords = useMemo(() => {
    return allRecords.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [allRecords, statusFilter]);

  const selectedRecord = useMemo(() => {
    if (!selectedRecordId || !isClient) return null;
    void payrollVersion;
    return getPayrollRecordById(selectedRecordId) ?? null;
  }, [selectedRecordId, isClient, payrollVersion]);

  // Statistics
  const stats = useMemo(() => {
    const totalTHP = allRecords.filter((r) => r.status !== "cancelled").reduce((sum, r) => sum + r.takeHomePay, 0);
    const totalCommissions = allRecords
      .filter((r) => r.status !== "cancelled")
      .reduce((sum, r) => sum + r.serviceCommission + r.productCommission, 0);
    const draftCount = allRecords.filter((r) => r.status === "draft").length;
    const readyToPayCount = allRecords.filter((r) => r.status === "approved").length;

    return { totalTHP, totalCommissions, draftCount, readyToPayCount };
  }, [allRecords]);

  function handleCalculatePayroll() {
    if (!employee || !selectedBranchId) {
      alert("Pilih cabang terlebih dahulu untuk menghitung payroll.");
      return;
    }

    try {
      generateMonthlyPayroll(selectedBranchId, periodMonth, employee);
      setPayrollVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghitung payroll.");
    }
  }

  function handleOpenDetail(record: PayrollRecord) {
    setSelectedRecordId(record.id);
    setActionError(null);
    setDetailModalOpen(true);
  }

  function handleApprove() {
    if (!employee || !selectedRecord) return;
    try {
      approvePayrollRecord(selectedRecord.id, employee);
      setPayrollVersion((v) => v + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal menyetujui payroll.");
    }
  }

  function handleMarkPaid() {
    if (!employee || !selectedRecord) return;
    try {
      markPayrollPaid(selectedRecord.id, employee);
      setPayrollVersion((v) => v + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mencairkan payroll.");
    }
  }

  function handleOpenCancel() {
    setCancelReason("");
    setCancelModalOpen(true);
  }

  function handleConfirmCancel() {
    if (!employee || !selectedRecord) return;
    if (!cancelReason.trim()) {
      alert("Alasan pembatalan wajib diisi.");
      return;
    }

    try {
      cancelPayrollRecord(selectedRecord.id, cancelReason.trim(), employee);
      setCancelModalOpen(false);
      setDetailModalOpen(false);
      setPayrollVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal membatalkan payroll.");
    }
  }

  function getStatusBadge(status: PayrollStatus) {
    switch (status) {
      case "draft":
        return <Badge tone="warn">Draft (Belum Disetujui)</Badge>;
      case "approved":
        return <Badge tone="ok">Disetujui (Siap Bayar)</Badge>;
      case "paid":
        return <Badge tone="gold">Lunas (Paid)</Badge>;
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
      pageTitle="Payroll & Komisi Karyawan"
      activeNavId="payroll"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Pengeluaran Gaji</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{formatRupiah(stats.totalTHP)}</div>
            <div className="text-[11px] text-text-faint">Take-Home Pay periode {periodMonth}</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Total Komisi (Layanan &amp; Produk)</div>
            <div className="mt-1 text-2xl font-bold text-ok">{formatRupiah(stats.totalCommissions)}</div>
            <div className="text-[11px] text-text-faint">Insentif kinerja staf &amp; barber</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Draft Menunggu Approval</div>
            <div className="mt-1 text-2xl font-bold text-warn">{stats.draftCount} Staf</div>
            <div className="text-[11px] text-text-faint">Perlu diverifikasi manajer/owner</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text">Siap Dicairkan (Approved)</div>
            <div className="mt-1 text-2xl font-bold text-text">{stats.readyToPayCount} Staf</div>
            <div className="text-[11px] text-text-faint">Siap ditransfer &amp; dipotong kasbon</div>
          </div>
        </div>

        {/* Action Bar & Month Selector */}
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
              <label className="font-bold text-text-muted">STATUS:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="draft">Draft</option>
                <option value="approved">Disetujui (Approved)</option>
                <option value="paid">Lunas (Paid)</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>
          </div>

          <Button variant="primary" onClick={handleCalculatePayroll}>
            ⚡ Hitung Ulang Payroll Periode Ini
          </Button>
        </div>

        {/* Payroll Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">KARYAWAN &amp; ROLE</th>
                <th className="px-3.5 py-2.5 text-center">HADIR</th>
                <th className="px-3.5 py-2.5 text-right">GAJI POKOK</th>
                <th className="px-3.5 py-2.5 text-right">KOMISI LAYANAN</th>
                <th className="px-3.5 py-2.5 text-right">KOMISI PRODUK</th>
                <th className="px-3.5 py-2.5 text-right">TUNJANGAN &amp; LEMBUR</th>
                <th className="px-3.5 py-2.5 text-right">POTONGAN KASBON</th>
                <th className="px-3.5 py-2.5 text-right">TAKE-HOME PAY</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-text-faint">
                    Belum ada data slip gaji pada periode {periodMonth}. Klik tombol &quot;⚡ Hitung Ulang Payroll&quot; untuk menjalankan kalkulasi.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-text">{rec.employeeName}</div>
                      <div className="text-[11px] text-text-faint">
                        {rec.employeeRole} · <span className="font-mono text-gold-bright">{rec.payrollNumber}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-text-muted">{rec.attendanceDays} Hari</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-text">{formatRupiah(rec.baseSalary)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-ok">
                      {formatRupiah(rec.serviceCommission)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-ok">{formatRupiah(rec.productCommission)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-text-muted">
                      {formatRupiah(rec.allowances + rec.overtimeBonus)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-danger">
                      {rec.advanceDeduction > 0 ? `-${formatRupiah(rec.advanceDeduction)}` : "Rp 0"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-sm font-bold text-gold-bright">
                      {formatRupiah(rec.takeHomePay)}
                    </td>
                    <td className="px-3.5 py-2.5">{getStatusBadge(rec.status)}</td>
                    <td className="px-3.5 py-2.5 text-center">
                      <Button
                        variant="default"
                        className="px-2.5 py-0.5 text-[11px]"
                        onClick={() => handleOpenDetail(rec)}
                      >
                        Lihat Slip Gaji
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Slip Gaji (Payslip Preview) */}
      {selectedRecord && (
        <Modal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          eyebrow="Redbox Barbershop - Payslip"
          title={`Slip Gaji: ${selectedRecord.employeeName}`}
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div>
                {selectedRecord.status !== "paid" && selectedRecord.status !== "cancelled" && (
                  <Button variant="danger" className="text-xs" onClick={handleOpenCancel}>
                    Batalkan Slip
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
                  Tutup
                </Button>
                {selectedRecord.status === "draft" && (
                  <Button variant="primary" onClick={handleApprove}>
                    ✓ Setujui (Approve) Slip Gaji
                  </Button>
                )}
                {selectedRecord.status === "approved" && (
                  <Button variant="primary" onClick={handleMarkPaid}>
                    💸 Tandai Sudah Dibayar (Paid)
                  </Button>
                )}
                <Button variant="default" onClick={() => window.print()}>
                  🖨️ Cetak
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {actionError && (
              <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
                {actionError}
              </div>
            )}

            {/* Payslip Header */}
            <div className="rounded-lg border border-border bg-surface-2 p-3.5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-heading text-lg tracking-wider text-gold-bright">REDBOX BARBERSHOP</div>
                  <div className="text-[11px] text-text-faint">
                    Cabang {selectedRecord.branchName} · Periode: {selectedRecord.periodMonth}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-bold text-text">{selectedRecord.payrollNumber}</div>
                  <div className="mt-1">{getStatusBadge(selectedRecord.status)}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
                <div>
                  <span className="text-text-muted">Nama Karyawan:</span>{" "}
                  <span className="font-semibold text-text">{selectedRecord.employeeName}</span>
                </div>
                <div>
                  <span className="text-text-muted">Jabatan / Role:</span>{" "}
                  <span className="font-semibold text-text">{selectedRecord.employeeRole}</span>
                </div>
                <div>
                  <span className="text-text-muted">Total Kehadiran:</span>{" "}
                  <span className="font-semibold text-text">{selectedRecord.attendanceDays} Hari Kerja</span>
                </div>
                <div>
                  <span className="text-text-muted">Layanan Dikerjakan:</span>{" "}
                  <span className="font-semibold text-text">{selectedRecord.totalServicesCompleted} Transaksi</span>
                </div>
              </div>
            </div>

            {/* Breakdown Earnings vs Deductions */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* Kolom Pendapatan */}
              <div className="rounded-lg border border-border bg-surface-2 p-3.5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ok">
                  1. Rincian Pendapatan (Earnings)
                </div>
                <div className="space-y-1.5 divide-y divide-border/60">
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Gaji Pokok</span>
                    <span className="font-mono font-medium text-text">{formatRupiah(selectedRecord.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Komisi Layanan ({selectedRecord.totalServicesCompleted} item)</span>
                    <span className="font-mono font-semibold text-ok">{formatRupiah(selectedRecord.serviceCommission)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Komisi Produk ({selectedRecord.totalProductsSold} item)</span>
                    <span className="font-mono font-semibold text-ok">{formatRupiah(selectedRecord.productCommission)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Bonus Kehadiran &amp; Lembur</span>
                    <span className="font-mono text-text">{formatRupiah(selectedRecord.overtimeBonus)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Tunjangan Makan &amp; Transport</span>
                    <span className="font-mono text-text">{formatRupiah(selectedRecord.allowances)}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-text">
                    <span>Total Pendapatan Kotor</span>
                    <span className="font-mono text-gold-bright">{formatRupiah(selectedRecord.grossPay)}</span>
                  </div>
                </div>
              </div>

              {/* Kolom Potongan */}
              <div className="rounded-lg border border-border bg-surface-2 p-3.5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-danger">
                  2. Rincian Potongan (Deductions)
                </div>
                <div className="space-y-1.5 divide-y divide-border/60">
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Potongan Kasbon Karyawan</span>
                    <span className="font-mono font-semibold text-danger">
                      {selectedRecord.advanceDeduction > 0 ? `-${formatRupiah(selectedRecord.advanceDeduction)}` : "Rp 0"}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Potongan Keterlambatan / Alpha</span>
                    <span className="font-mono text-text-muted">Rp 0</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-text-muted">Potongan Lain-lain</span>
                    <span className="font-mono text-text-muted">Rp 0</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-danger">
                    <span>Total Potongan</span>
                    <span className="font-mono">-{formatRupiah(selectedRecord.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Pay Highlight Box */}
            <div className="rounded-lg border border-gold-bright/40 bg-gold-bright/10 p-4 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">
                TAKE-HOME PAY (GAJI BERSIH DITERIMA)
              </div>
              <div className="mt-1 font-mono text-3xl font-black text-gold-bright">
                {formatRupiah(selectedRecord.takeHomePay)}
              </div>
            </div>

            {/* Footer Audit Info */}
            <div className="rounded border border-border bg-surface p-2.5 text-[11px] text-text-faint">
              <div>Dihitung otomatis oleh sistem pada {selectedRecord.createdAt.slice(0, 10)}</div>
              {selectedRecord.approvedByName && (
                <div>Disetujui oleh: {selectedRecord.approvedByName} ({selectedRecord.approvedAt?.slice(0, 10)})</div>
              )}
              {selectedRecord.paidByName && (
                <div className="text-ok">Telah dicairkan / dibayar oleh: {selectedRecord.paidByName} ({selectedRecord.paidAt?.slice(0, 10)})</div>
              )}
              {selectedRecord.cancellationReason && (
                <div className="text-danger">Alasan dibatalkan: {selectedRecord.cancellationReason}</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Batalkan Slip */}
      <Modal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        eyebrow="Konfirmasi Pembatalan"
        title="Batalkan Slip Gaji"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>
              Kembali
            </Button>
            <Button variant="danger" onClick={handleConfirmCancel}>
              Batalkan Slip Gaji Ini
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-text-muted">
            Apakah Anda yakin ingin membatalkan slip gaji ini? Masukkan alasan pembatalan untuk audit trail:
          </p>
          <textarea
            rows={3}
            placeholder="Misal: Salah kalkulasi jam lembur / revisi hari kerja..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full rounded border border-border bg-surface-2 p-2.5 text-xs text-text focus:border-gold-bright focus:outline-none"
          />
        </div>
      </Modal>
    </ManajemenShell>
  );
}
