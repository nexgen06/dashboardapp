-- Proje bazlı "Başlık sütunu" — Görev başlığı (Kanban / Özet / mobil kart) için
-- hangi extra_data anahtarının kullanılacağını proje sahibi seçer.
-- NULL = otomatik fallback (mevcut heuristic davranışı)

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS title_column text;

COMMENT ON COLUMN public.projects.title_column IS
  'Görev başlığı olarak kullanılacak extra_data anahtarı (örn. "Konu", "Ad Soyad"). NULL → otomatik';
