-- Proje anlık sohbeti: kalıcı mesajlar + okundu durumu
-- Supabase SQL Editor'da çalıştırın. Ardından Replication'da bu tabloları ekleyin veya alttaki publication satırlarını çalıştırın.

CREATE TABLE IF NOT EXISTS public.project_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_email text NOT NULL,
  sender_name text,
  body text NOT NULL CHECK (char_length(body) <= 2000 AND char_length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcm_project_created ON public.project_chat_messages(project_id, created_at DESC);

-- Kullanıcı proje sohbetini son ne zaman "gördü" (buradan sonraki başkası mesajları = okunmamış sayılır)
CREATE TABLE IF NOT EXISTS public.project_chat_reads (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reader_email text NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, reader_email)
);

CREATE INDEX IF NOT EXISTS idx_pcr_reader ON public.project_chat_reads(reader_email);

ALTER TABLE public.project_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pcm_allow_all" ON public.project_chat_messages;
DROP POLICY IF EXISTS "pcr_allow_all" ON public.project_chat_reads;

CREATE POLICY "pcm_allow_all" ON public.project_chat_messages
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "pcr_allow_all" ON public.project_chat_reads
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Realtime (hata: "already member" ise yok sayın)
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_chat_reads;
