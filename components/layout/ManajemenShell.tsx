"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Branch, Employee } from "@/lib/data";
import { Button } from "@/components/ui/Button";

export interface ManajemenNavItem {
  id: string;
  label: string;
  href: string;
}

const NAV_ITEMS: ManajemenNavItem[] = [
  { id: "overview", label: "Ringkasan", href: "/manajemen" },
  { id: "branch", label: "Branch Management", href: "/manajemen/branch" },
  { id: "catalog", label: "Product & Service Master", href: "/manajemen/catalog" },
  { id: "customers", label: "Customer Database", href: "/manajemen/customers" },
  { id: "membership", label: "Membership & Loyalty", href: "/manajemen/membership" },
  { id: "promotions", label: "Promosi & Diskon", href: "/manajemen/promotions" },
  { id: "employees", label: "Employee Master", href: "/manajemen/employees" },
];

interface ManajemenShellProps {
  employee: Employee;
  branches: Branch[];
  /** Branch currently being viewed/managed for branch-scoped data (Employee Master list, product stock). Owner can change it; BranchManager's is fixed to their own. */
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  pageTitle: string;
  activeNavId: string;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * Separate from AppShell (POV Karyawan) on purpose: this shell needs a
 * branch switcher and a "currently selected branch" concept that AppShell
 * has no notion of at all (POV Karyawan is always auto-scoped to the
 * logged-in employee's own branch, never a choice). Retrofitting AppShell
 * to support both would add a prop/branch-state axis to a component that's
 * simple and already working for its one job.
 */
export function ManajemenShell({
  employee,
  branches,
  selectedBranchId,
  onBranchChange,
  pageTitle,
  activeNavId,
  onLogout,
  children,
}: ManajemenShellProps) {
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-r border-border bg-bg-raised md:sticky md:top-0 md:h-screen">
        <div className="border-b border-border px-4 pb-3 pt-5">
          <div className="flex items-center gap-2 font-display text-2xl tracking-wide">
            <span className="inline-block h-3 w-3 bg-red" style={{ boxShadow: "3px 3px 0 var(--gold)" }} />
            REDBOX
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-text-faint">POV Manajemen</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2.5">
          {NAV_ITEMS.map((item) => (
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
            {employee.role === "Owner" ? (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-gold-bright">
                <select
                  value={selectedBranchId}
                  onChange={(event) => onBranchChange(event.target.value)}
                  className="bg-transparent py-1 text-xs font-bold text-gold-bright focus:outline-none"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id} className="bg-surface text-text">
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-gold-bright">
                Cabang {selectedBranch?.name ?? "—"}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-muted">
              <span className="inline-block h-5 w-5 rounded-full bg-red" />
              {employee.name} · {employee.role === "Owner" ? "Owner/HQ" : "Branch Manager"}
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 pb-16 pt-5">{children}</main>
      </div>
    </div>
  );
}
