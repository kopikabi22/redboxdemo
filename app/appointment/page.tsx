"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranchById,
  getEmployees,
  getServices,
  getCustomers,
  getAppointments,
  createAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  markNoShow,
  formatRupiah,
  HOME_SERVICE_PRICING,
  WEDDING_GROOMING_PRICING,
} from "@/lib/data";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  HomeServicePackage,
  WeddingPackage,
  TransactionCustomer,
} from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { AppShell, getNavItemsForRole } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AppointmentPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;
  const branch = session ? getBranchById(session.branchId) : undefined;

  const [dateFilter, setDateFilter] = useState(getTodayString());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [version, setVersion] = useState(0);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"in_store" | "home_service" | "wedding">("in_store");
  const [modalError, setModalError] = useState<string | null>(null);

  // Reason Modal for Cancel / No-Show
  const [reasonModal, setReasonModal] = useState<{
    open: boolean;
    appointmentId: string | null;
    action: "cancel" | "no_show";
    reason: string;
    error: string | null;
  }>({
    open: false,
    appointmentId: null,
    action: "cancel",
    reason: "",
    error: null,
  });

  // Form fields
  const [bookingType, setBookingType] = useState<"regular" | "walk_in">("regular");
  const [customerMode, setCustomerMode] = useState<"member" | "guest">("guest");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [formDate, setFormDate] = useState(getTodayString());
  const [formTime, setFormTime] = useState("10:00");
  const [formNotes, setFormNotes] = useState("");

  // Home Service fields
  const [homePkg, setHomePkg] = useState<HomeServicePackage>("single");
  const [homePax, setHomePax] = useState(1);
  const [homeAddress, setHomeAddress] = useState("");
  const [homeDistance, setHomeDistance] = useState<number>(2.0);

  // Wedding fields
  const [weddingPkg, setWeddingPkg] = useState<WeddingPackage>("gentleman");
  const [weddingAddress, setWeddingAddress] = useState("");
  const [weddingDistance, setWeddingDistance] = useState<number>(3.0);

  useEffect(() => {
    if (!isClient) return;
    if (!session) {
      router.replace("/login");
    } else if (session.role === "Barber") {
      setBarberFilter(session.id);
    }
  }, [isClient, session, router]);

  const barbers = useMemo(() => {
    if (!session) return [];
    return getEmployees().filter((e) => e.role === "Barber" && e.branchId === session.branchId);
  }, [session]);

  const services = useMemo(() => {
    return getServices().filter((s) => s.category !== "Membership");
  }, []);

  const members = useMemo(() => {
    return getCustomers().filter((c) => c.type === "member");
  }, []);

  const appointments = useMemo(() => {
    void version;
    if (!session) return [];
    return getAppointments()
      .filter((a) => a.branchId === session.branchId && a.date === dateFilter)
      .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
      .filter((a) => (barberFilter === "all" ? true : a.barberId === barberFilter))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [session, dateFilter, statusFilter, barberFilter, version]);

  function handleLogout() {
    clearSession("karyawan");
    router.replace("/login");
  }

  function handleStatusTransition(id: string, nextStatus: AppointmentStatus) {
    try {
      updateAppointmentStatus(id, nextStatus);
      setVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui status.");
    }
  }

  function handleOpenReasonModal(id: string, action: "cancel" | "no_show") {
    setReasonModal({
      open: true,
      appointmentId: id,
      action,
      reason: "",
      error: null,
    });
  }

  function handleConfirmReason() {
    if (!reasonModal.appointmentId) return;
    if (reasonModal.action === "no_show" && !reasonModal.reason.trim()) {
      setReasonModal((prev) => ({ ...prev, error: "Alasan No-Show wajib diisi." }));
      return;
    }

    try {
      if (reasonModal.action === "cancel") {
        cancelAppointment(reasonModal.appointmentId, reasonModal.reason.trim() || undefined);
      } else {
        markNoShow(reasonModal.appointmentId, reasonModal.reason.trim());
      }
      setReasonModal({ open: false, appointmentId: null, action: "cancel", reason: "", error: null });
      setVersion((v) => v + 1);
    } catch (err) {
      setReasonModal((prev) => ({ ...prev, error: err instanceof Error ? err.message : "Terjadi kesalahan." }));
    }
  }

  function handleOpenCreateModal() {
    setModalError(null);
    setSelectedBarberId(barbers[0]?.id ?? "");
    setSelectedServiceId(services[0]?.id ?? "");
    setFormDate(dateFilter);
    setFormTime("10:00");
    setGuestName("");
    setGuestPhone("");
    setFormNotes("");
    setIsCreateModalOpen(true);
  }

  function handleCreateAppointmentSubmit(event: React.FormEvent) {
    event.preventDefault();
    setModalError(null);
    if (!session) return;

    let customerPayload: TransactionCustomer;
    if (customerMode === "member") {
      const member = members.find((m) => m.id === selectedCustomerId);
      if (!member) {
        setModalError("Pilih customer member.");
        return;
      }
      customerPayload = {
        type: "member",
        customerId: member.id,
        name: member.name,
        phone: member.phone,
        tier: member.tier,
        preferences: member.preferences,
      };
    } else {
      if (!guestName.trim() || !guestPhone.trim()) {
        setModalError("Nama dan nomor HP wajib diisi.");
        return;
      }
      customerPayload = {
        type: "guest",
        customerId: null,
        name: guestName.trim(),
        phone: guestPhone.trim(),
        tier: null,
      };
    }

    if (!selectedBarberId) {
      setModalError("Pilih barber yang bertugas.");
      return;
    }

    try {
      if (modalTab === "in_store") {
        if (!selectedServiceId) {
          setModalError("Pilih layanan servis.");
          return;
        }
        createAppointment({
          branchId: session.branchId,
          customer: customerPayload,
          barberId: selectedBarberId,
          type: bookingType,
          serviceId: selectedServiceId,
          date: formDate,
          startTime: formTime,
          notes: formNotes,
        });
      } else if (modalTab === "home_service") {
        if (!homeAddress.trim()) {
          setModalError("Alamat wajib diisi untuk layanan Home Service.");
          return;
        }
        createAppointment({
          branchId: session.branchId,
          customer: customerPayload,
          barberId: selectedBarberId,
          type: "home_service",
          packageType: homePkg,
          paxCount: homePkg === "single" ? 1 : homePax,
          address: homeAddress.trim(),
          distanceKm: homeDistance,
          date: formDate,
          startTime: formTime,
          notes: formNotes,
        });
      } else if (modalTab === "wedding") {
        if (!weddingAddress.trim()) {
          setModalError("Alamat / Lokasi venue wajib diisi untuk Wedding Grooming.");
          return;
        }
        createAppointment({
          branchId: session.branchId,
          customer: customerPayload,
          barberId: selectedBarberId,
          type: "wedding",
          packageType: weddingPkg,
          address: weddingAddress.trim(),
          distanceKm: weddingDistance,
          date: formDate,
          startTime: formTime,
          notes: formNotes,
        });
      }

      setIsCreateModalOpen(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Gagal membuat reservasi.");
    }
  }

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
        return "Terjadwal (Booked)";
      case "checked_in":
        return "Checked In";
      case "in_service":
        return "Sedang Dilayani";
      case "completed":
        return "Selesai (Siap Bayar)";
      case "paid":
        return "Lunas (Terbayar)";
      case "cancelled":
        return "Dibatalkan";
      case "no_show":
        return "No-Show";
      default:
        return status;
    }
  }

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <AppShell
      employee={session}
      branch={branch}
      pageTitle="Appointment & Queue"
      navItems={getNavItemsForRole(session.role)}
      activeNavId="appointment"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">TANGGAL</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-text-muted">STATUS</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="booked">Terjadwal</option>
                <option value="checked_in">Checked In</option>
                <option value="in_service">Sedang Dilayani</option>
                <option value="completed">Selesai</option>
                <option value="paid">Lunas</option>
                <option value="cancelled">Dibatalkan</option>
                <option value="no_show">No-Show</option>
              </select>
            </div>
            {session.role !== "Barber" && (
              <div>
                <label className="mb-1 block text-[11px] font-bold text-text-muted">BARBER</label>
                <select
                  value={barberFilter}
                  onChange={(e) => setBarberFilter(e.target.value)}
                  className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text focus:border-gold-bright focus:outline-none"
                >
                  <option value="all">Semua Barber</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <Button variant="primary" onClick={handleOpenCreateModal}>
              + Buat Reservasi / Walk-In
            </Button>
          </div>
        </div>

        {/* Queue / Appointment Grid */}
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center text-text-muted">
            <span className="text-3xl">🗓️</span>
            <div className="text-sm font-semibold">Tidak ada jadwal reservasi atau antrean.</div>
            <div className="text-xs text-text-faint">
              Pilih tanggal lain atau klik tombol &quot;+ Buat Reservasi / Walk-In&quot; untuk menambahkan antrean.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition-colors hover:border-gold-bright/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gold-bright/20 px-2 py-0.5 font-mono text-xs font-extrabold text-gold-bright">
                        #{appt.queueNumber ?? "—"}
                      </span>
                      <span className="font-mono text-xs font-bold text-text">
                        ⏰ {appt.startTime} - {appt.endTime}
                      </span>
                    </div>
                    <Badge tone={getStatusTone(appt.status)}>{getStatusLabel(appt.status)}</Badge>
                  </div>

                  <div className="my-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Konsumen:</span>
                      <span className="font-semibold text-text">
                        {appt.customer.name}{" "}
                        {appt.customer.type === "member" && (
                          <span className="rounded bg-gold-bright/15 px-1 py-0.5 text-[10px] text-gold-bright">
                            {appt.customer.tier}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">No. HP:</span>
                      <span className="font-mono text-text-faint">{appt.customer.phone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Barber:</span>
                      <span className="font-semibold text-gold-bright">💈 {appt.barberName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Layanan / Paket:</span>
                      <span className="font-semibold text-text">{appt.serviceName}</span>
                    </div>
                    {appt.paxCount > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Jumlah Orang:</span>
                        <span className="font-semibold text-text">{appt.paxCount} Orang</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Biaya / Harga:</span>
                      <span className="font-bold text-text">{formatRupiah(appt.price)}</span>
                    </div>
                    {appt.address && (
                      <div className="mt-2 rounded bg-surface-2 p-2 text-[11.5px] text-text-muted">
                        📍 <span className="font-semibold text-text">{appt.address}</span>
                        {appt.distanceKm !== null && appt.distanceKm !== undefined && (
                          <span className="ml-1 text-gold-bright">({appt.distanceKm} KM)</span>
                        )}
                      </div>
                    )}
                    {appt.notes && (
                      <div className="rounded bg-surface-2/60 p-2 text-[11px] italic text-text-muted">
                        📝 {appt.notes}
                      </div>
                    )}
                    {appt.noShowReason && (
                      <div className="rounded border border-danger/40 bg-danger/10 p-2 text-[11px] text-danger">
                        ❌ Alasan No-Show: {appt.noShowReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div className="mt-2 border-t border-border pt-3">
                  {appt.status === "booked" && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        className="flex-1 text-xs"
                        onClick={() => handleStatusTransition(appt.id, "checked_in")}
                      >
                        Check In
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs text-danger hover:bg-danger/10"
                        onClick={() => handleOpenReasonModal(appt.id, "cancel")}
                      >
                        Batal
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs text-text-muted hover:bg-surface-2"
                        onClick={() => handleOpenReasonModal(appt.id, "no_show")}
                      >
                        No-Show
                      </Button>
                    </div>
                  )}

                  {appt.status === "checked_in" && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        className="flex-1 text-xs"
                        onClick={() => handleStatusTransition(appt.id, "in_service")}
                      >
                        Mulai Servis
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs text-danger hover:bg-danger/10"
                        onClick={() => handleOpenReasonModal(appt.id, "cancel")}
                      >
                        Batal
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs text-text-muted hover:bg-surface-2"
                        onClick={() => handleOpenReasonModal(appt.id, "no_show")}
                      >
                        No-Show
                      </Button>
                    </div>
                  )}

                  {appt.status === "in_service" && (
                    <Button
                      variant="primary"
                      fullWidth
                      className="text-xs font-bold"
                      onClick={() => handleStatusTransition(appt.id, "completed")}
                    >
                      ✓ Selesai Servis
                    </Button>
                  )}

                  {appt.status === "completed" && (
                    <div className="flex items-center justify-between rounded bg-ok/10 p-2 text-xs font-bold text-ok">
                      <span>✓ Siap Dibayar di POS</span>
                      <span className="text-[11px] font-normal text-text-muted">Tarik di Kasir POS</span>
                    </div>
                  )}

                  {appt.status === "paid" && (
                    <div className="flex items-center justify-between rounded bg-surface-2 p-2 text-xs font-bold text-text-muted">
                      <span>✓ Lunas</span>
                      <span className="font-mono text-[11px] text-gold-bright">{appt.transactionId}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Buat Reservasi */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        eyebrow="Reservasi Baru"
        title="Buat Reservasi & Antrean"
      >
        <form onSubmit={handleCreateAppointmentSubmit} className="space-y-4 text-xs">
          {modalError && (
            <div className="rounded-md border border-danger/40 bg-danger/10 p-2.5 text-danger">{modalError}</div>
          )}

          {/* Type Tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setModalTab("in_store")}
              className={`flex-1 border-b-2 py-2 text-center font-bold ${
                modalTab === "in_store"
                  ? "border-gold-bright text-gold-bright"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              In-Store / Walk-In
            </button>
            <button
              type="button"
              onClick={() => setModalTab("home_service")}
              className={`flex-1 border-b-2 py-2 text-center font-bold ${
                modalTab === "home_service"
                  ? "border-gold-bright text-gold-bright"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              Home Service
            </button>
            <button
              type="button"
              onClick={() => setModalTab("wedding")}
              className={`flex-1 border-b-2 py-2 text-center font-bold ${
                modalTab === "wedding"
                  ? "border-gold-bright text-gold-bright"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              Wedding Grooming
            </button>
          </div>

          {/* Customer Selection */}
          <div className="space-y-2 rounded-lg border border-border bg-surface-2/50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text">Data Konsumen</span>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="custMode"
                    checked={customerMode === "guest"}
                    onChange={() => setCustomerMode("guest")}
                  />
                  <span>Guest</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="custMode"
                    checked={customerMode === "member"}
                    onChange={() => setCustomerMode("member")}
                  />
                  <span>Member</span>
                </label>
              </div>
            </div>

            {customerMode === "member" ? (
              <div>
                <label className="mb-1 block text-text-muted">Pilih Member Terdaftar</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.phone}) - Tier {m.tier}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-text-muted">Nama Konsumen *</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-text-muted">Nomor HP *</label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Barber & Schedule */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-text-muted">Pilih Barber *</label>
              <select
                value={selectedBarberId}
                onChange={(e) => setSelectedBarberId(e.target.value)}
                className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                required
              >
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    💈 {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-text-muted">Tanggal *</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-text-muted">Jam Mulai *</label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                required
              />
            </div>
            {modalTab === "in_store" && (
              <div>
                <label className="mb-1 block font-semibold text-text-muted">Tipe Booking *</label>
                <select
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value as "regular" | "walk_in")}
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                >
                  <option value="regular">Booking Reservasi</option>
                  <option value="walk_in">Walk-In Langsung</option>
                </select>
              </div>
            )}
          </div>

          {/* In-Store Service selection */}
          {modalTab === "in_store" && (
            <div>
              <label className="mb-1 block font-semibold text-text-muted">Layanan Servis *</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} mnt) - {formatRupiah(s.price)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Home Service fields */}
          {modalTab === "home_service" && (
            <div className="space-y-3 rounded-lg border border-border bg-surface-2/30 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-text-muted">Paket Home Service</label>
                  <select
                    value={homePkg}
                    onChange={(e) => {
                      const val = e.target.value as HomeServicePackage;
                      setHomePkg(val);
                      if (val === "single") setHomePax(1);
                      else if (homePax < 2) setHomePax(2);
                    }}
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                  >
                    <option value="single">Single ({formatRupiah(HOME_SERVICE_PRICING.single)})</option>
                    <option value="family">Family ({formatRupiah(HOME_SERVICE_PRICING.family)}/orang, min 2)</option>
                  </select>
                </div>
                {homePkg === "family" && (
                  <div>
                    <label className="mb-1 block text-text-muted">Jumlah Orang (Min 2)</label>
                    <input
                      type="number"
                      min="2"
                      max="10"
                      value={homePax}
                      onChange={(e) => setHomePax(parseInt(e.target.value, 10) || 2)}
                      className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-text-muted">Alamat Lengkap Kunjungan *</label>
                <input
                  type="text"
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  placeholder="Jl. Nama Jalan No. XX, Kelurahan, Kota"
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-text-muted">Estimasi Jarak dari Cabang (Maks 5 KM) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5.0"
                    value={homeDistance}
                    onChange={(e) => setHomeDistance(parseFloat(e.target.value) || 0)}
                    className="w-24 rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                    required
                  />
                  <span className="text-text-muted">KM (Radius validasi RedBox)</span>
                </div>
              </div>
            </div>
          )}

          {/* Wedding Grooming fields */}
          {modalTab === "wedding" && (
            <div className="space-y-3 rounded-lg border border-border bg-surface-2/30 p-3">
              <div>
                <label className="mb-1 block text-text-muted">Paket Wedding Grooming</label>
                <select
                  value={weddingPkg}
                  onChange={(e) => setWeddingPkg(e.target.value as WeddingPackage)}
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                >
                  <option value="gentleman">Gentleman - 1 Orang ({formatRupiah(WEDDING_GROOMING_PRICING.gentleman)})</option>
                  <option value="silver">Silver - 2 Orang ({formatRupiah(WEDDING_GROOMING_PRICING.silver)})</option>
                  <option value="gold">Gold - 3 Orang ({formatRupiah(WEDDING_GROOMING_PRICING.gold)})</option>
                  <option value="platinum">Platinum - 4 Orang ({formatRupiah(WEDDING_GROOMING_PRICING.platinum)})</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-text-muted">Alamat / Lokasi Venue Acara *</label>
                <input
                  type="text"
                  value={weddingAddress}
                  onChange={(e) => setWeddingAddress(e.target.value)}
                  placeholder="Hotel / Gedung / Alamat Rumah"
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-text-muted">Estimasi Jarak dari Cabang (Maks 5 KM) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5.0"
                    value={weddingDistance}
                    onChange={(e) => setWeddingDistance(parseFloat(e.target.value) || 0)}
                    className="w-24 rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                    required
                  />
                  <span className="text-text-muted">KM (Radius validasi RedBox)</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-text-muted">Catatan Khusus (Opsional)</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Preferensi gaya, catatan request pelanggan..."
              rows={2}
              className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Simpan Reservasi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Alasan Batalkan / No-Show */}
      <Modal
        open={reasonModal.open}
        onClose={() => setReasonModal((prev) => ({ ...prev, open: false }))}
        eyebrow={reasonModal.action === "cancel" ? "Batalkan Reservasi" : "Tandai No-Show"}
        title={reasonModal.action === "cancel" ? "Konfirmasi Pembatalan" : "Catat Konsumen No-Show"}
      >
        <div className="space-y-3 text-xs">
          {reasonModal.error && (
            <div className="rounded-md border border-danger/40 bg-danger/10 p-2.5 text-danger">
              {reasonModal.error}
            </div>
          )}
          <p className="text-text-muted">
            {reasonModal.action === "cancel"
              ? "Masukkan alasan pembatalan reservasi (opsional):"
              : "Konsumen tidak hadir pada slot waktu yang ditentukan. Masukkan alasan no-show (wajib):"}
          </p>
          <textarea
            value={reasonModal.reason}
            onChange={(e) => setReasonModal((prev) => ({ ...prev, reason: e.target.value, error: null }))}
            placeholder="Alasan..."
            rows={3}
            className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
          />
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="ghost"
              onClick={() => setReasonModal((prev) => ({ ...prev, open: false }))}
            >
              Kembali
            </Button>
            <Button
              variant="primary"
              className={reasonModal.action === "cancel" ? "bg-danger hover:bg-danger/80" : ""}
              onClick={handleConfirmReason}
            >
              {reasonModal.action === "cancel" ? "Ya, Batalkan" : "Tandai No-Show"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
