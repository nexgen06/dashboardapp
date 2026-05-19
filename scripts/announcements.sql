-- =============================================================================
-- Duyurular — admin'in tüm kullanıcılara ilettiği mesajlar.
-- =============================================================================
-- Çalıştır: Supabase Studio > SQL Editor > yapıştır > Run. Idempotent.

CREATE TABLE IF NOT EXISTS public.announcements (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email  text        NOT NULL,
  title         text        NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 120),
  body          text        NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 5000),
  pinned        boolean     NOT NULL DEFAULT false,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id uuid        NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  reader_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, reader_id)
);

CREATE INDEX IF NOT EXISTS announcements_pinned_created_idx ON public.announcements (pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_expires_idx        ON public.announcements (expires_at);
CREATE INDEX IF NOT EXISTS announcement_reads_reader_idx    ON public.announcement_reads (reader_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.announcements_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcements_touch_trg ON public.announcements;
CREATE TRIGGER announcements_touch_trg
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.announcements_touch_updated_at();

-- RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_select_all     ON public.announcements;
DROP POLICY IF EXISTS announcements_insert_admin   ON public.announcements;
DROP POLICY IF EXISTS announcements_update_admin   ON public.announcements;
DROP POLICY IF EXISTS announcements_delete_admin   ON public.announcements;
DROP POLICY IF EXISTS ann_reads_select_own         ON public.announcement_reads;
DROP POLICY IF EXISTS ann_reads_insert_own         ON public.announcement_reads;
DROP POLICY IF EXISTS ann_reads_delete_own         ON public.announcement_reads;

-- announcements: herkes okur; sadece admin yazar
CREATE POLICY announcements_select_all
  ON public.announcements
  FOR SELECT TO authenticated
  USING (expires_at IS NULL OR expires_at > now());

CREATE POLICY announcements_insert_admin
  ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  );

CREATE POLICY announcements_update_admin
  ON public.announcements
  FOR UPDATE TO authenticated
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

CREATE POLICY announcements_delete_admin
  ON public.announcements
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  );

-- announcement_reads: herkes kendi satırını yazar/okur
CREATE POLICY ann_reads_select_own
  ON public.announcement_reads
  FOR SELECT TO authenticated
  USING (reader_id = auth.uid());

CREATE POLICY ann_reads_insert_own
  ON public.announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (reader_id = auth.uid());

CREATE POLICY ann_reads_delete_own
  ON public.announcement_reads
  FOR DELETE TO authenticated
  USING (reader_id = auth.uid());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcement_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_reads;
  END IF;
END $$;

COMMENT ON TABLE public.announcements IS 'Admin tarafından oluşturulan duyurular — tüm kullanıcılar görür.';
COMMENT ON TABLE public.announcement_reads IS 'Bir duyuruyu hangi kullanıcının okuduğu (badge sayımı için).';
