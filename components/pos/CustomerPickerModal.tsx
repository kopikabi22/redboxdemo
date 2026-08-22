"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { searchMemberCustomers, getMembershipActivationFee, formatRupiah } from "@/lib/data";
import type { TransactionCustomer } from "@/lib/data";

interface CustomerPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: TransactionCustomer) => void;
  /** "Daftar Baru" hands off to a separate activation-payment flow the caller owns — this modal never calls checkout() itself. */
  onStartRegistration: (draft: { name: string; phone: string; referrerId: string | null }) => void;
}

type Mode = "member" | "guest" | "register";

export function CustomerPickerModal({ open, onClose, onSelect, onStartRegistration }: CustomerPickerModalProps) {
  const [mode, setMode] = useState<Mode>("member");
  const [query, setQuery] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regReferrerPhone, setRegReferrerPhone] = useState("");
  const [regError, setRegError] = useState<string | null>(null);

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
      setRegName("");
      setRegPhone("");
      setRegReferrerPhone("");
      setRegError(null);
    }
  }

  const results = searchMemberCustomers(query);
  const referrerMatch = regReferrerPhone.trim().length >= 8 ? searchMemberCustomers(regReferrerPhone.trim())[0] ?? null : null;
  const activationFee = getMembershipActivationFee();

  function handleUseGuestPhone() {
    const trimmed = guestPhone.trim();
    if (trimmed.length < 8) {
      setGuestError("Nomor HP minimal 8 digit.");
      return;
    }
    onSelect({ type: "guest", customerId: null, name: "Guest", phone: trimmed, tier: null });
  }

  function handleStartRegistration() {
    const name = regName.trim();
    const phone = regPhone.trim();
    if (!name) {
      setRegError("Nama wajib diisi.");
      return;
    }
    if (phone.length < 8) {
      setRegError("Nomor HP minimal 8 digit.");
      return;
    }
    const referrerPhoneTrimmed = regReferrerPhone.trim();
    if (referrerPhoneTrimmed.length >= 8 && !referrerMatch) {
      setRegError("Nomor HP yang mereferensikan tidak ditemukan di daftar member. Kosongkan kalau tidak ada referral.");
      return;
    }
    if (activationFee === null) {
      setRegError("Service Aktivasi Member tidak ditemukan di katalog. Hubungi Owner/HQ.");
      return;
    }
    setRegError(null);
    onStartRegistration({ name, phone, referrerId: referrerMatch ? referrerMatch.id : null });
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
      <div className="mb-3 grid grid-cols-3 gap-2">
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
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`rounded-md border px-3 py-2.5 text-center text-xs font-bold ${
            mode === "register" ? "border-gold-bright bg-surface-2 text-gold-bright" : "border-border bg-surface text-text-muted"
          }`}
        >
          Daftar Baru
        </button>
      </div>

      {mode === "member" && (
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
      )}

      {mode === "guest" && (
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

      {mode === "register" && (
        <div>
          <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-text-faint">Nama</div>
          <input
            type="text"
            placeholder="Nama lengkap"
            value={regName}
            onChange={(event) => setRegName(event.target.value)}
            className="mb-2.5 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
          />
          <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-text-faint">Nomor HP</div>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="08xxxxxxxxxx"
            value={regPhone}
            onChange={(event) => setRegPhone(event.target.value.replace(/[^0-9]/g, ""))}
            className="mb-2.5 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
          />
          <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-text-faint">Nomor HP yang Mereferensikan (opsional)</div>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="08xxxxxxxxxx"
            value={regReferrerPhone}
            onChange={(event) => setRegReferrerPhone(event.target.value.replace(/[^0-9]/g, ""))}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
          />
          {regReferrerPhone.trim().length >= 8 && (
            <div className={`mt-1.5 text-xs ${referrerMatch ? "text-gold-bright" : "text-danger"}`}>
              {referrerMatch ? `Ditemukan: ${referrerMatch.name}` : "Tidak ditemukan di daftar member."}
            </div>
          )}
          {regError && <div className="mt-1.5 text-xs text-danger">{regError}</div>}
          <div className="mt-2 text-xs text-text-faint">
            {activationFee !== null
              ? `Aktivasi member sekali bayar ${formatRupiah(activationFee)}, berlaku seumur hidup. Setelah ini, layar pembayaran aktivasi akan terbuka.`
              : "Service Aktivasi Member belum tersedia di katalog — hubungi Owner/HQ sebelum mendaftarkan member baru."}
          </div>
          <Button variant="primary" fullWidth className="mt-3.5" onClick={handleStartRegistration}>
            Lanjut ke Pembayaran Aktivasi
          </Button>
        </div>
      )}
    </Modal>
  );
}
