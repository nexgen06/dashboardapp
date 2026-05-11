-- Dashboard: Row Level Security (RLS) — projects, tasks, profiles, proje sohbeti
-- Supabase SQL Editor'da, auth.profiles kurulduktan sonra çalıştırın (scripts/supabase-auth-profiles.sql).
-- Giriş yapmış istemci anon key ile çalışır; bu politikalar veri erişimini auth.uid() / profiles / assigned_emails ile sınırlar.
--
-- Özet:
--   - profiles: herkes sadece kendi satırını okur; admin tüm profilleri listeler (kullanıcı yetkileri sayfası).
--   - projects: admin tüm projeler; diğerleri yalnızca assigned_emails dolu ve kendi e-postası listedeyse.
--   - tasks: admin veya projesiz satırlar veya erişilebilir projeye bağlı satırlar; yazma rollerle uyumlu.
--   - project_chat_*: açık "allow_all" politikaları kaldırılır; yalnızca proje erişimi olan kullanıcı.
--
-- Not: Proje oluşturan proje yöneticisi, kendi e-postasını assigned_emails'e eklemelidir; aksi halde
--       (assigned boş) projeyi yalnızca admin görür — bu, uygulama UI ile aynıdır.

-- ---------------------------------------------------------------------------
-- Yardımcılar (authenticated)
-- ---------------------------------------------------------------------------

create or replace function public.auth_email_lower ()
  returns text
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select
    nullif(
      lower(
        trim(
          coalesce(
            (select p.email from public.profiles p where p.id = auth.uid() limit 1),
            nullif(trim(auth.jwt() ->> 'email'), '')
          )
        )
      ),
      ''
    );
$$;

create or replace function public.is_app_admin ()
  returns boolean
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where
      p.id = auth.uid()
      and p.role_id = 'admin'
  );
$$;

create or replace function public.current_profile_role_id ()
  returns text
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select coalesce(
    (
      select p.role_id
      from public.profiles p
      where
        p.id = auth.uid()
      limit 1
    ),
    'member'
  );
$$;

create or replace function public.user_has_project_access_by_id (project_uuid uuid)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select
    public.is_app_admin ()
    or (
      project_uuid is not null
      and exists (
        select 1
        from public.projects p
        where
          p.id = project_uuid
          and coalesce(cardinality(p.assigned_emails), 0) > 0
          and public.auth_email_lower () is not null
          and exists (
            select 1
            from
              unnest(coalesce(p.assigned_emails, '{}'::text[])) as t (raw)
            where
              lower(trim(t.raw)) = public.auth_email_lower ()
          )
      )
    );
$$;

revoke all on function public.auth_email_lower () from public;
revoke all on function public.is_app_admin () from public;
revoke all on function public.current_profile_role_id () from public;
revoke all on function public.user_has_project_access_by_id (uuid) from public;

