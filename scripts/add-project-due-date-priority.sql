-- Proje bazında hedef tarih ve öncelik (zaman / öncelik durumu).
-- Supabase Dashboard > SQL Editor'da çalıştırın.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS priority text;

-- Opsiyonel: varsayılan veya constraint
-- ALTER TABLE public.projects ADD CONSTRAINT projects_priority_check
--   CHECK (priority IS NULL OR priority IN ('High', 'Medium', 'Low'));
