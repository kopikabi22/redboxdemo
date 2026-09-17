-- Row Level Security — branch-scoping enforced in the database, not just
-- the application layer (CLAUDE.md: "JANGAN filter branch cuma di
-- application layer").
--
-- Scope of this migration: RLS is ENABLED on every table (default-deny), but
-- concrete policies are only written for the tables the POS cutover
-- actually touches — everything checkout(), cash in/out, cashier closing,
-- and held bills read or write. Every other table (appointment, purchasing,
-- HR scheduling, finance, etc.) is enabled-but-policyless on purpose: those
-- modules are still localStorage-only, so until their cutover, nobody
-- (except service_role, which bypasses RLS) can touch them through the API.
-- That is the correct state, not an oversight — add their policies when
-- each module actually cuts over.
--
-- Role model: every Supabase Auth user shares ONE Postgres role
-- (`authenticated`) — the RBAC matrix's 11 app-level roles (Owner, Cashier,
-- Barber, ...) are a data-layer concept (role.name via app_user.role_id),
-- not distinct Postgres roles. So all access differentiation between e.g.
-- Cashier and Owner happens inside policy USING/WITH CHECK clauses via the
-- helper functions below, never via GRANT.
--
-- Idempotency pattern for policies: every CREATE POLICY below is preceded by
-- a matching DROP POLICY IF EXISTS on the same name/table, rather than
-- wrapping CREATE POLICY in a DO $$ ... EXCEPTION WHEN duplicate_object THEN
-- null; END $$ block. Deliberate choice, not just style: the DO/EXCEPTION
-- pattern would SILENTLY SKIP creating the policy if one with that name
-- already exists, even if this file's definition of it has since changed —
-- which is exactly the situation a fix like this session's product_batch_
-- update correction would hit on a database that already ran the old
-- version of this file. DROP-then-CREATE always converges the database to
-- whatever this file currently says, the same way CREATE OR REPLACE
-- FUNCTION does for the functions below — that's the property an idempotent
-- migration needs, not just "don't error on rerun."

-- ---------------------------------------------------------------------------
-- Helper functions. All SECURITY DEFINER + fixed search_path: they need to
-- read app_user/employee/role regardless of the calling user's own RLS
-- grants on those tables (avoids recursive-policy problems), and a fixed
-- search_path is required security hygiene for SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select r.name
  from public.app_user u
  join public.role r on r.role_id = u.role_id
  where u.id = auth.uid();
$$;

create or replace function public.current_employee_branch_id() returns bigint
language sql stable security definer set search_path = public as $$
  select e.branch_id
  from public.employee e
  where e.user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_employee_branch_id() is
  'NULL for a user with no employee row (e.g. Finance/HQ staff who are never scoped to one branch) — every policy below treats NULL as "matches no branch", never as a wildcard.';

-- Roles that read/act across every branch (Owner, HQ/Admin, SystemAdmin per
-- docs/RBAC_CRUD_Matrix.md). Deliberately excludes Finance even though
-- Finance reads cross-branch on SOME rows (cashier closing review) — that
-- exception is expressed on the specific policies that need it, not baked
-- into this general-purpose helper, so this function's name stays accurate.
create or replace function public.is_cross_branch_role() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() in ('Owner', 'HQ/Admin', 'SystemAdmin');
$$;

-- Explicit REVOKE before each GRANT: PostgreSQL automatically grants
-- EXECUTE on every newly created function to PUBLIC (unlike TABLE
-- privileges, which are NOT granted to PUBLIC by default) — and on top of
-- that, Supabase runs its own ALTER DEFAULT PRIVILEGES as part of standard
-- project setup that auto-grants EXECUTE on new public-schema functions to
-- `anon` and `authenticated` specifically. Left alone, either of those
-- would let anon/authenticated (and PUBLIC, meaning literally any role)
-- call these SECURITY DEFINER functions before the GRANT below narrows
-- access back down. These REVOKEs close BOTH of those default grants
-- explicitly, rather than relying on them happening to already be absent.
revoke execute on function public.current_role_name() from public, anon, authenticated;
grant execute on function public.current_role_name() to authenticated;
revoke execute on function public.current_employee_branch_id() from public, anon, authenticated;
grant execute on function public.current_employee_branch_id() to authenticated;
revoke execute on function public.is_cross_branch_role() from public, anon, authenticated;
grant execute on function public.is_cross_branch_role() to authenticated;

