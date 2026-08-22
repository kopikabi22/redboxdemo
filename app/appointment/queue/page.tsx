"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession, getBranchById } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { AppShell, getNavItemsForRole } from "@/components/layout/AppShell";

/** Placeholder — Appointment & Queue is Tier 2 scope, not built yet. */
export default function AppointmentQueuePlaceholderPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;
  const branch = session ? getBranchById(session.branchId) : undefined;

  useEffect(() => {
    if (isClient && !session) {
      router.replace("/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("karyawan");
    router.replace("/login");
  }

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <AppShell
      employee={session}
      branch={branch}
      pageTitle="Appointment & Queue"
      navItems={getNavItemsForRole(session.role)}
      activeNavId="appointment"
      onLogout={handleLogout}
    >
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <div className="font-accent italic text-gold-bright">Tier 2 — belum dibangun</div>
        <p className="max-w-sm text-sm text-text-muted">
          Modul Appointment &amp; Queue untuk cabang {branch?.name ?? "—"} akan tersedia di Tier 2.
        </p>
      </div>
    </AppShell>
  );
}
