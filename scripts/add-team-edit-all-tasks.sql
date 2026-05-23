-- Proje bazında satır düzenleme modu.
-- Amaç: Proje ekibi tüm görevleri görebilsin; normalde yalnızca kendi/atanmamış
-- satırlarını düzenlesin. Bu alan true ise ekip tüm satırları düzenleyebilir.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS team_edit_all_tasks boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.team_edit_all_tasks IS
  'Açıksa proje ekibi tüm görev satırlarını düzenleyebilir. Kapalıysa UI/RLS normal üyeleri kendi veya atanmamış satırlarla sınırlar.';

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

REVOKE ALL ON FUNCTION public.project_team_edit_all_tasks (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.task_is_editable_for_current_user (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_team_edit_all_tasks (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_is_editable_for_current_user (uuid, text) TO authenticated;

DROP POLICY IF EXISTS tasks_update_staff ON public.tasks;

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
