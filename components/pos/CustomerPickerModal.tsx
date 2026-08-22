"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { searchMemberCustomers } from "@/lib/data";
import type { TransactionCustomer } from "@/lib/data";

interface CustomerPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: TransactionCustomer) => void;
}

type Mode = "member" | "guest";

export function CustomerPickerModal({ open, onClose, onSelect }: CustomerPickerModalProps) {
  const [mode, setMode] = useState<Mode>("member");
  const [query, setQuery] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);

  // Reset the form the instant `open` flips to true — done during render
  // (React's documented "adjusting state when a prop changes" pattern),
  // not in an Effect, so there's no extra render/flicker and no setState
  // call inside a useEffect body.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMode("member");
      setQuery("");
      setGuestPhone("");
      setGuestError(null);
    }
  }

  const results = searchMemberCustomers(query);

  function handleUseGuestPhone() {
    const trimmed = guestPhone.trim();
    if (trimmed.length < 8) {
      setGuestError("Nomor HP minimal 8 digit.");
      return;
    }
    onSelect({ type: "guest", customerId: null, name: "Guest", phone: trimmed, tier: null });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="POS"
      title="Pilih Konsumen"
      footer={
        <Button variant="ghost" fullWidth onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("member")}
          className={`rounded-md border px-3 py-2.5 text-center text-xs font-bold ${
            mode === "member" ? "border-gold-bright bg-surface-2 text-gold-bright" : "border-border bg-surface text-text-muted"
          }`}
        >
          Member
        </button>
        <button
          type="button"
          onClick={() => setMode("guest")}
          className={`rounded-md border px-3 py-2.5 text-center text-xs font-bold ${
            mode === "guest" ? "border-gold-bright bg-surface-2 text-gold-bright" : "border-border bg-surface text-text-muted"
          }`}
        >
          Guest
        </button>
      </div>

      {mode === "member" ? (
        <div>
          <input
            type="text"
            placeholder="Cari nama atau nomor HP..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mb-2.5 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
          />
          {results.length === 0 ? (
            <div className="py-2.5 text-sm text-text-faint">Tidak ditemukan.</div>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() =>
                  onSelect({
                    type: "member",
                    customerId: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                    tier: customer.tier,
                  })
                }
                className="flex w-full items-center justify-between border-b border-border py-2.5 text-left last:border-b-0"
              >
                <div>
                  <div className="text-[12.5px] font-semibold">{customer.name}</div>
                  <div className="text-xs text-text-faint">{customer.phone}</div>
                </div>
                <span className="rounded-full bg-gold-bright/20 px-2.5 py-0.5 text-[11px] font-bold text-gold-bright">
                  {customer.tier} · {customer.points} pts
                </span>
              </button>
            ))
          )}
        </div>
      ) : (
        <div>
          <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-text-faint">Nomor HP Guest (wajib)</div>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="08xxxxxxxxxx"
            value={guestPhone}
            onChange={(event) => {
              setGuestPhone(event.target.value.replace(/[^0-9]/g, ""));
              setGuestError(null);
            }}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
          />
          {guestError && <div className="mt-1.5 text-xs text-danger">{guestError}</div>}
          <div className="mt-2 text-xs text-text-faint">
            Guest tidak membayar aktivasi member. Kalau nanti daftar jadi member, riwayat transaksi tetap nyambung ke nomor HP ini.
          </div>
          <Button variant="primary" fullWidth className="mt-3.5" onClick={handleUseGuestPhone}>
            Pakai Nomor Ini
          </Button>
        </div>
      )}
    </Modal>
  );
}
