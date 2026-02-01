-- Canlı Tablo (tasks) - Supabase SQL Editor'da çalıştırın.
-- Not: project_id kullanacaksanız önce scripts/create-projects-table.sql ile projects tablosunu oluşturun.
--      Projeler kullanmayacaksanız aşağıdaki project_id satırını silin veya yorum satırı yapın.

-- 1) Tablo oluştur
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Yapılacak',
  assignee text,
  last_updated_by text,
  updated_at timestamptz DEFAULT now(),
  priority text DEFAULT 'Medium',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  due_date date,
  extra_data jsonb DEFAULT '{}'
);

-- 2) Mevcut tabloya eksik sütunları eklemek için (tablo zaten varsa):
-- ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'Medium';
-- ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
-- ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
-- ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date date;
-- ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS extra_data jsonb DEFAULT '{}';

-- 3) İndeks (proje bazlı filtre için)
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

-- 4) Realtime: Dashboard > Database > Replication > supabase_realtime içinde tasks'ı etkinleştirin.
