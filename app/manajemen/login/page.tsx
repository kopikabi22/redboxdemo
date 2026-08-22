"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getEmployeesByRoles,
  getBranchById,
  getSessionEmployee,
  setSessionEmployee,
  verifyEmployeePin,
} from "@/lib/data";
import type { Employee } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export default function ManajemenLoginPage() {
  const router = useRouter();
  const isClient = useIsClient();
  // Namespaced 'manajemen' — deliberately separate from the 'karyawan'
  // session so logging in here never signs in the POV Karyawan side too.
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employees = isClient && !session ? getEmployeesByRoles(["Owner", "BranchManager"]) : [];

  const [pinTarget, setPinTarget] = useState<Employee | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isClient && session) {
      router.replace("/manajemen");
    }
  }, [isClient, session, router]);

  function openPinModal(employee: Employee) {
    setPinTarget(employee);
    setPin("");
    setError(null);
  }

  function handleSubmitPin() {
    if (!pinTarget) return;
    if (verifyEmployeePin(pinTarget.id, pin)) {
      setSessionEmployee("manajemen", pinTarget);
      router.push("/manajemen");
    } else {
      setError("PIN salah, coba lagi.");
      setPin("");
    }
  }

  if (!isClient || session) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-10">
      <div className="mb-1 flex items-center gap-2.5 font-display text-5xl tracking-wide">
        <span className="inline-block h-5 w-5 bg-red" style={{ boxShadow: "4px 4px 0 var(--gold)" }} />
        REDBOX ERP
      </div>
      <div className="mb-9 font-accent italic text-text-faint">Back Office — pilih akun Anda</div>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-3.5 sm:grid-cols-3">
        {employees.map((employee) => {
          const branch = getBranchById(employee.branchId);
          return (
            <button
              key={employee.id}
              type="button"
              onClick={() => openPinModal(employee)}
              className="rounded-lg border border-border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-gold-bright"
            >
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-red text-sm font-extrabold">
                {employee.name.charAt(0)}
              </div>
              <div className="text-sm font-bold">{employee.name}</div>
              <div className="mt-0.5 text-xs font-semibold text-gold-bright">
                {employee.role === "Owner" ? "Owner / HQ" : "Branch Manager"}
              </div>
              <div className="mt-1.5 text-[11.5px] text-text-faint">
                {employee.role === "Owner" ? "Semua Cabang" : `Cabang ${branch?.name ?? "—"}`}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-xs text-text-faint">Tier 1 — data tersimpan lokal di browser ini, sama dengan POV Karyawan.</div>

      <Modal
        open={pinTarget !== null}
        onClose={() => setPinTarget(null)}
        eyebrow="Masuk"
        title={pinTarget ? `Masukkan PIN — ${pinTarget.name}` : ""}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setPinTarget(null)}>
              Batal
            </Button>
            <Button variant="primary" fullWidth onClick={handleSubmitPin} disabled={pin.length !== 4}>
              Masuk
            </Button>
          </>
        }
      >
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(event) => {
            setPin(event.target.value.replace(/[^0-9]/g, ""));
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && pin.length === 4) handleSubmitPin();
          }}
          placeholder="••••"
          className="w-full rounded-md border border-border bg-surface px-3 py-3 text-center text-2xl tracking-[0.5em] text-text focus:border-gold-bright focus:outline-none"
        />
        {error && <div className="mt-2.5 text-center text-sm text-danger">{error}</div>}
      </Modal>
    </div>
  );
}
