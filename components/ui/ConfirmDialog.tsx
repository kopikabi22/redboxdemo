"use client";

import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmLabel?: string;
}

export function ConfirmDialog({ open, onClose, eyebrow, title, message, onConfirm, confirmLabel = "Ya, Lanjutkan" }: ConfirmDialogProps) {
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
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-text-muted">{message}</div>
    </Modal>
  );
}
