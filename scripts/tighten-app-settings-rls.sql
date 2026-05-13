-- app_settings yazma politikalarını sıkılaştırır: yalnızca admin ve proje yöneticisi.
-- Önkoşul: scripts/supabase-rls-policies.sql (is_app_admin, current_profile_role_id).
-- Mevcut geniş politikaları (WITH CHECK true) değiştirir; idempotent çalıştırılabilir.

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_select_anon ON public.app_settings;
DROP POLICY IF EXISTS app_settings_insert_anon ON public.app_settings;
DROP POLICY IF EXISTS app_settings_update_anon ON public.app_settings;
DROP POLICY IF EXISTS app_settings_delete_anon ON public.app_settings;

DROP POLICY IF EXISTS app_settings_insert_authenticated ON public.app_settings;
DROP POLICY IF EXISTS app_settings_update_authenticated ON public.app_settings;
DROP POLICY IF EXISTS app_settings_insert_staff ON public.app_settings;
DROP POLICY IF EXISTS app_settings_update_staff ON public.app_settings;

CREATE POLICY app_settings_insert_staff ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR public.current_profile_role_id() = 'project_manager'
  );

CREATE POLICY app_settings_update_staff ON public.app_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR public.current_profile_role_id() = 'project_manager'
  )
  WITH CHECK (
    public.is_app_admin()
    OR public.current_profile_role_id() = 'project_manager'
  );
