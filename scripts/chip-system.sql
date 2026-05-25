-- Merkezi çip kütüphanesi ve satır çip değerleri.
-- Mevcut tasks/projects/project_columns yapısını bozmaz; çipler task satırlarına referansla bağlanır.

create table if not exists public.chip_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0 and char_length(name) <= 120),
  category text not null check (
    category in ('date','status','email','payment','approval','risk','document','privacy','system')
  ),
  description text,
  icon text,
  color text not null default 'slate',
  is_system boolean not null default false,
  manager_only boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, name)
);

create table if not exists public.chip_options (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.chip_templates(id) on delete cascade,
  label text not null check (char_length(trim(label)) > 0 and char_length(label) <= 120),
  value text not null check (char_length(trim(value)) > 0 and char_length(value) <= 120),
  color text not null default 'slate',
  icon text,
  sort_order integer not null default 0,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, value)
);

create table if not exists public.table_chip_bindings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  column_key text not null check (char_length(trim(column_key)) > 0),
  template_id uuid not null references public.chip_templates(id) on delete cascade,
  allow_multiple boolean not null default false,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, column_key, template_id)
);

create table if not exists public.row_chip_values (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  template_id uuid not null references public.chip_templates(id) on delete cascade,
  option_id uuid not null references public.chip_options(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','automation','system','import')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (task_id, template_id, option_id)
);

create index if not exists chip_templates_category_idx on public.chip_templates(category, name);
create index if not exists chip_options_template_idx on public.chip_options(template_id, sort_order, label);
create index if not exists table_chip_bindings_project_idx on public.table_chip_bindings(project_id, column_key);
create index if not exists row_chip_values_task_idx on public.row_chip_values(task_id, updated_at desc);
create index if not exists row_chip_values_template_idx on public.row_chip_values(template_id, option_id);

create or replace function public.touch_chip_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chip_templates_touch_trg on public.chip_templates;
create trigger chip_templates_touch_trg
  before update on public.chip_templates
  for each row execute function public.touch_chip_updated_at();

drop trigger if exists chip_options_touch_trg on public.chip_options;
create trigger chip_options_touch_trg
  before update on public.chip_options
  for each row execute function public.touch_chip_updated_at();

drop trigger if exists table_chip_bindings_touch_trg on public.table_chip_bindings;
create trigger table_chip_bindings_touch_trg
  before update on public.table_chip_bindings
  for each row execute function public.touch_chip_updated_at();

create or replace function public.touch_row_chip_values_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(new.updated_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists row_chip_values_touch_trg on public.row_chip_values;
create trigger row_chip_values_touch_trg
  before insert or update on public.row_chip_values
  for each row execute function public.touch_row_chip_values_updated_at();

alter table public.chip_templates enable row level security;
alter table public.chip_options enable row level security;
alter table public.table_chip_bindings enable row level security;
alter table public.row_chip_values enable row level security;

drop policy if exists chip_templates_select on public.chip_templates;
create policy chip_templates_select
  on public.chip_templates for select to authenticated using (true);

drop policy if exists chip_templates_write_staff on public.chip_templates;
create policy chip_templates_write_staff
  on public.chip_templates for all to authenticated
  using (public.current_profile_role_id() in ('admin','project_manager'))
  with check (public.current_profile_role_id() in ('admin','project_manager'));

drop policy if exists chip_options_select on public.chip_options;
create policy chip_options_select
  on public.chip_options for select to authenticated using (true);

drop policy if exists chip_options_write_staff on public.chip_options;
create policy chip_options_write_staff
  on public.chip_options for all to authenticated
  using (public.current_profile_role_id() in ('admin','project_manager'))
  with check (public.current_profile_role_id() in ('admin','project_manager'));

drop policy if exists table_chip_bindings_select on public.table_chip_bindings;
create policy table_chip_bindings_select
  on public.table_chip_bindings for select to authenticated
  using (public.user_has_project_access_by_id(project_id));

drop policy if exists table_chip_bindings_write_staff on public.table_chip_bindings;
create policy table_chip_bindings_write_staff
  on public.table_chip_bindings for all to authenticated
  using (
    public.is_app_admin()
    or (
      public.current_profile_role_id() = 'project_manager'
      and public.user_has_project_access_by_id(project_id)
    )
  )
  with check (
    public.is_app_admin()
    or (
      public.current_profile_role_id() = 'project_manager'
      and public.user_has_project_access_by_id(project_id)
    )
  );

drop policy if exists row_chip_values_select_visible on public.row_chip_values;
create policy row_chip_values_select_visible
  on public.row_chip_values for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = row_chip_values.task_id
        and public.task_is_visible_for_current_user(t.project_id, t.assignee)
    )
  );

drop policy if exists row_chip_values_insert_editable on public.row_chip_values;
create policy row_chip_values_insert_editable
  on public.row_chip_values for insert to authenticated
  with check (
    exists (
      select 1
      from public.tasks t
      join public.chip_templates ct on ct.id = row_chip_values.template_id
      where t.id = row_chip_values.task_id
        and public.task_is_editable_for_current_user(t.project_id, t.assignee)
        and (
          not ct.manager_only
          or public.current_profile_role_id() in ('admin','project_manager')
        )
    )
  );

