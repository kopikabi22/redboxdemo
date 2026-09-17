-- Audit log — append-only, no UPDATE/DELETE for any app role including
-- System Admin (docs/RBAC_CRUD_Matrix.md note #1), enforced in the RLS
-- migration by simply never granting an UPDATE/DELETE policy on it.
-- Source of truth: docs/ERD_RedBoxERP.mermaid.

create table if not exists public.audit_log (
  event_id bigint generated always as identity primary key,
  user_id uuid references public.app_user (id),
  action varchar(50) not null,
  entity varchar(100) not null,
  entity_id varchar(100) not null,
  branch_id bigint references public.branch (branch_id),
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);
create index if not exists audit_log_branch_id_idx on public.audit_log (branch_id);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at);

comment on table public.audit_log is
  'branch_id is nullable because some audited actions (e.g. role/permission change) are holding-scope, not tied to one branch.';
