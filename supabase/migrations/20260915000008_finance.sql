-- Finance: Chart of Accounts, Journal Entry/Line, Fiscal Period, Bank
-- Reconciliation. Source of truth: docs/ERD_RedBoxERP.mermaid +
-- docs/Data_Dictionary_RedBoxERP.md.
--
-- Not part of the POS cutover (Finance stays on localStorage for now per the
-- agreed migration order) but included here because business rules #11-12
-- are non-negotiable and the balanced-journal constraint has to exist as a
-- real DB guarantee from the day this table is created, not bolted on later.

-- ---------------------------------------------------------------------------
-- fiscal_period — created before journal_entry since journal_entry
-- references it.
-- ---------------------------------------------------------------------------
create table if not exists public.fiscal_period (
  fiscal_period_id bigint generated always as identity primary key,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  check (period_end > period_start)
);

-- NOTE (idempotency gap, deliberately not fixed here — see chat response):
-- ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS form in Postgres, so
-- rerunning this file against a database that already has this exclusion
-- constraint will fail on this statement specifically.
alter table public.fiscal_period
  add constraint fiscal_period_no_overlap
  exclude using gist (daterange(period_start, period_end, '[]') with &&);

-- ---------------------------------------------------------------------------
-- chart_of_accounts
-- ---------------------------------------------------------------------------
create table if not exists public.chart_of_accounts (
  account_id bigint generated always as identity primary key,
  account_code varchar(20) not null unique,
  account_name varchar(150) not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense'))
);

-- ---------------------------------------------------------------------------
-- journal_entry / journal_line — append-only (business rule #12: a closed
-- fiscal period cannot be edited; corrections are new adjusting entries).
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entry (
  journal_id bigint generated always as identity primary key,
  branch_id bigint not null references public.branch (branch_id),
  fiscal_period_id bigint not null references public.fiscal_period (fiscal_period_id),
  reference varchar(100),
  created_at timestamptz not null default now()
);

create index if not exists journal_entry_branch_id_idx on public.journal_entry (branch_id);
create index if not exists journal_entry_fiscal_period_id_idx on public.journal_entry (fiscal_period_id);

create table if not exists public.journal_line (
  line_id bigint generated always as identity primary key,
  journal_id bigint not null references public.journal_entry (journal_id),
  account_id bigint not null references public.chart_of_accounts (account_id),
  debit numeric(15, 2) not null default 0 check (debit >= 0),
  credit numeric(15, 2) not null default 0 check (credit >= 0),
  check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create index if not exists journal_line_journal_id_idx on public.journal_line (journal_id);
create index if not exists journal_line_account_id_idx on public.journal_line (account_id);

-- Business rule #11: every journal_id's lines must balance (sum(debit) =
-- sum(credit)). Enforced as a deferred, per-row constraint trigger: DEFERRED
-- means every row-level firing from a multi-line INSERT (the normal case —
-- a journal entry is always written as 2+ lines in one transaction) actually
-- runs at COMMIT time, by which point every line has already been inserted,
-- so the balance check sees the final state instead of failing after line 1
-- alone. (Transition tables would let this run once per statement instead
-- of once per row, but constraint triggers don't support them — this is the
-- standard textbook pattern for a deferred balance constraint.)
create or replace function public.check_journal_balance() returns trigger
language plpgsql as $$
declare
  jid bigint;
  total_debit numeric(15, 2);
  total_credit numeric(15, 2);
begin
  jid := coalesce(new.journal_id, old.journal_id);

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into total_debit, total_credit
    from public.journal_line
    where journal_id = jid;

  if total_debit <> total_credit then
    raise exception 'Journal entry % is not balanced: debit % <> credit %', jid, total_debit, total_credit;
  end if;

  return null;
end;
$$;

drop trigger if exists journal_line_balance_check on public.journal_line;
create constraint trigger journal_line_balance_check
  after insert or update or delete on public.journal_line
  deferrable initially deferred
  for each row execute function public.check_journal_balance();

-- ---------------------------------------------------------------------------
-- bank_reconciliation
-- ---------------------------------------------------------------------------
create table if not exists public.bank_reconciliation (
  reconciliation_id bigint generated always as identity primary key,
  payment_id bigint not null references public.payment (payment_id),
  settlement_amount numeric(15, 2) not null,
  gateway_fee numeric(15, 2) not null default 0,
  matched_at timestamptz not null default now()
);

create index if not exists bank_reconciliation_payment_id_idx on public.bank_reconciliation (payment_id);