-- ---------------------------------------------------------------------------
-- role / app_user / employee / branch — read support for every policy below.
-- ---------------------------------------------------------------------------
alter table public.role enable row level security;
drop policy if exists role_select on public.role;
create policy role_select on public.role for select to authenticated using (true);

alter table public.app_user enable row level security;
drop policy if exists app_user_select on public.app_user;
create policy app_user_select on public.app_user for select to authenticated
  using (id = auth.uid() or public.is_cross_branch_role());

alter table public.employee enable row level security;
drop policy if exists employee_select on public.employee;
create policy employee_select on public.employee for select to authenticated
  using (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id());

alter table public.branch enable row level security;
drop policy if exists branch_select on public.branch;
create policy branch_select on public.branch for select to authenticated
  using (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id());

alter table public.company enable row level security; -- no policy yet: nothing in POS scope reads company directly

-- ---------------------------------------------------------------------------
-- customer / membership / loyalty_ledger — deliberately NOT branch-scoped on
-- SELECT: "Customer ID tunggal" means a Tegal cashier must be able to find a
-- customer who first became a member at Bypass. Mutation is scoped by role,
-- not branch, for the same reason.
-- ---------------------------------------------------------------------------
alter table public.customer enable row level security;

drop policy if exists customer_select on public.customer;
create policy customer_select on public.customer for select to authenticated using (true);

drop policy if exists customer_insert on public.customer;
create policy customer_insert on public.customer for insert to authenticated
  with check (public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'Marketing/CRM', 'SystemAdmin'));

-- No UPDATE/DELETE policy: full CRM profile editing is Marketing/CRM module
-- scope, not cut over yet. points_balance specifically is never directly
-- updatable by anyone (see apply_loyalty_ledger_entry trigger) — that is
-- true with or without a general customer UPDATE policy existing.

alter table public.membership enable row level security;

drop policy if exists membership_select on public.membership;
create policy membership_select on public.membership for select to authenticated using (true);

drop policy if exists membership_insert on public.membership;
create policy membership_insert on public.membership for insert to authenticated
  with check (public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'Marketing/CRM', 'SystemAdmin'));

alter table public.loyalty_ledger enable row level security;

drop policy if exists loyalty_ledger_select on public.loyalty_ledger;
create policy loyalty_ledger_select on public.loyalty_ledger for select to authenticated using (true);

drop policy if exists loyalty_ledger_insert on public.loyalty_ledger;
create policy loyalty_ledger_insert on public.loyalty_ledger for insert to authenticated
  with check (public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'Marketing/CRM', 'SystemAdmin'));

-- No UPDATE/DELETE on loyalty_ledger for any role, ever (RBAC note #1).

-- ---------------------------------------------------------------------------
-- service / product / product_service_link — read-only for this cutover.
-- Product & Service Master management (create/edit) stays out of scope
-- until that module cuts over; seeding/editing until then goes through
-- service_role (migrations or an admin script), which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.service enable row level security;
drop policy if exists service_select on public.service;
create policy service_select on public.service for select to authenticated using (true);

alter table public.product enable row level security;
drop policy if exists product_select on public.product;
create policy product_select on public.product for select to authenticated using (true);

alter table public.product_service_link enable row level security;
drop policy if exists product_service_link_select on public.product_service_link;
create policy product_service_link_select on public.product_service_link for select to authenticated using (true);

alter table public.variant enable row level security; -- no policy yet

-- ---------------------------------------------------------------------------
-- inventory — SELECT only, branch-scoped. No UPDATE policy at all: on_hand
-- only ever changes via the stock_movement trigger (SECURITY DEFINER), so
-- this blocks every direct write path, not just unauthorized ones.
-- ---------------------------------------------------------------------------
alter table public.inventory enable row level security;

drop policy if exists inventory_select on public.inventory;
create policy inventory_select on public.inventory for select to authenticated
  using (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id());

-- ---------------------------------------------------------------------------
-- product_batch — FEFO detail. Unlike inventory, checkout's FEFO deduction
-- (lib/data/batches.ts deductStockFEFO) decrements remaining_qty directly
-- rather than through a ledger, so this needs a real UPDATE policy — scoped
-- to the batch's own branch. New batches are only created by Purchasing
-- receiving, which isn't cut over yet, so no INSERT policy.
-- ---------------------------------------------------------------------------
alter table public.product_batch enable row level security;

drop policy if exists product_batch_select on public.product_batch;
create policy product_batch_select on public.product_batch for select to authenticated
  using (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id());

drop policy if exists product_batch_update on public.product_batch;
create policy product_batch_update on public.product_batch for update to authenticated
  using (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'SystemAdmin')
    and (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id())
  )
  with check (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id());

