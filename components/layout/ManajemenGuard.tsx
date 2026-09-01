"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSessionEmployee } from "@/lib/data";

export interface ManajemenGuardProps {
  children: ReactNode;
}

export function ManajemenGuard({ children }: ManajemenGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    // Login page doesn't need guard redirect
    if (pathname === "/manajemen/login") {
      setIsAuthorized(true);
      setIsChecking(false);
      return;
    }

    const manajemenSession = getSessionEmployee("manajemen");
    const karyawanSession = getSessionEmployee("karyawan");

    if (manajemenSession) {
      // Sesi manajemen valid
      setIsAuthorized(true);
    } else if (karyawanSession) {
      // Ada sesi karyawan/kasir, perintahkan redirect paksa ke POS
      setIsAuthorized(false);
      router.replace("/pos/new");
    } else {
      // Tidak ada sesi sama sekali
      setIsAuthorized(false);
      router.replace("/manajemen/login");
    }

    setIsChecking(false);
  }, [pathname, router]);

  // If on login page, always render children
  if (pathname === "/manajemen/login") {
    return <>{children}</>;
  }

  // Kondisional Ketat:
  // 1. Jika iChecking masih true, tampilan loading state
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted">
        Memverifikasi otorisasi keamanan...
      </div>
    );
  }

  // 2. Jika tidak lolos otorisasi, jangan render apapun
  if (!isAuthorized) {
    return null;
  }

  // 3. Jika lolos semua, render children
  return <>{children}</>;
}
