create table if not exists public.reference_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  file_name text,
  fields jsonb not null default '[]'::jsonb,
  records jsonb not null default '[]'::jsonb,
  record_count integer not null default 0,
  label_field text,
  key_field text,
  search_fields jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reference_sources_name_idx on public.reference_sources using btree (name);

alter table public.reference_sources enable row level security;

drop policy if exists "reference_sources_select_authenticated" on public.reference_sources;
create policy "reference_sources_select_authenticated"
on public.reference_sources
for select
to authenticated
using (true);

drop policy if exists "reference_sources_insert_admin_pm" on public.reference_sources;
create policy "reference_sources_insert_admin_pm"
on public.reference_sources
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_id in ('admin', 'project_manager')
  )
);

drop policy if exists "reference_sources_update_admin_pm" on public.reference_sources;
create policy "reference_sources_update_admin_pm"
on public.reference_sources
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_id in ('admin', 'project_manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_id in ('admin', 'project_manager')
  )
);

drop policy if exists "reference_sources_delete_admin" on public.reference_sources;
create policy "reference_sources_delete_admin"
on public.reference_sources
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_id = 'admin'
  )
);

create or replace function public.set_reference_sources_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reference_sources_updated_at on public.reference_sources;
create trigger trg_reference_sources_updated_at
before update on public.reference_sources
for each row execute function public.set_reference_sources_updated_at();

