/* SECURITY DEFINER: RLS politikaları bu fonksiyonları çağırdığında tablolara tekrar RLS ile girilmez;
   aksi halde tasks ↔ projects ↔ profiles zinciri "stack depth limit exceeded" (54001) üretebilir. */

CREATE OR REPLACE FUNCTION public.auth_email_lower ()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    LOWER(TRIM(
      COALESCE(
        NULLIF(TRIM(auth.jwt() ->> 'email'), ''),
        NULLIF(TRIM((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1)), '')
      )
    )),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role_id = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role_id ()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.role_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    'member'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_access_by_id (project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_app_admin()
    OR (
      project_uuid IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_uuid
          AND COALESCE(CARDINALITY(p.assigned_emails), 0) > 0
          AND public.auth_email_lower() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(p.assigned_emails, '{}'::text[])) AS t (raw)
            WHERE LOWER(TRIM(t.raw)) = public.auth_email_lower()
          )
      )
    );
$$;

/* projects üzerinde tekrar RLS ile SELECT yapmaz; task politikaları bunu kullanır */
CREATE OR REPLACE FUNCTION public.project_strict_assignee_visibility (p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT pr.strict_assignee_visibility
      FROM public.projects pr
      WHERE pr.id = p_project_id
      LIMIT 1
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.project_team_edit_all_tasks (p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT pr.team_edit_all_tasks
      FROM public.projects pr
      WHERE pr.id = p_project_id
      LIMIT 1
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.task_is_visible_for_current_user (p_project_id uuid, p_assignee text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    public.is_app_admin()
    OR p_project_id IS NULL
    OR (
      public.user_has_project_access_by_id (p_project_id)
      AND (
        NOT public.project_strict_assignee_visibility (p_project_id)
        OR public.current_profile_role_id () IN ('admin', 'project_manager')
        OR p_assignee IS NULL
        OR BTRIM(p_assignee) = ''
        OR LOWER(BTRIM(p_assignee)) = public.auth_email_lower ()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.task_is_editable_for_current_user (p_project_id uuid, p_assignee text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    public.is_app_admin()
    OR public.current_profile_role_id () = 'project_manager'
    OR p_project_id IS NULL
    OR (
      public.user_has_project_access_by_id (p_project_id)
      AND (
        public.project_team_edit_all_tasks (p_project_id)
        OR p_assignee IS NULL
        OR BTRIM(p_assignee) = ''
        OR LOWER(BTRIM(p_assignee)) = public.auth_email_lower ()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.task_insert_assignee_allowed (p_project_id uuid, p_assignee text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_project_id IS NULL
    OR public.is_app_admin ()
    OR public.current_profile_role_id () = 'project_manager'
    OR NOT public.project_strict_assignee_visibility (p_project_id)
    OR p_assignee IS NULL
    OR BTRIM(p_assignee) = ''
    OR LOWER(BTRIM(p_assignee)) = public.auth_email_lower ();
$$;

REVOKE ALL ON FUNCTION public.auth_email_lower () FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_app_admin () FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_role_id () FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_project_access_by_id (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_strict_assignee_visibility (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_team_edit_all_tasks (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.task_is_visible_for_current_user (uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.task_is_editable_for_current_user (uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.task_insert_assignee_allowed (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_email_lower () TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin () TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role_id () TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_project_access_by_id (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_strict_assignee_visibility (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_team_edit_all_tasks (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_is_visible_for_current_user (uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_is_editable_for_current_user (uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_insert_assignee_allowed (uuid, text) TO authenticated;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin_all ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY profiles_select_admin_all ON public.profiles
  FOR SELECT TO authenticated USING (public.is_app_admin());

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select_visible ON public.projects;
DROP POLICY IF EXISTS projects_insert_staff ON public.projects;
DROP POLICY IF EXISTS projects_update_staff ON public.projects;
DROP POLICY IF EXISTS projects_delete_admin ON public.projects;

CREATE POLICY projects_select_visible ON public.projects
  FOR SELECT TO authenticated USING (
    public.is_app_admin()
    OR (
      COALESCE(CARDINALITY(projects.assigned_emails), 0) > 0
      AND public.auth_email_lower() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM UNNEST(COALESCE(projects.assigned_emails, '{}'::text[])) AS t (raw)
        WHERE LOWER(TRIM(t.raw)) = public.auth_email_lower()
      )
    )
  );

CREATE POLICY projects_insert_staff ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_role_id() IN ('admin', 'project_manager'));

CREATE POLICY projects_update_staff ON public.projects
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR (
      public.current_profile_role_id() = 'project_manager'
      AND public.user_has_project_access_by_id (projects.id)
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR (
      public.current_profile_role_id() = 'project_manager'
      AND public.user_has_project_access_by_id (projects.id)
    )
  );

CREATE POLICY projects_delete_admin ON public.projects
  FOR DELETE TO authenticated USING (public.is_app_admin());

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select_visible ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_staff ON public.tasks;
DROP POLICY IF EXISTS tasks_update_staff ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_staff ON public.tasks;

CREATE POLICY tasks_select_visible ON public.tasks
  FOR SELECT TO authenticated USING (
    public.task_is_visible_for_current_user (tasks.project_id, tasks.assignee)
  );

CREATE POLICY tasks_insert_staff ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_profile_role_id () IN ('admin', 'project_manager', 'member')
    AND (
      project_id IS NULL
      OR public.user_has_project_access_by_id (project_id)
    )
    AND public.task_insert_assignee_allowed (project_id, assignee)
  );

CREATE POLICY tasks_update_staff ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.task_is_editable_for_current_user (tasks.project_id, tasks.assignee))
  WITH CHECK (
    public.current_profile_role_id () IN ('admin', 'project_manager', 'member')
    AND (
      project_id IS NULL
      OR public.user_has_project_access_by_id (project_id)
    )
    AND public.task_is_editable_for_current_user (project_id, assignee)
  );

CREATE POLICY tasks_delete_staff ON public.tasks
  FOR DELETE TO authenticated USING (
    public.current_profile_role_id() IN ('admin', 'project_manager')
    AND (
      public.is_app_admin()
      OR tasks.project_id IS NULL
      OR public.user_has_project_access_by_id (tasks.project_id)
    )
  );

DO $$
BEGIN
  IF to_regclass('public.project_chat_messages') IS NOT NULL THEN
    ALTER TABLE public.project_chat_messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "pcm_allow_all" ON public.project_chat_messages;
    DROP POLICY IF EXISTS pcm_select ON public.project_chat_messages;
    DROP POLICY IF EXISTS pcm_insert ON public.project_chat_messages;
    DROP POLICY IF EXISTS pcm_delete ON public.project_chat_messages;
    CREATE POLICY pcm_select ON public.project_chat_messages
      FOR SELECT TO authenticated USING (public.user_has_project_access_by_id (project_id));
    CREATE POLICY pcm_insert ON public.project_chat_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        public.user_has_project_access_by_id (project_id)
        AND LOWER(TRIM(sender_email)) = public.auth_email_lower()
      );
    CREATE POLICY pcm_delete ON public.project_chat_messages
      FOR DELETE TO authenticated USING (public.is_app_admin());
  END IF;

  IF to_regclass('public.project_chat_reads') IS NOT NULL THEN
    ALTER TABLE public.project_chat_reads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "pcr_allow_all" ON public.project_chat_reads;
    DROP POLICY IF EXISTS pcr_select ON public.project_chat_reads;
    DROP POLICY IF EXISTS pcr_insert ON public.project_chat_reads;
    DROP POLICY IF EXISTS pcr_update ON public.project_chat_reads;
    DROP POLICY IF EXISTS pcr_delete ON public.project_chat_reads;
    CREATE POLICY pcr_select ON public.project_chat_reads
      FOR SELECT TO authenticated USING (
        public.user_has_project_access_by_id (project_id)
        AND LOWER(TRIM(reader_email)) = public.auth_email_lower()
      );
    CREATE POLICY pcr_insert ON public.project_chat_reads
      FOR INSERT TO authenticated
      WITH CHECK (
        public.user_has_project_access_by_id (project_id)
        AND LOWER(TRIM(reader_email)) = public.auth_email_lower()
      );
    CREATE POLICY pcr_update ON public.project_chat_reads
      FOR UPDATE TO authenticated
      USING (
        public.user_has_project_access_by_id (project_id)
        AND LOWER(TRIM(reader_email)) = public.auth_email_lower()
      )
      WITH CHECK (
        public.user_has_project_access_by_id (project_id)
        AND LOWER(TRIM(reader_email)) = public.auth_email_lower()
      );
    CREATE POLICY pcr_delete ON public.project_chat_reads
      FOR DELETE TO authenticated USING (public.is_app_admin());
  END IF;
END $$;