drop policy if exists row_chip_values_update_editable on public.row_chip_values;
create policy row_chip_values_update_editable
  on public.row_chip_values for update to authenticated
  using (
    exists (
      select 1
      from public.tasks t
      join public.chip_templates ct on ct.id = row_chip_values.template_id
      where t.id = row_chip_values.task_id
        and public.task_is_editable_for_current_user(t.project_id, t.assignee)
        and (
          not ct.manager_only
          or public.current_profile_role_id() in ('admin','project_manager')
        )
    )
  )
  with check (
    exists (
      select 1
      from public.tasks t
      join public.chip_templates ct on ct.id = row_chip_values.template_id
      where t.id = row_chip_values.task_id
        and public.task_is_editable_for_current_user(t.project_id, t.assignee)
        and (
          not ct.manager_only
          or public.current_profile_role_id() in ('admin','project_manager')
        )
    )
  );

drop policy if exists row_chip_values_delete_editable on public.row_chip_values;
create policy row_chip_values_delete_editable
  on public.row_chip_values for delete to authenticated
  using (
    exists (
      select 1
      from public.tasks t
      join public.chip_templates ct on ct.id = row_chip_values.template_id
      where t.id = row_chip_values.task_id
        and public.task_is_editable_for_current_user(t.project_id, t.assignee)
        and (
          not ct.manager_only
          or public.current_profile_role_id() in ('admin','project_manager')
        )
    )
  );

grant select, insert, update, delete on public.chip_templates to authenticated;
grant select, insert, update, delete on public.chip_options to authenticated;
grant select, insert, update, delete on public.table_chip_bindings to authenticated;
grant select, insert, update, delete on public.row_chip_values to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chip_templates;
    alter publication supabase_realtime add table public.chip_options;
    alter publication supabase_realtime add table public.table_chip_bindings;
    alter publication supabase_realtime add table public.row_chip_values;
  end if;
exception
  when duplicate_object then null;
end $$;

insert into public.chip_templates (name, category, description, icon, color, is_system, manager_only)
values
  ('Risk', 'risk', 'Operasyon risk seviyesi', 'alert-triangle', 'red', true, false),
  ('Ödeme Durumu', 'payment', 'Ödeme takip durumu', 'credit-card', 'amber', true, false),
  ('Sistem', 'system', 'Otomasyon tarafından üretilen sistem çipleri', 'sparkles', 'blue', true, true),
  ('Evrak', 'document', 'Evrak akış durumu', 'file-text', 'slate', true, false),
  ('Gizlilik', 'privacy', 'Veri gizlilik sınıfı', 'shield', 'violet', true, true)
on conflict (category, name) do update set
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  is_system = excluded.is_system,
  manager_only = excluded.manager_only;

insert into public.chip_options (template_id, label, value, color, icon, sort_order, is_terminal)
select t.id, v.label, v.value, v.color, v.icon, v.sort_order, v.is_terminal
from public.chip_templates t
join (
  values
    ('risk','Risk','Düşük Risk','low','emerald','circle',10,false),
    ('risk','Risk','Orta Risk','medium','amber','alert-circle',20,false),
    ('risk','Risk','Kritik Risk','critical','red','alert-triangle',30,true),
    ('payment','Ödeme Durumu','Ödendi','paid','emerald','check-circle',10,true),
    ('payment','Ödeme Durumu','Ödenmedi','unpaid','slate','circle',20,false),
    ('payment','Ödeme Durumu','Gecikti','overdue','red','clock',30,false),
    ('payment','Ödeme Durumu','Kısmi Ödeme','partial','amber','circle-dot',40,false),
    ('payment','Ödeme Durumu','İptal','cancelled','slate','x-circle',50,true),
    ('system','Sistem','Bugün Son','due_today','blue','calendar',10,false),
    ('system','Sistem','Hareketsiz','stale','amber','pause-circle',20,false),
    ('system','Sistem','SLA Aşıldı','sla_breached','red','timer-off',30,false),
    ('document','Evrak','Eksik Evrak','missing','red','file-x',10,false),
    ('document','Evrak','İşlemde','processing','blue','loader',20,false),
    ('document','Evrak','Arşivlendi','archived','slate','archive',30,true),
    ('privacy','Gizlilik','Genel','public','emerald','unlock',10,false),
    ('privacy','Gizlilik','Hizmete Özel','internal','amber','lock-keyhole',20,false),
    ('privacy','Gizlilik','Gizli','confidential','red','shield-alert',30,true)
) as v(category, template_name, label, value, color, icon, sort_order, is_terminal)
  on t.category = v.category and t.name = v.template_name
on conflict (template_id, value) do update set
  label = excluded.label,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_terminal = excluded.is_terminal;

comment on table public.chip_templates is 'Merkezi çip şablonları: kategori, renk, ikon, yönetici kısıtı.';
comment on table public.row_chip_values is 'Görev satırına atanmış çip seçenekleri. source=automation/manual/import/system.';
