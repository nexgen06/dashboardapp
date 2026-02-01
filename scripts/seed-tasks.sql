-- Canlı Tablo (tasks) için örnek kayıtlar
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın.
-- Tabloda id (uuid, default gen_random_uuid()), content, status, assignee, last_updated_by sütunları olmalı.

INSERT INTO tasks (content, status, assignee, last_updated_by) VALUES
  ('Dashboard arayüzünü güncelle', 'Devam ediyor', 'Ayşe Yılmaz', 'sistem'),
  ('API entegrasyonunu tamamla', 'Beklemede', 'Mehmet Kaya', 'sistem'),
  ('Kullanıcı testlerini çalıştır', 'Yapılacak', 'Zeynep Demir', 'sistem'),
  ('Dokümantasyonu yaz', 'Yapılacak', null, 'sistem'),
  ('Performans iyileştirmeleri', 'Tamamlandı', 'Ali Özkan', 'sistem');
