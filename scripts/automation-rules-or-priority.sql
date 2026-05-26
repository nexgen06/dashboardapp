-- Otomasyon kuralları — OR mantığı + öncelik desteği.
-- Yeni alanlar:
--   condition_logic ('and' | 'or') — koşulları nasıl birleştirelim. Default 'and'.
--   priority (integer) — küçük değer önce çalışır. Default 0.
--   trigger_type artık 'status_changed' değerini de kabul eder.
-- Idempotent: güvenle tekrar çalıştırılabilir.

-- 1) condition_logic
alter table public.automation_rules
  add column if not exists condition_logic text not null default 'and';

do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'automation_rules'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%condition_logic%';

  if con_name is null then
    alter table public.automation_rules
      add constraint automation_rules_condition_logic_check
      check (condition_logic in ('and', 'or'));
  end if;
end $$;

comment on column public.automation_rules.condition_logic is
  'Koşulları birleştirme mantığı: ''and'' = hepsi geçerli olmalı, ''or'' = herhangi biri yeterli.';

-- 2) priority
alter table public.automation_rules
  add column if not exists priority integer not null default 0;

comment on column public.automation_rules.priority is
  'Kural sıralama önceliği — küçük değerler önce uygulanır. UI manuel sıralama için kullanılır.';

-- 3) trigger_type CHECK constraint genişlet — 'status_changed' eklensin
do $$
declare
  con_name text;
  con_def text;
begin
  select con.conname, pg_get_constraintdef(con.oid)
    into con_name, con_def
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'automation_rules'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%trigger_type%';

  if con_name is not null and (con_def is null or con_def not ilike '%status_changed%') then
    execute format('alter table public.automation_rules drop constraint %I', con_name);
  end if;

  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'automation_rules'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status_changed%'
  ) then
    alter table public.automation_rules
      add constraint automation_rules_trigger_type_check
      check (trigger_type in ('row_saved', 'scheduled', 'manual', 'status_changed'));
  end if;
end $$;

-- 4) Mevcut kurallar için varsayılan değerler garantili (NOT NULL default sayesinde)
update public.automation_rules
set condition_logic = 'and'
where condition_logic is null;

update public.automation_rules
set priority = 0
where priority is null;

-- 5) Yardımcı index (priority sorgulamak hızlansın)
create index if not exists automation_rules_priority_idx
  on public.automation_rules (priority asc, updated_at desc);
