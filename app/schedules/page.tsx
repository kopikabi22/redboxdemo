"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranchById,
  getEmployees,
  getSchedulesByBranchAndDateRange,
  getSchedulesByBranchAndDate,
} from "@/lib/data";
import type { ShiftType } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { AppShell, getNavItemsForRole } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";

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

export default function EmployeeSchedulePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;
  const employee = session;
  const branch = employee ? getBranchById(employee.branchId) : undefined;

  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (isClient && !session) {
      router.replace("/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("karyawan");
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
  const todayStr = formatDateString(new Date());

  // Schedules for this employee's branch in this week
  const branchWeekSchedules = useMemo(() => {
    if (!isClient || !employee) return [];
    return getSchedulesByBranchAndDateRange(employee.branchId, startDateStr, endDateStr);
  }, [isClient, employee, startDateStr, endDateStr]);

  // Today's team schedule
  const todayTeamSchedules = useMemo(() => {
    if (!isClient || !employee) return [];
    return getSchedulesByBranchAndDate(employee.branchId, todayStr);
  }, [isClient, employee, todayStr]);

  // All employees in branch
  const branchEmployees = useMemo(() => {
    if (!isClient || !employee) return [];
    return getEmployees().filter((e) => e.branchId === employee.branchId);
  }, [isClient, employee]);

  // Today's schedule for this logged-in employee
  const todayMySchedule = useMemo(() => {
    if (!employee) return null;
    return todayTeamSchedules.find((s) => s.employeeId === employee.id);
  }, [employee, todayTeamSchedules]);

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
        return "Pagi (09:00 - 15:00)";
      case "siang":
        return "Siang (15:00 - 21:00)";
      case "full":
        return "Full Day (09:00 - 21:00)";
      case "off":
        return "OFF (Libur)";
      case "cuti":
        return "Cuti / Izin";
      default:
        return type;
    }
  }

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  return (
    <AppShell
      employee={employee}
      branch={branch}
      pageTitle="Jadwal Kerja Saya"
      navItems={getNavItemsForRole(employee.role)}
      activeNavId="schedules"
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        {/* Today's Shift Card */}
        <div className="rounded-lg border border-gold-bright/40 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                JADWAL ANDA HARI INI ({new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })})
              </div>
              <div className="mt-1 text-xl font-bold text-text">{employee.name}</div>
            </div>
            <div>
              {todayMySchedule ? (
                <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${getShiftBadgeClass(todayMySchedule.shiftType)}`}>
                  {getShiftLabel(todayMySchedule.shiftType)}
                </span>
              ) : (
                <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-400">
                  Pagi (09:00 - 15:00) · Default
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <div>
              <span className="text-text-muted">Cabang:</span>
              <div className="font-semibold text-text">{branch?.name ?? employee.branchId}</div>
            </div>
            <div>
              <span className="text-text-muted">Jam Kerja:</span>
              <div className="font-mono font-semibold text-gold-bright">
                {todayMySchedule?.startTime && todayMySchedule?.endTime
                  ? `${todayMySchedule.startTime} - ${todayMySchedule.endTime}`
                  : "09:00 - 15:00"}
              </div>
            </div>
            <div>
              <span className="text-text-muted">Role:</span>
              <div className="font-semibold text-text">{employee.role}</div>
            </div>
            <div>
              <span className="text-text-muted">Catatan:</span>
              <div className="italic text-text-muted">{todayMySchedule?.notes || "—"}</div>
            </div>
          </div>
        </div>

        {/* Weekly Schedule Navigation */}
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

          <span className="text-xs font-bold text-gold-bright">
            {weekDays[0].dateStr} s.d. {weekDays[6].dateStr}
          </span>
        </div>

        {/* Weekly Grid for this Employee */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const sch = branchWeekSchedules.find(
              (s) => s.employeeId === employee.id && s.date === day.dateStr,
            );
            const shiftType: ShiftType = sch ? sch.shiftType : "pagi";

            return (
              <div
                key={day.dateStr}
                className={`flex flex-col justify-between rounded-lg border p-3 text-xs ${
                  day.isToday
                    ? "border-gold-bright/50 bg-gold-bright/10"
                    : "border-border bg-surface"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text">{day.dayName}</span>
                    {day.isToday && (
                      <span className="rounded bg-gold-bright/20 px-1 py-0.2 text-[9px] font-bold text-gold-bright">
                        HARI INI
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-faint">
                    {day.dayNumber} {day.monthName}
                  </div>
                </div>

                <div className="my-3">
                  <div
                    className={`rounded border p-2 text-center text-xs font-bold ${getShiftBadgeClass(
                      shiftType,
                    )}`}
                  >
                    {shiftType.toUpperCase()}
                  </div>
                  <div className="mt-1 text-center font-mono text-[11px] text-text-muted">
                    {sch?.startTime && sch?.endTime
                      ? `${sch.startTime} - ${sch.endTime}`
                      : "09:00 - 15:00"}
                  </div>
                </div>

                {sch?.notes ? (
                  <div className="rounded bg-surface-2 p-1.5 text-[10px] italic text-text-muted">
                    {sch.notes}
                  </div>
                ) : (
                  <div className="text-[10px] text-text-faint text-center">—</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Team On-Duty Today */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
            Rekan Bertugas Hari Ini ({branch?.name ?? "Cabang"})
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {branchEmployees.map((colleague) => {
              const sch = todayTeamSchedules.find((s) => s.employeeId === colleague.id);
              const shiftType: ShiftType = sch ? sch.shiftType : "pagi";

              return (
                <div
                  key={colleague.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-2/60 p-2.5 text-xs"
                >
                  <div>
                    <div className="font-semibold text-text">
                      {colleague.name} {colleague.id === employee.id && "(Anda)"}
                    </div>
                    <div className="text-[11px] text-text-faint">
                      {colleague.role === "Barber" ? "💈 Barber" : `👤 ${colleague.role}`}
                    </div>
                  </div>
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-bold ${getShiftBadgeClass(
                      shiftType,
                    )}`}
                  >
                    {shiftType.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
