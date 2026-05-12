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
