-- Saved Views: kullanicinin kaydettigi adlandirilmis gorunum seti
-- Calisir: Supabase Studio > SQL Editor > yeni sorgu > yapistir > Run
-- Idempotent: tekrar calistirabilirsin

-- 1) Tablo
CREATE TABLE IF NOT EXISTS public.saved_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope       text        NOT NULL DEFAULT 'private' CHECK (scope IN ('private','shared')),
  name        text        NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  target      text        NOT NULL DEFAULT 'live_table',
  config      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2) Indeksler
CREATE INDEX IF NOT EXISTS saved_views_user_idx  ON public.saved_views (user_id, target);
CREATE INDEX IF NOT EXISTS saved_views_scope_idx ON public.saved_views (scope, target);

-- 3) updated_at otomatik
CREATE OR REPLACE FUNCTION public.saved_views_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS saved_views_touch_trg ON public.saved_views;
CREATE TRIGGER saved_views_touch_trg
  BEFORE UPDATE ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.saved_views_touch_updated_at();

-- 4) RLS
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_views_select ON public.saved_views;
DROP POLICY IF EXISTS saved_views_insert ON public.saved_views;
DROP POLICY IF EXISTS saved_views_update ON public.saved_views;
DROP POLICY IF EXISTS saved_views_delete ON public.saved_views;

CREATE POLICY saved_views_select
  ON public.saved_views
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR scope = 'shared');

CREATE POLICY saved_views_insert
  ON public.saved_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_views_update
  ON public.saved_views
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (scope = 'shared' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    ))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (scope = 'shared' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    ))
  );

CREATE POLICY saved_views_delete
  ON public.saved_views
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (scope = 'shared' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    ))
  );
