-- Referans kaynaklara kategori (klasör) desteği.
-- Free-text kategori — kullanıcı kendi tasnifini yapar.
-- Idempotent: güvenle tekrar çalıştırılabilir.

alter table public.reference_sources
  add column if not exists category text;

comment on column public.reference_sources.category is
  'Kullanıcı tarafından atanan kategori/klasör adı. UI filtresinde gruplama için.';

create index if not exists reference_sources_category_idx
  on public.reference_sources (category);
