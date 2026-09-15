import type { ReactNode } from "react";

type BadgeTone = "ok" | "warn" | "danger" | "gold" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  ok: "bg-ok/10 text-ok border border-ok/25",
  warn: "bg-warn/10 text-warn border border-warn/25",
  danger: "bg-danger/10 text-danger border border-danger/25",
  gold: "bg-gold-bright/15 text-gold-bright border border-gold-bright/30",
  neutral: "bg-surface-2 text-text-muted border border-border",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
