-- Kurumsal ağlarda Supabase Presence/WebSocket engellenirse çevrimiçi kullanıcı
-- bilgisini normal HTTPS istekleriyle korumak için heartbeat tablosu.

create table if not exists public.presence_heartbeats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  user_name text,
  scope text not null check (scope in ('app', 'tasks', 'project')),
  project_id text,
  project_key text not null default '',
  row_id text,
  client_id text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presence_heartbeats_scope_project_check check (
    (scope in ('app', 'tasks') and project_id is null and project_key = '')
    or (scope = 'project' and project_id is not null and project_key = project_id)
  )
);

alter table public.presence_heartbeats
  drop constraint if exists presence_heartbeats_scope_check;

alter table public.presence_heartbeats
  add constraint presence_heartbeats_scope_check
  check (scope in ('app', 'tasks', 'project'));

alter table public.presence_heartbeats
  drop constraint if exists presence_heartbeats_scope_project_check;

alter table public.presence_heartbeats
  add constraint presence_heartbeats_scope_project_check
  check (
    (scope in ('app', 'tasks') and project_id is null and project_key = '')
    or (scope = 'project' and project_id is not null and project_key = project_id)
  );

create unique index if not exists presence_heartbeats_user_scope_project_key_idx
  on public.presence_heartbeats (user_id, scope, project_key);

create index if not exists presence_heartbeats_last_seen_idx
  on public.presence_heartbeats (scope, project_id, last_seen_at desc);

alter table public.presence_heartbeats enable row level security;

drop policy if exists presence_heartbeats_select_authenticated on public.presence_heartbeats;
create policy presence_heartbeats_select_authenticated
  on public.presence_heartbeats
  for select
  to authenticated
  using (
    last_seen_at > now() - interval '2 minutes'
    or public.is_app_admin()
  );

drop policy if exists presence_heartbeats_insert_own on public.presence_heartbeats;
create policy presence_heartbeats_insert_own
  on public.presence_heartbeats
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists presence_heartbeats_update_own on public.presence_heartbeats;
create policy presence_heartbeats_update_own
  on public.presence_heartbeats
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists presence_heartbeats_delete_own on public.presence_heartbeats;
create policy presence_heartbeats_delete_own
  on public.presence_heartbeats
  for delete
  to authenticated
  using (auth.uid() = user_id);
