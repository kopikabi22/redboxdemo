"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  /** Throw (with a message) to reject the PIN — shown inline, modal stays open. */
  onSubmit: (pin: string) => void;
  confirmLabel?: string;
}

export function PinModal({ open, onClose, eyebrow, title, onSubmit, confirmLabel = "Konfirmasi" }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Same render-time reset pattern used across the other modals in this app.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPin("");
      setError(null);
    }
  }

  function handleSubmit() {
    setError(null);
    try {
      onSubmit(pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN salah.");
      setPin("");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      footer={
        <>
          <Button variant="ghost" fullWidth onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} disabled={pin.length !== 4}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        autoFocus
        value={pin}
        onChange={(event) => {
          setPin(event.target.value.replace(/[^0-9]/g, ""));
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && pin.length === 4) handleSubmit();
        }}
        placeholder="••••"
        className="w-full rounded-md border border-border bg-surface px-3 py-3 text-center text-2xl tracking-[0.5em] text-text focus:border-gold-bright focus:outline-none"
      />
      {error && <div className="mt-2.5 text-center text-sm text-danger">{error}</div>}
    </Modal>
  );
}
