-- tasks tablosu oluşturma + örnek kayıtlar
-- Supabase Dashboard > SQL Editor'da çalıştırın.

-- 1) Tablo yoksa oluştur
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  assignee text,
  last_updated_by text,
  priority text DEFAULT 'Medium',
  updated_at timestamptz DEFAULT now()
);

-- Mevcut tabloya priority ve updated_at eklemek için (tablo zaten varsa):
-- ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'Medium';
-- ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) Realtime: Dashboard > Database > Replication > supabase_realtime içinde tasks'ı etkinleştirin

-- 3) RLS açıksa anon okuma/yazma izni (isteğe bağlı)
-- ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for anon" ON public.tasks FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4) Örnek kayıtlar (priority ve updated_at opsiyonel)
INSERT INTO public.tasks (content, status, assignee, last_updated_by, priority) VALUES
  ('Dashboard arayüzünü güncelle', 'Devam ediyor', 'Ayşe Yılmaz', 'sistem', 'Medium'),
  ('API entegrasyonunu tamamla', 'Beklemede', 'Mehmet Kaya', 'sistem', 'High'),
  ('Kullanıcı testlerini çalıştır', 'Yapılacak', 'Zeynep Demir', 'sistem', 'Medium'),
  ('Dokümantasyonu yaz', 'Yapılacak', null, 'sistem', 'Low'),
  ('Performans iyileştirmeleri', 'Tamamlandı', 'Ali Özkan', 'sistem', 'High');
