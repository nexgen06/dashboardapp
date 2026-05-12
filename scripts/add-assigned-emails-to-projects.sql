ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS assigned_emails text[] DEFAULT '{}';
