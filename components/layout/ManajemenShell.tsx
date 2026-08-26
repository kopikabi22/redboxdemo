"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import type { Branch, Employee } from "@/lib/data";
import { Button } from "@/components/ui/Button";

export interface ManajemenNavItem {
  id: string;
  label: string;
  href: string;
}

export interface ManajemenNavGroup {
  id: string;
  label: string;
  items: ManajemenNavItem[];
}

export const NAV_GROUPS: ManajemenNavGroup[] = [
  {
    id: "executive_analytics",
    label: "📊 Eksekutif & Analitik",
    items: [
      { id: "executive", label: "Executive Dashboard (BI)", href: "/manajemen/executive" },
      { id: "analytics_productivity", label: "Produktivitas & Okupansi", href: "/manajemen/analytics/productivity" },
      { id: "targets", label: "Target & KPI Cabang", href: "/manajemen/targets" },
      { id: "audit", label: "Audit Trail & Log", href: "/manajemen/audit" },
    ],
  },
  {
    id: "operations",
    label: "💈 Operasional Cabang",
    items: [
      { id: "overview", label: "Ringkasan Operasional", href: "/manajemen" },
      { id: "branch", label: "Manajemen Cabang", href: "/manajemen/branch" },
      { id: "appointments", label: "Reservasi & Antrean", href: "/manajemen/appointments" },
      { id: "schedules", label: "Jadwal & Shift Kerja", href: "/manajemen/schedules" },
    ],
  },
  {
    id: "catalog_inventory",
    label: "📦 Katalog & Inventori",
    items: [
      { id: "catalog", label: "Master Layanan & Produk", href: "/manajemen/catalog" },
      { id: "catalog_velocity", label: "Menu & Product Velocity", href: "/manajemen/catalog/velocity" },
      { id: "batches", label: "Batch & Kadaluarsa (FEFO)", href: "/manajemen/inventory/batches" },
      { id: "stock_opname", label: "Stock Opname", href: "/manajemen/inventory/opname" },
      { id: "stock_transfers", label: "Transfer Stok Cabang", href: "/manajemen/inventory/transfers" },
      { id: "purchase_orders", label: "Purchase Orders (PO)", href: "/manajemen/purchasing/orders" },
      { id: "suppliers", label: "Master Supplier", href: "/manajemen/purchasing/suppliers" },
    ],
  },
  {
    id: "crm_loyalty",
    label: "👥 CRM & Loyalitas",
    items: [
      { id: "customers", label: "Database Pelanggan", href: "/manajemen/customers" },
      { id: "crm_intelligence", label: "Customer Intelligence (RFM)", href: "/manajemen/crm/intelligence" },
      { id: "membership", label: "Program Membership", href: "/manajemen/membership" },
      { id: "promotions", label: "Promo & Diskon", href: "/manajemen/promotions" },
      { id: "reminders", label: "Reminder WhatsApp", href: "/manajemen/reminders" },
    ],
  },
  {
    id: "finance_hr",
    label: "💰 Keuangan & HR",
    items: [
      { id: "finance_pnl", label: "Laporan P&L & Kas", href: "/manajemen/finance/pnl" },
      { id: "finance_expenses", label: "Beban Operasional (OPEX)", href: "/manajemen/finance/expenses" },
      { id: "finance_ap", label: "Hutang Dagang (AP)", href: "/manajemen/finance/ap" },
      { id: "payroll", label: "Gaji & Komisi (Payroll)", href: "/manajemen/hr/payroll" },
      { id: "advances", label: "Kasbon Karyawan", href: "/manajemen/hr/advances" },
      { id: "employees", label: "Data Karyawan", href: "/manajemen/employees" },
    ],
  },
];

export const NAV_ITEMS: ManajemenNavItem[] = NAV_GROUPS.flatMap((g) => g.items);

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
 * logged-in employee's own branch, never a choice).
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
  const pathname = usePathname();
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  // Helper to determine the active group ID based on activeNavId or pathname
  const getActiveGroupId = () => {
    for (const group of NAV_GROUPS) {
      if (
        group.items.some(
          (item) => item.id === activeNavId || (pathname && (item.href === pathname || pathname.startsWith(item.href + "/"))),
        )
      ) {
        return group.id;
      }
    }
    return NAV_GROUPS[0]?.id ?? "operations";
  };

  // Initialize open groups: ONLY the active group is open (true), all others are collapsed (false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const activeId = getActiveGroupId();
    const state: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      state[group.id] = group.id === activeId;
    }
    return state;
  });

  // When activeNavId or pathname changes, ensure the active group is expanded
  useEffect(() => {
    const activeId = getActiveGroupId();
    setOpenGroups((prev) => ({
      ...prev,
      [activeId]: true,
    }));
  }, [activeNavId, pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[255px_1fr]">
      <aside className="flex flex-col border-r border-border bg-bg-raised md:sticky md:top-0 md:h-screen">
        <div className="border-b border-border px-4 pb-3 pt-5">
          <div className="flex items-center gap-2 font-display text-2xl tracking-wide">
            <span className="inline-block h-3 w-3 bg-red" style={{ boxShadow: "3px 3px 0 var(--gold)" }} />
            REDBOX
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-text-faint">POV Manajemen · Back-Office</div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {NAV_GROUPS.map((group) => {
            const isOpen = !!openGroups[group.id];
            const hasActiveItem = group.items.some((item) => item.id === activeNavId);

            return (
              <div key={group.id} className="rounded-lg border border-border/40 bg-surface/40">
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold transition-all hover:bg-surface-2/60 ${
                    hasActiveItem ? "text-gold-bright" : "text-text"
                  }`}
                >
                  <span className="truncate tracking-wide">{group.label}</span>
                  <span
                    className={`ml-2 inline-block text-[10px] text-text-muted transition-transform duration-200 ${
                      isOpen ? "rotate-90 text-gold-bright" : ""
                    }`}
                  >
                    ▶
                  </span>
                </button>

                {/* Sub-items list */}
                {isOpen && (
                  <div className="space-y-0.5 border-t border-border/30 px-1.5 py-1.5">
                    {group.items.map((item) => {
                      const isActive = item.id === activeNavId;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`flex items-center gap-2 rounded-md border-l-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            isActive
                              ? "border-gold-bright bg-surface-2 font-bold text-gold-bright shadow-sm"
                              : "border-transparent text-text-muted hover:bg-surface-2 hover:text-text"
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-3.5">
          <Button variant="ghost" fullWidth onClick={onLogout}>
            🚪 Keluar / Ganti Akun
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3.5 border-b border-border bg-bg-raised px-6 py-3.5">
          <div className="font-display text-[22px] tracking-wide">{pageTitle}</div>
          <div className="flex items-center gap-2.5">
            {employee.role === "Owner" || employee.role === "Finance" || employee.role === "Admin" ? (
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
              {employee.name} · {employee.role === "Owner" ? "Owner/HQ" : employee.role === "Finance" ? "Finance" : employee.role === "Admin" ? "Admin" : "Branch Manager"}
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 pb-16 pt-5">{children}</main>
      </div>
    </div>
  );
}
