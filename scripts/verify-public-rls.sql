-- RLS doğrulama: public şemada RLS kapalı tablolar (Supabase güvenlik uyarısı ile aynı kontrol).
-- Supabase SQL Editor'da çalıştırın; Results panelinde table_name sütunu listelenir.
-- Beklenti: 0 satır. Satır varsa ilgili tablo için ALTER TABLE ... ENABLE ROW LEVEL SECURITY + politikalar.

SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1;
