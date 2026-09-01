"use client";

import { dummyReminder } from "@/lib/data/dummy";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getCustomerReminderCandidates,
  recordReminderSent,
  getReminderLogs,
  generateWhatsAppUrl,
  formatWhatsAppPhone,
} from "@/lib/data";
import type { CustomerReminderCandidate, ReminderType, ReminderLog } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

type FilterTab = "all" | "haircut_routine" | "dormant_churn" | "upcoming_appointment";

export default function ManajemenRemindersPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [reminderVersion, setReminderVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [sendCandidate, setSendCandidate] = useState<CustomerReminderCandidate | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

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

  const allCandidates = useMemo(() => {
    if (!isClient) return [];
    void reminderVersion;
    return getCustomerReminderCandidates(selectedBranchId || undefined);
  }, [isClient, selectedBranchId, reminderVersion]);

  const allLogs = useMemo(() => {
    if (!isClient) return [];
    void reminderVersion;
    return getReminderLogs();
  }, [isClient, reminderVersion]);

  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((c) => {
      if (activeTab !== "all" && c.type !== activeTab) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.customer.name.toLowerCase().includes(q);
        const matchPhone = c.customer.phone.includes(q);
        if (!matchName && !matchPhone) return false;
      }

      return true;
    });
  }, [allCandidates, activeTab, searchQuery]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const totalEligible = allCandidates.filter((c) => c.isEligible).length;
    const routineCount = allCandidates.filter((c) => c.type === "haircut_routine").length;
    const dormantCount = allCandidates.filter((c) => c.type === "dormant_churn").length;
    const upcomingCount = allCandidates.filter((c) => c.type === "upcoming_appointment").length;

    return { totalEligible, routineCount, dormantCount, upcomingCount };
  }, [allCandidates]);

  function handleOpenSendModal(candidate: CustomerReminderCandidate) {
    setSendCandidate(candidate);
    setCustomMessage(candidate.suggestedMessage);
    setSendError(null);
  }

  function handleSendWhatsApp() {
    if (!employee || !sendCandidate) return;
    setSendError(null);

    const messageToSend = customMessage.trim();
    if (!messageToSend) {
      setSendError("Isi pesan WhatsApp tidak boleh kosong.");
      return;
    }

    try {
      // 1. Record log into storage
      recordReminderSent(sendCandidate.customer.id, sendCandidate.type, messageToSend, employee);

      // 2. Open WhatsApp Web / App
      const waUrl = generateWhatsAppUrl(sendCandidate.customer.phone, messageToSend);
      window.open(waUrl, "_blank", "noopener,noreferrer");

      // 3. Close modal & refresh state
      setSendCandidate(null);
      setReminderVersion((v) => v + 1);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Gagal mencatat pengiriman reminder.");
    }
  }

  function getReminderTypeBadge(type: ReminderType) {
    switch (type) {
      case "haircut_routine":
        return <Badge tone="warn">Rutin Potong (21-35 Hari)</Badge>;
      case "dormant_churn":
        return <Badge tone="danger">Berisiko Churn (&gt; 45 Hari)</Badge>;
      case "upcoming_appointment":
        return <Badge tone="ok">Konfirmasi Booking</Badge>;
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
      pageTitle="Customer Reminder & Engagement"
      activeNavId="reminders"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Siap Diingatkan</div>
            <div className="mt-1 text-2xl font-bold text-ok">{stats.totalEligible}</div>
            <div className="text-[11px] text-text-faint">Memenuhi Syarat &amp; Bebas Spam</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-warn">Rutin Potong Rambut</div>
            <div className="mt-1 text-2xl font-bold text-warn">{stats.routineCount}</div>
            <div className="text-[11px] text-text-faint">Siklus 21 – 35 Hari</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">Berisiko Churn</div>
            <div className="mt-1 text-2xl font-bold text-danger">{stats.dormantCount}</div>
            <div className="text-[11px] text-text-faint">Tidak Kunjung &gt; 45 Hari</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Konfirmasi Reservasi</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{stats.upcomingCount}</div>
            <div className="text-[11px] text-text-faint">Jadwal H-0 / H-1</div>
          </div>
        </div>

        {/* Action Bar & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "all"
                  ? "bg-gold-bright text-surface-0 font-bold"
                  : "bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              Semua ({allCandidates.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("haircut_routine")}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "haircut_routine"
                  ? "bg-warn text-surface-0 font-bold"
                  : "bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              Rutin Potong ({stats.routineCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dormant_churn")}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "dormant_churn"
                  ? "bg-danger text-white font-bold"
                  : "bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              Berisiko Churn ({stats.dormantCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upcoming_appointment")}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "upcoming_appointment"
                  ? "bg-ok text-surface-0 font-bold"
                  : "bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              Konfirmasi Booking ({stats.upcomingCount})
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="text"
              placeholder="Cari customer / no. HP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-52 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
            />
            <Button variant="ghost" onClick={() => setHistoryModalOpen(true)}>
              📜 Riwayat Pengiriman ({allLogs.length})
            </Button>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">CUSTOMER</th>
                <th className="px-3.5 py-2.5">TIER</th>
                <th className="px-3.5 py-2.5">TERAKHIR BERKUNJUNG</th>
                <th className="px-3.5 py-2.5">BARBER / RESERVASI</th>
                <th className="px-3.5 py-2.5">TIPE REMINDER</th>
                <th className="px-3.5 py-2.5">STATUS ANTI-SPAM</th>
                <th className="px-3.5 py-2.5">PREVIEW PESAN</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dummyReminder.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                dummyReminder.map((rem) => (
                  <tr key={rem.id} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5 font-bold">{rem.customer}</td>
                    <td className="px-3.5 py-2.5"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gold-bright/10 text-gold-bright">{rem.tier}</span></td>
                    <td className="px-3.5 py-2.5 font-mono text-text-muted">{rem.terakhir}</td>
                    <td className="px-3.5 py-2.5">{rem.barber}</td>
                    <td className="px-3.5 py-2.5">{rem.tipe}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-ok/10 text-ok">{rem.status}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-text-muted max-w-xs truncate" title={rem.pesan}>{rem.pesan}</td>
                    <td className="px-3.5 py-2.5 text-center"><button className="text-gold-bright">Kirim</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Preview & Kirim WhatsApp */}
      <Modal
        open={sendCandidate !== null}
        onClose={() => setSendCandidate(null)}
        eyebrow="WhatsApp Follow-up"
        title={`Kirim Pesan Pengingat · ${sendCandidate?.customer.name ?? ""}`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setSendCandidate(null)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSendWhatsApp}>
              Buka WhatsApp &amp; Catat Log
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {sendError && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 font-medium text-danger">
              {sendError}
            </div>
          )}

          <div className="rounded border border-border bg-surface-2 p-3">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-text-muted">Customer:</span>{" "}
                <span className="font-semibold text-text">{sendCandidate?.customer.name}</span>
              </div>
              <div>
                <span className="text-text-muted">Nomor WhatsApp:</span>{" "}
                <span className="font-mono font-semibold text-gold-bright">
                  {sendCandidate ? formatWhatsAppPhone(sendCandidate.customer.phone) : ""}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Kategori:</span>{" "}
                {sendCandidate && getReminderTypeBadge(sendCandidate.type)}
              </div>
              <div>
                <span className="text-text-muted">Kunjungan Terakhir:</span>{" "}
                <span className="text-text">{sendCandidate?.daysSinceLastVisit} hari lalu</span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-text-muted">ISI PESAN WHATSAPP (DAPAT DISESUAIKAN)</label>
            <textarea
              rows={4}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 p-2.5 text-xs text-text focus:border-gold-bright focus:outline-none"
            />
            <div className="mt-1 text-[10px] text-text-faint">
              * Tombol &quot;Buka WhatsApp &amp; Catat Log&quot; akan membuka chat WhatsApp dengan pesan di atas dan mencatat status pengiriman ke log CRM.
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Riwayat Log Pengiriman */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        eyebrow="Audit CRM"
        title="Riwayat Reminder Terkirim"
        footer={
          <Button variant="ghost" onClick={() => setHistoryModalOpen(false)}>
            Tutup
          </Button>
        }
      >
        <div className="max-h-96 space-y-2 overflow-y-auto text-xs">
          {allLogs.length === 0 ? (
            <div className="py-8 text-center text-text-faint">Belum ada riwayat reminder yang tercatat.</div>
          ) : (
            allLogs.map((log) => (
              <div key={log.id} className="rounded border border-border bg-surface-2 p-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gold-bright">{log.customerName}</span>
                  <span className="text-text-faint">{new Date(log.sentAt).toLocaleString("id-ID")}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
                  <span>📱 {log.customerPhone}</span>
                  <span>•</span>
                  <span>Pengirim: {log.actorName}</span>
                </div>
                <div className="mt-1.5 rounded bg-surface/80 p-2 text-[11px] italic text-text-muted">
                  &quot;{log.message}&quot;
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </ManajemenShell>
  );
}
