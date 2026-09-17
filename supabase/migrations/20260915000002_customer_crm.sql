-- Customer, Membership & Loyalty (CLAUDE.md "Customer ID tunggal" — one table,
-- shared by POS Quick-Lookup and full CRM alike).
-- Source of truth: docs/ERD_RedBoxERP.mermaid + docs/Data_Dictionary_RedBoxERP.md.

-- ---------------------------------------------------------------------------
-- customer
-- ---------------------------------------------------------------------------
create table if not exists public.customer (
  customer_id bigint generated always as identity primary key,
  name varchar(150),
  phone_number varchar(20) not null unique,
  type text not null default 'guest' check (type in ('guest', 'member')),
  -- Trigger-maintained cache (see loyalty_ledger below) — never written
  -- directly by application code, mirrors inventory.on_hand's relationship
  -- to stock_movement.
  points_balance int not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now()
);

comment on column public.customer.points_balance is
  'Cached running balance, maintained ONLY by the loyalty_ledger AFTER INSERT trigger (see below). Never UPDATE this column directly.';

-- ---------------------------------------------------------------------------
-- membership
-- ---------------------------------------------------------------------------
create table if not exists public.membership (
  membership_id bigint generated always as identity primary key,
  customer_id bigint not null unique references public.customer (customer_id),
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  activated_at timestamptz not null default now(),
  activation_fee numeric(15, 2) not null default 100000.00
);

comment on column public.membership.activation_fee is
  'Historical — do not update after the row is written, even if the Rp100.000 policy changes later (business rule #6: historical price immutable).';

-- ---------------------------------------------------------------------------
-- loyalty_ledger — append-only. No UPDATE/DELETE policy is ever granted to
-- app roles (see the RLS migration) so corrections must be new rows, per
-- CLAUDE.md's "ledger, bukan overwrite" principle.
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_ledger (
  ledger_id bigint generated always as identity primary key,
  customer_id bigint not null references public.customer (customer_id),
  points int not null,
  type text not null check (type in ('earn', 'redeem', 'adjustment', 'expiry', 'referral_bonus')),
  order_id bigint, -- FK to orders.order_id added once that table exists (see orders migration)
  reference varchar(100),
  note text,
  actor_id uuid references public.app_user (id),
  created_at timestamptz not null default now()
);

create index if not exists loyalty_ledger_customer_id_idx on public.loyalty_ledger (customer_id);

comment on column public.loyalty_ledger.type is
  'referral_bonus added beyond the ERD''s 4 values to match the existing referral feature (lib/data/membership.ts recordReferralBonus).';

-- The one and only place customer.points_balance changes. Mirrors
-- lib/data/membership.ts recordLoyaltyLedgerEntry()'s guarantee: a write
-- that would take the balance negative is rejected outright, and — because
-- this runs inside whatever transaction inserted the ledger row — the
-- ledger insert itself rolls back too. No caller can end up with a ledger
-- entry that the cached balance disagrees with.
-- SECURITY DEFINER is load-bearing, not incidental: the RLS migration grants
-- no role an UPDATE policy on customer.points_balance at all, so this is the
-- ONLY path that can ever change it — running as the function owner (which
-- owns the table and so bypasses RLS) is what makes that enforceable rather
-- than just documented.
create or replace function public.apply_loyalty_ledger_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_balance int;
begin
  update public.customer
    set points_balance = points_balance + new.points
    where customer_id = new.customer_id
    returning points_balance into new_balance;

  if new_balance is null then
    raise exception 'Customer % not found for loyalty ledger entry', new.customer_id;
  end if;

  if new_balance < 0 then
    raise exception 'Loyalty ledger entry would take customer % points balance negative (%)', new.customer_id, new_balance;
  end if;

  return new;
end;
$$;

create or replace trigger loyalty_ledger_apply
  after insert on public.loyalty_ledger
  for each row execute function public.apply_loyalty_ledger_entry();

-- ---------------------------------------------------------------------------
-- customer_preference
-- ---------------------------------------------------------------------------
create table if not exists public.customer_preference (
  preference_id bigint generated always as identity primary key,
  customer_id bigint not null references public.customer (customer_id),
  preferred_barber_id bigint references public.employee (employee_id),
  preferred_style varchar(150),
  preferred_product varchar(150),
  notes text
);

create index if not exists customer_preference_customer_id_idx on public.customer_preference (customer_id);

-- ---------------------------------------------------------------------------
-- complaint
-- ---------------------------------------------------------------------------
create table if not exists public.complaint (
  complaint_id bigint generated always as identity primary key,
  customer_id bigint not null references public.customer (customer_id),
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists complaint_customer_id_idx on public.complaint (customer_id);

-- ---------------------------------------------------------------------------
-- customer_merge_log
-- ---------------------------------------------------------------------------
create table if not exists public.customer_merge_log (
  merge_id bigint generated always as identity primary key,
  source_customer_id bigint not null references public.customer (customer_id),
  target_customer_id bigint not null references public.customer (customer_id),
  merged_at timestamptz not null default now(),
  check (source_customer_id <> target_customer_id)
);
