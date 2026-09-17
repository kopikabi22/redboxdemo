-- ============================================================================
-- Smoke test — exercises constraints/triggers created by
-- supabase/migrations/*.sql. Entirely wrapped in BEGIN...ROLLBACK so nothing
-- written here is ever kept, regardless of pass or fail.
--
-- Deliberately placed at supabase/smoke_test.sql, NOT inside
-- supabase/migrations/ — same reasoning as verify_queries.sql's header
-- comment: files in migrations/ get tracked by the Supabase CLI as schema
-- migrations, which this is not.
--
-- Run this connected as the database owner (e.g. pasted into the Supabase
-- SQL Editor, which runs as `postgres`) — table owners bypass RLS by
-- default, so this test exercises the CONSTRAINTS and TRIGGERS from the
-- migrations, not the RLS policies from 20260915000010_rls.sql. Testing the
-- RLS policies themselves would mean impersonating specific auth.uid()/role
-- combinations, which is a different, separate test this file does not
-- attempt.
--
-- How failures surface: a `raise exception` propagates out of the DO block,
-- aborts the transaction, and the trailing ROLLBACK (harmless on an already-
-- aborted transaction) still runs. Read the error message — it always
-- starts with 'FAIL:' — to see which test failed and why. On success, five
-- 'PASS:' NOTICEs print, followed by 'ALL 5 SMOKE TESTS PASSED' — but NOTICE
-- output does not show up in Supabase's Postgres Logs, so each PASS is ALSO
-- written to a temp table (smoke_test_results), which the final `select *`
-- below dumps to the Results grid before the ROLLBACK undoes everything,
-- table included (CREATE TEMP TABLE is transactional like any other DDL —
-- ROLLBACK removes the table definition itself, not just its rows, so nothing
-- needs manual DROPping and rerunning this file never hits "already exists").
-- ============================================================================

begin;

do $$
declare
  v_company_id bigint;
  v_branch_id bigint;
  v_customer_id bigint;
  v_employee_id bigint;
  v_product_id bigint;
  v_inventory_id bigint;
  v_account_debit_id bigint;
  v_account_credit_id bigint;
  v_fiscal_period_id bigint;
  v_journal_id bigint;
  v_journal_id_bad bigint;
  v_on_hand_before int;
  v_on_hand_after int;
  v_caught boolean;
begin
  -- Results table — see header comment. Created here (not outside the DO
  -- block) purely so it's the first thing that happens once the block
  -- starts; it holds no fixture data and doesn't participate in any test's
  -- pass/fail logic.
  execute 'create temp table smoke_test_results (test_name text, result text, detail text)';

  -- ------------------------------------------------------------------------
  -- Fixtures (all expected to succeed — if any of these fail, that's a real
  -- schema problem, not something this test is designed to catch/report).
  -- ------------------------------------------------------------------------
  insert into public.company (name) values ('Smoke Test Co')
    returning company_id into v_company_id;

  insert into public.branch (company_id, name, city, province)
    values (v_company_id, 'Smoke Test Branch', 'Cirebon', 'Jawa Barat')
    returning branch_id into v_branch_id;

  insert into public.customer (name, phone_number, type)
    values ('Smoke Test Customer', '089900000001', 'guest')
    returning customer_id into v_customer_id;

  insert into public.employee (branch_id, name, position)
    values (v_branch_id, 'Smoke Test Employee', 'Cashier')
    returning employee_id into v_employee_id;

  insert into public.product (sku, name, selling_price)
    values ('SMOKE-SKU-1', 'Smoke Test Product', 10000)
    returning product_id into v_product_id;

  insert into public.inventory (product_id, branch_id, on_hand, reserved)
    values (v_product_id, v_branch_id, 10, 0)
    returning inventory_id into v_inventory_id;

  insert into public.chart_of_accounts (account_code, account_name, account_type)
    values ('SMOKE-1000', 'Smoke Test Kas', 'asset')
    returning account_id into v_account_debit_id;

  insert into public.chart_of_accounts (account_code, account_name, account_type)
    values ('SMOKE-4000', 'Smoke Test Pendapatan', 'revenue')
    returning account_id into v_account_credit_id;

  insert into public.fiscal_period (period_start, period_end, status)
    values (
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
      'open'
    )
    returning fiscal_period_id into v_fiscal_period_id;

  raise notice 'Fixtures created OK (branch=%, customer=%, employee=%, product=%, inventory=%, fiscal_period=%)',
    v_branch_id, v_customer_id, v_employee_id, v_product_id, v_inventory_id, v_fiscal_period_id;

  -- ------------------------------------------------------------------------
  -- Test 1: balanced journal_entry + journal_line -> must SUCCEED.
  -- Both lines are inserted while the constraint trigger is still DEFERRED
  -- (its default mode), then SET CONSTRAINTS ... IMMEDIATE forces the
  -- check_journal_balance() check to run right here instead of waiting for
  -- COMMIT (which never happens in this script — everything ends in
  -- ROLLBACK), so a failure here is observable within this script.
  -- ------------------------------------------------------------------------
  insert into public.journal_entry (branch_id, fiscal_period_id, reference)
    values (v_branch_id, v_fiscal_period_id, 'SMOKE-TEST-1-BALANCED')
    returning journal_id into v_journal_id;
  insert into public.journal_line (journal_id, account_id, debit, credit)
    values (v_journal_id, v_account_debit_id, 100000, 0);
  insert into public.journal_line (journal_id, account_id, debit, credit)
    values (v_journal_id, v_account_credit_id, 0, 100000);
  execute 'set constraints journal_line_balance_check immediate';
  insert into smoke_test_results (test_name, result, detail)
    values ('Test 1', 'PASS', format('balanced journal_entry %s accepted as expected', v_journal_id));
  raise notice 'PASS: Test 1 - balanced journal_entry % accepted as expected', v_journal_id;

  -- ------------------------------------------------------------------------
  -- Test 2: unbalanced journal_entry -> must FAIL (check_journal_balance).
  -- Reset to DEFERRED first so both lines land before the check runs, same
  -- shape as Test 1, rather than possibly failing on the first line alone
  -- because Test 1 left the session in IMMEDIATE mode.
  -- ------------------------------------------------------------------------
  v_caught := false;
  begin
    execute 'set constraints journal_line_balance_check deferred';
    insert into public.journal_entry (branch_id, fiscal_period_id, reference)
      values (v_branch_id, v_fiscal_period_id, 'SMOKE-TEST-2-UNBALANCED')
      returning journal_id into v_journal_id_bad;
    insert into public.journal_line (journal_id, account_id, debit, credit)
      values (v_journal_id_bad, v_account_debit_id, 100000, 0);
    insert into public.journal_line (journal_id, account_id, debit, credit)
      values (v_journal_id_bad, v_account_credit_id, 0, 40000);
    execute 'set constraints journal_line_balance_check immediate';
    -- If we get here, the constraint did NOT fire — that is itself a failure.
    raise exception 'FAIL: Test 2 - unbalanced journal_line (debit 100000 / credit 40000) was accepted, check_journal_balance did not fire';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise; -- our own deliberate failure above — propagate it, don't treat as a pass
      end if;
      v_caught := true;
      insert into smoke_test_results (test_name, result, detail)
        values ('Test 2', 'PASS', format('unbalanced journal_line correctly rejected: %s', sqlerrm));
      raise notice 'PASS: Test 2 - unbalanced journal_line correctly rejected: %', sqlerrm;
  end;
  if not v_caught then
    raise exception 'FAIL: Test 2 did not reach its expected-failure branch';
  end if;

  -- ------------------------------------------------------------------------
  -- Test 3: loyalty_ledger entry that would take points_balance negative
  -- -> must FAIL (apply_loyalty_ledger_entry trigger). Customer starts at
  -- the default points_balance = 0, so redeeming 100 points is guaranteed
  -- to go negative.
  -- ------------------------------------------------------------------------
  v_caught := false;
  begin
    insert into public.loyalty_ledger (customer_id, points, type, reference)
      values (v_customer_id, -100, 'redeem', 'SMOKE-TEST-3');
    raise exception 'FAIL: Test 3 - loyalty_ledger entry that should have taken points_balance negative was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      v_caught := true;
      insert into smoke_test_results (test_name, result, detail)
        values ('Test 3', 'PASS', format('negative points_balance correctly rejected: %s', sqlerrm));
      raise notice 'PASS: Test 3 - negative points_balance correctly rejected: %', sqlerrm;
  end;
  if not v_caught then
    raise exception 'FAIL: Test 3 did not reach its expected-failure branch';
  end if;

  -- ------------------------------------------------------------------------
  -- Test 4: ordinary stock_movement -> must SUCCEED, on_hand updated by the
  -- apply_stock_movement trigger (not by this test writing to inventory
  -- directly — there is no UPDATE policy that would even allow that under
  -- RLS, though this session bypasses RLS as the table owner regardless).
  -- ------------------------------------------------------------------------
  select on_hand into v_on_hand_before from public.inventory where inventory_id = v_inventory_id;
  insert into public.stock_movement (inventory_id, quantity, movement_type, reference)
    values (v_inventory_id, 5, 'purchase_receiving', 'SMOKE-TEST-4');
  select on_hand into v_on_hand_after from public.inventory where inventory_id = v_inventory_id;
  if v_on_hand_after <> v_on_hand_before + 5 then
    raise exception 'FAIL: Test 4 - on_hand went from % to % (expected exactly +5 via apply_stock_movement trigger)', v_on_hand_before, v_on_hand_after;
  end if;
  insert into smoke_test_results (test_name, result, detail)
    values ('Test 4', 'PASS', format('stock_movement accepted, on_hand %s -> %s via trigger', v_on_hand_before, v_on_hand_after));
  raise notice 'PASS: Test 4 - stock_movement accepted, on_hand % -> % via trigger', v_on_hand_before, v_on_hand_after;

  -- ------------------------------------------------------------------------
  -- Test 5: appointment type='wedding' with no address -> must FAIL
  -- (appointment_requires_address_for_non_regular check constraint).
  -- ------------------------------------------------------------------------
  v_caught := false;
  begin
    insert into public.appointment (customer_id, employee_id, branch_id, type, address, slot_time)
      values (v_customer_id, v_employee_id, v_branch_id, 'wedding', null, now() + interval '1 day');
    raise exception 'FAIL: Test 5 - wedding appointment with no address was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      v_caught := true;
      insert into smoke_test_results (test_name, result, detail)
        values ('Test 5', 'PASS', format('wedding appointment without address correctly rejected: %s', sqlerrm));
      raise notice 'PASS: Test 5 - wedding appointment without address correctly rejected: %', sqlerrm;
  end;
  if not v_caught then
    raise exception 'FAIL: Test 5 did not reach its expected-failure branch';
  end if;

  raise notice 'ALL 5 SMOKE TESTS PASSED';
end $$;

-- Same info as the 5 'PASS:' NOTICEs above, but as an actual result set —
-- NOTICE output doesn't appear in Supabase's Postgres Logs, this does show
-- in the SQL Editor's Results grid. Still inside the transaction, so this
-- sees everything the DO block just inserted; the table (and everything
-- else) disappears the moment ROLLBACK below runs.
select * from smoke_test_results order by test_name;

rollback;
