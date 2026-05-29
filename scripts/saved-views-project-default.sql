-- Saved Views: proje bazlı varsayılan görünüm (Sprint 3.1)
-- Çalıştır: Supabase Studio → SQL Editor → yapıştır → Run
-- Önkoşul: scripts/saved-views.sql

ALTER TABLE public.saved_views
  ADD COLUMN IF NOT EXISTS project_id uuid NULL REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.saved_views
  ADD COLUMN IF NOT EXISTS is_project_default boolean NOT NULL DEFAULT false;

-- Proje varsayılanı yalnızca paylaşılan + project_id dolu olabilir
ALTER TABLE public.saved_views
  DROP CONSTRAINT IF EXISTS saved_views_project_default_requires_shared;

ALTER TABLE public.saved_views
  ADD CONSTRAINT saved_views_project_default_requires_shared
  CHECK (
    NOT is_project_default
    OR (project_id IS NOT NULL AND scope = 'shared')
  );

-- Proje başına en fazla bir varsayılan
DROP INDEX IF EXISTS saved_views_one_default_per_project;
CREATE UNIQUE INDEX saved_views_one_default_per_project
  ON public.saved_views (project_id)
  WHERE is_project_default = true AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS saved_views_project_idx
  ON public.saved_views (project_id, target)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.saved_views.project_id IS
  'Bu görünüm hangi projeye bağlı (proje varsayılanı veya proje kapsamlı paylaşım).';

COMMENT ON COLUMN public.saved_views.is_project_default IS
  'true ise proje açılışında Canlı Tablo bu görünümü otomatik uygular (scope=shared olmalı).';
