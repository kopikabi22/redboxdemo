"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, type ReactNode } from "react";
import type { Branch, Employee, EmployeeRole } from "@/lib/data";
import { Button } from "@/components/ui/Button";

export interface NavItem {
  id: string;
  label: string;
  href: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for which tabs each POV Karyawan role sees in the
 * unified "Operasional Cabang" shell — grouped into static headers:
 * - KASIR & TRANSAKSI: POS, Appointment & Queue, Riwayat Transaksi (/riwayat)
 * - OPERASIONAL: Inventory
 * - SHIFT & HR: Attendance & Break, Jadwal Saya, Cashier Closing
 */
export function getNavGroupsForRole(role: EmployeeRole): NavGroup[] {
  if (role === "Kasir") {
    return [
      {
        id: "kasir_transaksi",
        label: "KASIR & TRANSAKSI",
        items: [
          { id: "pos", label: "POS", href: "/pos/new" },
          { id: "appointment", label: "Appointment & Queue", href: "/appointment" },
          { id: "riwayat", label: "Riwayat Transaksi", href: "/riwayat" },
        ],
      },
      {
        id: "operasional",
        label: "OPERASIONAL",
        items: [
          { id: "inventory", label: "Inventory", href: "/inventory" },
        ],
      },
      {
        id: "shift_hr",
        label: "SHIFT & HR",
        items: [
          { id: "attendance", label: "Attendance & Break", href: "/attendance" },
          { id: "schedules", label: "Jadwal Saya", href: "/schedules" },
          { id: "closing", label: "Cashier Closing", href: "/pos/closing" },
        ],
      },
    ];
  }
  if (role === "Barber") {
    return [
      {
        id: "kasir_transaksi",
        label: "KASIR & TRANSAKSI",
        items: [
          { id: "appointment", label: "Appointment & Queue", href: "/appointment" },
        ],
      },
      {
        id: "shift_hr",
        label: "SHIFT & HR",
        items: [
          { id: "attendance", label: "Attendance & Break", href: "/attendance" },
          { id: "schedules", label: "Jadwal Saya", href: "/schedules" },
        ],
      },
    ];
  }
  return [];
}

export function getNavItemsForRole(role: EmployeeRole): NavItem[] {
  return getNavGroupsForRole(role).flatMap((g) => g.items);
}

interface AppShellProps {
  employee: Employee;
  branch: Branch | undefined;
  pageTitle: string;
  navItems?: NavItem[];
  navGroups?: NavGroup[];
  activeNavId: string;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * Shell for the unified "Operasional Cabang" module (POV Karyawan): one
 * sidebar + topbar, grouped by static category headers without accordion.
 */
export function AppShell({
  employee,
  branch,
  pageTitle,
  navItems,
  navGroups,
  activeNavId,
  onLogout,
  children,
}: AppShellProps) {
  const groupsToRender = useMemo(() => {
    if (navGroups && navGroups.length > 0) return navGroups;

    const baseGroups = getNavGroupsForRole(employee.role);
    if (!navItems || navItems.length === 0) return baseGroups;

    // Filter items in baseGroups to only those present in navItems
    const allowedIds = new Set(navItems.map((i) => i.id));
    return baseGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => allowedIds.has(item.id)),
      }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, navItems, employee.role]);

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-r border-border bg-bg-raised md:sticky md:top-0 md:h-screen">
        <div className="border-b border-border px-4 pb-3 pt-5">
          <Image src="/logo-redbox.png" alt="RedBox Logo" width={140} height={45} className="object-contain" />
          <div className="mt-1 text-[10px] uppercase tracking-wide text-text-faint">POV Karyawan</div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5">
          {groupsToRender.map((group, groupIdx) => (
            <div key={group.id}>
              <div
                className={`px-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider ${
                  groupIdx === 0 ? "mt-2 mb-2" : "mt-6 mb-2"
                }`}
              >
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.id === activeNavId;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-[13px] font-semibold transition-colors ${
                        isActive
                          ? "border-gold-bright bg-surface-2 font-bold text-gold-bright shadow-sm"
                          : "border-transparent text-text-muted hover:bg-surface hover:text-text"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
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
