-- =============================================================================
-- Saved Views — Adlandırılmış filtre/görünüm seti
-- =============================================================================
-- "Bu haftaki kritik işler", "Bana atanan", "Geciken görevler" gibi
-- kullanıcının kaydettiği görünüm yapılandırmaları.
--
-- scope:
--   "private"  → sadece sahibi görür
--   "shared"   → tüm authenticated kullanıcılar görür (kurumsal varsayılan)
--
-- config: tam görünüm snapshot'ı (filtreler, sıralama, sütun görünürlüğü, vb.)
-- Versionlu: { version: 1, filters: {...}, sort: [...], columns: {...} }
-- =============================================================================

-- 1) Tablo --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope       text        NOT NULL DEFAULT 'private'
                          CHECK (scope IN ('private','shared')),
  name        text        NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  /** Hedef: hangi sayfa/scope için (örn. "live_table"). v1'de hep "live_table". */
  target      text        NOT NULL DEFAULT 'live_table',
  config      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_views IS 'Kullanıcının kaydettiği filtre/görünüm seti — Canlı Tablo vb.';
COMMENT ON COLUMN public.saved_views.config IS '{ version, filters, sort, columns } snapshot';

-- 2) İndeksler ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS saved_views_user_idx   ON public.saved_views (user_id, target);
CREATE INDEX IF NOT EXISTS saved_views_scope_idx  ON public.saved_views (scope, target);

-- updated_at otomatik tetikleyici
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

-- 3) RLS ---------------------------------------------------------------------
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_views_select ON public.saved_views;
DROP POLICY IF EXISTS saved_views_insert ON public.saved_views;
DROP POLICY IF EXISTS saved_views_update ON public.saved_views;
DROP POLICY IF EXISTS saved_views_delete ON public.saved_views;

-- SELECT: private → sahibi; shared → tüm auth kullanıcılar
CREATE POLICY saved_views_select
  ON public.saved_views
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR scope = 'shared'
  );

-- INSERT: kendi user_id'siyle ekleyebilir
CREATE POLICY saved_views_insert
  ON public.saved_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: sadece sahibi; ya da admin tüm shared'leri yönetebilir
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

-- DELETE: aynı kural
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

-- =============================================================================
-- Test:
--   INSERT INTO saved_views (user_id, name, config)
--     VALUES (auth.uid(), 'Bana atanan', '{"version":1}'::jsonb);
--   SELECT id, name, scope FROM saved_views ORDER BY updated_at DESC;
-- =============================================================================
