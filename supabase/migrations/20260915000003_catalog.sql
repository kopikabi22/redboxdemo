-- Product & Service Master (Central Product/SKU Master — one product = one
-- SKU, used by every channel, per CLAUDE.md architecture principle).
-- Source of truth: docs/ERD_RedBoxERP.mermaid.
--
-- service/product get category/brand/commission_percent/low_stock_threshold
-- beyond the ERD's bare columns because those are already load-bearing in
-- the existing app (lib/data/types.ts Service/Product) and are read directly
-- by POS at checkout (commission_percent) and by the Inventory tab's
-- cukup/rendah/habis status (low_stock_threshold).

-- ---------------------------------------------------------------------------
-- service
-- ---------------------------------------------------------------------------
create table if not exists public.service (
  service_id bigint generated always as identity primary key,
  name varchar(150) not null,
  category varchar(100),
  duration_minutes int not null check (duration_minutes > 0),
  price numeric(15, 2) not null check (price >= 0),
  commission_percent numeric(5, 2) not null default 20 check (commission_percent >= 0 and commission_percent <= 100),
  effective_date date not null default current_date,
  active boolean not null default true
);

comment on column public.service.price is
  'Current active price. Historical order_item.price is captured at sale time and never re-derived from this column (business rule #6).';

-- ---------------------------------------------------------------------------
-- product
-- ---------------------------------------------------------------------------
create table if not exists public.product (
  product_id bigint generated always as identity primary key,
  sku varchar(50) not null unique,
  name varchar(150) not null,
  category varchar(100),
  brand varchar(100),
  cost_price numeric(15, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(15, 2) not null check (selling_price >= 0),
  low_stock_threshold int not null default 0 check (low_stock_threshold >= 0),
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- variant
-- ---------------------------------------------------------------------------
create table if not exists public.variant (
  variant_id bigint generated always as identity primary key,
  product_id bigint not null references public.product (product_id),
  variant_name varchar(100) not null
);

create index if not exists variant_product_id_idx on public.variant (product_id);

-- ---------------------------------------------------------------------------
-- product_service_link — BOM: what a service consumes per use (e.g. pomade
-- per haircut), so retail sale isn't the only path that moves stock.
-- ---------------------------------------------------------------------------
create table if not exists public.product_service_link (
  link_id bigint generated always as identity primary key,
  service_id bigint not null references public.service (service_id),
  product_id bigint not null references public.product (product_id),
  quantity_consumed numeric(10, 3) not null check (quantity_consumed > 0),
  unique (service_id, product_id)
);