-- ---------------------------------------------------------------------------
-- stock_movement — insert-only (append-only ledger, RBAC note #1). Scoped
-- through the inventory row it targets, since stock_movement itself has no
-- branch_id column (matches the ERD — branch lives one hop away, on
-- inventory).
-- ---------------------------------------------------------------------------
alter table public.stock_movement enable row level security;

drop policy if exists stock_movement_select on public.stock_movement;
create policy stock_movement_select on public.stock_movement for select to authenticated
  using (
    public.is_cross_branch_role()
    or exists (
      select 1 from public.inventory i
      where i.inventory_id = stock_movement.inventory_id
        and i.branch_id = public.current_employee_branch_id()
    )
  );

drop policy if exists stock_movement_insert on public.stock_movement;
create policy stock_movement_insert on public.stock_movement for insert to authenticated
  with check (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'Warehouse', 'SystemAdmin')
    and exists (
      select 1 from public.inventory i
      where i.inventory_id = stock_movement.inventory_id
        and (public.is_cross_branch_role() or i.branch_id = public.current_employee_branch_id())
    )
  );

-- ---------------------------------------------------------------------------
-- orders / order_item / payment — the transaction itself.
-- Cashier: create + read own branch (no UPDATE — matches the matrix's
--   "U hanya save-bill", which is held_bill, not orders).
-- BranchManager/Owner: UPDATE is the refund/void APPROVAL path (business
--   rule #7 — trigger happens at POS, approval happens here); note this
--   still just flips status, the app is responsible for driving an explicit
--   approval UI rather than a bare toggle (RBAC note #2).
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id());

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'SystemAdmin')
    and (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id())
  );

drop policy if exists orders_update_approval on public.orders;
create policy orders_update_approval on public.orders for update to authenticated
  using (
    public.current_role_name() = 'Owner'
    or (public.current_role_name() = 'BranchManager' and branch_id = public.current_employee_branch_id())
  )
  with check (
    public.current_role_name() = 'Owner'
    or (public.current_role_name() = 'BranchManager' and branch_id = public.current_employee_branch_id())
  );

alter table public.order_item enable row level security;

drop policy if exists order_item_select on public.order_item;
create policy order_item_select on public.order_item for select to authenticated
  using (
    public.is_cross_branch_role()
    or exists (select 1 from public.orders o where o.order_id = order_item.order_id and o.branch_id = public.current_employee_branch_id())
  );

drop policy if exists order_item_insert on public.order_item;
create policy order_item_insert on public.order_item for insert to authenticated
  with check (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'SystemAdmin')
    and exists (
      select 1 from public.orders o
      where o.order_id = order_item.order_id
        and (public.is_cross_branch_role() or o.branch_id = public.current_employee_branch_id())
    )
  );

alter table public.payment enable row level security;

drop policy if exists payment_select on public.payment;
create policy payment_select on public.payment for select to authenticated
  using (
    public.is_cross_branch_role()
    or exists (select 1 from public.orders o where o.order_id = payment.order_id and o.branch_id = public.current_employee_branch_id())
  );

drop policy if exists payment_insert on public.payment;
create policy payment_insert on public.payment for insert to authenticated
  with check (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'SystemAdmin')
    and exists (
      select 1 from public.orders o
      where o.order_id = payment.order_id
        and (public.is_cross_branch_role() or o.branch_id = public.current_employee_branch_id())
    )
  );

-- ---------------------------------------------------------------------------
-- promotion — read broadly so POS can validate a code against any active
-- promo; config edits stay Owner/BranchManager (matches
-- lib/data/promotions.ts checkPromoManagerRbac). used_count increments go
-- through a narrow SECURITY DEFINER function instead of a broad UPDATE
-- grant, so Cashier can register a redemption without being able to edit
-- discount rules.
-- ---------------------------------------------------------------------------
alter table public.promotion enable row level security;

drop policy if exists promotion_select on public.promotion;
create policy promotion_select on public.promotion for select to authenticated using (true);

drop policy if exists promotion_update_manage on public.promotion;
create policy promotion_update_manage on public.promotion for update to authenticated
  using (public.current_role_name() in ('Owner', 'BranchManager'))
  with check (public.current_role_name() in ('Owner', 'BranchManager'));

