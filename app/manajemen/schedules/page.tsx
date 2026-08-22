"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getEmployees,
  getSchedulesByBranchAndDateRange,
  upsertEmployeeSchedule,
  deleteSchedule,
  SHIFT_TIMES,
} from "@/lib/data";
import type { Employee, ShiftSchedule, ShiftType } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

function addDays(d: Date, days: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

interface ShiftModalState {
  open: boolean;
  scheduleId?: string | null;
  employeeId: string;
  employeeName: string;
  role: string;
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  notes: string;
}

const DEFAULT_MODAL_STATE: ShiftModalState = {
  open: false,
  scheduleId: null,
  employeeId: "",
  employeeName: "",
  role: "",
  date: "",
  shiftType: "pagi",
  startTime: "09:00",
  endTime: "15:00",
  notes: "",
};

export default function ManajemenSchedulesPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const employee = session;

  const branches = useMemo(() => (isClient ? getBranches() : []), [isClient]);
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(employee, branches);

  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [modalState, setModalState] = useState<ShiftModalState>(DEFAULT_MODAL_STATE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isClient) return;
    if (!session) {
      router.replace("/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("manajemen");
    router.replace("/login");
  }

  // Calculate current week's 7 days
  const weekDays = useMemo(() => {
    const today = new Date();
    const baseMonday = getMonday(today);
    const targetMonday = addDays(baseMonday, weekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(targetMonday, i);
      return {
        dateStr: formatDateString(d),
        dayName: DAY_NAMES[i],
        dayNumber: d.getDate(),
        monthName: d.toLocaleDateString("id-ID", { month: "short" }),
        isToday: formatDateString(d) === formatDateString(new Date()),
      };
    });
  }, [weekOffset]);

  const startDateStr = weekDays[0].dateStr;
  const endDateStr = weekDays[6].dateStr;

  // Selected Branch Data
  const currentBranch = branches.find((b) => b.id === selectedBranchId);
  const minCoverage = currentBranch?.minBarberCoverage ?? 1;

  // Employees in selected branch
  const branchEmployees = useMemo(() => {
    if (!isClient || !selectedBranchId) return [];
    return getEmployees().filter((e) => e.branchId === selectedBranchId);
  }, [isClient, selectedBranchId]);

  // Schedules in current week range
  const weekSchedules = useMemo(() => {
    if (!isClient || !selectedBranchId) return [];
    void scheduleVersion;
    return getSchedulesByBranchAndDateRange(selectedBranchId, startDateStr, endDateStr);
  }, [isClient, selectedBranchId, startDateStr, endDateStr, scheduleVersion]);

  // Daily Active Barber Coverage Count
  const dailyCoverage = useMemo(() => {
    const barbers = branchEmployees.filter((e) => e.role === "Barber");

    return weekDays.map((day) => {
      let activeCount = 0;
      for (const barber of barbers) {
        const sch = weekSchedules.find((s) => s.employeeId === barber.id && s.date === day.dateStr);
        if (!sch || (sch.shiftType !== "off" && sch.shiftType !== "cuti")) {
          activeCount++;
        }
      }
      return {
        dateStr: day.dateStr,
        activeCount,
        isUnderCovered: activeCount < minCoverage,
      };
    });
  }, [weekDays, branchEmployees, weekSchedules, minCoverage]);

  function handleOpenCellModal(targetEmp: Employee, dateStr: string) {
    const existing = weekSchedules.find((s) => s.employeeId === targetEmp.id && s.date === dateStr);
    setErrorMsg(null);

    if (existing) {
      setModalState({
        open: true,
        scheduleId: existing.id,
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        role: targetEmp.role,
        date: dateStr,
        shiftType: existing.shiftType,
        startTime: existing.startTime,
        endTime: existing.endTime,
        notes: existing.notes ?? "",
      });
    } else {
      setModalState({
        open: true,
        scheduleId: null,
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        role: targetEmp.role,
        date: dateStr,
        shiftType: "pagi",
        startTime: SHIFT_TIMES.pagi.startTime,
        endTime: SHIFT_TIMES.pagi.endTime,
        notes: "",
      });
    }
  }

  function handleShiftTypeChange(newType: ShiftType) {
    const cfg = SHIFT_TIMES[newType];
    setModalState((prev) => ({
      ...prev,
      shiftType: newType,
      startTime: cfg.startTime,
      endTime: cfg.endTime,
    }));
  }

  function handleSaveShift() {
    if (!employee) return;
    setErrorMsg(null);
    try {
      upsertEmployeeSchedule(
        {
          employeeId: modalState.employeeId,
          date: modalState.date,
          shiftType: modalState.shiftType,
          startTime: modalState.startTime,
          endTime: modalState.endTime,
          notes: modalState.notes,
        },
        employee,
      );
      setScheduleVersion((v) => v + 1);
      setModalState(DEFAULT_MODAL_STATE);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan jadwal.");
    }
  }

  function handleDeleteShift() {
    if (!employee || !modalState.scheduleId) return;
    setErrorMsg(null);
    try {
      deleteSchedule(modalState.scheduleId, employee);
      setScheduleVersion((v) => v + 1);
      setModalState(DEFAULT_MODAL_STATE);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus jadwal.");
    }
  }

  function getShiftBadgeClass(type: ShiftType) {
    switch (type) {
      case "pagi":
        return "border-blue-500/30 bg-blue-500/15 text-blue-400";
      case "siang":
        return "border-amber-500/30 bg-amber-500/15 text-amber-400";
      case "full":
        return "border-gold-bright/40 bg-gold-bright/15 text-gold-bright font-bold";
      case "off":
        return "border-border bg-surface-2 text-text-faint";
      case "cuti":
        return "border-danger/40 bg-danger/15 text-danger font-semibold";
      default:
        return "border-border bg-surface-2 text-text-muted";
    }
  }

  function getShiftLabel(type: ShiftType) {
    switch (type) {
      case "pagi":
        return "Pagi";
      case "siang":
        return "Siang";
      case "full":
        return "Full Day";
      case "off":
        return "OFF";
      case "cuti":
        return "Cuti/Izin";
      default:
        return type;
    }
  }

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <ManajemenShell
      employee={employee}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Jadwal Kerja (Roster)"
      activeNavId="schedules"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Navigation & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-2/80"
            >
              ◀ Minggu Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-2/80"
            >
              Minggu Ini
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-2/80"
            >
              Minggu Berikutnya ▶
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-gold-bright">
              {weekDays[0].dateStr} s.d. {weekDays[6].dateStr}
            </span>
            <span className="rounded bg-surface-2 px-2.5 py-1 text-text-muted">
              Min. Barber Coverage: <strong className="text-text">{minCoverage} Barber</strong>
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/60 px-3.5 py-2 text-[11px]">
          <span className="font-bold text-text-muted">Keterangan:</span>
          <span className="rounded border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-blue-400">
            Pagi (09:00 - 15:00)
          </span>
          <span className="rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-amber-400">
            Siang (15:00 - 21:00)
          </span>
          <span className="rounded border border-gold-bright/40 bg-gold-bright/15 px-2 py-0.5 font-bold text-gold-bright">
            Full Day (09:00 - 21:00)
          </span>
          <span className="rounded border border-border bg-surface-2 px-2 py-0.5 text-text-faint">
            OFF (Libur)
          </span>
          <span className="rounded border border-danger/40 bg-danger/15 px-2 py-0.5 font-semibold text-danger">
            Cuti / Izin
          </span>
        </div>

        {/* Weekly Matrix Grid */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-text-muted">
              <tr>
                <th className="w-48 px-3.5 py-3">KARYAWAN</th>
                {weekDays.map((day) => (
                  <th
                    key={day.dateStr}
                    className={`px-3 py-3 text-center ${
                      day.isToday ? "bg-gold-bright/10 text-gold-bright" : ""
                    }`}
                  >
                    <div className="font-bold">{day.dayName}</div>
                    <div className="text-[10px] font-normal text-text-faint">
                      {day.dayNumber} {day.monthName}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {branchEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-faint">
                    Belum ada karyawan yang terdaftar di cabang ini.
                  </td>
                </tr>
              ) : (
                branchEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-surface-2/40">
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-text">{emp.name}</div>
                      <div className="text-[11px] text-text-faint">
                        {emp.role === "Barber" ? "💈 Barber" : `👤 ${emp.role}`}
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const sch = weekSchedules.find(
                        (s) => s.employeeId === emp.id && s.date === day.dateStr,
                      );
                      const shiftType: ShiftType = sch ? sch.shiftType : "pagi";

                      return (
                        <td
                          key={day.dateStr}
                          className={`p-2 text-center ${
                            day.isToday ? "bg-gold-bright/5" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenCellModal(emp, day.dateStr)}
                            className={`w-full rounded border px-2 py-1.5 text-center transition-all hover:scale-105 ${getShiftBadgeClass(
                              shiftType,
                            )}`}
                          >
                            <div className="text-xs font-bold">{getShiftLabel(shiftType)}</div>
                            {sch?.startTime && sch?.endTime ? (
                              <div className="font-mono text-[10px] opacity-80">
                                {sch.startTime} - {sch.endTime}
                              </div>
                            ) : !sch ? (
                              <div className="text-[10px] italic opacity-60">Default (Pagi)</div>
                            ) : (
                              <div className="text-[10px] opacity-60">—</div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            {/* Footer: Daily Coverage Summary */}
            <tfoot className="border-t-2 border-border bg-surface-2 text-xs font-bold">
              <tr>
                <td className="px-3.5 py-3">
                  <div>BARBER AKTIF / HARI</div>
                  <div className="text-[10px] font-normal text-text-faint">
                    Target min: {minCoverage} barber
                  </div>
                </td>
                {dailyCoverage.map((cov) => (
                  <td
                    key={cov.dateStr}
                    className={`px-3 py-3 text-center ${
                      cov.isUnderCovered
                        ? "bg-danger/20 text-danger"
                        : "text-ok"
                    }`}
                  >
                    <div className="text-sm font-bold">{cov.activeCount} Barber</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider">
                      {cov.isUnderCovered ? "⚠️ Kritis" : "✓ Cukup"}
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal Edit Shift */}
      <Modal
        open={modalState.open}
        onClose={() => setModalState(DEFAULT_MODAL_STATE)}
        eyebrow="Pengaturan Shift"
        title={`${modalState.employeeName} · ${modalState.date}`}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            {modalState.scheduleId ? (
              <Button variant="ghost" onClick={handleDeleteShift} className="text-danger">
                Hapus Jadwal
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setModalState(DEFAULT_MODAL_STATE)}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleSaveShift}>
                Simpan Jadwal
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          {errorMsg && (
            <div className="rounded border border-danger/40 bg-danger/10 p-2.5 text-danger font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="mb-1 block font-bold text-text-muted">TIPE SHIFT</label>
            <div className="grid grid-cols-3 gap-2">
              {(["pagi", "siang", "full", "off", "cuti"] as ShiftType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleShiftTypeChange(type)}
                  className={`rounded border p-2 text-center font-bold capitalize transition-all ${
                    modalState.shiftType === type
                      ? "border-gold-bright bg-gold-bright text-bg"
                      : "border-border bg-surface-2 text-text hover:bg-surface-2/80"
                  }`}
                >
                  {getShiftLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {modalState.shiftType !== "off" && modalState.shiftType !== "cuti" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold text-text-muted">JAM MULAI</label>
                <input
                  type="time"
                  value={modalState.startTime}
                  onChange={(e) => setModalState((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-text-muted">JAM SELESAI</label>
                <input
                  type="time"
                  value={modalState.endTime}
                  onChange={(e) => setModalState((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-gold-bright focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block font-bold text-text-muted">CATATAN (OPSIONAL)</label>
            <input
              type="text"
              placeholder="Misal: Bertukar shift dengan Agus..."
              value={modalState.notes}
              onChange={(e) => setModalState((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </ManajemenShell>
  );
}
