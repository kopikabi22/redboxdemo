"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranches, formatRupiah } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export interface RiwayatItem {
  id: string;
  orderType: "Walk-In" | "Booking" | "Dine In";
  timestamp: string;
  businessDate?: string;
  branchName?: string;
  customerName: string;
  customerPhone: string;
  barberName: string;
  items: { name: string; qty: number; price: number }[];
  itemCount: number;
  total: number;
  method: "Tunai" | "QRIS" | "Debit" | "Transfer";
  status: "Lunas" | "Void";
}

const DUMMY_RIWAYAT: RiwayatItem[] = [
  {
    id: "KK-260901-014",
    orderType: "Walk-In",
    timestamp: "01 Sep 2026, 19:15 WIB",
    customerName: "Rian Ardiansyah",
    customerPhone: "0812-3456-7890",
    barberName: "Dimas",
    items: [
      { name: "Gentlemen Haircut", qty: 1, price: 50000 },
      { name: "Hair Wash & Tonic", qty: 1, price: 15000 },
    ],
    itemCount: 2,
    total: 65000,
    method: "QRIS",
    status: "Lunas",
  },
  {
    id: "KK-260901-013",
    orderType: "Booking",
    timestamp: "01 Sep 2026, 18:30 WIB",
    customerName: "Ahmad Fauzi",
    customerPhone: "0819-8765-4321",
    barberName: "Eko",
    items: [
      { name: "Father & Son Package", qty: 2, price: 55000 },
    ],
    itemCount: 2,
    total: 110000,
    method: "Debit",
    status: "Lunas",
  },
  {
    id: "KK-260901-012",
    orderType: "Walk-In",
    timestamp: "01 Sep 2026, 17:45 WIB",
    customerName: "Hendro Prasetyo",
    customerPhone: "0857-1122-3344",
    barberName: "Rian",
    items: [
      { name: "Gentlemen Haircut", qty: 1, price: 50000 },
      { name: "Pomade Waterbased Deluxe", qty: 1, price: 45000 },
    ],
    itemCount: 2,
    total: 95000,
    method: "Tunai",
    status: "Lunas",
  },
  {
    id: "KK-260901-011",
    orderType: "Walk-In",
    timestamp: "01 Sep 2026, 16:20 WIB",
    customerName: "Dimas Wahyu",
    customerPhone: "0878-5566-7788",
    barberName: "Dimas",
    items: [
      { name: "Gentlemen Haircut", qty: 1, price: 39000 },
    ],
    itemCount: 1,
    total: 39000,
    method: "QRIS",
    status: "Lunas",
  },
  {
    id: "KK-260901-010",
    orderType: "Booking",
    timestamp: "01 Sep 2026, 15:10 WIB",
    customerName: "Surya Kencana",
    customerPhone: "0813-9988-7766",
    barberName: "Eko",
    items: [
      { name: "Gentlemen Cut & Beard Trim", qty: 1, price: 75000 },
    ],
    itemCount: 1,
    total: 75000,
    method: "Tunai",
    status: "Lunas",
  },
  {
    id: "KK-260901-009",
    orderType: "Walk-In",
    timestamp: "01 Sep 2026, 14:00 WIB",
    customerName: "Kevin Sanjaya",
    customerPhone: "0821-4433-2211",
    barberName: "Rian",
    items: [
      { name: "Gentlemen Haircut", qty: 1, price: 50000 },
      { name: "Hair Tattoo Art", qty: 1, price: 35000 },
    ],
    itemCount: 2,
    total: 85000,
    method: "QRIS",
    status: "Lunas",
  },
  {
    id: "KK-260901-008",
    orderType: "Walk-In",
    timestamp: "01 Sep 2026, 12:45 WIB",
    customerName: "Bambang Pamungkas",
    customerPhone: "0811-2233-4455",
    barberName: "Dimas",
    items: [
      { name: "Pomade Matte Clay", qty: 1, price: 51000 },
    ],
    itemCount: 1,
    total: 51000,
    method: "Tunai",
    status: "Lunas",
  },
];

