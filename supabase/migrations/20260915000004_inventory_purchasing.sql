-- Inventory Management & Purchasing.
-- Source of truth: docs/ERD_RedBoxERP.mermaid + docs/Data_Dictionary_RedBoxERP.md.

-- ---------------------------------------------------------------------------
-- inventory — one balance row per (product, branch). available_stock is a
-- STORED GENERATED column rather than the Data Dictionary's suggested
-- "one function" approach: a generated column is that same idea taken one
-- step further — it's not just centralized, it's physically impossible for
-- it to drift, because Postgres recomputes it from on_hand/reserved on every
-- write and no code path can write to it directly.
-- ---------------------------------------------------------------------------
create table if not exists public.inventory (
  inventory_id bigint generated always as identity primary key,
  product_id bigint not null references public.product (product_id),
  branch_id bigint not null references public.branch (branch_id),
  on_hand int not null default 0,
  reserved int not null default 0 check (reserved >= 0),
  available_stock int generated always as (on_hand - reserved) stored,
  expiry_date date,
  batch_no varchar(50),
  unique (product_id, branch_id)
);

create index if not exists inventory_branch_id_idx on public.inventory (branch_id);

comment on table public.inventory is
  'Single balance per (product_id, branch_id). Per-batch/expiry detail for FEFO lives in product_batch below — this row is the aggregate the rest of the app reads.';

-- ---------------------------------------------------------------------------
-- product_batch — NOT in the ERD. Added because Tier 2 FEFO (docs require
-- multiple batches with distinct expiry dates per product+branch) cannot be
-- represented by inventory's single expiry_date/batch_no columns, and the
-- existing app (lib/data/types.ts ProductBatch, lib/data/batches.ts) already
-- depends on this shape. inventory stays the aggregate balance; this table
-- is the FEFO detail that sums up to it.
-- ---------------------------------------------------------------------------
create table if not exists public.product_batch (
  batch_id bigint generated always as identity primary key,
  product_id bigint not null references public.product (product_id),
  branch_id bigint not null references public.branch (branch_id),
  batch_number varchar(50) not null,
  expiry_date date not null,
  initial_qty int not null check (initial_qty >= 0),
  remaining_qty int not null check (remaining_qty >= 0),
  received_date date not null default current_date,
  cost numeric(15, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, branch_id, batch_number)
);

create index if not exists product_batch_product_branch_idx on public.product_batch (product_id, branch_id);
create index if not exists product_batch_expiry_idx on public.product_batch (expiry_date);

-- ---------------------------------------------------------------------------
-- stock_movement — append-only ledger (business rule #3: any inventory
-- change must create a stock movement record).
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movement (
  movement_id bigint generated always as identity primary key,
  inventory_id bigint not null references public.inventory (inventory_id),
  quantity int not null check (quantity <> 0),
  movement_type text not null check (
    movement_type in ('sale', 'purchase_receiving', 'transfer', 'adjustment', 'writeoff', 'consumption')
  ),
  reference varchar(100),
  actor_id uuid references public.app_user (id),
  created_at timestamptz not null default now()
);

create index if not exists stock_movement_inventory_id_idx on public.stock_movement (inventory_id);
create index if not exists stock_movement_created_at_idx on public.stock_movement (created_at);

comment on column public.stock_movement.quantity is 'Positive = stock in, negative = stock out. Never zero (see check constraint).';

-- The one and only place inventory.on_hand changes — implements CLAUDE.md's
-- "Available Stock ... satu fungsi/service, dipakai ulang" as a DB trigger
-- rather than an app-layer function, so no future endpoint can bypass it by
-- writing to inventory directly.
-- SECURITY DEFINER is load-bearing (see the matching comment on
-- apply_loyalty_ledger_entry in the customer_crm migration): the RLS
-- migration never grants an UPDATE policy on inventory.on_hand/reserved to
-- any app role, so inserting a stock_movement row is the only way on_hand
-- can change at all.
create or replace function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.inventory
    set on_hand = on_hand + new.quantity
    where inventory_id = new.inventory_id;

  if not found then
    raise exception 'Inventory row % not found for stock movement', new.inventory_id;
  end if;

  return new;
end;
$$;

create or replace trigger stock_movement_apply
  after insert on public.stock_movement
  for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------------------
-- stock_transfer
-- ---------------------------------------------------------------------------
create table if not exists public.stock_transfer (
  transfer_id bigint generated always as identity primary key,
  source_branch_id bigint not null references public.branch (branch_id),
  dest_branch_id bigint not null references public.branch (branch_id),
  status text not null default 'requested' check (status in ('requested', 'in_transit', 'received')),
  created_at timestamptz not null default now(),
  check (source_branch_id <> dest_branch_id)
);

-- ---------------------------------------------------------------------------
-- supplier
-- ---------------------------------------------------------------------------
create table if not exists public.supplier (
  supplier_id bigint generated always as identity primary key,
  name varchar(150) not null,
  terms varchar(150)
);

-- ---------------------------------------------------------------------------
-- purchase_order / purchase_order_item
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_order (
  po_id bigint generated always as identity primary key,
  supplier_id bigint not null references public.supplier (supplier_id),
  status text not null default 'draft' check (status in ('draft', 'approved', 'received', 'cancelled')),
  order_date date not null default current_date
);

create table if not exists public.purchase_order_item (
  po_item_id bigint generated always as identity primary key,
  po_id bigint not null references public.purchase_order (po_id),
  product_id bigint not null references public.product (product_id),
  quantity int not null check (quantity > 0)
);

create index if not exists purchase_order_item_po_id_idx on public.purchase_order_item (po_id);
