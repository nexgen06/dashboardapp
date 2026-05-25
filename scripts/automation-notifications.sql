-- Otomasyon bildirimleri.
-- Amaç: notify aksiyonunun yöneticilere merkezi notifications kaydı oluşturması.

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'notifications'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%project_assigned%'
    and pg_get_constraintdef(con.oid) ilike '%announcement%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.notifications drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'project_assigned',
      'task_assigned',
      'overdue',
      'admin_team_done',
      'chat_unread',
      'announcement',
      'automation'
    )
  );

create or replace function public.create_automation_notification(
  p_task_id uuid,
  p_rule_id uuid,
  p_title text,
  p_body text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  task_project_id uuid;
  task_assignee text;
  task_label text;
  inserted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select t.project_id, t.assignee, coalesce(nullif(trim(t.content), ''), 'Görev')
    into task_project_id, task_assignee, task_label
  from public.tasks t
  where t.id = p_task_id;

  if p_task_id is null or task_project_id is null then
    return 0;
  end if;

  if not (
    public.is_app_admin()
    or (
      public.current_profile_role_id() = 'project_manager'
      and public.user_has_project_access_by_id(task_project_id)
    )
  ) then
    raise exception 'not allowed';
  end if;

  with recipients as (
    select p.id
    from public.profiles p
    where p.role_id = 'admin'

    union

    select pmp.user_id
    from public.project_member_permissions pmp
    where pmp.project_id = task_project_id
      and (
        pmp.project_role in ('project_owner', 'project_manager')
        or pmp.can_edit = true
      )

    union

    select p.id
    from public.profiles p
    where task_assignee is not null
      and lower(trim(p.email)) = lower(trim(task_assignee))
  ),
  upserted as (
    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      href,
      count,
      source_table,
      source_id,
      source_key,
      payload,
      read_at,
      archived_at
    )
    select
      r.id,
      'automation',
      coalesce(nullif(trim(p_title), ''), 'Otomasyon bildirimi'),
      nullif(trim(coalesce(p_body, task_label)), ''),
      '/canli-tablo',
      1,
      'tasks',
      p_task_id::text,
      concat('automation:', coalesce(p_rule_id::text, 'manual'), ':', p_task_id::text),
      jsonb_build_object(
        'task_id', p_task_id,
        'rule_id', p_rule_id,
        'project_id', task_project_id
      ),
      null,
      null
    from recipients r
    where r.id is not null
    on conflict (recipient_id, source_key)
    do update set
      title = excluded.title,
      body = excluded.body,
      href = excluded.href,
      count = excluded.count,
      payload = excluded.payload,
      read_at = null,
      archived_at = null
    returning 1
  )
  select count(*) into inserted_count from upserted;

  return inserted_count;
end;
$$;

revoke all on function public.create_automation_notification(uuid, uuid, text, text) from public;
grant execute on function public.create_automation_notification(uuid, uuid, text, text) to authenticated;

comment on function public.create_automation_notification(uuid, uuid, text, text)
  is 'Otomasyon notify aksiyonu için admin/proje yöneticisi/atanan kullanıcı bildirimlerini güvenli şekilde üretir.';
