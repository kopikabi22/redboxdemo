-- Core identity: company, branch, role, app_user, employee.
-- Source of truth: docs/ERD_RedBoxERP.mermaid + docs/Data_Dictionary_RedBoxERP.md.
--
-- Deviations from the ERD, and why:
--   * app_user.id is UUID = auth.users.id (not a separate bigint identity).
--     Every RLS policy in this project needs to compare against auth.uid();
--     keying app_user directly by that UUID means every policy is a direct
--     equality/subquery instead of an extra join through a bigint mapping
--     table, and it makes "one Supabase Auth account per app_user" a DB
--     constraint instead of a convention.
--   * branch gets address/phone/min_barber_coverage beyond the ERD's four
--     columns, because those are already load-bearing in the existing app
--     (lib/data/types.ts Branch) and business rule #9 (rolling schedule must
--     respect minimum barber coverage) needs min_barber_coverage to live
--     somewhere. Every other table in this migration set sticks to exactly
--     what the ERD/Data Dictionary specify.

-- ---------------------------------------------------------------------------
-- company
-- ---------------------------------------------------------------------------
create table if not exists public.company (
  company_id bigint generated always as identity primary key,
  name varchar(150) not null
);

comment on table public.company is 'Parent holding organization. Expected to hold exactly one row for RedBox.';

-- ---------------------------------------------------------------------------
-- branch
-- ---------------------------------------------------------------------------
create table if not exists public.branch (
  branch_id bigint generated always as identity primary key,
  company_id bigint not null references public.company (company_id),
  name varchar(150) not null,
  city varchar(100) not null,
  province varchar(100) not null,
  operating_hours varchar(100),
  scope_type text not null default 'branch' check (scope_type in ('holding', 'branch')),
  address varchar(255),
  phone varchar(30),
  min_barber_coverage int not null default 1 check (min_barber_coverage >= 0),
  created_at timestamptz not null default now()
);

comment on column public.branch.min_barber_coverage is 'Minimum active barbers required on duty per day at this branch (business rule #9).';

-- ---------------------------------------------------------------------------
-- role
-- ---------------------------------------------------------------------------
create table if not exists public.role (
  role_id bigint generated always as identity primary key,
  name varchar(50) not null unique
);

insert into public.role (name) values
  ('Owner'), ('HQ/Admin'), ('BranchManager'), ('Cashier'), ('Barber'),
  ('Warehouse'), ('Purchasing'), ('HR'), ('Finance'), ('Marketing/CRM'), ('SystemAdmin')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- app_user — one row per Supabase Auth identity, keyed by that identity's UUID.
-- ---------------------------------------------------------------------------
create table if not exists public.app_user (
  id uuid primary key references auth.users (id) on delete cascade,
  role_id bigint not null references public.role (role_id),
  username varchar(100) not null unique,
  auth_method text not null default 'password' check (auth_method in ('password', 'pin', 'face')),
  last_login_at timestamptz
);

comment on table public.app_user is
  'Maps a Supabase Auth user to an ERP role. id = auth.users.id by design (see file header) so RLS policies can compare auth.uid() directly.';

-- ---------------------------------------------------------------------------
-- employee
-- ---------------------------------------------------------------------------
create table if not exists public.employee (
  employee_id bigint generated always as identity primary key,
  user_id uuid references public.app_user (id),
  branch_id bigint not null references public.branch (branch_id),
  name varchar(150) not null,
  position varchar(50) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists employee_branch_id_idx on public.employee (branch_id);
create index if not exists employee_user_id_idx on public.employee (user_id);

comment on table public.employee is
  'user_id is nullable: an Employee record can exist before its Supabase Auth account is provisioned, matching PRD onboarding order.';
