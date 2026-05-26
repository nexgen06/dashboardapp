-- Görev onay (workflow) akışı için merkezi bildirim üretimi.
-- Amaç:
--   * Üye "Kontrole gönder" yaptığında proje yöneticisi/sahibi + global admin/PM'lere bildirim.
--   * Yönetici Onayla / Revize iste / Reddet aksiyonunu uyguladığında ilgili üyeye bildirim.
-- Idempotent: güvenle tekrar çalıştırılabilir.

-- 1) notifications.type CHECK constraint'ini 'workflow' tipini içerecek şekilde genişlet.
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
      'automation',
      'workflow'
    )
  );

-- 2) RPC: workflow aksiyonu için bildirim üretir.
--    Aksiyon = 'submit'              -> proje sahibi/yöneticileri + global admin/PM
--    Aksiyon = 'approve'/'request_revision'/'reject' -> task'ın son submit eden üyesi
--    (yoksa task.assignee fallback). Notu varsa body içine ekler.

create or replace function public.create_workflow_notification(
  p_task_id uuid,
  p_action text,
  p_to_status text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  task_project_id uuid;
  task_assignee text;
  task_content text;
  task_extra jsonb;
  proj_name text;
  proj_title_column text;
  proj_subtitle_columns text[];
  actor_email text;
  actor_display text;
  submitter_email text;
  notif_title text;
  notif_body text;
  notif_summary text;
  notif_source_key text;
  inserted_count integer := 0;
  k text;
  v text;
  parts text[];
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  if p_action not in ('submit', 'approve', 'request_revision', 'reject', 'unlock', 'unlock_request') then
    return 0;
  end if;

  select t.project_id, t.assignee, coalesce(t.content, ''), coalesce(t.extra_data, '{}'::jsonb)
    into task_project_id, task_assignee, task_content, task_extra
  from public.tasks t
  where t.id = p_task_id;

  if task_project_id is null then
    return 0;
  end if;

  -- Proje bilgisi: ad + başlık/altbaşlık kolonları (extra_data'dan zengin metin için)
  select
      coalesce(nullif(trim(pr.name), ''), 'Proje'),
      nullif(trim(pr.title_column), ''),
      pr.subtitle_columns
    into proj_name, proj_title_column, proj_subtitle_columns
  from public.projects pr
  where pr.id = task_project_id;

  -- Görev özeti metni:
  --   1) content varsa onu kullan
  --   2) yoksa title_column varsa extra_data[title_column]
  --   3) yoksa 'Görev'
  if task_content is not null and length(trim(task_content)) > 0 then
    notif_summary := trim(task_content);
  elsif proj_title_column is not null and (task_extra ? proj_title_column) then
    notif_summary := coalesce(nullif(trim(task_extra->>proj_title_column), ''), 'Görev');
  else
    notif_summary := 'Görev';
  end if;

  -- Alt başlık: project.subtitle_columns dolu alanlardan "Anahtar: Değer · ..." formatı
  parts := array[]::text[];
  if proj_subtitle_columns is not null then
    foreach k in array proj_subtitle_columns
    loop
      if k is null or trim(k) = '' then continue; end if;
      if proj_title_column is not null and lower(trim(k)) = lower(proj_title_column) then continue; end if;
      v := nullif(trim(coalesce(task_extra->>k, '')), '');
      if v is not null then
        parts := parts || (k || ': ' || v);
      end if;
    end loop;
  end if;

  -- Yetki: çağıran kullanıcı bu projeye erişimi olmalı (admin değilse).
  if not (
    public.is_app_admin()
    or public.user_has_project_access_by_id(task_project_id)
  ) then
    raise exception 'not allowed';
  end if;

  -- Aktör (aksiyonu yapan) e-postası.
  select lower(trim(coalesce(u.email, '')))
    into actor_email
  from auth.users u
  where u.id = auth.uid();

  actor_display := coalesce(nullif(actor_email, ''), 'Bir kullanıcı');

  -- Başlık aksiyona göre — kim ne yaptı.
  if p_action = 'submit' then
    notif_title := format('%s onayınıza gönderdi', actor_display);
  elsif p_action = 'approve' then
    notif_title := format('%s satırı onayladı', actor_display);
  elsif p_action = 'request_revision' then
    notif_title := format('%s revize istedi', actor_display);
  elsif p_action = 'reject' then
    notif_title := format('%s satırı reddetti', actor_display);
  elsif p_action = 'unlock' then
    notif_title := format('%s kilidi açtı', actor_display);
  elsif p_action = 'unlock_request' then
    notif_title := format('%s kilidi açmayı talep etti', actor_display);
  end if;

  -- Gövde:
  --   [Proje · Görev özeti]
  --   [Alt başlık kolonları] (varsa)
  --   [Not: ...] (revize/ret için kullanıcı notu)
  notif_body := format('%s · %s', proj_name, notif_summary);
  if array_length(parts, 1) is not null and array_length(parts, 1) > 0 then
    notif_body := notif_body || E'\n' || array_to_string(parts, ' · ');
  end if;
  if nullif(trim(coalesce(p_note, '')), '') is not null then
    notif_body := notif_body || E'\nNot: ' || trim(p_note);
  end if;

  -- Her aksiyon için benzersiz source_key (alıcı bazında upsert):
  --   workflow:{action}:{task_id}:{epoch_ms}
  -- Aynı aksiyon tekrar tetiklenirse yeni bir bildirim olarak görünmeli, bu yüzden
  -- timestamp ekliyoruz. Aksi halde upsert eski kaydı günceller ve kullanıcı haberi atlar.
  notif_source_key := concat(
    'workflow:',
    p_action,
    ':',
    p_task_id::text,
    ':',
    (extract(epoch from now()) * 1000)::bigint::text
  );

  if p_action = 'submit' or p_action = 'unlock_request' then
    -- Alıcılar: global admin/PM + projenin owner/manager üyeleri
    with recipients as (
      select p.id
      from public.profiles p
      where p.role_id in ('admin', 'project_manager')

      union

      select pmp.user_id
      from public.project_member_permissions pmp
      where pmp.project_id = task_project_id
        and pmp.project_role in ('project_owner', 'project_manager')
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
        payload
      )
      select
        r.id,
        'workflow',
        notif_title,
        notif_body,
        '/canli-tablo',
        1,
        'tasks',
        p_task_id::text,
        notif_source_key,
        jsonb_build_object(
          'task_id', p_task_id,
          'project_id', task_project_id,
          'action', p_action,
          'to_status', p_to_status,
          'actor_email', actor_email,
          'note', p_note
        )
      from recipients r
      where r.id is not null
        and r.id <> auth.uid()
      on conflict (recipient_id, source_key) do nothing
      returning 1
    )
    select count(*) into inserted_count from upserted;

  else
    -- approve / request_revision / reject:
    -- Alıcı = task'ın son 'submit' eventini gerçekleştiren kullanıcı; yoksa task.assignee.
    select lower(trim(coalesce(e.actor_email, '')))
      into submitter_email
    from public.task_workflow_events e
    where e.task_id = p_task_id
      and e.action = 'submit'
    order by e.created_at desc
    limit 1;

    if submitter_email is null or submitter_email = '' then
      submitter_email := lower(trim(coalesce(task_assignee, '')));
    end if;

    if submitter_email is null or submitter_email = '' then
      return 0;
    end if;

    with recipients as (
      select p.id
      from public.profiles p
      where lower(trim(p.email)) = submitter_email
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
        payload
      )
      select
        r.id,
        'workflow',
        notif_title,
        notif_body,
        '/canli-tablo',
        1,
        'tasks',
        p_task_id::text,
        notif_source_key,
        jsonb_build_object(
          'task_id', p_task_id,
          'project_id', task_project_id,
          'action', p_action,
          'to_status', p_to_status,
          'actor_email', actor_email,
          'note', p_note
        )
      from recipients r
      where r.id is not null
        and r.id <> auth.uid()
      on conflict (recipient_id, source_key) do nothing
      returning 1
    )
    select count(*) into inserted_count from upserted;
  end if;

  return inserted_count;
end;
$$;

revoke all on function public.create_workflow_notification(uuid, text, text, text) from public;
grant execute on function public.create_workflow_notification(uuid, text, text, text) to authenticated;

comment on function public.create_workflow_notification(uuid, text, text, text)
  is 'Görev onay (workflow) aksiyonu için ilgili PM/üye bildirimlerini güvenli şekilde üretir.';
