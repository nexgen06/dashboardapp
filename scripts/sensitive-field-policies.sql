-- =============================================================================
-- Hassas alan policy merkezi + shadow karar logu (DB-first)
-- =============================================================================
-- Bu script enforcement acmadan once policy modelini ve shadow telemetry tablosunu
-- hazirlar. Idempotent calisir.

create table if not exists public.sensitive_field_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  field_pattern text not null check (char_length(trim(field_pattern)) > 0),
  match_type text not null default 'contains'
    check (match_type in ('exact', 'contains', 'regex')),
  action text not null
    check (action in ('view', 'edit', 'copy', 'export_masked', 'export_unmasked')),
  role_scope text[] not null default array['admin', 'project_manager', 'member', 'viewer']::text[],
  project_scope uuid references public.projects(id) on delete cascade,
  decision text not null check (decision in ('allow', 'deny')),
  reason_required boolean not null default false,
  priority integer not null default 100 check (priority >= 0 and priority <= 10000),
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sensitive_field_policies_enabled_idx
  on public.sensitive_field_policies (enabled, action, priority);

create index if not exists sensitive_field_policies_project_idx
  on public.sensitive_field_policies (project_scope, action, enabled);

create or replace function public.sensitive_field_policies_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sensitive_field_policies_touch_trg on public.sensitive_field_policies;
create trigger sensitive_field_policies_touch_trg
  before update on public.sensitive_field_policies
  for each row execute function public.sensitive_field_policies_touch_updated_at();

alter table public.sensitive_field_policies enable row level security;

drop policy if exists sensitive_field_policies_select_admin on public.sensitive_field_policies;
create policy sensitive_field_policies_select_admin
  on public.sensitive_field_policies
  for select
  to authenticated
  using (public.is_app_admin());

drop policy if exists sensitive_field_policies_insert_admin on public.sensitive_field_policies;
create policy sensitive_field_policies_insert_admin
  on public.sensitive_field_policies
  for insert
  to authenticated
  with check (public.is_app_admin());

drop policy if exists sensitive_field_policies_update_admin on public.sensitive_field_policies;
create policy sensitive_field_policies_update_admin
  on public.sensitive_field_policies
  for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists sensitive_field_policies_delete_admin on public.sensitive_field_policies;
create policy sensitive_field_policies_delete_admin
  on public.sensitive_field_policies
  for delete
  to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.sensitive_field_policies to authenticated;

create table if not exists public.pii_policy_shadow_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  field_name text not null,
  action text not null
    check (action in ('view', 'edit', 'copy', 'export_masked', 'export_unmasked')),
  legacy_decision text not null check (legacy_decision in ('allow', 'deny')),
  policy_decision text not null check (policy_decision in ('allow', 'deny')),
  policy_id uuid references public.sensitive_field_policies(id) on delete set null,
  enforced boolean not null default false,
  context jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index if not exists pii_policy_shadow_log_user_at_idx
  on public.pii_policy_shadow_log (user_id, at desc);
create index if not exists pii_policy_shadow_log_action_at_idx
  on public.pii_policy_shadow_log (action, at desc);
create index if not exists pii_policy_shadow_log_policy_idx
  on public.pii_policy_shadow_log (policy_id, at desc);

alter table public.pii_policy_shadow_log enable row level security;

drop policy if exists pii_policy_shadow_log_select_admin on public.pii_policy_shadow_log;
create policy pii_policy_shadow_log_select_admin
  on public.pii_policy_shadow_log
  for select
  to authenticated
  using (public.is_app_admin());

drop policy if exists pii_policy_shadow_log_insert_own on public.pii_policy_shadow_log;
create policy pii_policy_shadow_log_insert_own
  on public.pii_policy_shadow_log
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and lower(trim(user_email)) = public.auth_email_lower()
  );

grant select, insert on public.pii_policy_shadow_log to authenticated;

create or replace function public.evaluate_sensitive_policy(
  p_field_key text,
  p_action text,
  p_role_id text,
  p_project_id uuid default null
)
returns table(
  decision text,
  policy_id uuid,
  reason_required boolean,
  priority integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field text := lower(trim(coalesce(p_field_key, '')));
  v_action text := lower(trim(coalesce(p_action, '')));
  v_role text := lower(trim(coalesce(p_role_id, 'member')));
begin
  if v_field = '' or v_action = '' then
    return query select 'allow'::text, null::uuid, false, 10000;
    return;
  end if;

  return query
  with candidates as (
    select
      p.id as policy_id,
      p.decision,
      p.reason_required,
      p.priority
    from public.sensitive_field_policies p
    where p.enabled = true
      and p.action = v_action
      and v_role = any (p.role_scope)
      and (p.project_scope is null or p.project_scope = p_project_id)
      and (
        (p.match_type = 'exact' and v_field = lower(trim(p.field_pattern)))
        or (p.match_type = 'contains' and strpos(v_field, lower(trim(p.field_pattern))) > 0)
        or (p.match_type = 'regex' and v_field ~* p.field_pattern)
      )
    order by p.priority asc, p.created_at asc
    limit 1
  )
  select c.decision, c.policy_id, c.reason_required, c.priority
  from candidates c;

  if not found then
    return query select 'allow'::text, null::uuid, false, 10000;
  end if;
end;
$$;

revoke all on function public.evaluate_sensitive_policy(text, text, text, uuid) from public;
grant execute on function public.evaluate_sensitive_policy(text, text, text, uuid) to authenticated;

comment on table public.sensitive_field_policies is
  'Hassas alan aksiyonlari icin merkezi policy kaynagi. DB-first karar motoru burayi kullanir.';

comment on table public.pii_policy_shadow_log is
  'Legacy karar ile policy kararini shadow modda karsilastirma telemetry kaydi.';
