-- Rapor şablonları: PDF/e-posta export ayarlarını kurumsal veya kişisel olarak saklar.
-- Çalışır: Supabase Studio > SQL Editor > yapıştır > Run
-- Idempotent: tekrar çalıştırılabilir.

create table if not exists public.report_templates (
  id              uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  scope           text        not null default 'private' check (scope in ('private','shared')),
  assignment_scope text       not null default 'system' check (assignment_scope in ('system','project')),
  project_id      uuid        references public.projects(id) on delete cascade,
  is_default      boolean     not null default false,
  name            text        not null check (length(trim(name)) > 0),
  description     text,
  template_config jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.report_templates
  add column if not exists assignment_scope text not null default 'system';
alter table public.report_templates
  add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.report_templates
  add column if not exists is_default boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'report_templates_assignment_scope_check'
  ) then
    alter table public.report_templates
      add constraint report_templates_assignment_scope_check
      check (assignment_scope in ('system','project'));
  end if;
end;
$$;

create index if not exists report_templates_user_idx on public.report_templates (user_id);
create index if not exists report_templates_scope_idx on public.report_templates (scope);
create index if not exists report_templates_assignment_idx on public.report_templates (assignment_scope, project_id);
create index if not exists report_templates_updated_idx on public.report_templates (updated_at desc);
create unique index if not exists report_templates_one_system_default_idx
  on public.report_templates (assignment_scope)
  where is_default = true and assignment_scope = 'system';
create unique index if not exists report_templates_one_project_default_idx
  on public.report_templates (project_id)
  where is_default = true and assignment_scope = 'project' and project_id is not null;

create or replace function public.report_templates_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists report_templates_touch_trg on public.report_templates;
create trigger report_templates_touch_trg
  before update on public.report_templates
  for each row execute function public.report_templates_touch_updated_at();

alter table public.report_templates enable row level security;

drop policy if exists report_templates_select on public.report_templates;
drop policy if exists report_templates_insert on public.report_templates;
drop policy if exists report_templates_update on public.report_templates;
drop policy if exists report_templates_delete on public.report_templates;

create policy report_templates_select
  on public.report_templates
  for select
  to authenticated
  using (user_id = auth.uid() or scope = 'shared');

create policy report_templates_insert
  on public.report_templates
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      scope = 'private'
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role_id in ('admin','project_manager')
      )
    )
  );

create policy report_templates_update
  on public.report_templates
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role_id in ('admin','project_manager')
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role_id in ('admin','project_manager')
    )
  );

create policy report_templates_delete
  on public.report_templates
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role_id in ('admin','project_manager')
    )
  );

comment on table public.report_templates is
  'PDF/e-posta export rapor şablonları: başlık, konu, kapsam, kolonlar, e-posta modu ve hassas veri tercihi.';
