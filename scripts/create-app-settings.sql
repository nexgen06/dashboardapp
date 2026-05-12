-- Dashboard: uygulama geneli ayarlar (ör. canlı tablo yoğunluğu — tüm üyeler ortak).
-- Supabase SQL Editor'da çalıştırın. RLS için `scripts/supabase-rls-policies.sql` içindeki
-- yardımcı fonksiyonlara ihtiyaç yoktur; yalnızca authenticated kullanılır.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('live_table_density', 'normal')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_authenticated on public.app_settings;
drop policy if exists app_settings_insert_authenticated on public.app_settings;
drop policy if exists app_settings_update_authenticated on public.app_settings;

create policy app_settings_select_authenticated on public.app_settings
  for select
  to authenticated
  using (true);

create policy app_settings_insert_authenticated on public.app_settings
  for insert
  to authenticated
  with check (true);

create policy app_settings_update_authenticated on public.app_settings
  for update
  to authenticated
  using (true)
  with check (true);

-- Realtime: yoğunluk değişince diğer sekmeler / kullanıcılar anında güncellenir.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
