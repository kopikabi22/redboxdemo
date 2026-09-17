-- Orders (the POS transaction itself) + the 3 tables the ERD doesn't cover
-- but the POS cutover cannot work without: cash_movement, cashier_closing,
-- held_bill. All three already exist as first-class concepts in
-- lib/data/types.ts (CashMove, CashierClosing, HeldBill) and in the CLAUDE.md
-- route flow (/pos/cash, /closing) — this is a documented gap in the ERD,
-- not a scope addition.
--
-- orders/order_item are extended past the ERD's bare `total` column for the
-- same reason as promotion in the previous migration: this is the literal
-- table POS checkout writes to, so it has to carry what checkout actually
-- computes (subtotal/discount/tax split, per-line barber for commission,
-- split payment support).

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  order_id bigint generated always as identity primary key,
  customer_id bigint not null references public.customer (customer_id),
  branch_id bigint not null references public.branch (branch_id),
  employee_id bigint not null references public.employee (employee_id),
  promotion_id bigint references public.promotion (promotion_id),
  subtotal numeric(15, 2) not null check (subtotal >= 0),
  discount_amount numeric(15, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(15, 2) not null default 0 check (tax_amount >= 0),
  total numeric(15, 2) not null check (total >= 0),
  channel varchar(20) not null default 'pos',
  status text not null default 'open' check (status in ('open', 'paid', 'void', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists orders_branch_id_idx on public.orders (branch_id);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_created_at_idx on public.orders (created_at);

comment on column public.orders.employee_id is 'The cashier who processed the sale (FK -> employee), not the barber(s) who served it — see order_item.employee_id for that.';

-- Now that orders exists, wire up the FK the loyalty_ledger migration left
-- unattached (loyalty_ledger.order_id was created without it since orders
-- didn't exist yet).
-- NOTE (idempotency gap, deliberately not fixed here — see chat response):
-- ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS form in Postgres, so
-- rerunning this file against a database that already has this FK will fail
-- on this statement specifically.
alter table public.loyalty_ledger
  add constraint loyalty_ledger_order_id_fkey foreign key (order_id) references public.orders (order_id);

-- ---------------------------------------------------------------------------
-- order_item — historical price/commission_percent are snapshots taken at
-- sale time (business rule #6: historical price immutable), never re-derived
-- from service/product's current price.
-- ---------------------------------------------------------------------------
create table if not exists public.order_item (
  order_item_id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (order_id),
  service_id bigint references public.service (service_id),
  product_id bigint references public.product (product_id),
  employee_id bigint references public.employee (employee_id),
  quantity int not null check (quantity > 0),
  price numeric(15, 2) not null check (price >= 0),
  commission_percent numeric(5, 2),
  taxable boolean not null default true,
  check (
    (service_id is not null and product_id is null) or
    (service_id is null and product_id is not null)
  )
);

create index if not exists order_item_order_id_idx on public.order_item (order_id);

comment on column public.order_item.employee_id is 'The barber who performed this specific line (TransactionLineItem.barberId) — an order can mix barbers across lines.';

-- ---------------------------------------------------------------------------
-- payment — split payment support: one order can have multiple payment rows.
-- The second check (cash_tendered >= amount for cash payments) mirrors the
-- guard already enforced in application code today: lib/data/transactions.ts
-- checkout() throws before writing anything if
-- `input.method === 'Cash' && input.cashTendered < total`, and that is the
-- only code path (besides test fixtures and seed.ts, which seeds an empty
-- array) that ever produces a cash Transaction — confirmed by grepping every
-- write to StorageKeys.transactions in lib/ and every checkout() call site
-- in app/. Safe to enforce the same guarantee as a DB constraint.
-- ---------------------------------------------------------------------------
create table if not exists public.payment (
  payment_id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (order_id),
  method text not null check (method in ('cash', 'qris', 'debit', 'credit', 'transfer', 'ewallet')),
  amount numeric(15, 2) not null check (amount > 0),
  cash_tendered numeric(15, 2),
  change_amount numeric(15, 2),
  created_at timestamptz not null default now(),
  check (method = 'cash' or (cash_tendered is null and change_amount is null)),
  check (method <> 'cash' or (cash_tendered is not null and cash_tendered >= amount))
);

create index if not exists payment_order_id_idx on public.payment (order_id);

-- ---------------------------------------------------------------------------
-- commission — populated at payroll-calculation time (Tier 3 HR), NOT
-- written by POS checkout. Matches the existing app, which computes
-- commission on the fly from order_item at payroll time rather than
-- persisting it per order (lib/data/payroll.ts) — kept here because the ERD
-- specifies it and later Finance/HR work will want a persisted ledger
-- instead of recomputing every time.
-- ---------------------------------------------------------------------------
create table if not exists public.commission (
  commission_id bigint generated always as identity primary key,
  employee_id bigint not null references public.employee (employee_id),
  order_id bigint not null references public.orders (order_id),
  amount numeric(15, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists commission_employee_id_idx on public.commission (employee_id);
create index if not exists commission_order_id_idx on public.commission (order_id);

-- ---------------------------------------------------------------------------
-- cash_movement — append-only, mirrors CashMove (lib/data/types.ts).
-- ---------------------------------------------------------------------------
create table if not exists public.cash_movement (
  cash_movement_id bigint generated always as identity primary key,
  branch_id bigint not null references public.branch (branch_id),
  type text not null check (type in ('in', 'out')),
  amount numeric(15, 2) not null check (amount > 0),
  note text,
  actor_id uuid references public.app_user (id),
  created_at timestamptz not null default now()
);

create index if not exists cash_movement_branch_id_idx on public.cash_movement (branch_id);

-- ---------------------------------------------------------------------------
-- cashier_closing — immutable once created (no update path exists in the
-- app either). breakdown lives in its own child table, one row per payment
-- method, mirroring PaymentMethodBreakdown[].
-- ---------------------------------------------------------------------------
create table if not exists public.cashier_closing (
  closing_id bigint generated always as identity primary key,
  branch_id bigint not null references public.branch (branch_id),
  cashier_id bigint not null references public.employee (employee_id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_expected numeric(15, 2) not null,
  total_actual numeric(15, 2) not null,
  total_variance numeric(15, 2) not null,
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);

create index if not exists cashier_closing_branch_id_idx on public.cashier_closing (branch_id);

create table if not exists public.cashier_closing_breakdown (
  breakdown_id bigint generated always as identity primary key,
  closing_id bigint not null references public.cashier_closing (closing_id),
  method text not null check (method in ('cash', 'qris', 'debit', 'credit', 'transfer', 'ewallet')),
  expected numeric(15, 2) not null,
  actual numeric(15, 2) not null,
  variance numeric(15, 2) not null,
  unique (closing_id, method)
);

-- ---------------------------------------------------------------------------
-- held_bill — a working draft (save/retrieve bill), not a financial record.
-- customer/items are stored as jsonb snapshots rather than normalized rows:
-- unlike orders/order_item, nothing ever reports on or joins against a held
-- bill's contents — it exists purely to be handed back to the POS screen
-- as-is when retrieved, then deleted.
-- ---------------------------------------------------------------------------
create table if not exists public.held_bill (
  held_bill_id bigint generated always as identity primary key,
  branch_id bigint not null references public.branch (branch_id),
  customer_snapshot jsonb,
  items jsonb not null,
  saved_at timestamptz not null default now()
);

create index if not exists held_bill_branch_id_idx on public.held_bill (branch_id);
