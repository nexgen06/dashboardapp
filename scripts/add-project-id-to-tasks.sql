-- tasks tablosuna project_id ekleyerek projeye bağlama
-- Supabase SQL Editor'da çalıştırın. Önce projects tablosu olmalı (scripts/create-projects-table.sql).

-- Sütun ekle (yoksa)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- İsteğe bağlı: proje bazlı sorgular için indeks
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
