-- MVP: Proje bazında "katı atanan görünürlüğü" + görev RLS
-- Supabase SQL Editor'da veya migration olarak çalıştırın.
--
-- Tam kurulum: scripts/supabase-rls-policies.sql (projeler/profil/sohbet politikaları ile birlikte önerilir).
-- Bu dosya: strict sütunu + görev politikaları + 54001 "stack depth" önleyici SECURITY DEFINER yardımcılar.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS strict_assignee_visibility boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.strict_assignee_visibility IS 'Açıksa: üye/izleyici sadece kendi assignee e-postasına veya atanmamış görevlere erişir; admin ve proje yöneticisi tüm görevleri görür.';

/* Aşağıdaki fonksiyon bloğu supabase-rls-policies.sql ile aynı olmalı (senkron tutun). */

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
REVOKE ALL ON FUNCTION public.task_is_visible_for_current_user (uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.task_insert_assignee_allowed (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_email_lower () TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin () TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role_id () TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_project_access_by_id (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_strict_assignee_visibility (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_is_visible_for_current_user (uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_insert_assignee_allowed (uuid, text) TO authenticated;

DROP POLICY IF EXISTS tasks_select_visible ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_staff ON public.tasks;
DROP POLICY IF EXISTS tasks_update_staff ON public.tasks;

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
  USING (public.task_is_visible_for_current_user (tasks.project_id, tasks.assignee))
  WITH CHECK (
    public.current_profile_role_id () IN ('admin', 'project_manager', 'member')
    AND (
      project_id IS NULL
      OR public.user_has_project_access_by_id (project_id)
    )
    AND public.task_insert_assignee_allowed (project_id, assignee)
  );
