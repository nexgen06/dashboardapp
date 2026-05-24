-- Proje bazlı ince yetki altyapısı.
-- Bu dosya tabloyu ve RLS'i hazırlar; mevcut uygulama davranışını tek başına değiştirmez.
-- Sonraki fazda export, yorum, kopyalama ve toplu işlemler bu tabloya bağlanabilir.

create table if not exists public.project_member_permissions (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  project_role text not null default 'member' check (project_role in ('project_owner', 'project_manager', 'member', 'viewer')),
  can_view boolean not null default true,
  can_edit boolean not null default false,
  can_comment boolean not null default true,
  can_copy boolean not null default true,
  can_export boolean not null default false,
  can_export_unmasked boolean not null default false,
  can_bulk_update boolean not null default false,
  can_bulk_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_member_permissions_user_idx
  on public.project_member_permissions (user_id, project_id);

create index if not exists project_member_permissions_email_idx
  on public.project_member_permissions (lower(trim(user_email)), project_id);

create or replace function public.project_member_permissions_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.user_email := lower(trim(new.user_email));
  return new;
end;
$$;

drop trigger if exists project_member_permissions_touch_trg on public.project_member_permissions;
create trigger project_member_permissions_touch_trg
  before insert or update on public.project_member_permissions
  for each row execute function public.project_member_permissions_touch_updated_at();

alter table public.project_member_permissions enable row level security;

drop policy if exists project_member_permissions_select_visible on public.project_member_permissions;
create policy project_member_permissions_select_visible
  on public.project_member_permissions
  for select
  to authenticated
  using (
    public.is_app_admin()
    or user_id = auth.uid()
    or public.user_has_project_access_by_id(project_id)
  );

drop policy if exists project_member_permissions_insert_staff on public.project_member_permissions;
create policy project_member_permissions_insert_staff
  on public.project_member_permissions
  for insert
  to authenticated
  with check (
    public.is_app_admin()
    or (
      public.current_profile_role_id() = 'project_manager'
      and public.user_has_project_access_by_id(project_id)
      and can_export_unmasked = false
      and can_bulk_delete = false
    )
  );

drop policy if exists project_member_permissions_update_staff on public.project_member_permissions;
create policy project_member_permissions_update_staff
  on public.project_member_permissions
  for update
  to authenticated
  using (
    public.is_app_admin()
    or (
      public.current_profile_role_id() = 'project_manager'
      and public.user_has_project_access_by_id(project_id)
    )
  )
  with check (
    public.is_app_admin()
    or (
      public.current_profile_role_id() = 'project_manager'
      and public.user_has_project_access_by_id(project_id)
      and can_export_unmasked = false
      and can_bulk_delete = false
    )
  );

drop policy if exists project_member_permissions_delete_admin on public.project_member_permissions;
create policy project_member_permissions_delete_admin
  on public.project_member_permissions
  for delete
  to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on table public.project_member_permissions to authenticated;

comment on table public.project_member_permissions is
  'Proje bazlı kullanıcı yetkileri. Global rolün yanında proje özelinde görüntüleme, düzenleme, yorum, kopya ve export izinlerini tutar.';
