-- =============================================================================
-- Geri bildirim — kullanıcılardan öneri / hata / soru toplama.
-- =============================================================================
-- Çalıştır: Supabase Studio > SQL Editor > yapıştır > Run. Idempotent.

CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email  text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('suggestion', 'bug', 'question', 'other')),
  title       text        NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 100),
  body        text        NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 2000),
  page_url    text,
  user_agent  text,
  status      text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'done', 'wontfix')),
  priority    text                 CHECK (priority IN ('low', 'medium', 'high')),
  admin_notes text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_user_created_idx ON public.feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_status_idx       ON public.feedback (status);
CREATE INDEX IF NOT EXISTS feedback_created_idx      ON public.feedback (created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.feedback_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_touch_trg ON public.feedback;
CREATE TRIGGER feedback_touch_trg
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_touch_updated_at();

-- RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_select_own_or_admin ON public.feedback;
DROP POLICY IF EXISTS feedback_insert_own          ON public.feedback;
DROP POLICY IF EXISTS feedback_update_admin        ON public.feedback;
DROP POLICY IF EXISTS feedback_delete_admin        ON public.feedback;

-- Select: sahibi kendi feedback'ini, admin tümünü
CREATE POLICY feedback_select_own_or_admin
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  );

-- Insert: herkes kendi adına gönderebilir
CREATE POLICY feedback_insert_own
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update: sadece admin (status, priority, admin_notes)
CREATE POLICY feedback_update_admin
  ON public.feedback
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  );

-- Delete: sadece admin
CREATE POLICY feedback_delete_admin
  ON public.feedback
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  );

-- Realtime publication (admin'in yeni feedback'leri anında görmesi için)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'feedback'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
  END IF;
END $$;

COMMENT ON TABLE public.feedback IS
  'Kullanıcı geri bildirimleri (öneri/hata/soru). Sahibi kendi göndererek/okuyabilir; admin tümünü yönetir.';
