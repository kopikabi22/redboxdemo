-- Reference/master data — NOT demo transactions. Company + the 5 real
-- RedBox branches (CLAUDE.md: "5 cabang lintas kota"). Safe to run once
-- against a fresh project; ON CONFLICT guards make it safe to re-run too.
-- Role rows are already seeded inline in
-- 20260915000001_core_identity.sql — not repeated here.

insert into public.company (name)
values ('RedBox Barbershop')
on conflict do nothing;

insert into public.branch (company_id, name, city, province, scope_type)
select c.company_id, b.name, b.city, b.province, 'branch'
from public.company c
cross join (values
  ('Bypass', 'Cirebon', 'Jawa Barat'),
  ('Samadikun', 'Cirebon', 'Jawa Barat'),
  ('CSB Mall', 'Cirebon', 'Jawa Barat'),
  ('Sumber', 'Cirebon', 'Jawa Barat'),
  ('Tegal', 'Tegal', 'Jawa Tengah')
) as b(name, city, province)
where c.name = 'RedBox Barbershop'
  and not exists (
    select 1 from public.branch existing
    where existing.company_id = c.company_id and existing.name = b.name
  );
