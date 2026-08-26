"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getBranchById,
  getManageableEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/data";
import type { Employee, EmployeeRole } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const ALL_ROLES: EmployeeRole[] = ["Kasir", "Barber", "BranchManager", "Owner", "Finance", "Admin"];
/** Roles a BranchManager is allowed to assign — elevated roles stay Owner/HQ-only, matching employees.ts's role-escalation guard. */
const ASSIGNABLE_ROLES_FOR_BRANCH_MANAGER: EmployeeRole[] = ["Kasir", "Barber"];
const ROLE_LABEL: Record<EmployeeRole, string> = {
  Kasir: "Kasir",
  Barber: "Barber",
  BranchManager: "Branch Manager",
  Owner: "Owner/HQ",
  Finance: "Finance",
  Admin: "Admin",
};

interface EmployeeFormState {
  id: string | null;
  name: string;
  role: EmployeeRole;
  branchId: string;
  pin: string;
}

export default function EmployeeMasterPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const branches = isClient ? getBranches() : [];
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(session, branches);

  const [dataVersion, setDataVersion] = useState(0);
  const [form, setForm] = useState<EmployeeFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  useEffect(() => {
    if (isClient && !session) {
      router.replace("/manajemen/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("manajemen");
    router.replace("/manajemen/login");
  }

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }
  // Captured as its own const so the hoisted `function` declarations below
  // see a type narrowed to `Employee` — TS doesn't carry the `if (!session)`
  // narrowing of the outer binding into a hoisted nested function body.
  const currentSession = session;

  void dataVersion;
  // RBAC scoping, logic-level: Owner gets every employee back, BranchManager
  // only their own branch's — enforced inside getManageableEmployees(),
  // not by filtering an already-fetched full list here on the page.
  const employees = getManageableEmployees(currentSession);

  function openCreateForm() {
    setFormError(null);
    setForm({
      id: null,
      name: "",
      role: "Kasir",
      // BranchManager can only ever create within their own branch — the
      // field starts there and, per the select below, stays disabled for
      // them so it can't be changed client-side either.
      branchId: currentSession.role === "Owner" ? (branches[0]?.id ?? "") : currentSession.branchId,
      pin: "",
    });
  }

  function openEditForm(employee: Employee) {
    setFormError(null);
    setForm({ id: employee.id, name: employee.name, role: employee.role, branchId: employee.branchId, pin: employee.pin });
  }

  function handleSave() {
    if (!form || !session) return;
    setFormError(null);
    try {
      const payload = { name: form.name, role: form.role, branchId: form.branchId, pin: form.pin };
      if (form.id) updateEmployee(form.id, payload, session);
      else createEmployee(payload, session);
      setForm(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan karyawan.");
    }
  }

  // BranchManager cannot transfer employees between branches (Owner/HQ-only
  // per CLAUDE.md) — the field is disabled for them on both create and edit,
  // matching the same rule updateEmployee()/createEmployee() enforce.
  const branchFieldDisabled = session.role !== "Owner";
  // BranchManager can still set a role, just never an elevated one — the
  // option list itself excludes BranchManager/Owner, matching the same
  // role-escalation guard createEmployee()/updateEmployee() enforce. Owner
  // keeps the full list.
  const assignableRoles = session.role === "Owner" ? ALL_ROLES : ASSIGNABLE_ROLES_FOR_BRANCH_MANAGER;

  return (
    <ManajemenShell
      employee={session}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Employee Master"
      activeNavId="employees"
      onLogout={handleLogout}
    >
      <div className="font-accent mb-1 text-xs italic text-gold-bright">
        {session.role === "Owner" ? "Semua Cabang" : "Cabang Anda"}
      </div>
      <div className="mb-1 font-display text-3xl tracking-wide">Employee Master</div>
      <div className="mb-4 max-w-xl text-sm text-text-muted">
        Data ini juga jadi kredensial login (PIN) untuk POV Karyawan. Rolling schedule, komisi, dan performance review
        lengkap tersedia di Tier 2/3.
      </div>

      <div className="mb-3.5 flex justify-end">
        <Button variant="primary" onClick={openCreateForm}>
          + Tambah Karyawan
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
              <th className="px-3 py-2 font-normal">Nama</th>
              <th className="px-3 py-2 font-normal">Role</th>
              <th className="px-3 py-2 font-normal">Cabang</th>
              <th className="px-3 py-2 font-normal">PIN</th>
              <th className="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const isSelf = employee.id === session.id;
              return (
                <tr key={employee.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-semibold">{employee.name}</td>
                  <td className="px-3 py-2">{ROLE_LABEL[employee.role]}</td>
                  <td className="px-3 py-2">{getBranchById(employee.branchId)?.name ?? "—"}</td>
                  <td className="px-3 py-2">••{employee.pin.slice(-2)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="default" className="px-2.5 py-1.5 text-xs" onClick={() => openEditForm(employee)}>
                        Ubah
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1.5 text-xs"
                        disabled={isSelf}
                        title={isSelf ? "Tidak bisa menghapus akun sendiri yang sedang login." : undefined}
                        onClick={() => setDeleteTarget(employee)}
                      >
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---- Employee form modal — PIN and role are set/changed here ---- */}
      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        eyebrow="Employee Master"
        title={form?.id ? "Ubah Karyawan" : "Tambah Karyawan"}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setForm(null)}>
              Batal
            </Button>
            <Button variant="primary" fullWidth onClick={handleSave}>
              Simpan
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Nama</div>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Role</div>
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as EmployeeRole })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">
                Cabang{branchFieldDisabled ? " (transfer cabang: Owner/HQ saja)" : ""}
              </div>
              <select
                value={form.branchId}
                disabled={branchFieldDisabled}
                onChange={(event) => setForm({ ...form, branchId: event.target.value })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none disabled:opacity-50"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">PIN (4 digit, untuk login &amp; clock-in/out)</div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={form.pin}
                onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/[^0-9]/g, "") })}
                placeholder="••••"
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-center text-lg tracking-[0.4em] text-text focus:border-gold-bright focus:outline-none"
              />
            </div>

            {formError && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Employee Master"
        title="Hapus Karyawan?"
        message="Akun ini tidak akan bisa login lagi ke POV Karyawan."
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (deleteTarget && session) {
            deleteEmployee(deleteTarget.id, session);
            setDataVersion((v) => v + 1);
          }
        }}
      />
    </ManajemenShell>
  );
}
