CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('live_table_density', 'normal')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_select_authenticated ON public.app_settings;
DROP POLICY IF EXISTS app_settings_insert_authenticated ON public.app_settings;
DROP POLICY IF EXISTS app_settings_update_authenticated ON public.app_settings;

CREATE POLICY app_settings_select_authenticated ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY app_settings_insert_authenticated ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY app_settings_update_authenticated ON public.app_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
  END IF;
END $$;
