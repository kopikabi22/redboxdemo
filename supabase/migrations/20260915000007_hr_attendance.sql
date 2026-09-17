-- Employee/HR: attendance (self-service clock in/out/break) and shift
-- schedule (HR-configured, employees only consume it — CLAUDE.md's
-- cross-POV note: karyawan pakai jadwal yang sudah dibuat, tidak
-- membuatnya sendiri).
-- Source of truth: docs/ERD_RedBoxERP.mermaid.

-- ---------------------------------------------------------------------------
-- attendance — breaks modeled as a child table (one row per break) rather
-- than the app's embedded breaks[] array, since Postgres has no native array
-- for "start/end pairs that each need independent validation" as cleanly as
-- a normalized child table with its own check constraint.
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  attendance_id bigint generated always as identity primary key,
  employee_id bigint not null references public.employee (employee_id),
  clock_in timestamptz not null,
  clock_out timestamptz,
  method text not null check (method in ('pin', 'face_recognition')),
  check (clock_out is null or clock_out > clock_in)
);

create index if not exists attendance_employee_id_idx on public.attendance (employee_id);

create table if not exists public.attendance_break (
  break_id bigint generated always as identity primary key,
  attendance_id bigint not null references public.attendance (attendance_id),
  break_start timestamptz not null,
  break_end timestamptz,
  check (break_end is null or break_end > break_start)
);

create index if not exists attendance_break_attendance_id_idx on public.attendance_break (attendance_id);

-- ---------------------------------------------------------------------------
-- shift_schedule
-- ---------------------------------------------------------------------------
create table if not exists public.shift_schedule (
  schedule_id bigint generated always as identity primary key,
  employee_id bigint not null references public.employee (employee_id),
  branch_id bigint not null references public.branch (branch_id),
  shift_date date not null,
  shift_time varchar(50) not null,
  created_at timestamptz not null default now(),
  unique (employee_id, shift_date)
);

create index if not exists shift_schedule_branch_date_idx on public.shift_schedule (branch_id, shift_date);
