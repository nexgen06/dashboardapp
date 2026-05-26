-- Onaylanan görev satırlarının kilitlenmesi (proje bazında opt-in).
-- Akış:
--   workflow_enabled açık + lock_on_approval açık projede,
--   workflow_status = 'approved' olan satır:
--     * Admin / global project_manager / proje rolü project_owner|project_manager
--       tarafından güncellenebilir (kilidi açma yetkisi).
--     * Diğer kullanıcılar (üye, atanan dahil) güncelleyemez ve silemez.
--
-- Idempotent: güvenle tekrar çalıştırılabilir.

-- 0) task_workflow_events.action CHECK constraint'ini 'unlock' aksiyonunu kabul edecek
--    şekilde genişlet.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'task_workflow_events'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%action%'
    and pg_get_constraintdef(con.oid) ilike '%submit%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.task_workflow_events drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.task_workflow_events
  add constraint task_workflow_events_action_check
  check (action in ('submit', 'approve', 'request_revision', 'reject', 'reset', 'unlock', 'unlock_request'));

-- 1) projects tablosuna lock_on_approval kolonu
alter table public.projects
  add column if not exists lock_on_approval boolean not null default false;

comment on column public.projects.lock_on_approval is
  'Açıksa workflow onayı verilmiş (approved) görev satırları yalnızca admin/PM/proje yetkilisi tarafından güncellenebilir; diğer kullanıcılar için kilitlidir.';

-- 2) Yardımcı: projenin kilit ayarını döner.
create or replace function public.project_lock_on_approval(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select lock_on_approval from public.projects where id = p_project_id limit 1),
    false
  );
$$;

revoke all on function public.project_lock_on_approval(uuid) from public;
grant execute on function public.project_lock_on_approval(uuid) to authenticated;

-- 3) Yardımcı: Görev, mevcut kullanıcı için kilitli mi?
--    Kilitli = onaylanmış + proje kilit açık + kullanıcı yetkili değil.
create or replace function public.task_is_locked_for_current_user(
  p_project_id uuid,
  p_workflow_status text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_workflow_status is null or p_workflow_status <> 'approved' then
    return false;
  end if;
  if p_project_id is null then
    return false;
  end if;
  if not public.project_lock_on_approval(p_project_id) then
    return false;
  end if;
  if public.is_app_admin() then
    return false;
  end if;
  if public.current_profile_role_id() = 'project_manager' then
    return false;
  end if;
  if public.user_is_project_workflow_reviewer(p_project_id) then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.task_is_locked_for_current_user(uuid, text) from public;
grant execute on function public.task_is_locked_for_current_user(uuid, text) to authenticated;

comment on function public.task_is_locked_for_current_user(uuid, text) is
  'Görev satırı çağıran kullanıcı için kilitli mi? Onaylı + proje kilit açık + kullanıcı yetkili değilse true.';

-- 4) RESTRICTIVE policy'ler — diğer (permissive) policy'lerin sonucuna AND'lenir.
--    Yani: bir satır birinin update etmesine izin verilse bile, restrictive AND
--    edilince kilitli satır için engellenir.
drop policy if exists tasks_no_update_when_locked on public.tasks;
create policy tasks_no_update_when_locked on public.tasks
  as restrictive
  for update
  to authenticated
  using (
    not public.task_is_locked_for_current_user(project_id, workflow_status)
  )
  with check (
    not public.task_is_locked_for_current_user(project_id, workflow_status)
  );

comment on policy tasks_no_update_when_locked on public.tasks is
  'Onaylı + kilitli görev satırlarının yetkisiz kullanıcılarca güncellenmesini engeller.';

drop policy if exists tasks_no_delete_when_locked on public.tasks;
create policy tasks_no_delete_when_locked on public.tasks
  as restrictive
  for delete
  to authenticated
  using (
    not public.task_is_locked_for_current_user(project_id, workflow_status)
  );

comment on policy tasks_no_delete_when_locked on public.tasks is
  'Onaylı + kilitli görev satırlarının yetkisiz kullanıcılarca silinmesini engeller.';
