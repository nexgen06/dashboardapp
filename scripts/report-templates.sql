-- Rapor şablonları: PDF/e-posta export ayarlarını kurumsal veya kişisel olarak saklar.
-- Çalışır: Supabase Studio > SQL Editor > yapıştır > Run
-- Idempotent: tekrar çalıştırılabilir.

create table if not exists public.report_templates (
  id              uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  scope           text        not null default 'private' check (scope in ('private','shared')),
  name            text        not null check (length(trim(name)) > 0),
  description     text,
  template_config jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists report_templates_user_idx on public.report_templates (user_id);
create index if not exists report_templates_scope_idx on public.report_templates (scope);
create index if not exists report_templates_updated_idx on public.report_templates (updated_at desc);

create or replace function public.report_templates_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists report_templates_touch_trg on public.report_templates;
create trigger report_templates_touch_trg
  before update on public.report_templates
  for each row execute function public.report_templates_touch_updated_at();

alter table public.report_templates enable row level security;

drop policy if exists report_templates_select on public.report_templates;
drop policy if exists report_templates_insert on public.report_templates;
drop policy if exists report_templates_update on public.report_templates;
drop policy if exists report_templates_delete on public.report_templates;

create policy report_templates_select
  on public.report_templates
  for select
  to authenticated
  using (user_id = auth.uid() or scope = 'shared');

create policy report_templates_insert
  on public.report_templates
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      scope = 'private'
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role_id in ('admin','project_manager')
      )
    )
  );

create policy report_templates_update
  on public.report_templates
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role_id in ('admin','project_manager')
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role_id in ('admin','project_manager')
    )
  );

create policy report_templates_delete
  on public.report_templates
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role_id in ('admin','project_manager')
    )
  );

comment on table public.report_templates is
  'PDF/e-posta export rapor şablonları: başlık, konu, kapsam, kolonlar, e-posta modu ve hassas veri tercihi.';