create or replace function public.increment_promotion_usage(p_promotion_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.promotion
    set used_count = used_count + 1
    where promotion_id = p_promotion_id
      and active
      and (usage_limit is null or used_count < usage_limit);

  if not found then
    raise exception 'Promotion % is not usable (inactive, not found, or usage limit reached)', p_promotion_id;
  end if;
end;
$$;

revoke execute on function public.increment_promotion_usage(bigint) from public, anon, authenticated;
grant execute on function public.increment_promotion_usage(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- cash_movement — append-only for this cutover. Finance's "CRU cross-branch"
-- row in the RBAC matrix is left for when Finance's own module cuts over;
-- granting UPDATE on a cash ledger ahead of that needs its own design pass,
-- not a default.
-- ---------------------------------------------------------------------------
alter table public.cash_movement enable row level security;

drop policy if exists cash_movement_select on public.cash_movement;
create policy cash_movement_select on public.cash_movement for select to authenticated
  using (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id());

drop policy if exists cash_movement_insert on public.cash_movement;
create policy cash_movement_insert on public.cash_movement for insert to authenticated
  with check (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'SystemAdmin')
    and (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id())
  );

-- ---------------------------------------------------------------------------
-- cashier_closing / cashier_closing_breakdown — insert-only, matching the
-- app (CashierClosing has no update function: "Immutable once created").
-- ---------------------------------------------------------------------------
alter table public.cashier_closing enable row level security;

drop policy if exists cashier_closing_select on public.cashier_closing;
create policy cashier_closing_select on public.cashier_closing for select to authenticated
  using (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id());

drop policy if exists cashier_closing_insert on public.cashier_closing;
create policy cashier_closing_insert on public.cashier_closing for insert to authenticated
  with check (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'SystemAdmin')
    and (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id())
  );

alter table public.cashier_closing_breakdown enable row level security;

drop policy if exists cashier_closing_breakdown_select on public.cashier_closing_breakdown;
create policy cashier_closing_breakdown_select on public.cashier_closing_breakdown for select to authenticated
  using (
    exists (
      select 1 from public.cashier_closing c
      where c.closing_id = cashier_closing_breakdown.closing_id
        and (public.is_cross_branch_role() or c.branch_id = public.current_employee_branch_id())
    )
  );

drop policy if exists cashier_closing_breakdown_insert on public.cashier_closing_breakdown;
create policy cashier_closing_breakdown_insert on public.cashier_closing_breakdown for insert to authenticated
  with check (
    exists (
      select 1 from public.cashier_closing c
      where c.closing_id = cashier_closing_breakdown.closing_id
        and (public.is_cross_branch_role() or c.branch_id = public.current_employee_branch_id())
    )
  );

-- ---------------------------------------------------------------------------
-- held_bill — a scratch draft, so it's the one POS table with full CRUD
-- (create/retrieve/delete) for whoever's working that branch's register.
-- ---------------------------------------------------------------------------
alter table public.held_bill enable row level security;

drop policy if exists held_bill_all on public.held_bill;
create policy held_bill_all on public.held_bill for all to authenticated
  using (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'SystemAdmin')
    and (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id())
  )
  with check (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'BranchManager', 'Cashier', 'SystemAdmin')
    and (public.is_cross_branch_role() or branch_id = public.current_employee_branch_id())
  );

-- ---------------------------------------------------------------------------
-- audit_log — insert-only for app roles (a user can only log themselves as
-- actor), read scoped. No UPDATE/DELETE policy for ANY role, including
-- SystemAdmin (RBAC note #1: audit log is immutable for everyone).
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (
    public.current_role_name() in ('Owner', 'HQ/Admin', 'SystemAdmin')
    or (public.current_role_name() = 'BranchManager' and branch_id = public.current_employee_branch_id())
  );

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Every remaining ERD table: RLS enabled, no policies. Deny-all for anon and
-- authenticated until each table's owning module cuts over; service_role
-- (migrations, admin scripts) bypasses RLS by default and is unaffected.
-- ---------------------------------------------------------------------------
alter table public.customer_preference enable row level security;
alter table public.complaint enable row level security;
alter table public.customer_merge_log enable row level security;
alter table public.stock_transfer enable row level security;
alter table public.supplier enable row level security;
alter table public.purchase_order enable row level security;
alter table public.purchase_order_item enable row level security;
alter table public.appointment enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_break enable row level security;
alter table public.shift_schedule enable row level security;
alter table public.commission enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.journal_entry enable row level security;
alter table public.journal_line enable row level security;
alter table public.fiscal_period enable row level security;
alter table public.bank_reconciliation enable row level security;
