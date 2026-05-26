-- Görev workflow incelemesi için ek RLS politikası.
-- Amaç: Proje rolü 'project_owner' veya 'project_manager' olan kullanıcılar,
-- proje yöneticisi global rolüne sahip olmasalar bile, kendi projelerindeki
-- görevlerin workflow durumunu (onayla / revize iste / reddet) güncelleyebilsin.
--
-- Mevcut tasks_update_staff politikası korunur; bu politika OR'lanır, yani
-- ek izin verir, mevcut kısıtlamaları daraltmaz.
--
-- Idempotent: güvenle tekrar çalıştırılabilir.

create or replace function public.user_is_project_workflow_reviewer(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select true
      from public.project_member_permissions pmp
      where pmp.project_id = p_project_id
        and pmp.user_id = auth.uid()
        and pmp.project_role in ('project_owner', 'project_manager')
      limit 1
    ),
    false
  );
$$;

revoke all on function public.user_is_project_workflow_reviewer(uuid) from public;
grant execute on function public.user_is_project_workflow_reviewer(uuid) to authenticated;

comment on function public.user_is_project_workflow_reviewer(uuid)
  is 'Çağıran kullanıcının verilen projede project_owner veya project_manager rolüne sahip olup olmadığını döner.';

drop policy if exists tasks_update_workflow_reviewer on public.tasks;
create policy tasks_update_workflow_reviewer on public.tasks
  for update
  to authenticated
  using (
    project_id is not null
    and public.user_is_project_workflow_reviewer(project_id)
  )
  with check (
    project_id is not null
    and public.user_is_project_workflow_reviewer(project_id)
    and public.current_profile_role_id() in ('admin', 'project_manager', 'member')
  );

comment on policy tasks_update_workflow_reviewer on public.tasks
  is 'Proje rolü project_owner/project_manager olan kullanıcıların kendi projelerindeki görevleri güncellemesine izin verir. Workflow inceleme aksiyonları için gereklidir.';
