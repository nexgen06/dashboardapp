-- ============================================================
-- VERİTABANINI YENİDEN OLUŞTUR (Supabase SQL Editor'da çalıştırın)
-- Yanlışlıkla silinen veritabanı için: Bu dosyayı Supabase Dashboard
-- > SQL Editor'a yapıştırıp Run deyin. Sırayla tüm tablolar ve ayarlar oluşur.
-- ============================================================

-- 1) PROJECTS TABLOSU
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Aktif',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- projects: atanan kullanıcı e-postaları
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS assigned_emails text[] DEFAULT '{}';

-- projects: hedef tarih ve öncelik
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS priority text;

-- 2) TASKS TABLOSU (projects'e bağlı)
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

-- tasks: proje bazlı sorgular için indeks
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

-- 3) REALTIME (canlı güncellemeler için)
-- Not: "already in publication" hatası alırsanız yok sayın.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- ============================================================
-- Bitti. İsteğe bağlı: Supabase Dashboard > Database > Replication
-- bölümünde supabase_realtime içinde tasks ve projects işaretli olsun.
-- ============================================================
