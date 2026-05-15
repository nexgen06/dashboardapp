-- ================================================================
-- Auto-create profile on auth.users INSERT
-- ================================================================
-- Bu trigger, Supabase Auth'a yeni bir kullanıcı eklendiğinde
-- public.profiles tablosuna otomatik olarak bir satır ekler.
-- Böylece "ensureSupabaseProfileAndRole" yarış koşulu ortadan kalkar
-- ve istemci hiç bir zaman "ben yokum, ben adminim" diyemez.
--
-- ÇALIŞTIRMA SIRASI (kritik):
--   1) Bu dosyayı Supabase Studio SQL Editor'da çalıştır.
--   2) Sonra scripts/seed-admin-roles.sql ile mevcut adminleri işaretle.
--   3) Sonra istemci kod değişikliklerini deploy et.
--
-- Idempotent: birden fazla çalıştırılabilir, hata vermez.
-- ================================================================

-- 1) Yeni auth.users satırı eklenince profili oluşturur.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role_id, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ), ''),
    'member',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 2) Geriye dönük: auth.users'da olup profili olmayanları doldur.
--    Mevcut adminler bu adımda 'member' olarak işaretlenir; sonra
--    scripts/seed-admin-roles.sql ile yükseltilirler.
INSERT INTO public.profiles (id, email, role_id, updated_at)
SELECT u.id, COALESCE(u.email, ''), 'member', now()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Doğrulama: profil sayısı = auth.users sayısı olmalı.
DO $$
DECLARE
  user_count int;
  profile_count int;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  SELECT count(*) INTO profile_count FROM public.profiles;
  RAISE NOTICE 'auth.users: %, public.profiles: %', user_count, profile_count;
  IF user_count <> profile_count THEN
    RAISE WARNING 'Profil sayısı kullanıcı sayısına eşit değil; bu beklenmedik bir durum olabilir.';
  END IF;
END $$;
