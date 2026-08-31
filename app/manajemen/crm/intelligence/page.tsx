"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  formatRupiah,
} from "@/lib/data";
import { globalStats, dummyCRM } from "@/lib/data/dummy";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface CRMProfile {
  nama: string;
  kontak: string;
  tier: string;
  rfm: string;
  segmen: string;
  kunjungan: string;
  prediksi: string;
  belanja: number;
}

export default function CustomerIntelligencePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<CRMProfile | null>(null);

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

  const filteredProfiles = useMemo(() => {
    return dummyCRM.filter((p) => {
      if (selectedSegment !== "all" && p.segmen.toLowerCase() !== selectedSegment.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.nama.toLowerCase().includes(q) || p.kontak.includes(q);
      }
      return true;
    });
  }, [selectedSegment, searchQuery]);

  function getSegmentBadge(segment: string) {
    switch (segment.toLowerCase()) {
      case "champions":
        return <Badge tone="gold">🏆 Champions</Badge>;
      case "loyal customers":
        return <Badge tone="ok">💎 Loyal</Badge>;
      case "potential loyalists":
        return <Badge tone="neutral">⭐ Potential</Badge>;
      case "new customers":
        return <Badge tone="neutral">🌱 Baru</Badge>;
      case "at risk":
        return <Badge tone="danger">⚠️ At Risk</Badge>;
      case "hibernating":
        return <Badge tone="danger">💤 Hibernating</Badge>;
      default:
        return <Badge tone="neutral">{segment}</Badge>;
    }
  }

  function getWhatsAppUrl(profile: CRMProfile) {
    let cleanPhone = profile.kontak.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    }
    const message = `Halo Kak ${profile.nama}! Terima kasih telah berkunjung ke Redbox Barbershop. Dapatkan free treatment hair tonic pada kunjungan potong rambut berikutnya bersama barber favorit Anda! 💈✨`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  function handleOpenDetail(profile: CRMProfile) {
    setActiveProfile(profile);
    setModalOpen(true);
  }

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  const segmentsData = [
    { segment: "champions", label: "Champions", count: 85, pct: 19, revenue: 58000000, action: "Reward VIP, program eksklusif, jadikan brand ambassador" },
    { segment: "loyal customers", label: "Loyal Customers", count: 120, pct: 27, revenue: 62000000, action: "Upsell produk grooming retail dan layanan paket premium" },
    { segment: "potential loyalists", label: "Potential Loyalists", count: 95, pct: 21, revenue: 32000000, action: "Tawarkan program membership berbayar & poin loyalty" },
    { segment: "new customers", label: "New Customers", count: 65, pct: 14, revenue: 15500000, action: "Follow-up kepuasan servis via WA dalam 14 hari pertama" },
    { segment: "at risk", label: "At Risk (Churn Risk)", count: 50, pct: 11, revenue: 11500000, action: "Kirim pesan reminder personal dan voucher diskon 'We Miss You'" },
    { segment: "hibernating", label: "Hibernating / Lost", count: 35, pct: 8, revenue: 6500000, action: "Reaktivasi kampanye flash-deal potongan harga khusus" }
  ];

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
            <div className="mt-1 text-2xl font-bold text-text">{globalStats.memberAktif}</div>
            <div className="text-[11px] text-text-faint">Database profil perilaku pelanggan</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-bright">
              Rata-rata Recency
            </div>
            <div className="mt-1 text-2xl font-bold text-gold-bright">
              18 <span className="text-xs font-normal text-text-muted">hari lalu</span>
            </div>
            <div className="text-[11px] text-text-faint">Jarak rata-rata sejak kunjungan terakhir</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">
              Siklus Cukur Standar
            </div>
            <div className="mt-1 text-2xl font-bold text-ok">
              26 <span className="text-xs font-normal text-text-muted">hari</span>
            </div>
            <div className="text-[11px] text-text-faint">Estimasi interval normal pemotongan rambut</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">
              Perlu Retensi Segera
            </div>
            <div className="mt-1 text-2xl font-bold text-danger">
              45 <span className="text-xs font-normal text-text-muted">konsumen</span>
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
            {segmentsData.map((seg) => {
              const isSelected = selectedSegment.toLowerCase() === seg.segment.toLowerCase();
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
                    <span className="font-bold text-text">{seg.label}</span>
                    <span className="font-mono text-xs font-semibold text-gold-bright">
                      {seg.pct}%
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-text">{seg.count} orang</span>
                    <span className="font-mono text-xs text-text-muted">
                      Total: {formatRupiah(seg.revenue)}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] leading-relaxed text-text-faint">
                    💡 <span className="text-text-muted">{seg.action}</span>
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
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="all">Semua Segmen ({dummyCRM.length})</option>
                {segmentsData.map((s) => (
                  <option key={s.segment} value={s.segment}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-text-muted">CARI KONSUMEN:</label>
              <input
                type="text"
                placeholder="Nama, No HP..."
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
                <th className="px-3.5 py-2.5 text-center">KUNJUNGAN TERAKHIR</th>
                <th className="px-3.5 py-2.5 text-center">PREDIKSI CUKUR</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL BELANJA</th>
                <th className="px-3.5 py-2.5 text-center">AKSI RETENSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProfiles.map((p) => (
                <tr key={p.kontak} className="hover:bg-surface-2/60">
                  <td className="px-3.5 py-2.5">
                    <div className="font-bold text-text">{p.nama}</div>
                    <div className="font-mono text-[11px] text-text-faint">{p.kontak}</div>
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    <Badge tone={p.tier === "Guest" ? "neutral" : "gold"}>{p.tier}</Badge>
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-mono font-bold text-gold-bright">
                    {p.rfm}
                  </td>
                  <td className="px-3.5 py-2.5">{getSegmentBadge(p.segmen)}</td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-center font-mono text-text">
                    {p.kunjungan}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
                    <div className="font-mono text-text">{p.prediksi}</div>
                    {p.prediksi === "Overdue" && <Badge tone="danger">Terlambat</Badge>}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-text">
                    {formatRupiah(p.belanja)}
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
              ))}
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
          title={`Profil RFM: ${activeProfile.nama}`}
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
                <div className="mt-1 text-2xl font-black text-gold-bright">{activeProfile.rfm[0]} / 5</div>
              </div>

              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Frequency (F)</div>
                <div className="mt-1 text-2xl font-black text-ok">{activeProfile.rfm[1]} / 5</div>
              </div>

              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Monetary (M)</div>
                <div className="mt-1 text-2xl font-black text-text">{activeProfile.rfm[2]} / 5</div>
              </div>
            </div>

            {/* Profile Info Details */}
            <div className="rounded-lg border border-border bg-surface-2 p-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-text-muted">No. WhatsApp:</span>{" "}
                  <span className="font-mono font-semibold text-text">{activeProfile.kontak}</span>
                </div>
                <div>
                  <span className="text-text-muted">Membership Tier:</span>{" "}
                  <span className="font-semibold text-gold-bright">{activeProfile.tier}</span>
                </div>
                <div>
                  <span className="text-text-muted">Kunjungan Terakhir:</span>{" "}
                  <span className="font-mono text-text">{activeProfile.kunjungan}</span>
                </div>
                <div>
                  <span className="text-text-muted">Prediksi Cukur Berikutnya:</span>{" "}
                  <span className="font-mono font-semibold text-text">{activeProfile.prediksi}</span>
                </div>
              </div>
            </div>

            {/* Recommended Action */}
            <div className="rounded-lg border border-gold-bright/40 bg-gold-bright/10 p-3">
              <div className="font-bold text-gold-bright">🎯 Rekomendasi Tindakan Strategis:</div>
              <div className="mt-1 text-[11px] text-text">
                Konsumen tergolong ke dalam segmen <span className="font-bold text-gold-bright">{activeProfile.segmen}</span>. Segera hubungi via WhatsApp menggunakan promo dan sentuhan personal untuk mengoptimalkan retensi kunjungan.
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ManajemenShell>
  );
}
