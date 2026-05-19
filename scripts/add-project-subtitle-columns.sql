-- Proje bazlı "Alt başlık sütunları" — Görev kartlarında (Kanban / Gantt / Takvim /
-- Görev Özeti / Mobil kart) başlığın altında küçük gri satırda gösterilecek
-- ek extra_data anahtarları (en fazla 3 önerilir).
-- NULL veya boş dizi → alt başlık satırı gösterilmez.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS subtitle_columns text[];

COMMENT ON COLUMN public.projects.subtitle_columns IS
  'Görev kartında başlığın altında gösterilecek extra_data anahtarları (örn. ["Sicil No", "İl"]).';
