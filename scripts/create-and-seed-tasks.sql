CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Yapılacak',
  assignee text,
  last_updated_by text,
  priority text DEFAULT 'Medium',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.tasks (content, status, assignee, last_updated_by, priority) VALUES
  ('Dashboard arayüzünü güncelle', 'Devam ediyor', 'Ayşe Yılmaz', 'sistem', 'Medium'),
  ('API entegrasyonunu tamamla', 'Beklemede', 'Mehmet Kaya', 'sistem', 'High'),
  ('Kullanıcı testlerini çalıştır', 'Yapılacak', 'Zeynep Demir', 'sistem', 'Medium'),
  ('Dokümantasyonu yaz', 'Yapılacak', NULL, 'sistem', 'Low'),
  ('Performans iyileştirmeleri', 'Tamamlandı', 'Ali Özkan', 'sistem', 'High');
