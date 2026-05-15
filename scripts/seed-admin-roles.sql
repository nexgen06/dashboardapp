-- ================================================================
-- Seed admin roles in profiles table
-- ================================================================
-- Bu script, daha önce istemci tarafında NEXT_PUBLIC_ADMIN_EMAILS
-- listesinde / DEFAULT_FULL_ADMIN_EMAIL sabitinde tutulan tam yetkili
-- e-postaları DB'de role_id='admin' olarak işaretler.
--
-- KULLANIM:
--   1) Önce scripts/supabase-auto-create-profile.sql çalıştırılmış olmalı
--      (yoksa profil yoksa UPDATE etkisiz olur).
--   2) Aşağıdaki listeyi kendi admin e-postalarınızla güncelleyin.
--   3) Supabase Studio SQL Editor'da çalıştırın.
--
-- Idempotent: birden fazla çalıştırılabilir.
-- ================================================================

-- ─── BURAYA KENDİ ADMİN E-POSTALARINIZI EKLEYİN ───
WITH admin_emails AS (
  SELECT lower(trim(email)) AS email FROM (
    VALUES
      ('ugurgrses@gmail.com')
      -- , ('digerorneksinaf@sirket.com')
      -- , ('ekiplider@sirket.com')
  ) AS t(email)
)
UPDATE public.profiles p
SET role_id = 'admin',
    updated_at = now()
FROM admin_emails a
WHERE lower(p.email) = a.email
  AND p.role_id <> 'admin';

-- Doğrulama: kim admin olarak işaretlendi?
DO $$
DECLARE
  admin_count int;
  admin_emails_text text;
BEGIN
  SELECT count(*), string_agg(email, ', ' ORDER BY email)
  INTO admin_count, admin_emails_text
  FROM public.profiles
  WHERE role_id = 'admin';
  RAISE NOTICE 'Toplam admin sayısı: %', admin_count;
  RAISE NOTICE 'Admin e-postaları: %', COALESCE(admin_emails_text, '(hiçbiri)');
END $$;
