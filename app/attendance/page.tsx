"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranchById,
  getTodaysAttendance,
  getAttendanceHistory,
  recordClockIn,
  recordClockOut,
  startBreak,
  endBreak,
} from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { AppShell, getNavItemsForRole } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PinModal } from "@/components/ui/PinModal";

type PinAction = "clockIn" | "clockOut" | null;

export default function AttendancePage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;
  const employee = session;
  const branch = employee ? getBranchById(employee.branchId) : undefined;

  const [dataVersion, setDataVersion] = useState(0);
  const [pinAction, setPinAction] = useState<PinAction>(null);
  const [breakError, setBreakError] = useState<string | null>(null);

  useEffect(() => {
    if (isClient && !session) {
      router.replace("/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("karyawan");
    router.replace("/login");
  }

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }
  // Captured as its own const so the hoisted `function` declarations below
  // see a type narrowed to `Employee` — TS doesn't carry the `if (!employee)`
  // narrowing of the outer binding into a hoisted nested function body.
  const currentEmployee = employee;

  void dataVersion;
  const today = getTodaysAttendance(currentEmployee.id);
  const history = getAttendanceHistory(currentEmployee.id, 7);
  const lastBreak = today?.breaks[today.breaks.length - 1];
  const onBreak = Boolean(lastBreak && lastBreak.end === null);

  function handlePinSubmit(pin: string) {
    if (pinAction === "clockIn") {
      recordClockIn(currentEmployee.id, pin);
    } else if (pinAction === "clockOut") {
      recordClockOut(currentEmployee.id, pin);
    }
    setPinAction(null);
    setDataVersion((v) => v + 1);
  }

  function handleStartBreak() {
    setBreakError(null);
    try {
      startBreak(currentEmployee.id);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setBreakError(err instanceof Error ? err.message : "Gagal memulai istirahat.");
    }
  }

  function handleEndBreak() {
    setBreakError(null);
    try {
      endBreak(currentEmployee.id);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setBreakError(err instanceof Error ? err.message : "Gagal mengakhiri istirahat.");
    }
  }

  return (
    <AppShell
      employee={employee}
      branch={branch}
      pageTitle="Attendance & Break"
      navItems={getNavItemsForRole(employee.role)}
      activeNavId="attendance"
      onLogout={handleLogout}
    >
      <div className="mb-4 max-w-md rounded-lg border border-border bg-surface p-4">
        <div className="font-accent text-xs italic text-gold-bright">
          Hari Ini —{" "}
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between border-b border-dashed border-border pb-2">
            <span className="text-text-muted">Clock In</span>
            <span>{today ? new Date(today.clockIn).toLocaleTimeString("id-ID") : "—"}</span>
          </div>
          <div className="flex justify-between border-b border-dashed border-border pb-2">
            <span className="text-text-muted">Clock Out</span>
            <span>{today?.clockOut ? new Date(today.clockOut).toLocaleTimeString("id-ID") : "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Status Istirahat</span>
            {onBreak ? <Badge tone="warn">Sedang Istirahat</Badge> : <Badge tone="ok">Aktif Kerja</Badge>}
          </div>
        </div>

        {breakError && <div className="mt-3 text-sm text-danger">{breakError}</div>}

        <div className="mt-4 flex flex-wrap gap-2">
          {!today && (
            <Button variant="primary" onClick={() => setPinAction("clockIn")}>
              Clock In
            </Button>
          )}
          {today && !today.clockOut && (
            <Button variant="danger" onClick={() => setPinAction("clockOut")}>
              Clock Out
            </Button>
          )}
          {today && !today.clockOut && !onBreak && (
            <Button variant="ghost" onClick={handleStartBreak}>
              Mulai Istirahat
            </Button>
          )}
          {today && !today.clockOut && onBreak && (
            <Button variant="gold" onClick={handleEndBreak}>
              Selesai Istirahat
            </Button>
          )}
        </div>
      </div>

      <div className="font-accent mb-2 text-xs italic text-gold-bright">Riwayat 7 Hari Terakhir</div>
      <div className="max-w-2xl rounded-lg border border-border bg-surface">
        {history.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-faint">Belum ada riwayat.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
                <th className="px-3 py-2 font-normal">Tanggal</th>
                <th className="px-3 py-2 font-normal">Clock In</th>
                <th className="px-3 py-2 font-normal">Clock Out</th>
                <th className="px-3 py-2 font-normal">Istirahat</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">{record.date}</td>
                  <td className="px-3 py-2">{new Date(record.clockIn).toLocaleTimeString("id-ID")}</td>
                  <td className="px-3 py-2">
                    {record.clockOut ? new Date(record.clockOut).toLocaleTimeString("id-ID") : "—"}
                  </td>
                  <td className="px-3 py-2">{record.breaks.length}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PinModal
        open={pinAction !== null}
        onClose={() => setPinAction(null)}
        eyebrow={pinAction === "clockOut" ? "Clock Out" : "Clock In"}
        title={`Konfirmasi PIN — ${employee.name}`}
        onSubmit={handlePinSubmit}
      />
    </AppShell>
  );
}
