-- Proje arşivi: tamamlanmış/eski projeleri silmeden gizlemek için soft-archive
-- Çalışır: Supabase Studio > SQL Editor > yapıştır > Run
-- Idempotent: tekrar çalıştırılabilir.

alter table public.projects
  add column if not exists archived_at timestamptz null;

-- Sadece arşivli olmayan kayıtlar üzerinde dolaşmak için partial index
create index if not exists projects_active_idx
  on public.projects (updated_at desc)
  where archived_at is null;

-- Arşiv listesi için ayrı bir index (filtreleme + sıralama)
create index if not exists projects_archived_idx
  on public.projects (archived_at desc)
  where archived_at is not null;

comment on column public.projects.archived_at is
  'Soft-archive timestamp. NULL = aktif proje. Değer dolu = arşivli (RLS değişmez, UI filtreler).';