grant execute on function public.auth_email_lower () to authenticated;
grant execute on function public.is_app_admin () to authenticated;
grant execute on function public.current_profile_role_id () to authenticated;
grant execute on function public.user_has_project_access_by_id (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: SELECT sıkılaştırma
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_authenticated on public.profiles;

drop policy if exists profiles_select_own on public.profiles;

drop policy if exists profiles_select_admin_all on public.profiles;

create policy profiles_select_own on public.profiles for
select to authenticated using (auth.uid() = id);

create policy profiles_select_admin_all on public.profiles for
select to authenticated using (public.is_app_admin ());

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;

drop policy if exists projects_select_visible on public.projects;

drop policy if exists projects_insert_staff on public.projects;

drop policy if exists projects_update_staff on public.projects;

drop policy if exists projects_delete_admin on public.projects;

create policy projects_select_visible on public.projects for
select to authenticated using (
  public.is_app_admin ()
  or (
    coalesce(cardinality(projects.assigned_emails), 0) > 0
    and public.auth_email_lower () is not null
    and exists (
      select 1
      from
        unnest(coalesce(projects.assigned_emails, '{}'::text[])) as t (raw)
      where
        lower(trim(t.raw)) = public.auth_email_lower ()
    )
  )
);

create policy projects_insert_staff on public.projects for insert to authenticated
with
  check (
    public.current_profile_role_id () in ('admin', 'project_manager')
  );

create policy projects_update_staff on public.projects for
update to authenticated using (
  public.is_app_admin ()
  or (
    public.current_profile_role_id () = 'project_manager'
    and public.user_has_project_access_by_id (projects.id)
  )
)
with
  check (
    public.is_app_admin ()
    or (
      public.current_profile_role_id () = 'project_manager'
      and public.user_has_project_access_by_id (projects.id)
    )
  );

create policy projects_delete_admin on public.projects for delete to authenticated using (public.is_app_admin ());

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;

drop policy if exists tasks_select_visible on public.tasks;

drop policy if exists tasks_insert_staff on public.tasks;

drop policy if exists tasks_update_staff on public.tasks;

drop policy if exists tasks_delete_staff on public.tasks;

create policy tasks_select_visible on public.tasks for
select to authenticated using (
  public.is_app_admin ()
  or tasks.project_id is null
  or public.user_has_project_access_by_id (tasks.project_id)
);

create policy tasks_insert_staff on public.tasks for insert to authenticated
with
  check (
    public.current_profile_role_id () in ('admin', 'project_manager', 'member')
    and (
      project_id is null
      or public.user_has_project_access_by_id (project_id)
    )
  );

create policy tasks_update_staff on public.tasks for
update to authenticated using (
  public.is_app_admin ()
  or tasks.project_id is null
  or public.user_has_project_access_by_id (tasks.project_id)
)
with
  check (
    public.current_profile_role_id () in ('admin', 'project_manager', 'member')
    and (
      project_id is null
      or public.user_has_project_access_by_id (project_id)
    )
  );

create policy tasks_delete_staff on public.tasks for delete to authenticated using (
  public.current_profile_role_id () in ('admin', 'project_manager')
  and (
    public.is_app_admin ()
    or tasks.project_id is null
    or public.user_has_project_access_by_id (tasks.project_id)
  )
);

-- ---------------------------------------------------------------------------
-- Proje sohbeti (varsa eski açık politikaları kaldır)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass ('public.project_chat_messages') is not null then
    alter table public.project_chat_messages enable row level security;

    drop policy if exists "pcm_allow_all" on public.project_chat_messages;

    drop policy if exists pcm_select on public.project_chat_messages;

    drop policy if exists pcm_insert on public.project_chat_messages;

    drop policy if exists pcm_delete on public.project_chat_messages;

    create policy pcm_select on public.project_chat_messages for
    select to authenticated using (public.user_has_project_access_by_id (project_id));

    create policy pcm_insert on public.project_chat_messages for insert to authenticated
    with
      check (
        public.user_has_project_access_by_id (project_id)
        and lower(trim(sender_email)) = public.auth_email_lower ()
      );

    create policy pcm_delete on public.project_chat_messages for delete to authenticated using (public.is_app_admin ());
  end if;

  if to_regclass ('public.project_chat_reads') is not null then
    alter table public.project_chat_reads enable row level security;

    drop policy if exists "pcr_allow_all" on public.project_chat_reads;

    drop policy if exists pcr_select on public.project_chat_reads;

    drop policy if exists pcr_insert on public.project_chat_reads;

    drop policy if exists pcr_update on public.project_chat_reads;

    drop policy if exists pcr_delete on public.project_chat_reads;

    create policy pcr_select on public.project_chat_reads for
    select to authenticated using (
      public.user_has_project_access_by_id (project_id)
      and lower(trim(reader_email)) = public.auth_email_lower ()
    );

    create policy pcr_insert on public.project_chat_reads for insert to authenticated
    with
      check (
        public.user_has_project_access_by_id (project_id)
        and lower(trim(reader_email)) = public.auth_email_lower ()
      );

    create policy pcr_update on public.project_chat_reads for
    update to authenticated using (
      public.user_has_project_access_by_id (project_id)
      and lower(trim(reader_email)) = public.auth_email_lower ()
    )
    with
      check (
        public.user_has_project_access_by_id (project_id)
        and lower(trim(reader_email)) = public.auth_email_lower ()
      );

    create policy pcr_delete on public.project_chat_reads for delete to authenticated using (public.is_app_admin ());
  end if;
end
$$;
