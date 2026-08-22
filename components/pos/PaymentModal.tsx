"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatRupiah } from "@/lib/data";
import type { PaymentMethod } from "@/lib/data";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  total: number;
  /** May throw (e.g. checkout() rejecting due to stock/cash validation) — caught here and shown inline, modal stays open. */
  onConfirm: (method: PaymentMethod, cashTendered: number) => void;
}

const METHODS: PaymentMethod[] = ["Cash", "QRIS", "Debit", "Transfer", "E-Wallet"];

export function PaymentModal({ open, onClose, total, onConfirm }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [cashTenderedInput, setCashTenderedInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Same render-time reset pattern as CustomerPickerModal — see its comment.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMethod("Cash");
      setCashTenderedInput("");
      setError(null);
    }
  }

  const cashTendered = Number(cashTenderedInput || 0);
  const change = cashTendered - total;
  const canConfirm = method !== "Cash" || cashTendered >= total;

  function handleConfirm() {
    setError(null);
    try {
      onConfirm(method, method === "Cash" ? cashTendered : total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses pembayaran.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="POS"
      title="Bayar"
      footer={
        <>
          <Button variant="ghost" fullWidth onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" fullWidth disabled={!canConfirm} onClick={handleConfirm}>
            Konfirmasi
          </Button>
        </>
      }
    >
      <div className="flex justify-between border-b border-dashed border-border pb-2 text-sm">
        <span>Total Tagihan</span>
        <span className="text-base font-bold text-gold-bright">{formatRupiah(total)}</span>
      </div>

      <div className="mb-1.5 mt-3.5 text-[11.5px] uppercase tracking-wide text-text-faint">Metode Pembayaran</div>
      <div className="mb-3.5 grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-md border px-3 py-2.5 text-center text-xs font-bold ${
              method === m ? "border-gold-bright bg-surface-2 text-gold-bright" : "border-border bg-surface text-text-muted"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {method === "Cash" ? (
        <div>
          <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-text-faint">Uang Tunai Diterima</div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={cashTenderedInput}
            onChange={(event) => setCashTenderedInput(event.target.value.replace(/[^0-9]/g, ""))}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-right text-lg font-bold tabular-nums text-text focus:border-gold-bright focus:outline-none"
          />
          <div className="mt-2 flex justify-between text-sm">
            <span>Kembalian</span>
            <span className="font-bold text-gold-bright">{formatRupiah(Math.max(change, 0))}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1 text-xs text-text-faint">
          Pastikan pembayaran {method} sudah dikonfirmasi di mesin EDC/aplikasi sebelum menekan Konfirmasi.
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      )}
    </Modal>
  );
}
