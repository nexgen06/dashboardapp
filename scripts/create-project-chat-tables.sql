CREATE TABLE IF NOT EXISTS public.project_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  sender_email text NOT NULL,
  sender_name text,
  body text NOT NULL CHECK (CHAR_LENGTH(body) <= 2000 AND CHAR_LENGTH(TRIM(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcm_project_created ON public.project_chat_messages (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_chat_reads (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  reader_email text NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, reader_email)
);

CREATE INDEX IF NOT EXISTS idx_pcr_reader ON public.project_chat_reads (reader_email);

ALTER TABLE public.project_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_chat_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_chat_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_chat_reads;
  END IF;
END $$;
