-- Otomasyon merkezi: kural, aksiyon ve çalışma logları.

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0 and char_length(name) <= 160),
  enabled boolean not null default true,
  trigger_type text not null default 'row_saved' check (trigger_type in ('row_saved','scheduled','manual')),
  conditions jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_actions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  action_type text not null check (
    action_type in ('assign_chip','notify','lock_row','set_risk','color_row','log_only')
  ),
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.automation_rules(id) on delete set null,
  task_id uuid references public.tasks(id) on delete cascade,
  status text not null check (status in ('applied','skipped','failed')),
  message text,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_rules_project_idx on public.automation_rules(project_id, enabled);
create index if not exists automation_actions_rule_idx on public.automation_actions(rule_id, sort_order);
create index if not exists automation_logs_task_idx on public.automation_logs(task_id, created_at desc);
create index if not exists automation_logs_rule_idx on public.automation_logs(rule_id, created_at desc);

create or replace function public.touch_automation_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists automation_rules_touch_trg on public.automation_rules;
create trigger automation_rules_touch_trg
  before update on public.automation_rules
  for each row execute function public.touch_automation_updated_at();

drop trigger if exists automation_actions_touch_trg on public.automation_actions;
create trigger automation_actions_touch_trg
  before update on public.automation_actions
  for each row execute function public.touch_automation_updated_at();

alter table public.automation_rules enable row level security;
alter table public.automation_actions enable row level security;
alter table public.automation_logs enable row level security;

drop policy if exists automation_rules_select_visible on public.automation_rules;
create policy automation_rules_select_visible
  on public.automation_rules for select to authenticated
  using (
    public.is_app_admin()
    or project_id is null
    or public.user_has_project_access_by_id(project_id)
  );

drop policy if exists automation_rules_write_staff on public.automation_rules;
create policy automation_rules_write_staff
  on public.automation_rules for all to authenticated
  using (
    public.is_app_admin()
    or (
      public.current_profile_role_id() = 'project_manager'
      and (project_id is null or public.user_has_project_access_by_id(project_id))
    )
  )
  with check (
    public.is_app_admin()
    or (
      public.current_profile_role_id() = 'project_manager'
      and (project_id is null or public.user_has_project_access_by_id(project_id))
    )
  );

drop policy if exists automation_actions_select_visible on public.automation_actions;
create policy automation_actions_select_visible
  on public.automation_actions for select to authenticated
  using (
    exists (
      select 1 from public.automation_rules r
      where r.id = automation_actions.rule_id
        and (public.is_app_admin() or r.project_id is null or public.user_has_project_access_by_id(r.project_id))
    )
  );

drop policy if exists automation_actions_write_staff on public.automation_actions;
create policy automation_actions_write_staff
  on public.automation_actions for all to authenticated
  using (
    exists (
      select 1 from public.automation_rules r
      where r.id = automation_actions.rule_id
        and (
          public.is_app_admin()
          or (
            public.current_profile_role_id() = 'project_manager'
            and (r.project_id is null or public.user_has_project_access_by_id(r.project_id))
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.automation_rules r
      where r.id = automation_actions.rule_id
        and (
          public.is_app_admin()
          or (
            public.current_profile_role_id() = 'project_manager'
            and (r.project_id is null or public.user_has_project_access_by_id(r.project_id))
          )
        )
    )
  );

drop policy if exists automation_logs_select_visible on public.automation_logs;
create policy automation_logs_select_visible
  on public.automation_logs for select to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = automation_logs.task_id
        and public.task_is_visible_for_current_user(t.project_id, t.assignee)
    )
  );

drop policy if exists automation_logs_insert_members on public.automation_logs;
create policy automation_logs_insert_members
  on public.automation_logs for insert to authenticated
  with check (
    public.current_profile_role_id() in ('admin','project_manager','member')
  );

grant select, insert, update, delete on public.automation_rules to authenticated;
grant select, insert, update, delete on public.automation_actions to authenticated;
grant select, insert on public.automation_logs to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.automation_rules;
    alter publication supabase_realtime add table public.automation_actions;
    alter publication supabase_realtime add table public.automation_logs;
  end if;
exception
  when duplicate_object then null;
end $$;

comment on table public.automation_rules is 'Teknik olmayan kullanıcılar için koşul + aksiyon otomasyon kuralları.';
comment on table public.automation_logs is 'Otomasyon çalışmaları: hangi kural, hangi satır, ne yaptı.';
