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
import type { Employee, EmployeeRole } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const ROLE_DISPLAY_LABEL: Record<string, string> = {
  Owner: "Owner",
  Finance: "Finance",
  Admin: "Admin",
  BranchManager: "Branch Manager",
};

export default function ManajemenLoginPage() {
  const router = useRouter();
  const isClient = useIsClient();
  // Namespaced 'manajemen' — deliberately separate from the 'karyawan'
  // session so logging in here never signs in the POV Karyawan side too.
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employees = isClient && !session ? getEmployeesByRoles(["Owner", "Finance", "Admin", "BranchManager"]) : [];

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [pinTarget, setPinTarget] = useState<Employee | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isClient && session) {
      router.replace("/manajemen");
    }
  }, [isClient, session, router]);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  function openPinModal(employee: Employee) {
    setSelectedEmployeeId(employee.id);
    setPinTarget(employee);
    setPin("");
    setError(null);
  }

  function handleDropdownSelect(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    const target = employees.find((e) => e.id === employeeId);
    if (target) {
      openPinModal(target);
    }
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
      <div className="mb-8 font-accent italic text-text-faint">POV Manajemen · Back Office — pilih akun Anda</div>

      {/* Dropdown Selector */}
      <div className="mb-6 w-full max-w-md rounded-xl border border-border/70 bg-surface/60 p-4 shadow-lg backdrop-blur-sm">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">
          Pilih Akun Manajemen
        </label>
        <select
          value={selectedEmployeeId}
          onChange={(e) => handleDropdownSelect(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-semibold text-text focus:border-gold-bright focus:outline-none"
        >
          {employees.map((emp) => {
            const roleLabel = ROLE_DISPLAY_LABEL[emp.role] ?? emp.role;
            return (
              <option key={emp.id} value={emp.id} className="bg-surface text-text">
                {emp.name} ({roleLabel})
              </option>
            );
          })}
        </select>
        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
            className="text-xs"
            onClick={() => {
              const target = employees.find((e) => e.id === selectedEmployeeId);
              if (target) openPinModal(target);
            }}
          >
            Lanjut Masukkan PIN →
          </Button>
        </div>
      </div>

      <div className="my-2 flex items-center gap-3 text-xs text-text-faint">
        <span className="h-px w-16 bg-border" />
        atau pilih cepat kartu di bawah
        <span className="h-px w-16 bg-border" />
      </div>

      {/* Account Cards Grid */}
      <div className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-3.5 sm:grid-cols-3">
        {employees.map((employee) => {
          const branch = getBranchById(employee.branchId);
          const isHQ = ["Owner", "Finance", "Admin"].includes(employee.role);
          const roleLabel = ROLE_DISPLAY_LABEL[employee.role] ?? employee.role;

          return (
            <button
              key={employee.id}
              type="button"
              onClick={() => openPinModal(employee)}
              className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-1 hover:border-gold-bright hover:shadow-lg ${
                selectedEmployeeId === employee.id
                  ? "border-gold-bright bg-surface-2 shadow-md"
                  : "border-border bg-surface"
              }`}
            >
              <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-red text-base font-extrabold text-white shadow-sm">
                {employee.name.charAt(0)}
              </div>
              <div className="text-base font-bold text-text">{employee.name}</div>
              <div className="mt-0.5 text-xs font-bold text-gold-bright">
                {roleLabel}
              </div>
              <div className="mt-1.5 text-[11.5px] text-text-faint">
                {isHQ ? "Semua Cabang (All / HQ)" : `Cabang ${branch?.name ?? "—"}`}
              </div>
              <div className="mt-3 text-[11px] font-mono text-text-muted/70">
                PIN: •••• (Klik untuk masuk)
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 text-xs text-text-faint">Tier 1-4 · Data tersimpan lokal di browser ini, tersinkronisasi antar-POV.</div>

      <Modal
        open={pinTarget !== null}
        onClose={() => setPinTarget(null)}
        eyebrow="Masuk POV Manajemen"
        title={pinTarget ? `Masukkan PIN — ${pinTarget.name} (${ROLE_DISPLAY_LABEL[pinTarget.role] ?? pinTarget.role})` : ""}
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
        <div className="mb-3 text-center text-xs text-text-muted">
          Masukkan 4 digit PIN akun <span className="font-bold text-text">{pinTarget?.name}</span>
        </div>
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
        {error && <div className="mt-2.5 text-center text-sm font-semibold text-danger">{error}</div>}
      </Modal>
    </div>
  );
}
