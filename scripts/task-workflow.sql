-- Görev workflow / onay sistemi MVP.
-- Proje bazında açılır; görev satırı kontrol bekliyor, revize, onaylandı, reddedildi gibi
-- ayrı bir workflow_status alanı taşır. Mevcut tasks.status kolonunu bozmaz.

alter table public.projects
  add column if not exists workflow_enabled boolean not null default false;

comment on column public.projects.workflow_enabled is
  'Açıksa bu projedeki görev satırları tamamlanmadan önce onay workflow durumlarıyla izlenir.';

alter table public.tasks
  add column if not exists workflow_status text not null default 'draft'
    check (workflow_status in ('draft', 'submitted', 'revision_requested', 'approved', 'rejected')),
  add column if not exists workflow_submitted_at timestamptz,
  add column if not exists workflow_reviewed_at timestamptz,
  add column if not exists workflow_reviewed_by text;

comment on column public.tasks.workflow_status is
  'Görev onay akışı durumu: draft, submitted, revision_requested, approved, rejected.';

create table if not exists public.task_workflow_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  from_status text check (from_status is null or from_status in ('draft', 'submitted', 'revision_requested', 'approved', 'rejected')),
  to_status text not null check (to_status in ('draft', 'submitted', 'revision_requested', 'approved', 'rejected')),
  action text not null check (action in ('submit', 'approve', 'request_revision', 'reject', 'reset')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists task_workflow_events_task_idx
  on public.task_workflow_events (task_id, created_at desc);

create index if not exists task_workflow_events_project_idx
  on public.task_workflow_events (project_id, created_at desc);

alter table public.task_workflow_events enable row level security;

drop policy if exists task_workflow_events_select_visible on public.task_workflow_events;
create policy task_workflow_events_select_visible
  on public.task_workflow_events
  for select
  to authenticated
  using (
    public.is_app_admin()
    or public.user_has_project_access_by_id(project_id)
  );

drop policy if exists task_workflow_events_insert_project_members on public.task_workflow_events;
create policy task_workflow_events_insert_project_members
  on public.task_workflow_events
  for insert
  to authenticated
  with check (
    public.is_app_admin()
    or (
      auth.uid() = actor_id
      and public.user_has_project_access_by_id(project_id)
    )
  );

drop policy if exists task_workflow_events_delete_admin on public.task_workflow_events;
create policy task_workflow_events_delete_admin
  on public.task_workflow_events
  for delete
  to authenticated
  using (public.is_app_admin());

grant select, insert, delete on table public.task_workflow_events to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_workflow_events'
  ) then
    return;
  end if;
  alter publication supabase_realtime add table public.task_workflow_events;
exception
  when undefined_object then
    null;
end $$;
