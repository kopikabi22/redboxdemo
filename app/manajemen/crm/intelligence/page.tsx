"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getCustomerIntelligenceSummary,
  getCustomerRFMProfiles,
  formatRupiah,
} from "@/lib/data";
import type { CustomerRFMProfile, RFMSegment } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

const SEGMENT_NAMES: Record<RFMSegment, string> = {
  champions: "Champions",
  loyal: "Loyal Customers",
  potential_loyalist: "Potential Loyalists",
  new_customers: "New Customers",
  at_risk: "At Risk (Churn Risk)",
  hibernating: "Hibernating / Lost",
};

export default function CustomerIntelligencePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [selectedSegment, setSelectedSegment] = useState<"all" | RFMSegment>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<CustomerRFMProfile | null>(null);

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

  // Summary & Profiles Data
  const summary = useMemo(() => {
    if (!isClient) return null;
    return getCustomerIntelligenceSummary(selectedBranchId || undefined);
  }, [isClient, selectedBranchId]);

  const allProfiles = useMemo(() => {
    if (!isClient) return [];
    const seg = selectedSegment !== "all" ? selectedSegment : undefined;
    return getCustomerRFMProfiles(selectedBranchId || undefined, seg);
  }, [isClient, selectedBranchId, selectedSegment]);

  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return allProfiles;
    const q = searchQuery.toLowerCase();
    return allProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.favoriteBarberName && p.favoriteBarberName.toLowerCase().includes(q)) ||
        (p.favoriteServiceName && p.favoriteServiceName.toLowerCase().includes(q)),
    );
  }, [allProfiles, searchQuery]);

  function getSegmentBadge(segment: RFMSegment) {
    switch (segment) {
      case "champions":
        return <Badge tone="gold">🏆 Champions</Badge>;
      case "loyal":
        return <Badge tone="ok">💎 Loyal</Badge>;
      case "potential_loyalist":
        return <Badge tone="neutral">⭐ Potential</Badge>;
      case "new_customers":
        return <Badge tone="neutral">🌱 Baru</Badge>;
      case "at_risk":
        return <Badge tone="danger">⚠️ At Risk</Badge>;
      case "hibernating":
        return <Badge tone="danger">💤 Hibernating</Badge>;
    }
  }

  function getWhatsAppUrl(profile: CustomerRFMProfile) {
    let cleanPhone = profile.phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    }

    let message = "";
    if (profile.segment === "champions") {
      message = `Halo Kak ${profile.name}! Terima kasih telah menjadi pelanggan VIP Redbox Barbershop. Dapatkan free treatment hair tonic pada kunjungan potong rambut berikutnya bersama barber favorit Anda! 💈✨`;
    } else if (profile.segment === "at_risk") {
      message = `Halo Kak ${profile.name}! Kami merindukan kehadiran Kakak di Redbox Barbershop. Sudah waktunya merapikan rambut nih. Dapatkan diskon 15% khusus kunjungan minggu ini. Booking sekarang yuk! ✂️`;
    } else if (profile.segment === "hibernating") {
      message = `Halo Kak ${profile.name}! Mau tampil fresh kembali? Dapatkan voucher spesial potongan Rp20.000 di Redbox Barbershop untuk reservasi hari ini. Ditunggu kedatangannya ya! 💈`;
    } else if (profile.segment === "new_customers") {
      message = `Halo Kak ${profile.name}! Terima kasih atas kunjungan pertama Kakak di Redbox Barbershop. Nikmati voucher diskon 10% untuk kunjungan kedua Kakak dalam 21 hari ke depan! ✂️`;
    } else {
      message = `Halo Kak ${profile.name}! Jadwal potong rambut Kakak sudah tiba di Redbox Barbershop. Mau kami siapkan jadwal dengan ${profile.favoriteBarberName || "barber terbaik kami"}? 😊`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  function handleOpenDetail(profile: CustomerRFMProfile) {
    setActiveProfile(profile);
    setModalOpen(true);
  }

  if (!employee || !summary) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <ManajemenShell
      employee={employee}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Customer Intelligence & RFM Segmentation"
      activeNavId="crm_intelligence"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Basis Konsumen Dianalisis
            </div>
            <div className="mt-1 text-2xl font-bold text-text">{summary.totalAnalyzedCustomers}</div>
            <div className="text-[11px] text-text-faint">Database profil perilaku pelanggan</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">
              Rata-rata Recency
            </div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">
              {summary.averageRecencyDays} <span className="text-xs font-normal text-text-muted">hari lalu</span>
            </div>
            <div className="text-[11px] text-text-faint">Jarak rata-rata sejak kunjungan terakhir</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">
              Siklus Cukur Standar
            </div>
            <div className="mt-1 text-2xl font-bold text-ok">
              {summary.averageVisitInterval} <span className="text-xs font-normal text-text-muted">hari</span>
            </div>
            <div className="text-[11px] text-text-faint">Estimasi interval normal pemotongan rambut</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">
              Perlu Retensi Segera
            </div>
            <div className="mt-1 text-2xl font-bold text-danger">
              {summary.atRiskCustomerCount} <span className="text-xs font-normal text-text-muted">konsumen</span>
            </div>
            <div className="text-[11px] text-text-faint">Segmen At-Risk &amp; Hibernating</div>
          </div>
        </div>

        {/* 6 RFM Segment Distribution Cards (Clickable) */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">
            Matriks Distribusi 6 Segmen Perilaku Konsumen (Klik untuk filter)
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {summary.segments.map((seg) => {
              const isSelected = selectedSegment === seg.segment;
              return (
                <div
                  key={seg.segment}
                  onClick={() => setSelectedSegment(isSelected ? "all" : seg.segment)}
                  className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                    isSelected
                      ? "border-gold-bright bg-surface-2 shadow-md"
                      : "border-border bg-surface hover:border-gold-bright/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text">{seg.segmentLabel}</span>
                    <span className="font-mono text-xs font-semibold text-gold-bright">
                      {seg.percentage.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-text">{seg.customerCount} orang</span>
                    <span className="font-mono text-xs text-text-muted">
                      Total: {formatRupiah(seg.totalRevenue)}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] leading-relaxed text-text-faint">
                    💡 <span className="text-text-muted">{seg.recommendedAction}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">FILTER SEGMEN:</label>
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value as "all" | RFMSegment)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Segmen ({summary.totalAnalyzedCustomers})</option>
                {Object.keys(SEGMENT_NAMES).map((k) => (
                  <option key={k} value={k}>
                    {SEGMENT_NAMES[k as RFMSegment]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">CARI KONSUMEN:</label>
              <input
                type="text"
                placeholder="Nama, No HP, Barber, Layanan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          </div>

          <div className="text-[11px] text-text-muted">
            Menampilkan <span className="font-bold text-text">{filteredProfiles.length}</span> profil konsumen
          </div>
        </div>

        {/* RFM Database Table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5">NAMA &amp; KONTAK</th>
                <th className="px-3.5 py-2.5 text-center">TIER</th>
                <th className="px-3.5 py-2.5 text-center">SKOR RFM</th>
                <th className="px-3.5 py-2.5">SEGMEN</th>
                <th className="px-3.5 py-2.5">BARBER &amp; LAYANAN FAVORIT</th>
                <th className="px-3.5 py-2.5 text-center">KUNJUNGAN TERAKHIR</th>
                <th className="px-3.5 py-2.5 text-center">PREDIKSI CUKUR</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL BELANJA</th>
                <th className="px-3.5 py-2.5 text-center">AKSI RETENSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-text-faint">
                    Tidak ada data profil konsumen yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => (
                  <tr key={p.customerId} className="hover:bg-surface-2/60">
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-text">{p.name}</div>
                      <div className="font-mono text-[11px] text-text-faint">{p.phone}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {p.tier ? <Badge tone="gold">{p.tier}</Badge> : <span className="text-text-faint">-</span>}
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-gold-bright">
                      {p.rfmScore}
                    </td>
                    <td className="px-3.5 py-2.5">{getSegmentBadge(p.segment)}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-text">{p.favoriteBarberName || "-"}</div>
                      <div className="text-[10px] text-text-muted">{p.favoriteServiceName || "-"}</div>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-center font-mono text-text">
                      <div>{p.lastVisitDate || "-"}</div>
                      <div className="text-[10px] text-text-faint">({p.recencyDays} hari lalu)</div>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
                      <div className="font-mono text-text">{p.predictedNextVisit || "-"}</div>
                      {p.isOverdue && <Badge tone="danger">Terlambat</Badge>}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-text">
                      {formatRupiah(p.monetary)}
                      <div className="text-[10px] font-normal text-text-faint">{p.frequency}x kunjungan</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <a
                          href={getWhatsAppUrl(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded bg-ok/20 px-2 py-0.5 text-[11px] font-bold text-ok transition-colors hover:bg-ok hover:text-bg"
                        >
                          💬 WA
                        </a>
                        <Button
                          variant="default"
                          className="px-2 py-0.5 text-[11px]"
                          onClick={() => handleOpenDetail(p)}
                        >
                          Detail
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Profil RFM */}
      {activeProfile && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          eyebrow="Customer Intelligence"
          title={`Profil RFM: ${activeProfile.name}`}
          footer={
            <div className="flex w-full justify-between items-center">
              <a
                href={getWhatsAppUrl(activeProfile)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-ok px-3 py-1.5 text-xs font-bold text-bg hover:opacity-90"
              >
                💬 Kirim Pesan WhatsApp Personal
              </a>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Tutup
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5 text-xs">
            {/* R - F - M Score Breakdown */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Recency (R)</div>
                <div className="mt-1 text-2xl font-black text-gold-bright">{activeProfile.rScore} / 5</div>
                <div className="text-[10px] text-text-faint">{activeProfile.recencyDays} hari lalu</div>
              </div>

              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Frequency (F)</div>
                <div className="mt-1 text-2xl font-black text-ok">{activeProfile.fScore} / 5</div>
                <div className="text-[10px] text-text-faint">{activeProfile.frequency} transaksi</div>
              </div>

              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Monetary (M)</div>
                <div className="mt-1 text-2xl font-black text-text">{activeProfile.mScore} / 5</div>
                <div className="text-[10px] text-text-faint">{formatRupiah(activeProfile.monetary)}</div>
              </div>
            </div>

            {/* Profile Info Details */}
            <div className="rounded-lg border border-border bg-surface-2 p-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-text-muted">No. WhatsApp:</span>{" "}
                  <span className="font-mono font-semibold text-text">{activeProfile.phone}</span>
                </div>
                <div>
                  <span className="text-text-muted">Membership Tier:</span>{" "}
                  <span className="font-semibold text-gold-bright">{activeProfile.tier || "Guest Non-Member"}</span>
                </div>
                <div>
                  <span className="text-text-muted">Barber Favorit:</span>{" "}
                  <span className="font-semibold text-text">{activeProfile.favoriteBarberName || "-"}</span>
                </div>
                <div>
                  <span className="text-text-muted">Layanan Favorit:</span>{" "}
                  <span className="font-semibold text-text">{activeProfile.favoriteServiceName || "-"}</span>
                </div>
                <div>
                  <span className="text-text-muted">Kunjungan Terakhir:</span>{" "}
                  <span className="font-mono text-text">{activeProfile.lastVisitDate}</span>
                </div>
                <div>
                  <span className="text-text-muted">Prediksi Cukur Berikutnya:</span>{" "}
                  <span className="font-mono font-semibold text-text">{activeProfile.predictedNextVisit}</span>
                </div>
              </div>
            </div>

            {/* Recommended Action */}
            <div className="rounded-lg border border-gold-bright/40 bg-gold-bright/10 p-3">
              <div className="font-bold text-gold-bright">🎯 Rekomendasi Tindakan Strategis:</div>
              <div className="mt-1 text-[11px] text-text">
                Konsumen tergolong ke dalam segmen <span className="font-bold text-gold-bright">{SEGMENT_NAMES[activeProfile.segment]}</span>. Segera hubungi via WhatsApp menggunakan promo dan sentuhan personal untuk mengoptimalkan retensi kunjungan.
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ManajemenShell>
  );
}
