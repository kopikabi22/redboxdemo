"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Branch, Employee, EmployeeRole } from "@/lib/data";
import { Button } from "@/components/ui/Button";

export interface NavItem {
  id: string;
  label: string;
  href: string;
}

/**
 * Single source of truth for which tabs each POV Karyawan role sees in the
 * unified "Operasional Cabang" shell — Kasir gets the full operational set,
 * Barber only Appointment & Queue (placeholder for now) and Attendance &
 * Break, per CLAUDE.md's role-based tab visibility rule.
 */
export function getNavItemsForRole(role: EmployeeRole): NavItem[] {
  if (role === "Kasir") {
    return [
      { id: "pos", label: "POS", href: "/pos/new" },
      { id: "attendance", label: "Attendance & Break", href: "/attendance" },
      { id: "inventory", label: "Inventory", href: "/inventory" },
    ];
  }
  if (role === "Barber") {
    return [
      { id: "appointment", label: "Appointment & Queue", href: "/appointment/queue" },
      { id: "attendance", label: "Attendance & Break", href: "/attendance" },
    ];
  }
  return [];
}

interface AppShellProps {
  employee: Employee;
  branch: Branch | undefined;
  pageTitle: string;
  navItems: NavItem[];
  activeNavId: string;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * Shell for the unified "Operasional Cabang" module (POV Karyawan): one
 * sidebar + topbar, tabs vary by role. Only built-out tabs are passed in
 * navItems — pages not built yet in this slice simply aren't listed.
 */
export function AppShell({ employee, branch, pageTitle, navItems, activeNavId, onLogout, children }: AppShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-r border-border bg-bg-raised md:sticky md:top-0 md:h-screen">
        <div className="border-b border-border px-4 pb-3 pt-5">
          <div className="flex items-center gap-2 font-display text-2xl tracking-wide">
            <span className="inline-block h-3 w-3 bg-red" style={{ boxShadow: "3px 3px 0 var(--gold)" }} />
            REDBOX
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-text-faint">POV Karyawan</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2.5">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`mb-0.5 flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2.5 text-[13.5px] font-semibold ${
                item.id === activeNavId
                  ? "border-gold-bright bg-surface-2 text-text"
                  : "border-transparent text-text-muted hover:bg-surface hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <Button variant="ghost" fullWidth onClick={onLogout}>
            Keluar / Ganti Akun
          </Button>
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3.5 border-b border-border bg-bg-raised px-6 py-3.5">
          <div className="font-display text-[22px] tracking-wide">{pageTitle}</div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-gold-bright">
              Cabang {branch?.name ?? "—"}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-muted">
              <span className="inline-block h-5 w-5 rounded-full bg-red" />
              {employee.name} · {employee.role}
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 pb-16 pt-5">{children}</main>
      </div>
    </div>
  );
}
