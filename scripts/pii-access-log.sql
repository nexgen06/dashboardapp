-- =============================================================================
-- PII (kişisel veri) erişim kayıtları — kim TCKN/sicil gibi hassas alanlara
-- ne zaman, hangi yoldan (kopya / unmask / export) erişti?
-- =============================================================================
-- KVKK uyumu + içeriden sızdırma erken-tespiti için.
-- Çalışır: Supabase Studio > SQL Editor > yapıştır > Run. Idempotent.

-- 1) Tablo
CREATE TABLE IF NOT EXISTS public.pii_access_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  text        NOT NULL,
  action      text        NOT NULL CHECK (action IN ('copy', 'unmask', 'export')),
  field_name  text        NOT NULL,     -- "TCKN", "Sicil No" gibi
  record_id   uuid,                     -- ilgili task id (NULL = toplu export)
  record_count integer    NOT NULL DEFAULT 1, -- toplu export'ta etkilenen satır sayısı
  at          timestamptz NOT NULL DEFAULT now()
);

-- 2) İndeksler
CREATE INDEX IF NOT EXISTS pii_access_user_at_idx ON public.pii_access_log (user_id, at DESC);
CREATE INDEX IF NOT EXISTS pii_access_at_idx      ON public.pii_access_log (at DESC);
CREATE INDEX IF NOT EXISTS pii_access_action_idx  ON public.pii_access_log (action);

-- 3) RLS — sadece admin okuyabilir; herkes (authenticated) sadece KENDİ user_id'siyle insert eder
ALTER TABLE public.pii_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pii_access_select_admin ON public.pii_access_log;
DROP POLICY IF EXISTS pii_access_insert_own   ON public.pii_access_log;
DROP POLICY IF EXISTS pii_access_no_update    ON public.pii_access_log;
DROP POLICY IF EXISTS pii_access_no_delete    ON public.pii_access_log;

CREATE POLICY pii_access_select_admin
  ON public.pii_access_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  );

CREATE POLICY pii_access_insert_own
  ON public.pii_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Log immutable: update / delete yok (denetim güvenliği)
-- (Hiçbir UPDATE / DELETE policy'si yok → erişilemez)

COMMENT ON TABLE public.pii_access_log IS
  'TCKN/Sicil gibi hassas alanlara kopya/unmask/export ile erişim kaydı. KVKK + sızdırma tespiti.';
