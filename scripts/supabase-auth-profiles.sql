-- Dashboard: Supabase Auth + profil / roller tablosu
-- Supabase SQL Editor veya migrations ile çalıştırın.
-- Profil SELECT sıkılaştırması ve projects/tasks RLS için bu dosyadan sonra
-- scripts/supabase-rls-policies.sql betiğini çalıştırın.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text,
  role_id text not null default 'member',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- İlk oluşturmada kullanıcı kendi satırını ekler / günceller
create policy profiles_select_authenticated on public.profiles
  for select
  using (auth.role () = 'authenticated');

create policy profiles_insert_own on public.profiles
  for insert
  with check (auth.uid () = id);

create policy profiles_update_own on public.profiles
  for update
  using (auth.uid () = id);

-- Rol ataması için (yalnızca role_id='admin' çağıranlar)
create or replace function public.admin_set_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid () is null then
    raise exception 'not authenticated';
  end if;
  if new_role not in ('admin', 'project_manager', 'member', 'viewer') then
    raise exception 'invalid role';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid () and p.role_id = 'admin'
  ) then
    raise exception 'only admins can change roles';
  end if;
  update public.profiles
  set role_id = new_role, updated_at = now()
  where id = target_id;
end;
$$;

revoke all on function public.admin_set_role (uuid, text) from public;
grant execute on function public.admin_set_role (uuid, text) to authenticated;
