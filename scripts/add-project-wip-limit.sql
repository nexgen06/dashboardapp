-- WIP (Work In Progress) limiti — proje bazlı, "Devam ediyor" kolonu için
-- NULL = limit yok
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS wip_in_progress_limit integer;

COMMENT ON COLUMN public.projects.wip_in_progress_limit IS
  'Kanban "Devam ediyor" kolonu için yumuşak WIP limiti. Aşılırsa amber/kırmızı uyarı.';
