"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  message: string;
  /** May throw (e.g. a business-rule guard in the data layer) — shown inline, dialog stays open. */
  onConfirm: () => void;
  confirmLabel?: string;
}

export function ConfirmDialog({ open, onClose, eyebrow, title, message, onConfirm, confirmLabel = "Ya, Lanjutkan" }: ConfirmDialogProps) {
  const [error, setError] = useState<string | null>(null);

  // Same render-time reset pattern used across the other modals in this app.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setError(null);
  }

  function handleConfirm() {
    setError(null);
    try {
      onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses.");
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
          <Button variant="danger" fullWidth onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-text-muted">{message}</div>
      {error && (
        <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      )}
    </Modal>
  );
}
