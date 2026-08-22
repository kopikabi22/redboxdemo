"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionEmployee } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";

export default function HomePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;

  useEffect(() => {
    if (!isClient) return;
    if (!session) {
      router.replace("/login");
    } else if (session.role === "Kasir") {
      router.replace("/pos/new");
    } else if (session.role === "Barber") {
      router.replace("/appointment/queue");
    } else {
      router.replace("/manajemen");
    }
  }, [isClient, session, router]);

  return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Mengarahkan…</div>;
}
