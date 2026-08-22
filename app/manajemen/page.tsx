"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee, clearSession } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { Button } from "@/components/ui/Button";

/** Placeholder — POV Manajemen routes haven't been designed yet (see CLAUDE.md). */
export default function ManajemenPlaceholderPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="font-display text-3xl tracking-wide">POV Manajemen</div>
      <div className="font-accent italic text-gold-bright">Menyusul</div>
      <p className="max-w-sm text-sm text-text-muted">
        Halo {session.name}, struktur route POV Manajemen belum didesain — akan menyusul setelah dibahas terpisah.
      </p>
      <Button variant="ghost" onClick={handleLogout}>
        Keluar / Ganti Akun
      </Button>
    </div>
  );
}
