-- Görev yorumları — tek bir görev altında ekip iletişimi.
-- Çalışır: Supabase Studio > SQL Editor > yapıştır > Run
-- Idempotent: tekrar çalıştırılabilir.

-- 1) Tablo
CREATE TABLE IF NOT EXISTS public.task_comments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Kullanıcı silinse bile yorum metnini eşleştirebilmek için cache'lenmiş alanlar:
  user_email        text        NOT NULL,
  user_display_name text,
  body              text        NOT NULL CHECK (
    char_length(body) <= 5000 AND char_length(trim(body)) > 0
  ),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2) İndeksler
CREATE INDEX IF NOT EXISTS task_comments_task_idx     ON public.task_comments (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_comments_user_idx     ON public.task_comments (user_id);

-- 3) updated_at trigger
CREATE OR REPLACE FUNCTION public.task_comments_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_touch_trg ON public.task_comments;
CREATE TRIGGER task_comments_touch_trg
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.task_comments_touch_updated_at();

-- 4) RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comments_select ON public.task_comments;
DROP POLICY IF EXISTS task_comments_insert ON public.task_comments;
DROP POLICY IF EXISTS task_comments_update ON public.task_comments;
DROP POLICY IF EXISTS task_comments_delete ON public.task_comments;

-- Select: yorumun görevine erişebilen herkes (mevcut task RLS helper'ı ile)
CREATE POLICY task_comments_select
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND public.task_is_visible_for_current_user(t.project_id, t.assignee)
    )
  );

-- Insert: görevi görebilen + member+ rolü + sadece kendi user_id ile
CREATE POLICY task_comments_insert
  ON public.task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_profile_role_id() IN ('admin', 'project_manager', 'member')
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND public.task_is_visible_for_current_user(t.project_id, t.assignee)
    )
  );

-- Update: sadece yorum sahibi
CREATE POLICY task_comments_update
  ON public.task_comments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete: yorum sahibi veya admin
CREATE POLICY task_comments_delete
  ON public.task_comments
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_profile_role_id() = 'admin'
  );

-- 5) Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
  END IF;
END $$;

COMMENT ON TABLE public.task_comments IS
  'Görev yorumları — tek bir görev altında ekip iletişimi. RLS: görev üzerinde view yetkisi.';
