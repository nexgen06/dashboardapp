-- Sıra: 1) bu dosya 2) supabase-auth-profiles.sql 3) supabase-rls-policies.sql 4) create-app-settings.sql

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Aktif',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS assigned_emails text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS priority text;

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Yapılacak',
  assignee text,
  last_updated_by text,
  updated_at timestamptz DEFAULT now(),
  priority text DEFAULT 'Medium',
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  due_date date,
  extra_data jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks (project_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
END $$;
