"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranchById,
  getExpectedTotals,
  createCashierClosing,
  getClosingHistory,
  formatRupiah,
} from "@/lib/data";
import type { ActualByMethod, CashierClosing, PaymentMethod } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { AppShell, getNavItemsForRole } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { PinModal } from "@/components/ui/PinModal";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "QRIS", "Debit", "Transfer", "E-Wallet"];

type ActualInputs = Record<PaymentMethod, string>;

const EMPTY_ACTUAL_INPUTS: ActualInputs = { Cash: "", QRIS: "", Debit: "", Transfer: "", "E-Wallet": "" };

export default function CashierClosingPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;
  const employee = session && session.role === "Kasir" ? session : null;
  const branch = employee ? getBranchById(employee.branchId) : undefined;

  const [dataVersion, setDataVersion] = useState(0);
  const [actualInputs, setActualInputs] = useState<ActualInputs>(EMPTY_ACTUAL_INPUTS);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [receipt, setReceipt] = useState<CashierClosing | null>(null);

  useEffect(() => {
    if (!isClient) return;
    if (!session) {
      router.replace("/login");
    } else if (session.role !== "Kasir") {
      router.replace("/home");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("karyawan");
    router.replace("/login");
  }

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  void dataVersion;
  const expected = getExpectedTotals(employee.id, employee.branchId);
  const history = getClosingHistory(employee.id, employee.branchId);
  const allFilled = PAYMENT_METHODS.every((method) => actualInputs[method].trim() !== "");

  function handleSetActual(method: PaymentMethod, value: string) {
    setActualInputs((prev) => ({ ...prev, [method]: value.replace(/[^0-9]/g, "") }));
  }

  function handleSubmitPin(pin: string) {
    if (!employee) return;
    const actualByMethod: ActualByMethod = {};
    for (const method of PAYMENT_METHODS) {
      actualByMethod[method] = Number(actualInputs[method] || 0);
    }
    const closing = createCashierClosing(employee.id, { pin, actualByMethod });
    setReceipt(closing);
    setActualInputs(EMPTY_ACTUAL_INPUTS);
    setPinModalOpen(false);
    setDataVersion((v) => v + 1);
  }

  return (
    <AppShell
      employee={employee}
      branch={branch}
      pageTitle="Cashier Closing"
      navItems={getNavItemsForRole(employee.role)}
      activeNavId="closing"
      onLogout={handleLogout}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---- Expected (live preview since last closing) ---- */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="font-accent text-xs italic text-gold-bright">Expected — Sejak Closing Terakhir</div>
          <div className="mb-3 mt-0.5 text-xs text-text-faint">
            {new Date(expected.periodStart).toLocaleString("id-ID")} — {new Date(expected.periodEnd).toLocaleString("id-ID")}
          </div>
          <div className="space-y-1.5 text-sm">
            {expected.breakdown.map((row) => (
              <div key={row.method} className="flex justify-between border-b border-dashed border-border pb-1.5">
                <span className="text-text-muted">{row.method}</span>
                <span className="font-bold">{formatRupiah(row.expected)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1 text-base">
              <span>Total Expected</span>
              <span className="font-bold text-gold-bright">{formatRupiah(expected.totalExpected)}</span>
            </div>
          </div>
        </div>

        {/* ---- Actual input form ---- */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="font-accent text-xs italic text-gold-bright">Actual — Hasil Hitung Fisik / Cek Mutasi</div>
          <div className="mb-3 mt-0.5 text-xs text-text-faint">
            Isi kelima metode (isi 0 kalau memang tidak ada transaksi untuk metode itu).
          </div>
          <div className="space-y-2.5">
            {PAYMENT_METHODS.map((method) => (
              <div key={method} className="flex items-center justify-between gap-2">
                <span className="text-sm">{method}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={actualInputs[method]}
                  onChange={(event) => handleSetActual(method, event.target.value)}
                  className="w-36 rounded-md border border-border bg-surface-2 px-3 py-2 text-right text-sm text-text focus:border-gold-bright focus:outline-none"
                />
              </div>
            ))}
          </div>
          <Button
            variant="primary"
            fullWidth
            className="mt-4"
            disabled={!allFilled}
            onClick={() => setPinModalOpen(true)}
          >
            Tutup Shift
          </Button>
          {!allFilled && (
            <div className="mt-2 text-center text-xs text-text-faint">Isi actual untuk kelima metode dulu.</div>
          )}
        </div>
      </div>

      {/* ---- Result of the closing just created ---- */}
      {receipt && (
        <div className="mt-4 rounded-lg border border-gold-bright/40 bg-surface p-4">
          <div className="font-accent text-xs italic text-gold-bright">Closing Tersimpan — {receipt.id}</div>
          <div className="mb-3 mt-0.5 text-xs text-text-faint">{new Date(receipt.createdAt).toLocaleString("id-ID")}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
                  <th className="px-3 py-2 font-normal">Metode</th>
                  <th className="px-3 py-2 font-normal">Expected</th>
                  <th className="px-3 py-2 font-normal">Actual</th>
                  <th className="px-3 py-2 font-normal">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {receipt.breakdown.map((row) => {
                  const isOff = row.variance !== 0;
                  return (
                    <tr key={row.method} className={`border-b border-border last:border-b-0 ${isOff ? "bg-warn/10" : ""}`}>
                      <td className="px-3 py-2 font-semibold">{row.method}</td>
                      <td className="px-3 py-2">{formatRupiah(row.expected)}</td>
                      <td className="px-3 py-2">{formatRupiah(row.actual)}</td>
                      <td className={`px-3 py-2 font-bold ${isOff ? "text-warn" : "text-ok"}`}>
                        {row.variance > 0 ? "+" : ""}
                        {formatRupiah(row.variance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-base">
            <span>Total Selisih</span>
            <span className={`font-bold ${receipt.totalVariance !== 0 ? "text-warn" : "text-ok"}`}>
              {receipt.totalVariance > 0 ? "+" : ""}
              {formatRupiah(receipt.totalVariance)}
            </span>
          </div>
        </div>
      )}

      {/* ---- Read-only history ---- */}
      <div className="font-accent mb-2 mt-5 text-xs italic text-gold-bright">Riwayat Closing Sebelumnya</div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        {history.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-faint">Belum ada riwayat closing.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
                <th className="px-3 py-2 font-normal">Waktu</th>
                <th className="px-3 py-2 font-normal">Total Expected</th>
                <th className="px-3 py-2 font-normal">Total Actual</th>
                <th className="px-3 py-2 font-normal">Total Selisih</th>
              </tr>
            </thead>
            <tbody>
              {history.map((closing) => (
                <tr key={closing.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">{new Date(closing.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2">{formatRupiah(closing.totalExpected)}</td>
                  <td className="px-3 py-2">{formatRupiah(closing.totalActual)}</td>
                  <td className={`px-3 py-2 font-bold ${closing.totalVariance !== 0 ? "text-warn" : "text-ok"}`}>
                    {closing.totalVariance > 0 ? "+" : ""}
                    {formatRupiah(closing.totalVariance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        eyebrow="Cashier Closing"
        title={`Konfirmasi PIN — ${employee.name}`}
        confirmLabel="Tutup Shift"
        onSubmit={handleSubmitPin}
      />
    </AppShell>
  );
}
