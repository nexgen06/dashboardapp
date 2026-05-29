-- Bildirimler Faz 2 — atama ve gecikme tetikleyicileri
-- Önkoşul: scripts/notifications.sql
-- Çalıştır: Supabase Studio → SQL Editor → Run
-- Idempotent: güvenle tekrar çalıştırılabilir.
--
-- Ne yapar:
--   1) Projeye yeni e-posta eklendiğinde → project_assigned
--   2) Görev assignee değiştiğinde → task_assigned
--   3) refresh_overdue_task_notifications() → gecikmiş görevler (cron ile günlük)
--
-- Cron (Supabase Dashboard → Database → Extensions → pg_cron veya Scheduled):
--   select public.refresh_overdue_task_notifications();
-- Önerilen: her gün 06:00 Europe/Istanbul

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

create or replace function public.is_task_status_done(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_status, ''))) in (
    'tamamlandı', 'tamamlandi', 'yapıldı', 'yapildi', 'done', 'completed'
  );
$$;

create or replace function public.profile_id_for_assignee_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.profile_id_for_assignee_email(text) from public;
grant execute on function public.profile_id_for_assignee_email(text) to authenticated;

create or replace function public.enqueue_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_href text,
  p_source_table text,
  p_source_id text,
  p_source_key text,
  p_payload jsonb default '{}'::jsonb,
  p_reset_read boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_id is null then
    return;
  end if;

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
  values (
    p_recipient_id,
    p_type,
    p_title,
    nullif(trim(p_body), ''),
    coalesce(nullif(trim(p_href), ''), '/'),
    1,
    nullif(trim(p_source_table), ''),
    nullif(trim(p_source_id), ''),
    p_source_key,
    coalesce(p_payload, '{}'::jsonb),
    null,
    null
  )
  on conflict (recipient_id, source_key)
  do update set
    type = excluded.type,
    title = excluded.title,
    body = excluded.body,
    href = excluded.href,
    count = excluded.count,
    source_table = excluded.source_table,
    source_id = excluded.source_id,
    payload = excluded.payload,
    archived_at = null,
    updated_at = now(),
    read_at = case
      when p_reset_read then null
      else public.notifications.read_at
    end;
end;
$$;

revoke all on function public.enqueue_notification(uuid, text, text, text, text, text, text, text, jsonb, boolean) from public;

-- ---------------------------------------------------------------------------
-- Proje ataması (assigned_emails dizisine yeni e-posta)
-- ---------------------------------------------------------------------------

create or replace function public.notifications_after_project_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_profile_id uuid;
  v_project_name text;
begin
  if to_regclass('public.notifications') is null then
    return new;
  end if;

  v_project_name := coalesce(nullif(trim(new.name), ''), 'Proje');

  for v_email in
    select lower(trim(e))
    from unnest(coalesce(new.assigned_emails, '{}'::text[])) as e
    where trim(e) <> ''
      and position('@' in trim(e)) > 0
    except
    select lower(trim(e))
    from unnest(
      case
        when tg_op = 'UPDATE' then coalesce(old.assigned_emails, '{}'::text[])
        else '{}'::text[]
      end
    ) as e
    where trim(e) <> ''
  loop
    v_profile_id := public.profile_id_for_assignee_email(v_email);
    if v_profile_id is null then
      continue;
    end if;
    if v_profile_id is not distinct from auth.uid() then
      continue;
    end if;

    perform public.enqueue_notification(
      v_profile_id,
      'project_assigned',
      format('Size "%s" projesi atandı', v_project_name),
      null,
      '/projeler/' || new.id::text,
      'projects',
      new.id::text,
      'project_assigned:' || new.id::text,
      jsonb_build_object('project_id', new.id, 'project_name', v_project_name),
      true
    );
  end loop;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.projects') is not null then
    drop trigger if exists notifications_project_assignments_trg on public.projects;
    create trigger notifications_project_assignments_trg
      after insert or update of assigned_emails, name on public.projects
      for each row execute function public.notifications_after_project_assignments();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Görev ataması (assignee değişimi)
-- ---------------------------------------------------------------------------

create or replace function public.notifications_after_task_assignee_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignee text;
  v_old_assignee text;
  v_profile_id uuid;
  v_href text;
  v_body text;
