"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Single reusable dialog shell (PIN entry, customer picker, payment, receipt).
 * Each caller supplies its own body/footer content as children/props.
 */
export function Modal({ open, onClose, eyebrow, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col rounded-lg border border-border bg-bg-raised"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-5 pb-3 pt-5">
          <div>
            <div className="font-accent text-xs italic text-gold-bright">{eyebrow}</div>
            <div className="font-display text-2xl tracking-wide">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="px-1.5 py-0.5 text-lg text-text-faint hover:text-text"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-2.5 border-t border-border px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
