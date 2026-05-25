-- Otomasyon aksiyonlarının satır üzerinde kalıcı durum üretmesi.
-- color_row ve lock_row aksiyonları bu tablo üzerinden canlı tabloya yansır.

create table if not exists public.task_automation_state (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  row_color text check (row_color in ('red','amber','emerald','blue','purple','slate')),
  locked boolean not null default false,
  locked_reason text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists task_automation_state_locked_idx
  on public.task_automation_state(locked)
  where locked = true;

create or replace function public.touch_task_automation_state_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists task_automation_state_touch_trg on public.task_automation_state;
create trigger task_automation_state_touch_trg
  before update on public.task_automation_state
  for each row execute function public.touch_task_automation_state_updated_at();

alter table public.task_automation_state enable row level security;

drop policy if exists task_automation_state_select_visible on public.task_automation_state;
create policy task_automation_state_select_visible
  on public.task_automation_state for select to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_automation_state.task_id
        and public.task_is_visible_for_current_user(t.project_id, t.assignee)
    )
  );

drop policy if exists task_automation_state_insert_staff on public.task_automation_state;
create policy task_automation_state_insert_staff
  on public.task_automation_state for insert to authenticated
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_automation_state.task_id
        and public.current_profile_role_id() = 'project_manager'
        and public.user_has_project_access_by_id(t.project_id)
    )
  );

drop policy if exists task_automation_state_update_staff on public.task_automation_state;
create policy task_automation_state_update_staff
  on public.task_automation_state for update to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_automation_state.task_id
        and public.current_profile_role_id() = 'project_manager'
        and public.user_has_project_access_by_id(t.project_id)
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_automation_state.task_id
        and public.current_profile_role_id() = 'project_manager'
        and public.user_has_project_access_by_id(t.project_id)
    )
  );

grant select, insert, update on public.task_automation_state to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.task_automation_state;
  end if;
exception
  when duplicate_object then null;
end $$;

comment on table public.task_automation_state is 'Otomasyonların satır rengi ve kilit durumu gibi tablo davranışlarını tuttuğu kalıcı durum tablosu.';
