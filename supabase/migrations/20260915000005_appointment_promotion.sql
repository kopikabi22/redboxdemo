-- Appointment & Queue, Promotion & Campaign.
-- Source of truth: docs/ERD_RedBoxERP.mermaid.

-- ---------------------------------------------------------------------------
-- appointment
-- ---------------------------------------------------------------------------
create table if not exists public.appointment (
  appointment_id bigint generated always as identity primary key,
  customer_id bigint not null references public.customer (customer_id),
  employee_id bigint not null references public.employee (employee_id),
  branch_id bigint not null references public.branch (branch_id),
  service_id bigint references public.service (service_id),
  type text not null default 'regular' check (type in ('regular', 'home_service', 'wedding')),
  address varchar(255),
  slot_time timestamptz not null,
  status text not null default 'booked' check (
    status in ('booked', 'checked_in', 'completed', 'no_show', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  constraint appointment_requires_address_for_non_regular check (type = 'regular' or address is not null)
);

create index if not exists appointment_branch_id_idx on public.appointment (branch_id);
create index if not exists appointment_employee_id_idx on public.appointment (employee_id);
create index if not exists appointment_slot_time_idx on public.appointment (slot_time);

comment on constraint appointment_requires_address_for_non_regular on public.appointment is
  'address is required whenever type != regular (Home Service / Wedding Grooming location is the customer''s address, not the branch).';

-- ---------------------------------------------------------------------------
-- promotion — extended beyond the ERD's 5 bare columns because Promotion is
-- directly in the POS checkout path (lib/data/promotions.ts
-- validateAndCalculatePromo reads code/minSpend/usageLimit/dates/active) and
-- orders.promotion_id references this table, so checkout cannot function
-- against the ERD's minimal version alone.
-- ---------------------------------------------------------------------------
create table if not exists public.promotion (
  promotion_id bigint generated always as identity primary key,
  code varchar(50) not null unique,
  name varchar(150) not null,
  rule_type text not null check (rule_type in ('percentage', 'flat', 'bundle')),
  discount_value numeric(15, 2) not null check (discount_value > 0),
  max_discount numeric(15, 2) check (max_discount is null or max_discount > 0),
  min_spend numeric(15, 2) not null default 0 check (min_spend >= 0),
  scope_level text not null check (scope_level in ('holding', 'branch')),
  branch_id bigint references public.branch (branch_id),
  usage_limit int check (usage_limit is null or usage_limit > 0),
  used_count int not null default 0 check (used_count >= 0),
  start_date date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (rule_type <> 'percentage' or discount_value <= 100),
  check (scope_level = 'holding' or branch_id is not null)
);

create unique index if not exists promotion_code_upper_idx on public.promotion (upper(code));