export default function RiwayatTransaksiPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const branch = branches.find((b) => b.id === employee?.branchId);

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState<"Hari Ini" | "Kemarin" | "7 Hari" | "Pilih Tanggal">("Hari Ini");
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"Semua" | "Lunas" | "Void">("Semua");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrx, setSelectedTrx] = useState<RiwayatItem | null>(null);
  const [transactions, setTransactions] = useState<RiwayatItem[]>(DUMMY_RIWAYAT);

  useEffect(() => {
    if (!isClient) return;
    if (!session) {
      router.replace("/login");
    }
  }, [isClient, session, router]);

  // Read transactions from localStorage redbox_transactions if available
  useEffect(() => {
    if (!isClient) return;
    try {
      const raw = localStorage.getItem("redbox_transactions");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped: RiwayatItem[] = parsed.map((tx: any, idx: number) => {
            const rawMethod = tx.method || "Tunai";
            const method: RiwayatItem["method"] =
              rawMethod === "Cash" || rawMethod === "Tunai"
                ? "Tunai"
                : rawMethod === "QRIS"
                ? "QRIS"
                : rawMethod === "Debit"
                ? "Debit"
                : "Transfer";

            const items =
              Array.isArray(tx.items) && tx.items.length > 0
                ? tx.items.map((it: any) => ({
                    name: it.name || "Layanan / Produk",
                    qty: Number(it.qty) || 1,
                    price: Number(it.price) || 0,
                  }))
                : [{ name: "Layanan POS", qty: 1, price: Number(tx.total) || 0 }];

            const itemCount = items.reduce((sum: number, it: any) => sum + it.qty, 0);

            const dateStr = tx.timestamp
              ? new Date(tx.timestamp).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }) + " WIB"
              : "01 Sep 2026, 12:00 WIB";

            const branchName = tx.branchId
              ? branches.find((b) => b.id === tx.branchId)?.name || "Bypass"
              : "Bypass";

            return {
              id: tx.id || `KK-${idx + 1}`,
              orderType: (tx.orderType || (tx.customer?.type === "member" ? "Booking" : "Walk-In")) as "Walk-In" | "Booking" | "Dine In",
              timestamp: dateStr,
              businessDate: tx.timestamp ? tx.timestamp.slice(0, 10) : "2026-09-01",
              branchName,
              customerName: tx.customer?.name || "Pelanggan",
              customerPhone: tx.customer?.phone || "-",
              barberName: tx.cashierName || "Barber",
              items,
              itemCount,
              total: Number(tx.total) || 0,
              method,
              status: (tx.status === "Void" ? "Void" : "Lunas") as "Lunas" | "Void",
            };
          });

          setTransactions(mapped);
        }
      }
    } catch (err) {
      console.error("Gagal membaca data transaksi dari localStorage:", err);
    }
  }, [isClient, branches]);

  function handleLogout() {
    clearSession("karyawan");
    router.replace("/login");
  }

  function getItemDateStr(item: RiwayatItem): string {
    if (item.businessDate) return item.businessDate;
    const isoMatch = item.timestamp.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    const dmyMatch = item.timestamp.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const monthName = dmyMatch[2].toLowerCase().slice(0, 3);
      const year = dmyMatch[3];
      const monthMap: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", may: "05", jun: "06",
        jul: "07", agu: "08", aug: "08", sep: "09", okt: "10", oct: "10", nov: "11", des: "12", dec: "12"
      };
      const month = monthMap[monthName] || "09";
      return `${year}-${month}-${day}`;
    }
    return "2026-09-01";
  }

  // Filter Transactions (Immutable, derived from transactions)
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sevenDaysAgoStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return transactions.filter((item) => {
      // 1. Filter Status
      if (statusFilter !== "Semua" && item.status !== statusFilter) {
        return false;
      }

      // 2. Filter Cabang
      if (selectedBranch !== "all") {
        const itemBranch = item.branchName || "Bypass";
        if (itemBranch.toLowerCase() !== selectedBranch.toLowerCase()) {
          return false;
        }
      }

      // 3. Filter Periode
      const itemDate = getItemDateStr(item);
      if (selectedPeriod === "Hari Ini") {
        if (itemDate !== todayStr && itemDate !== "2026-09-01") {
          return false;
        }
      } else if (selectedPeriod === "Kemarin") {
        if (itemDate !== yesterdayStr && itemDate !== "2026-08-31") {
          return false;
        }
      } else if (selectedPeriod === "7 Hari") {
        if (itemDate < sevenDaysAgoStr && itemDate !== "2026-09-01") {
          return false;
        }
      } else if (selectedPeriod === "Pilih Tanggal") {
        if (selectedCustomDate && itemDate !== selectedCustomDate) {
          return false;
        }
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.id.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.customerPhone.includes(q) ||
          item.barberName.toLowerCase().includes(q) ||
          (item.branchName && item.branchName.toLowerCase().includes(q)) ||
          item.items.some((i) => i.name.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [transactions, statusFilter, selectedBranch, selectedPeriod, selectedCustomDate, searchQuery]);

  // Breakdown metrics computed from filteredTransactions
  const tunaiTotal = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.method === "Tunai" && t.status === "Lunas")
      .reduce((sum, t) => sum + t.total, 0);
  }, [filteredTransactions]);

  const qrisTotal = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.method === "QRIS" && t.status === "Lunas")
      .reduce((sum, t) => sum + t.total, 0);
  }, [filteredTransactions]);

  const debitTotal = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.method === "Debit" && t.status === "Lunas")
      .reduce((sum, t) => sum + t.total, 0);
  }, [filteredTransactions]);

  const grandTotal = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.status === "Lunas")
      .reduce((sum, t) => sum + t.total, 0);
  }, [filteredTransactions]);

  const totalLunasCount = useMemo(() => {
    return filteredTransactions.filter((t) => t.status === "Lunas").length;
  }, [filteredTransactions]);

  const totalItemsCount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.itemCount, 0);
  }, [filteredTransactions]);

  const avgOrderValue = useMemo(() => {
    return totalLunasCount > 0 ? Math.round(grandTotal / totalLunasCount) : 0;
  }, [grandTotal, totalLunasCount]);

  // Pagination State (Immutable .slice)
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 10;
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;

  useEffect(() => {
    setCurrentPage(0);
  }, [selectedPeriod, selectedCustomDate, selectedBranch, statusFilter, searchQuery]);

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <AppShell
      employee={employee}
      branch={branch}
      pageTitle="RIWAYAT TRANSAKSI KASIR"
      activeNavId="riwayat"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* 1. Baris Filter & Aksi */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Periode Filter Pills */}
            <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
              {(["Hari Ini", "Kemarin", "7 Hari", "Pilih Tanggal"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setSelectedPeriod(period)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                    selectedPeriod === period
                      ? "bg-gold-bright text-black font-bold shadow-sm"
                      : "text-text-muted hover:text-text hover:bg-surface"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Custom Date Input for Pilih Tanggal */}
            {selectedPeriod === "Pilih Tanggal" && (
              <input
                type="date"
                value={selectedCustomDate}
                onChange={(e) => setSelectedCustomDate(e.target.value)}
                className="rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
              />
            )}

            {/* Status Filter Pills */}
            <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
              {(["Semua", "Lunas", "Void"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                    statusFilter === status
                      ? "bg-red-600 text-white font-bold shadow-sm"
                      : "text-text-muted hover:text-text hover:bg-surface"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Dropdown Cabang */}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
            >
              <option value="all">Semua Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Quick Search */}
            <input
              type="text"
              placeholder="Cari No. ID, Pelanggan, Barber..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-text focus:border-gold-bright focus:outline-none"
            />
          </div>

          {/* Action Buttons: Print & Export */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="cursor-pointer flex items-center gap-1.5 rounded border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-surface hover:border-gold-bright"
            >
              <span>🖨️</span>
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="cursor-pointer flex items-center gap-1.5 rounded bg-green-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-green-600"
            >
              <span>📊</span>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* 2. Card Ringkasan (3 Grid) */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {/* Card 1: Transaksi */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              TRANSAKSI
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-gold-bright">
                {totalLunasCount}
              </span>
              <span className="text-xs font-bold text-ok">lunas</span>
            </div>
            <div className="mt-1 text-[11px] text-text-faint">
              Semua transaksi selesai tercatat hari ini
            </div>
          </div>

          {/* Card 2: Omzet */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ok">
              OMZET
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-ok">
                {formatRupiah(grandTotal)}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-ok">
              sudah bayar (penerimaan bersih)
            </div>
          </div>

          {/* Card 3: Rata-Rata & Items */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              RATA-RATA &amp; ITEMS
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-text">
                {formatRupiah(avgOrderValue)}
              </span>
              <span className="text-xs text-text-muted">/ order</span>
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              <span className="font-bold text-text">{totalItemsCount}</span> total item terjual
            </div>
          </div>
        </div>

        {/* 3. Card Rincian Pembayaran */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted">
              RINCIAN METODE PEMBAYARAN
            </div>
            <div className="text-xs text-text-muted">
              Total Penerimaan: <span className="font-mono font-bold text-gold-bright">{formatRupiah(grandTotal)}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-950/60 text-base font-bold text-green-400">
                  💵
                </span>
                <div>
                  <div className="text-xs font-bold text-text">Tunai</div>
                  <div className="text-[10px] text-text-muted">Cash di laci kasir</div>
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-ok">
                {formatRupiah(tunaiTotal)}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-950/60 text-base font-bold text-amber-400">
                  📱
                </span>
                <div>
                  <div className="text-xs font-bold text-text">QRIS</div>
                  <div className="text-[10px] text-text-muted">Scan statis / dinamis</div>
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-gold-bright">
                {formatRupiah(qrisTotal)}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-950/60 text-base font-bold text-blue-400">
                  💳
                </span>
                <div>
                  <div className="text-xs font-bold text-text">Debit</div>
                  <div className="text-[10px] text-text-muted">EDC Merchant Bank</div>
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-blue-400">
                {formatRupiah(debitTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* 4. List Riwayat Transaksi (Vertical List Cards) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-text-muted">
            <span>DAFTAR TRANSAKSI ({filteredTransactions.length})</span>
            <span>Urut berdasarkan waktu terbaru</span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-12 text-center text-text-faint">
              Tidak ada transaksi yang cocok dengan filter.
            </div>
          ) : (
            <>
              {paginatedTransactions.map((trx) => (
                <div
                  key={trx.id}
                  className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-gold-bright/50 hover:bg-surface-2/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left Metadata */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-sm font-bold text-gold-bright">
                        {trx.id}
                      </span>
                      <Badge tone={trx.orderType === "Booking" ? "gold" : trx.orderType === "Walk-In" ? "ok" : "neutral"}>
                        {trx.orderType}
                      </Badge>
                      <Badge tone={trx.status === "Lunas" ? "ok" : "danger"}>
                        {trx.status}
                      </Badge>
                      <span className="text-xs text-text-muted">• {trx.timestamp}</span>
                    </div>

                    {/* Right Price & Payment Badge */}
                    <div className="flex items-center gap-3">
                      <Badge
                        tone={
                          trx.method === "Tunai"
                            ? "ok"
                            : trx.method === "QRIS"
                            ? "gold"
                            : "neutral"
                        }
                      >
                        {trx.method}
                      </Badge>
                      <div className="font-mono text-lg font-bold text-ok">
                        {formatRupiah(trx.total)}
                      </div>
                    </div>
                  </div>

                  {/* Content Row */}
                  <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-border/60 pt-3 text-xs sm:grid-cols-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">PELANGGAN</div>
                      <div className="mt-0.5 font-bold text-text">{trx.customerName}</div>
                      <div className="text-[11px] text-text-muted">{trx.customerPhone}</div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">BARBER</div>
                      <div className="mt-0.5 font-semibold text-text">✂️ {trx.barberName}</div>
                    </div>

                    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                          ITEM LAYANAN &amp; PRODUK ({trx.itemCount} item)
                        </div>
                        <div className="mt-0.5 font-medium text-text">
                          {trx.items.map((i) => `${i.name} (${i.qty}x)`).join(", ")}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedTrx(trx)}
                        className="cursor-pointer rounded border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-gold-bright hover:text-gold-bright hover:bg-surface"
                      >
                        Lihat Struk 🔍
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-xs">
                  <div className="text-text-muted">
                    Menampilkan <span className="font-bold text-text">{currentPage * pageSize + 1}</span> - <span className="font-bold text-text">{Math.min((currentPage + 1) * pageSize, filteredTransactions.length)}</span> dari <span className="font-bold text-text">{filteredTransactions.length}</span> transaksi
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 0}
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      className="cursor-pointer rounded border border-border bg-surface-2 px-3 py-1.5 font-semibold text-text transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ◀ Sebelumnya
                    </button>
                    <span className="font-mono font-bold text-gold-bright">
                      Halaman {currentPage + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      className="cursor-pointer rounded border border-border bg-surface-2 px-3 py-1.5 font-semibold text-text transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Selanjutnya ▶
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Detail & Cetak Struk */}
      {selectedTrx && (
        <Modal
          open={selectedTrx !== null}
          onClose={() => setSelectedTrx(null)}
          eyebrow="Struk Transaksi POS"
          title={selectedTrx.id}
          footer={
            <div className="flex w-full justify-between items-center">
              <Button variant="default" onClick={() => window.print()}>
                🖨️ Cetak Struk
              </Button>
              <Button variant="primary" onClick={() => setSelectedTrx(null)}>
                Tutup
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-muted">No. Transaksi:</span>
                <span className="font-mono font-bold text-gold-bright">{selectedTrx.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Waktu:</span>
                <span className="font-mono text-text">{selectedTrx.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Tipe Layanan:</span>
                <span className="font-semibold text-text">{selectedTrx.orderType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Pelanggan:</span>
                <span className="font-bold text-text">
                  {selectedTrx.customerName} <span className="font-normal text-text-muted">({selectedTrx.customerPhone})</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Barber Bertugas:</span>
                <span className="text-text font-semibold">✂️ {selectedTrx.barberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Metode Pembayaran:</span>
                <span className="font-bold text-gold-bright">{selectedTrx.method}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="font-bold text-text-muted mb-2">RINCIAN ITEM</div>
              <div className="space-y-1.5">
                {selectedTrx.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.name} <span className="text-text-muted">x{item.qty}</span>
                    </span>
                    <span className="font-mono">{formatRupiah(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border mt-3 pt-2 space-y-1">
                <div className="flex justify-between border-t border-border/80 pt-1.5 font-bold text-sm">
                  <span>TOTAL PEMBAYARAN</span>
                  <span className="font-mono text-ok">{formatRupiah(selectedTrx.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
