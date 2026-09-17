# Supabase schema — RedBox ERP

Full schema for every table in `docs/ERD_RedBoxERP.mermaid`, designed against
that ERD + `docs/Data_Dictionary_RedBoxERP.md` + `docs/RBAC_CRUD_Matrix.md`.
Only the **POS module** (orders, payment, stock deduction, cash in/out,
cashier closing, held bills, loyalty earn) has real RLS policies wired up —
every other table exists but is locked down (RLS enabled, no policies) until
its own module cuts over from `localStorage`. See the comment at the top of
`migrations/20260915000010_rls.sql` for the full reasoning.

## Applying these migrations to a new project

Once you've created the Supabase project (see the steps Claude gave you) and
have the Project URL + keys:

**Option A — SQL Editor (no local setup, do this first time):**

1. Open your project's **SQL Editor** in the Supabase dashboard.
2. Run each file in `migrations/` **in filename order** (they're numbered —
   `20260915000001_...` through `20260915000010_...`), pasting one file's
   contents per query, in a fresh query each time.
3. Optionally run `seed.sql` afterward to insert the company + 5 branch rows.

**Option B — Supabase CLI (once you want this version-controlled against a
real project):**

```
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` applies every file in `migrations/` in order and records what's
already applied, so future schema changes are just "add a new numbered
file, run `db push` again."

## What's NOT here yet

- The `checkout()` RPC (a single Postgres function wrapping order + order_item
  + payment + stock_movement + loyalty_ledger writes in one transaction, the
  same atomicity `lib/data/transactions.ts checkout()` currently simulates
  with snapshot/rollback in JS) — next step, once the project exists and can
  actually be tested against.
- Auth wiring (how a 4-digit cashier PIN maps to a Supabase Auth session) —
  open design question, flagged separately.
- Seed data for `service`/`product`/`employee` — those come from whatever
  the Owner wants as real starting catalog/staff data, not something to
  invent here.
