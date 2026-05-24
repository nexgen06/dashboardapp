-- Merkezi bildirim kutusu.
-- Amaç: zil ve /bildirimler sayfası için kalıcı, denetlenebilir tek tablo.
-- Idempotent: güvenle tekrar çalıştırılabilir.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in (
      'project_assigned',
      'task_assigned',
      'overdue',
      'admin_team_done',
      'chat_unread',
      'announcement'
    )
  ),
  title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 240),
  body text,
  href text not null default '/',
  count integer not null default 1 check (count > 0),
  source_table text,
  source_id text,
  source_key text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notifications_recipient_source_key_idx
  on public.notifications (recipient_id, source_key);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, read_at, created_at desc)
  where archived_at is null;

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc)
  where archived_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_insert_own on public.notifications;
create policy notifications_insert_own
  on public.notifications
  for insert
  to authenticated
  with check (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists notifications_delete_denied on public.notifications;
create policy notifications_delete_denied
  on public.notifications
  for delete
  to authenticated
  using (false);

create or replace function public.notifications_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notifications_touch_trg on public.notifications;
create trigger notifications_touch_trg
  before update on public.notifications
  for each row execute function public.notifications_touch_updated_at();

create or replace function public.upsert_my_notifications(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_type text;
  v_title text;
  v_source_key text;
  v_count integer;
  v_reset_read boolean;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    v_type := nullif(trim(item->>'type'), '');
    v_title := nullif(trim(item->>'title'), '');
    v_source_key := nullif(trim(item->>'source_key'), '');
    v_count := greatest(1, coalesce(nullif(item->>'count', '')::integer, 1));
    v_reset_read := coalesce((item->>'reset_read')::boolean, false);

    if v_type is null or v_title is null or v_source_key is null then
      continue;
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
      auth.uid(),
      v_type,
      v_title,
      nullif(item->>'body', ''),
      coalesce(nullif(item->>'href', ''), '/'),
      v_count,
      nullif(item->>'source_table', ''),
      nullif(item->>'source_id', ''),
      v_source_key,
      coalesce(item->'payload', '{}'::jsonb),
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
      read_at = case
        when v_reset_read then null
        else public.notifications.read_at
      end;
  end loop;
end;
$$;

revoke all on function public.upsert_my_notifications(jsonb) from public;
grant execute on function public.upsert_my_notifications(jsonb) to authenticated;

create or replace function public.notifications_after_announcement_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    p.id,
    'announcement',
    new.title,
    new.body,
    '/bildirimler',
    1,
    'announcements',
    new.id::text,
    'announcement:' || new.id::text,
    jsonb_build_object(
      'author_email', new.author_email,
      'pinned', new.pinned,
      'expires_at', new.expires_at
    )
  from public.profiles p
  where p.id is not null
  on conflict (recipient_id, source_key) do nothing;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.announcements') is not null then
    drop trigger if exists notifications_announcement_insert_trg on public.announcements;
    create trigger notifications_announcement_insert_trg
      after insert on public.announcements
      for each row execute function public.notifications_after_announcement_insert();
  end if;
end $$;

create or replace function public.notifications_after_admin_alert_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    p.id,
    'admin_team_done',
    new.summary,
    null,
    '/canli-tablo',
    1,
    'admin_alerts',
    new.id::text,
    'admin_alert:' || new.id::text,
    jsonb_build_object(
      'kind', new.kind,
      'actor_email', new.actor_email,
      'actor_display', new.actor_display
    )
  from public.profiles p
  where p.role_id = 'admin'
  on conflict (recipient_id, source_key) do nothing;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.admin_alerts') is not null then
    drop trigger if exists notifications_admin_alert_insert_trg on public.admin_alerts;
    create trigger notifications_admin_alert_insert_trg
      after insert on public.admin_alerts
      for each row execute function public.notifications_after_admin_alert_insert();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

grant select, insert, update on table public.notifications to authenticated;

comment on table public.notifications is 'Merkezi kullanıcı bildirim kutusu. Zil, /bildirimler ve denetim için kalıcı kayıt sağlar.';
