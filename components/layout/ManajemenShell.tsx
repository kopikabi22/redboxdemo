"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import { getSessionEmployee, type Branch, type Employee } from "@/lib/data";
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
      { id: "assets", label: "Aset & Alat Kerja", href: "/manajemen/inventory/assets" },
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
  employee?: Employee | null;
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
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Cross-role RBAC Route Protection:
  // - If manajemen session is missing but karyawan session is detected -> force redirect to /pos/new
  // - If both sessions are missing -> redirect to /manajemen/login
  useEffect(() => {
    const manajemenSession = getSessionEmployee("manajemen");
    const karyawanSession = getSessionEmployee("karyawan");

    if (manajemenSession) {
      setIsAuthorized(true);
      setCheckingAuth(false);
    } else if (karyawanSession) {
      router.replace("/pos/new");
    } else {
      router.replace("/manajemen/login");
    }
  }, [router]);
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  // Helper to determine if a specific navigation item is active
  const isItemActive = (item: ManajemenNavItem) => {
    if (item.id === activeNavId) return true;
    if (!pathname) return false;
    if (item.href === "/manajemen") {
      return pathname === "/manajemen";
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  // Helper to determine if a group matches the current path/active item
  const isGroupActive = (groupId: string): boolean => {
    if (pathname) {
      if (groupId === "catalog_inventory") {
        if (
          pathname.includes("/inventory") ||
          pathname.includes("/catalog") ||
          pathname.includes("/purchasing")
        ) {
          return true;
        }
      }

      if (groupId === "finance_hr") {
        if (
          pathname.includes("/finance") ||
          pathname.includes("/hr") ||
          pathname.includes("/employees")
        ) {
          return true;
        }
      }

      if (groupId === "crm_loyalty") {
        if (
          pathname.includes("/crm") ||
          pathname.includes("/membership") ||
          pathname.includes("/promotions") ||
          pathname.includes("/reminders") ||
          pathname.includes("/customers")
        ) {
          return true;
        }
      }

      if (groupId === "executive_analytics") {
        if (
          pathname.includes("/executive") ||
          pathname.includes("/analytics") ||
          pathname.includes("/targets") ||
          pathname.includes("/audit")
        ) {
          return true;
        }
      }

      if (groupId === "operations") {
        if (
          pathname.includes("/branch") ||
          pathname.includes("/appointments") ||
          pathname.includes("/schedules") ||
          pathname === "/manajemen"
        ) {
          return true;
        }
      }
    }

    const group = NAV_GROUPS.find((g) => g.id === groupId);
    return group ? group.items.some((item) => isItemActive(item)) : false;
  };

  // Initialize open groups: Any group that matches is opened (true), others collapsed (false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      state[group.id] = isGroupActive(group.id);
    }
    return state;
  });

  // When activeNavId or pathname changes, ensure the active group remains expanded
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const group of NAV_GROUPS) {
        if (isGroupActive(group.id)) {
          next[group.id] = true;
        }
      }
      return next;
    });
  }, [activeNavId, pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Prevent interface flicker / leak while authentication is being verified
  if (checkingAuth || !isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg text-text-faint">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-bright border-t-transparent" />
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Mengautentikasi hak akses manajemen…
          </div>
        </div>
      </div>
    );
  }

  const activeEmployee = employee ?? getSessionEmployee("manajemen");

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[255px_1fr]">
      <aside className="flex flex-col border-r border-border bg-bg-raised md:sticky md:top-0 md:h-screen">
        <div className="border-b border-border px-4 pb-3 pt-5">
          <Image src="/logo-redbox.png" alt="RedBox Logo" width={140} height={45} className="object-contain" />
          <div className="mt-1 text-[10px] uppercase tracking-wide text-text-faint">POV Manajemen · Back-Office</div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {NAV_GROUPS.map((group) => {
            const isOpen = !!openGroups[group.id];
            const hasActiveItem = isGroupActive(group.id) || group.items.some((item) => isItemActive(item));

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
                      const isActive = isItemActive(item);
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
            {activeEmployee?.role === "Owner" || activeEmployee?.role === "Finance" || activeEmployee?.role === "Admin" ? (
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
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-gold-bright">
                Cabang {selectedBranch?.name ?? "—"}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-muted">
              <span className="inline-block h-5 w-5 rounded-full bg-red" />
              {activeEmployee?.name ?? "Staff"} · {activeEmployee?.role === "Owner" ? "Owner/HQ" : activeEmployee?.role === "Finance" ? "Finance" : activeEmployee?.role === "Admin" ? "Admin" : "Branch Manager"}
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 pb-16 pt-5">{children}</main>
      </div>
    </div>
  );
}
