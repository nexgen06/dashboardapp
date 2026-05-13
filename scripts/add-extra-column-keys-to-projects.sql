-- Canlı tabloda projeye özel ek sütun başlıkları (extra_data anahtarları) — import olmadan şema ipucu.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS extra_column_keys jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projects.extra_column_keys IS 'Metin dizisi: Canlı Tabloda bu projeyle görünen görevler için gösterilecek ek sütun adları (extra_data ile birleştirilir).';
