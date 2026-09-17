-- ============================================================================
-- Verification queries — read-only, run manually (e.g. in the Supabase SQL
-- Editor) AFTER applying every file in supabase/migrations/ in order.
-- Nothing in this file writes any data.
--
-- Deliberately placed at supabase/verify_queries.sql, NOT inside
-- supabase/migrations/: the Supabase CLI (`supabase db push` /
-- `migration list`) treats every file in migrations/ as a versioned schema
-- migration to track in supabase_migrations.schema_migrations, keyed off a
-- leading timestamp in the filename. A read-only query file dropped in that
-- folder risks being picked up by that tooling in ways this file was never
-- designed for. Living one level up avoids that entirely while staying
-- colocated with the migrations it verifies.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Expected tables vs information_schema.tables
-- ----------------------------------------------------------------------------
-- 1a. Every table this migration set should have created — any row with
--     exists_in_db = false means something failed to create or there's a
--     name mismatch between this list and the migrations.
with expected(table_name) as (
  values
    ('company'), ('branch'), ('role'), ('app_user'), ('employee'),
    ('customer'), ('membership'), ('loyalty_ledger'), ('customer_preference'),
    ('complaint'), ('customer_merge_log'),
    ('service'), ('product'), ('variant'), ('product_service_link'),
    ('inventory'), ('product_batch'), ('stock_movement'), ('stock_transfer'),
    ('supplier'), ('purchase_order'), ('purchase_order_item'),
    ('appointment'), ('promotion'),
    ('orders'), ('order_item'), ('payment'), ('commission'),
    ('cash_movement'), ('cashier_closing'), ('cashier_closing_breakdown'), ('held_bill'),
    ('attendance'), ('attendance_break'), ('shift_schedule'),
    ('fiscal_period'), ('chart_of_accounts'), ('journal_entry'), ('journal_line'), ('bank_reconciliation'),
    ('audit_log')
)
select
  expected.table_name,
  (actual.table_name is not null) as exists_in_db
from expected
left join information_schema.tables actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name
order by exists_in_db asc, expected.table_name;
-- Expect: 41 rows, all exists_in_db = true.

-- 1b. Reverse direction — any public table NOT in the expected list above
--     (catches leftovers, typos that created an extra table, etc).
with expected(table_name) as (
  values
    ('company'), ('branch'), ('role'), ('app_user'), ('employee'),
    ('customer'), ('membership'), ('loyalty_ledger'), ('customer_preference'),
    ('complaint'), ('customer_merge_log'),
    ('service'), ('product'), ('variant'), ('product_service_link'),
    ('inventory'), ('product_batch'), ('stock_movement'), ('stock_transfer'),
    ('supplier'), ('purchase_order'), ('purchase_order_item'),
    ('appointment'), ('promotion'),
    ('orders'), ('order_item'), ('payment'), ('commission'),
    ('cash_movement'), ('cashier_closing'), ('cashier_closing_breakdown'), ('held_bill'),
    ('attendance'), ('attendance_break'), ('shift_schedule'),
    ('fiscal_period'), ('chart_of_accounts'), ('journal_entry'), ('journal_line'), ('bank_reconciliation'),
    ('audit_log')
)
select t.table_name as unexpected_table
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and t.table_name not in (select table_name from expected)
order by t.table_name;
-- Expect: 0 rows.


-- ----------------------------------------------------------------------------
-- 2. Columns + key types for the 5 named "big" tables
-- ----------------------------------------------------------------------------
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('orders', 'order_item', 'payment', 'inventory', 'journal_line')
order by table_name, ordinal_position;


-- ----------------------------------------------------------------------------
-- 3. RLS enabled status for every table in public schema — must be TRUE
--    for all rows (this migration set enables RLS on every table it
--    creates, whether or not it also writes policies for it).
-- ----------------------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity asc, c.relname;
-- Expect: rls_enabled = true for every row. (rls_forced is expected false
-- throughout — this migration set never uses FORCE ROW LEVEL SECURITY,
-- since the SECURITY DEFINER triggers/functions rely on the table owner's
-- normal RLS-bypass to do their job.)


-- ----------------------------------------------------------------------------
-- 4. All policies, per table
-- ----------------------------------------------------------------------------
select
  schemaname,
  tablename,
  policyname,
  cmd as applies_to_command,
  roles,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- 5. EXECUTE grants on the 4 RLS helper/RPC functions
-- ----------------------------------------------------------------------------
-- This reflects whatever the CURRENT state is when you run it — it cannot
-- show you "before vs after REVOKE" after the fact, because
-- 20260915000010_rls.sql issues REVOKE immediately followed by GRANT for
-- each function, so the steady state after the full file has run is always
-- "revoked from public/anon/authenticated, then granted back to
-- authenticated only." To actually observe the "before" state, run this
-- query, then run ONLY the four `revoke ...` lines from that file by hand,
-- run this query again (should show no rows / no EXECUTE for these), then
-- run the four `grant ... to authenticated` lines and run it a third time.
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'current_role_name', 'current_employee_branch_id',
    'is_cross_branch_role', 'increment_promotion_usage'
  )
order by routine_name, grantee;
-- Expect (steady state, after the full migration has run): exactly one row
-- per function, grantee = authenticated, privilege_type = EXECUTE. No rows
-- for public/anon/PUBLIC.


-- ----------------------------------------------------------------------------
-- 6. Constraint list for journal_line, payment, appointment
-- ----------------------------------------------------------------------------
select
  cls.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type, -- c=check, f=foreign key, p=primary key, u=unique, x=exclusion, t=constraint trigger
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname in ('journal_line', 'payment', 'appointment')
order by cls.relname, con.contype, con.conname;

-- journal_line's DEFERRABLE constraint TRIGGER (journal_line_balance_check)
-- is not a pg_constraint row (it's a real trigger, contype has no 't' entry
-- for it here despite the comment above listing 't' — that letter is listed
-- for completeness of contype's possible values, but Postgres constraint
-- triggers created via CREATE CONSTRAINT TRIGGER do NOT appear in
-- pg_constraint at all, only in pg_trigger). Check it separately:
select
  cls.relname as table_name,
  trg.tgname as trigger_name,
  trg.tgdeferrable as is_deferrable,
  trg.tginitdeferred as is_initially_deferred,
  pg_get_triggerdef(trg.oid) as definition
from pg_trigger trg
join pg_class cls on cls.oid = trg.tgrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and not trg.tgisinternal
order by cls.relname, trg.tgname;
