import type { ReactNode } from "react";

type BadgeTone = "ok" | "warn" | "danger" | "gold" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  ok: "bg-ok/15 text-ok",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  gold: "bg-gold-bright/20 text-gold-bright",
  neutral: "bg-surface-2 text-text-muted",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