begin
  if to_regclass('public.notifications') is null then
    return new;
  end if;

  -- Tamamlanan görevlerde gecikmiş bildirimini kapat
  if tg_op = 'UPDATE' and public.is_task_status_done(new.status)
     and not public.is_task_status_done(old.status) then
    update public.notifications
    set read_at = coalesce(read_at, now()), updated_at = now()
    where source_key = 'overdue:' || new.id::text
      and read_at is null;
  end if;

  v_assignee := lower(trim(coalesce(new.assignee, '')));
  if tg_op = 'UPDATE' then
    v_old_assignee := lower(trim(coalesce(old.assignee, '')));
    if v_assignee = v_old_assignee then
      return new;
    end if;
  end if;

  if v_assignee = '' or v_assignee = 'ben' or position('@' in v_assignee) = 0 then
    return new;
  end if;

  v_profile_id := public.profile_id_for_assignee_email(v_assignee);
  if v_profile_id is null or v_profile_id is not distinct from auth.uid() then
    return new;
  end if;

  v_body := coalesce(nullif(trim(new.content), ''), null);
  if new.project_id is not null then
    v_href := '/canli-tablo?project=' || new.project_id::text || '&task=' || new.id::text;
  else
    v_href := '/canli-tablo?task=' || new.id::text;
  end if;

  perform public.enqueue_notification(
    v_profile_id,
    'task_assigned',
    'Size yeni bir görev atandı',
    v_body,
    v_href,
    'tasks',
    new.id::text,
    'task_assigned:' || new.id::text,
    jsonb_build_object('project_id', new.project_id),
    true
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.tasks') is not null then
    drop trigger if exists notifications_task_assignee_trg on public.tasks;
    create trigger notifications_task_assignee_trg
      after insert or update of assignee, status on public.tasks
      for each row execute function public.notifications_after_task_assignee_change();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Gecikmiş görevler (cron / manuel çağrı)
-- ---------------------------------------------------------------------------

create or replace function public.refresh_overdue_task_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  r record;
  v_profile_id uuid;
  v_assignee text;
  v_href text;
  v_today date := (timezone('Europe/Istanbul', now()))::date;
begin
  if to_regclass('public.notifications') is null or to_regclass('public.tasks') is null then
    return 0;
  end if;

  for r in
    select
      t.id,
      t.project_id,
      t.content,
      t.assignee,
      t.due_date
    from public.tasks t
    where t.assignee is not null
      and trim(t.assignee) <> ''
      and lower(trim(t.assignee)) <> 'ben'
      and position('@' in trim(t.assignee)) > 0
      and t.due_date is not null
      and (t.due_date::date) < v_today
      and not public.is_task_status_done(t.status)
  loop
    v_assignee := lower(trim(r.assignee));
    v_profile_id := public.profile_id_for_assignee_email(v_assignee);
    if v_profile_id is null then
      continue;
    end if;

    if r.project_id is not null then
      v_href := '/canli-tablo?project=' || r.project_id::text || '&task=' || r.id::text;
    else
      v_href := '/canli-tablo?task=' || r.id::text;
    end if;

    perform public.enqueue_notification(
      v_profile_id,
      'overdue',
      'Gecikmiş göreviniz var',
      coalesce(nullif(trim(r.content), ''), null),
      v_href,
      'tasks',
      r.id::text,
      'overdue:' || r.id::text,
      jsonb_build_object(
        'project_id', r.project_id,
        'due_date', r.due_date
      ),
      false
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.refresh_overdue_task_notifications() from public;
grant execute on function public.refresh_overdue_task_notifications() to service_role;

comment on function public.refresh_overdue_task_notifications()
  is 'Gecikmiş görev bildirimlerini üretir. Supabase cron veya Edge Function ile günlük çalıştırın.';

-- ---------------------------------------------------------------------------
-- Sağlık kontrolü (Kurumsal Admin + istemci yedek algılama)
-- ---------------------------------------------------------------------------

create or replace function public.notification_phase2_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enqueue_notification',
      to_regprocedure(
        'public.enqueue_notification(uuid,text,text,text,text,text,text,text,jsonb,boolean)'
      ) is not null,
    'project_trigger',
      exists(
        select 1
        from pg_trigger
        where tgname = 'notifications_project_assignments_trg'
          and not tgisinternal
      ),
    'task_trigger',
      exists(
        select 1
        from pg_trigger
        where tgname = 'notifications_task_assignee_trg'
          and not tgisinternal
      ),
    'refresh_overdue_fn',
      to_regprocedure('public.refresh_overdue_task_notifications()') is not null
  );
$$;

revoke all on function public.notification_phase2_status() from public;
grant execute on function public.notification_phase2_status() to authenticated;

comment on function public.notification_phase2_status()
  is 'Bildirimler Faz 2 tetikleyicilerinin kurulu olup olmadığını döndürür.';
