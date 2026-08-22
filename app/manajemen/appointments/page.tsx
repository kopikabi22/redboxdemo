"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getAppointments,
  formatRupiah,
} from "@/lib/data";
import type { Appointment, AppointmentStatus, AppointmentType } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ManajemenAppointmentsPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [dateFilter, setDateFilter] = useState(getTodayString());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

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

  const allAppointments = useMemo(() => {
    if (!isClient) return [];
    return getAppointments();
  }, [isClient]);

  const filteredAppointments = useMemo(() => {
    return allAppointments
      .filter((a) => {
        // Branch filter (if Owner chooses specific branch or BranchManager fixed to own branch)
        if (selectedBranchId && a.branchId !== selectedBranchId) {
          return false;
        }
        // Date filter
        if (dateFilter && a.date !== dateFilter) {
          return false;
        }
        // Status filter
        if (statusFilter !== "all" && a.status !== statusFilter) {
          return false;
        }
        // Type filter
        if (typeFilter !== "all" && a.type !== typeFilter) {
          return false;
        }
        // Search query (customer name, phone, barber, service)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCustomer = a.customer.name.toLowerCase().includes(q) || a.customer.phone.includes(q);
          const matchBarber = a.barberName.toLowerCase().includes(q);
          const matchService = (a.serviceName ?? "").toLowerCase().includes(q);
          const matchId = a.id.toLowerCase().includes(q);
          if (!matchCustomer && !matchBarber && !matchService && !matchId) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by date desc then start time asc
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return a.startTime.localeCompare(b.startTime);
      });
  }, [allAppointments, selectedBranchId, dateFilter, statusFilter, typeFilter, searchQuery]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const total = filteredAppointments.length;
    const completed = filteredAppointments.filter((a) => a.status === "completed" || a.status === "paid").length;
    const noShowOrCancel = filteredAppointments.filter((a) => a.status === "no_show" || a.status === "cancelled").length;
    const homeOrWedding = filteredAppointments.filter((a) => a.type === "home_service" || a.type === "wedding").length;
    const revenue = filteredAppointments
      .filter((a) => a.status === "paid" || a.status === "completed")
      .reduce((sum, a) => sum + a.price, 0);

    return { total, completed, noShowOrCancel, homeOrWedding, revenue };
  }, [filteredAppointments]);

  function getStatusTone(status: AppointmentStatus) {
    switch (status) {
      case "booked":
        return "neutral";
      case "checked_in":
        return "gold";
      case "in_service":
        return "warn";
      case "completed":
      case "paid":
        return "ok";
      case "cancelled":
      case "no_show":
        return "danger";
      default:
        return "neutral";
    }
  }

  function getStatusLabel(status: AppointmentStatus) {
    switch (status) {
      case "booked":
        return "Terjadwal";
      case "checked_in":
        return "Checked In";
      case "in_service":
        return "Sedang Servis";
      case "completed":
        return "Selesai";
      case "paid":
        return "Lunas";
      case "cancelled":
        return "Batal";
      case "no_show":
        return "No-Show";
      default:
        return status;
    }
  }

  function getTypeLabel(type: AppointmentType) {
    switch (type) {
      case "regular":
        return "In-Store";
      case "walk_in":
        return "Walk-In";
      case "home_service":
        return "Home Service";
      case "wedding":
        return "Wedding";
      default:
        return type;
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
      pageTitle="Reservasi & Antrean"
      activeNavId="appointments"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Reservasi</div>
            <div className="mt-1 text-2xl font-bold text-text">{stats.total}</div>
            <div className="text-[11px] text-text-faint">Sesuai filter aktif</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">Selesai / Lunas</div>
            <div className="mt-1 text-2xl font-bold text-ok">{stats.completed}</div>
            <div className="text-[11px] text-text-faint">Telah dilayani</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">No-Show / Batal</div>
            <div className="mt-1 text-2xl font-bold text-danger">{stats.noShowOrCancel}</div>
            <div className="text-[11px] text-text-faint">Tidak hadir / cancel</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">Home & Wedding</div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">{stats.homeOrWedding}</div>
            <div className="text-[11px] text-text-faint">Layanan luar cabang</div>
          </div>
          <div className="col-span-2 rounded-lg border border-border bg-surface p-3.5 md:col-span-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Nilai Servis</div>
            <div className="mt-1 text-xl font-bold text-gold-bright">{formatRupiah(stats.revenue)}</div>
            <div className="text-[11px] text-text-faint">Omset selesai / paid</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">TANGGAL</label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter("")}
                    className="text-[11px] text-text-muted hover:text-text"
                    title="Tampilkan Semua Tanggal"
                  >
                    Semua
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">STATUS</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="booked">Terjadwal (Booked)</option>
                <option value="checked_in">Checked In</option>
                <option value="in_service">Sedang Servis</option>
                <option value="completed">Selesai</option>
                <option value="paid">Lunas</option>
                <option value="cancelled">Dibatalkan</option>
                <option value="no_show">No-Show</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">TIPE</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Tipe</option>
                <option value="regular">In-Store Reguler</option>
                <option value="walk_in">Walk-In</option>
                <option value="home_service">Home Service</option>
                <option value="wedding">Wedding Grooming</option>
              </select>
            </div>
          </div>

          <div className="w-full md:w-64">
            <label className="mb-1 block text-[11px] font-bold text-text-muted">CARI</label>
            <input
              type="text"
              placeholder="Cari konsumen / barber / servis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">WAKTU & TANGGAL</th>
                <th className="px-3.5 py-2.5">CABANG</th>
                <th className="px-3.5 py-2.5">ANTREAN</th>
                <th className="px-3.5 py-2.5">TIPE</th>
                <th className="px-3.5 py-2.5">KONSUMEN</th>
                <th className="px-3.5 py-2.5">BARBER</th>
                <th className="px-3.5 py-2.5">LAYANAN / PAKET</th>
                <th className="px-3.5 py-2.5 text-right">HARGA</th>
                <th className="px-3.5 py-2.5">STATUS</th>
                <th className="px-3.5 py-2.5 text-center">DETAIL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-text-faint">
                    Tidak ada data reservasi yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => {
                  const branchObj = branches.find((b) => b.id === appt.branchId);
                  return (
                    <tr key={appt.id} className="hover:bg-surface-2/60">
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-text">{appt.date}</div>
                        <div className="font-mono text-[11px] text-text-muted">
                          {appt.startTime} - {appt.endTime}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="font-semibold">{branchObj?.name ?? appt.branchId}</span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="rounded bg-gold-bright/15 px-1.5 py-0.5 font-mono font-bold text-gold-bright">
                          #{appt.queueNumber ?? "—"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="text-[11px] font-semibold text-text-muted">{getTypeLabel(appt.type)}</span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-text">
                          {appt.customer.name}{" "}
                          {appt.customer.type === "member" && (
                            <span className="rounded bg-gold-bright/15 px-1 py-0.2 text-[10px] text-gold-bright">
                              {appt.customer.tier}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-text-faint">{appt.customer.phone}</div>
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-gold-bright">💈 {appt.barberName}</td>
                      <td className="px-3.5 py-2.5">
                        <div>{appt.serviceName}</div>
                        {appt.paxCount > 1 && (
                          <div className="text-[11px] text-text-muted">{appt.paxCount} Orang</div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-text">{formatRupiah(appt.price)}</td>
                      <td className="px-3.5 py-2.5">
                        <Badge tone={getStatusTone(appt.status)}>{getStatusLabel(appt.status)}</Badge>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-[11px]"
                          onClick={() => setSelectedAppointment(appt)}
                        >
                          Lihat
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Appointment */}
      <Modal
        open={selectedAppointment !== null}
        onClose={() => setSelectedAppointment(null)}
        eyebrow="Rincian Reservasi"
        title={selectedAppointment ? `Antrean #${selectedAppointment.queueNumber ?? "—"} · ${selectedAppointment.id}` : ""}
        footer={
          <Button variant="primary" fullWidth onClick={() => setSelectedAppointment(null)}>
            Tutup
          </Button>
        }
      >
        {selectedAppointment && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 border-b border-border pb-2.5">
              <div>
                <span className="text-text-muted">Cabang:</span>
                <div className="font-semibold">{branches.find((b) => b.id === selectedAppointment.branchId)?.name ?? selectedAppointment.branchId}</div>
              </div>
              <div>
                <span className="text-text-muted">Status:</span>
                <div>
                  <Badge tone={getStatusTone(selectedAppointment.status)}>
                    {getStatusLabel(selectedAppointment.status)}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-text-muted">Tanggal & Jam:</span>
                <div className="font-semibold">
                  {selectedAppointment.date} ({selectedAppointment.startTime} - {selectedAppointment.endTime})
                </div>
              </div>
              <div>
                <span className="text-text-muted">Durasi:</span>
                <div className="font-semibold">{selectedAppointment.durationMinutes} Menit</div>
              </div>
            </div>

            <div className="space-y-1.5 border-b border-border pb-2.5">
              <div className="flex justify-between">
                <span className="text-text-muted">Konsumen:</span>
                <span className="font-bold">{selectedAppointment.customer.name} ({selectedAppointment.customer.type})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">No. HP:</span>
                <span className="font-mono">{selectedAppointment.customer.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Barber Bertugas:</span>
                <span className="font-bold text-gold-bright">💈 {selectedAppointment.barberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Layanan / Paket:</span>
                <span>{selectedAppointment.serviceName}</span>
              </div>
              {selectedAppointment.paxCount > 1 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Jumlah Orang (Pax):</span>
                  <span>{selectedAppointment.paxCount} Orang</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span className="text-text-muted">Harga / Biaya:</span>
                <span className="text-gold-bright">{formatRupiah(selectedAppointment.price)}</span>
              </div>
            </div>

            {selectedAppointment.address && (
              <div className="rounded bg-surface-2 p-2.5">
                <div className="font-bold text-text">📍 Lokasi Kunjungan</div>
                <div className="mt-1 text-text-muted">{selectedAppointment.address}</div>
                {selectedAppointment.distanceKm !== null && (
                  <div className="mt-0.5 text-gold-bright">Jarak: {selectedAppointment.distanceKm} KM</div>
                )}
              </div>
            )}

            {selectedAppointment.notes && (
              <div className="rounded bg-surface-2/60 p-2.5">
                <div className="font-bold text-text">📝 Catatan</div>
                <div className="mt-0.5 italic text-text-muted">{selectedAppointment.notes}</div>
              </div>
            )}

            {selectedAppointment.noShowReason && (
              <div className="rounded border border-danger/40 bg-danger/10 p-2.5 text-danger">
                <div className="font-bold">❌ Alasan No-Show</div>
                <div className="mt-0.5">{selectedAppointment.noShowReason}</div>
              </div>
            )}

            {selectedAppointment.transactionId && (
              <div className="flex justify-between border-t border-border pt-2 text-ok">
                <span>No. Transaksi Kasir:</span>
                <span className="font-mono font-bold">{selectedAppointment.transactionId}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </ManajemenShell>
  );
}
