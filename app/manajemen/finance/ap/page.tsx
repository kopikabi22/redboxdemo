"use client";

import { dummyAP } from "@/lib/data/dummy";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getAccountsPayable,
  getAccountsPayableById,
  recordAPPayment,
  formatRupiah,
  todayDateString,
} from "@/lib/data";
import type { AccountsPayableRecord, APPaymentStatus } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function ManajemenAccountsPayablePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [apVersion, setAPVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedAPId, setSelectedAPId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"Transfer" | "Cash" | "Debit">("Transfer");
  const [payBankRef, setPayBankRef] = useState("");
  const [payDate, setPayDate] = useState(() => todayDateString());
  const [payNotes, setPayNotes] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

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

  const allAP = useMemo(() => {
    if (!isClient) return [];
    void apVersion;
    const st = statusFilter !== "all" ? (statusFilter as APPaymentStatus) : undefined;
    return getAccountsPayable(selectedBranchId || undefined, st);
  }, [isClient, selectedBranchId, statusFilter, apVersion]);

  const selectedAP = useMemo(() => {
    if (!selectedAPId || !isClient) return null;
    void apVersion;
    return getAccountsPayableById(selectedAPId) ?? null;
  }, [selectedAPId, isClient, apVersion]);

  // Statistics
  const stats = useMemo(() => {
    const today = todayDateString();
    const totalPOValue = allAP.reduce((sum, ap) => sum + ap.totalAmount, 0);
    const totalRemaining = allAP.reduce((sum, ap) => sum + ap.remainingBalance, 0);
    const totalPaid = allAP.reduce((sum, ap) => sum + ap.paidAmount, 0);
    const overdueCount = allAP.filter((ap) => ap.status !== "paid" && ap.dueDate <= today).length;

    return { totalPOValue, totalRemaining, totalPaid, overdueCount };
  }, [allAP]);

  function handleOpenPay(ap: AccountsPayableRecord) {
    setSelectedAPId(ap.id);
    setPayAmount(String(ap.remainingBalance));
    setPayMethod("Transfer");
    setPayBankRef("");
    setPayDate(todayDateString());
    setPayNotes("");
    setPayError(null);
    setPayModalOpen(true);
  }

  function handleSavePayment() {
    if (!employee || !selectedAP) return;
    setPayError(null);

    const amountNum = parseInt(payAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayError("Nominal pembayaran harus lebih dari Rp 0.");
      return;
    }

    if (amountNum > selectedAP.remainingBalance) {
      setPayError(
        `Nominal pembayaran melebihi sisa tagihan (${formatRupiah(selectedAP.remainingBalance)}).`,
      );
      return;
    }

    try {
      recordAPPayment(
        selectedAP.id,
        {
          amount: amountNum,
          paymentMethod: payMethod,
          bankReference: payBankRef.trim() || undefined,
          notes: payNotes.trim() || undefined,
          date: payDate,
        },
        employee,
      );

      setPayModalOpen(false);
      setAPVersion((v) => v + 1);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Gagal mencatat pembayaran hutang.");
    }
  }

  function getStatusBadge(status: APPaymentStatus) {
    switch (status) {
      case "unpaid":
        return <Badge tone="danger">Belum Dibayar</Badge>;
      case "partial":
        return <Badge tone="warn">Dibayar Sebagian</Badge>;
      case "paid":
        return <Badge tone="ok">Lunas (Paid)</Badge>;
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
      pageTitle="Hutang Dagang & Tagihan Supplier (AP)"
      activeNavId="finance_ap"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Nilai Tagihan PO</div>
            <div className="mt-1 text-2xl font-bold text-text">{formatRupiah(stats.totalPOValue)}</div>
            <div className="text-[11px] text-text-faint">Seluruh pembelian supplier</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">Sisa Hutang Belum Lunas</div>
            <div className="mt-1 text-2xl font-bold text-danger">{formatRupiah(stats.totalRemaining)}</div>
            <div className="text-[11px] text-text-faint">Kewajiban bayar tempo aktif</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Total Telah Dibayarkan</div>
            <div className="mt-1 text-2xl font-bold text-ok">{formatRupiah(stats.totalPaid)}</div>
            <div className="text-[11px] text-text-faint">Akumulasi pelunasan PO</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Jatuh Tempo Hari Ini/Lewat</div>
            <div className="mt-1 text-2xl font-bold text-warn">{stats.overdueCount} Tagihan</div>
            <div className="text-[11px] text-text-faint">Perlu segera diselesaikan</div>
          </div>
        </div>

        {/* Action Bar & Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex items-center gap-2.5 text-xs">
            <label className="font-bold text-text-muted">STATUS TAGIHAN:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="unpaid">Belum Dibayar (Unpaid)</option>
              <option value="partial">Dibayar Sebagian (Partial)</option>
              <option value="paid">Lunas (Paid)</option>
            </select>
          </div>

          <div className="text-xs text-text-faint">
            ℹ️ Data tagihan tersinkronisasi otomatis saat status PO berubah menjadi <span className="font-bold text-ok">Received</span>.
          </div>
        </div>

        {/* AP Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NO. PO</th>
                <th className="px-3.5 py-2.5">SUPPLIER</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">TGL DITERIMA</th>
                <th className="px-3.5 py-2.5">JATUH TEMPO</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL TAGIHAN</th>
                <th className="px-3.5 py-2.5 text-right">TERBAYAR</th>
                <th className="px-3.5 py-2.5 text-right">SISA HUTANG</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">\n              {dummyAP.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummyAP.map((ap, i) => (
                  <tr key={i} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{ap.po}</td>
                    <td className="px-3.5 py-2.5 font-bold">{ap.supplier}</td>
                    <td className="px-3.5 py-2.5">{ap.cabang}</td>
                    <td className="px-3.5 py-2.5">{ap.tglTerima}</td>
                    <td className="px-3.5 py-2.5 font-bold text-danger">{ap.jatuhTempo}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono">{ap.totalTagihan.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-ok">{ap.terbayar.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-danger">{ap.sisaHutang.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
                    <td className="px-3.5 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ap.status === 'Lunas' ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'}`}>{ap.status}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center"><button className="text-gold-bright">Detail</button></td>
                  </tr>
                ))
              )}\n            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Bayar Hutang Supplier */}
      {selectedAP && (
        <Modal
          open={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          eyebrow="Pelunasan Supplier"
          title={`Pembayaran AP: ${selectedAP.poNumber}`}
          footer={
            <div className="flex w-full justify-end gap-2">
              <Button variant="ghost" onClick={() => setPayModalOpen(false)}>
                Tutup
              </Button>
              {selectedAP.status !== "paid" && (
                <Button variant="primary" onClick={handleSavePayment}>
                  Simpan Pembayaran
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {payError && (
              <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
                {payError}
              </div>
            )}

            {/* Summary Box */}
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-text-muted">Supplier:</span>{" "}
                  <span className="font-semibold text-text">{selectedAP.supplierName}</span>
                </div>
                <div>
                  <span className="text-text-muted">Cabang:</span>{" "}
                  <span className="font-semibold text-text">{selectedAP.branchName}</span>
                </div>
                <div>
                  <span className="text-text-muted">Total Tagihan PO:</span>{" "}
                  <span className="font-mono font-bold text-text">{formatRupiah(selectedAP.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-text-muted">Sisa Hutang:</span>{" "}
                  <span className="font-mono font-bold text-danger">{formatRupiah(selectedAP.remainingBalance)}</span>
                </div>
              </div>
            </div>

            {/* Form Input Pembayaran Baru */}
            {selectedAP.status !== "paid" ? (
              <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
                <div className="font-bold uppercase tracking-wider text-gold-bright">
                  Catat Angsuran / Pelunasan
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block font-bold text-text-muted">NOMINAL BAYAR (RP)</label>
                    <input
                      type="number"
                      min="1000"
                      max={selectedAP.remainingBalance}
                      step="50000"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-text focus:border-gold-bright focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-text-muted">METODE BAYAR</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as "Transfer" | "Cash" | "Debit")}
                      className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                    >
                      <option value="Transfer">Transfer Bank</option>
                      <option value="Cash">Cash / Tunai</option>
                      <option value="Debit">Debit</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block font-bold text-text-muted">TANGGAL PEMBAYARAN</label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-text-muted">NO. REFERENSI / BUKTI TRANSFER</label>
                    <input
                      type="text"
                      placeholder="Misal: TRF-BCA-98721"
                      value={payBankRef}
                      onChange={(e) => setPayBankRef(e.target.value)}
                      className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-text-muted">CATATAN</label>
                  <input
                    type="text"
                    placeholder="Misal: Pelunasan termin 1..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded border border-ok/40 bg-ok/10 p-3 text-center font-bold text-ok">
                ✓ Tagihan PO ini telah LUNAS sepenuhnya.
              </div>
            )}

            {/* Riwayat Pembayaran */}
            <div>
              <div className="mb-1.5 font-bold uppercase tracking-wider text-text-muted">
                Riwayat Pembayaran ({selectedAP.payments.length})
              </div>
              <div className="max-h-40 overflow-y-auto rounded border border-border bg-surface-2">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-border bg-surface text-text-muted">
                    <tr>
                      <th className="px-2.5 py-1.5">TANGGAL</th>
                      <th className="px-2.5 py-1.5">METODE</th>
                      <th className="px-2.5 py-1.5">REFERENSI</th>
                      <th className="px-2.5 py-1.5 text-right">NOMINAL</th>
                      <th className="px-2.5 py-1.5">PETUGAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedAP.payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-text-faint">
                          Belum ada catatan angsuran pembayaran.
                        </td>
                      </tr>
                    ) : (
                      selectedAP.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-2.5 py-1.5 text-text-muted">{p.date}</td>
                          <td className="px-2.5 py-1.5 font-medium text-text">{p.paymentMethod}</td>
                          <td className="px-2.5 py-1.5 text-text-faint">{p.bankReference || "-"}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono font-bold text-ok">
                            {formatRupiah(p.amount)}
                          </td>
                          <td className="px-2.5 py-1.5 text-text-faint">{p.paidByName}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ManajemenShell>
  );
}
