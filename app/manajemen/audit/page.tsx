"use client";

import { dummyAuditLog } from "@/lib/data/dummy";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getAuditLogs,
} from "@/lib/data";
import type { AuditLogRecord } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

const ACTION_LABELS: Record<string, string> = {
  SET_BRANCH_TARGET: "Penetapan Target",
  VOID_TRANSACTION: "Void Transaksi",
  REFUND_TRANSACTION: "Refund Transaksi",
  APPROVE_PO: "Approval PO",
  RECEIVE_PO: "Penerimaan PO",
  DISPATCH_TRANSFER: "Kirim Transfer Stok",
  RECEIVE_TRANSFER: "Terima Transfer Stok",
  COMPLETE_OPNAME: "Penyelesaian Opname",
  APPROVE_PAYROLL: "Approval Payroll",
  PAY_PAYROLL: "Pembayaran Payroll",
  CREATE_EXPENSE: "Catat Pengeluaran",
  DELETE_EXPENSE: "Hapus Pengeluaran",
  PAY_AP: "Pembayaran AP Supplier",
  STOCK_ADJUSTMENT: "Penyesuaian Stok",
  PRICE_OVERRIDE: "Override Harga",
  ROLE_CHANGE: "Perubahan Role",
};

export default function ManajemenAuditPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Detail State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

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

  const allLogs = useMemo(() => {
    if (!isClient) return [];
    const act = actionFilter !== "all" ? actionFilter : undefined;
    return getAuditLogs(selectedBranchId || undefined, act);
  }, [isClient, selectedBranchId, actionFilter]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return allLogs;
    const q = searchQuery.toLowerCase();
    return allLogs.filter(
      (l) =>
        l.details.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        l.entityId.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q),
    );
  }, [allLogs, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const totalLogs = filteredLogs.length;
    const sensitiveActions = [
      "VOID_TRANSACTION",
      "REFUND_TRANSACTION",
      "STOCK_ADJUSTMENT",
      "DELETE_EXPENSE",
      "COMPLETE_OPNAME",
      "APPROVE_PAYROLL",
    ];
    const sensitiveCount = filteredLogs.filter((l) => sensitiveActions.includes(l.action)).length;
    const uniqueActors = new Set(filteredLogs.map((l) => l.actorId)).size;

    return { totalLogs, sensitiveCount, uniqueActors };
  }, [filteredLogs]);

  function handleOpenDetail(log: AuditLogRecord) {
    setSelectedLog(log);
    setModalOpen(true);
  }

  function getActionBadge(action: string) {
    if (action.includes("VOID") || action.includes("DELETE") || action.includes("REFUND")) {
      return <Badge tone="danger">{ACTION_LABELS[action] || action}</Badge>;
    }
    if (action.includes("APPROVE") || action.includes("TARGET") || action.includes("COMPLETE")) {
      return <Badge tone="gold">{ACTION_LABELS[action] || action}</Badge>;
    }
    if (action.includes("RECEIVE") || action.includes("PAY")) {
      return <Badge tone="ok">{ACTION_LABELS[action] || action}</Badge>;
    }
    return <Badge tone="neutral">{ACTION_LABELS[action] || action}</Badge>;
  }

  function formatTimestamp(isoString: string) {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
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
      pageTitle="Audit Trail & Log Sistem"
      activeNavId="audit"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Log Aktivitas</div>
            <div className="mt-1 text-2xl font-bold text-text">{stats.totalLogs}</div>
            <div className="text-[11px] text-text-faint">Jejak audit append-only tersimpan</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">Aksi Kritis &amp; Sensitif</div>
            <div className="mt-1 text-2xl font-bold text-danger">{stats.sensitiveCount}</div>
            <div className="text-[11px] text-text-faint">Void, Hapus, Opname &amp; Approval Payroll</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Petugas Aktif</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{stats.uniqueActors} Petugas</div>
            <div className="text-[11px] text-text-faint">Melakukan transaksi / perubahan data</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">JENIS AKSI:</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Jenis Aksi</option>
                {Object.keys(ACTION_LABELS).map((act) => (
                  <option key={act} value={act}>
                    {ACTION_LABELS[act]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">CARI LOG:</label>
              <input
                type="text"
                placeholder="Cari nama, ID entitas, deskripsi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="text-[11px] text-text-faint">
            🔒 Log audit bersifat <span className="font-semibold text-gold-bright">Immutable</span> (tidak dapat diubah/dihapus).
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">WAKTU (WIB)</th>
                <th className="px-3.5 py-2.5">PETUGAS / AKTOR</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">JENIS AKSI</th>
                <th className="px-3.5 py-2.5">ENTITAS &amp; ID</th>
                <th className="px-3.5 py-2.5">RINCIAN DESKRIPSI</th>
                <th className="px-3.5 py-2.5 text-center">SNAPSHOT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">\n              {dummyAuditLog.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummyAuditLog.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-mono text-gold-bright">{log.waktu}</td>
                    <td className="px-3.5 py-2.5 font-bold">{log.petugas}</td>
                    <td className="px-3.5 py-2.5">{log.cabang}</td>
                    <td className="px-3.5 py-2.5">{log.jenis}</td>
                    <td className="px-3.5 py-2.5 font-mono">{log.entitas}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{log.deskripsi}</td>
                    <td className="px-3.5 py-2.5 text-center">
                      <button className="text-gold-bright">Lihat</button>
                    </td>
                  </tr>
                ))
              )}\n            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Snapshot Log */}
      {selectedLog && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          eyebrow="Audit Snapshot"
          title={`Log Audit: ${selectedLog.id}`}
          footer={
            <div className="flex w-full justify-end">
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Tutup
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-text-muted">Timestamp:</span>{" "}
                  <span className="font-mono font-semibold text-text">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-text-muted">Petugas:</span>{" "}
                  <span className="font-semibold text-text">{selectedLog.actorName} ({selectedLog.actorRole})</span>
                </div>
                <div>
                  <span className="text-text-muted">Cabang:</span>{" "}
                  <span className="font-semibold text-text">{selectedLog.branchName}</span>
                </div>
                <div>
                  <span className="text-text-muted">Aksi:</span>{" "}
                  <span className="font-bold text-gold-bright">{selectedLog.action}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-text-muted">Entitas:</span>{" "}
                  <span className="font-mono text-text">{selectedLog.entityType} (ID: {selectedLog.entityId})</span>
                </div>
                <div className="col-span-2">
                  <span className="text-text-muted">Keterangan:</span>{" "}
                  <span className="text-text">{selectedLog.details}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 font-bold uppercase tracking-wider text-text-muted">
                Metadata &amp; State Snapshot
              </div>
              <pre className="max-h-60 overflow-auto rounded border border-border bg-bg p-3 font-mono text-[11px] text-text-muted">
                {selectedLog.metadata
                  ? JSON.stringify(selectedLog.metadata, null, 2)
                  : "// Tidak ada metadata tambahan"}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </ManajemenShell>
  );
}
