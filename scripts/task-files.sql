-- Görev/satır dosya ekleri. Storage bucket: task-files.

create table if not exists public.task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists task_files_task_idx on public.task_files(task_id, created_at desc);
create index if not exists task_files_project_idx on public.task_files(project_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

alter table public.task_files enable row level security;

drop policy if exists task_files_select_visible on public.task_files;
create policy task_files_select_visible
  on public.task_files for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id
        and public.task_is_visible_for_current_user(t.project_id, t.assignee)
    )
  );

drop policy if exists task_files_insert_editable on public.task_files;
create policy task_files_insert_editable
  on public.task_files for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id
        and public.task_is_editable_for_current_user(t.project_id, t.assignee)
    )
  );

drop policy if exists task_files_delete_editable on public.task_files;
create policy task_files_delete_editable
  on public.task_files for delete to authenticated
  using (
    public.is_app_admin()
    or (
      uploaded_by = auth.uid()
      and exists (
        select 1 from public.tasks t
        where t.id = task_files.task_id
          and public.task_is_editable_for_current_user(t.project_id, t.assignee)
      )
    )
  );

grant select, insert, delete on public.task_files to authenticated;

-- Storage RLS: yol formatı task-id/random-filename.ext.
drop policy if exists task_files_storage_select_visible on storage.objects;
create policy task_files_storage_select_visible
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-files'
    and exists (
      select 1
      from public.task_files tf
      join public.tasks t on t.id = tf.task_id
      where tf.file_path = storage.objects.name
        and public.task_is_visible_for_current_user(t.project_id, t.assignee)
    )
  );

drop policy if exists task_files_storage_insert_authenticated on storage.objects;
create policy task_files_storage_insert_authenticated
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files');

drop policy if exists task_files_storage_delete_owner_or_admin on storage.objects;
create policy task_files_storage_delete_owner_or_admin
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-files'
    and (
      public.is_app_admin()
      or exists (
        select 1 from public.task_files tf
        where tf.file_path = storage.objects.name
          and tf.uploaded_by = auth.uid()
      )
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.task_files;
  end if;
exception
  when duplicate_object then null;
end $$;

comment on table public.task_files is 'Görev sağ panelinde görüntülenen dosya ekleri.';
