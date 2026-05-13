-- Anında onarım: "policy ... already exists" (42710) hatası için.
-- Supabase şablonu / eski denemeler app_settings_select_anon vb. bırakmış olabilir.
-- Bu dosyayı bir kez SQL Editor'da çalıştırın; ardından create-app-settings veya tighten script'ini yeniden deneyin.

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_select_anon ON public.app_settings;
DROP POLICY IF EXISTS app_settings_insert_anon ON public.app_settings;
DROP POLICY IF EXISTS app_settings_update_anon ON public.app_settings;
DROP POLICY IF EXISTS app_settings_delete_anon ON public.app_settings;
DROP POLICY IF EXISTS app_settings_all_anon ON public.app_settings;
