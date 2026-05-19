-- =============================================================================
-- Kullanıcı profili — ek alanlar ve avatar storage bucket.
-- =============================================================================
-- profiles tablosuna nickname, full_name, avatar_url, title, department, bio,
-- timezone kolonları eklenir. RLS: kendi satırını günceller; tüm authenticated
-- görünür alanları okur (zaten policy var).
--
-- Çalışır: Supabase Studio > SQL Editor > yapıştır > Run. Idempotent.

-- 1) Sütunlar
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname    text,
  ADD COLUMN IF NOT EXISTS full_name   text,
  ADD COLUMN IF NOT EXISTS avatar_url  text,
  ADD COLUMN IF NOT EXISTS title       text,
  ADD COLUMN IF NOT EXISTS department  text,
  ADD COLUMN IF NOT EXISTS bio         text,
  ADD COLUMN IF NOT EXISTS timezone    text DEFAULT 'Europe/Istanbul';

COMMENT ON COLUMN public.profiles.nickname   IS 'Görünen ad — yorumlar/online listesinde gösterilir';
COMMENT ON COLUMN public.profiles.full_name  IS 'Resmi tam ad (ad + soyad)';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Storage bucket public URL veya harici URL';
COMMENT ON COLUMN public.profiles.title      IS 'Unvan — örn. "Yazılım Geliştirici"';
COMMENT ON COLUMN public.profiles.department IS 'Departman/birim — örn. "IT"';
COMMENT ON COLUMN public.profiles.bio        IS 'Kısa açıklama (max 200 char önerilir)';
COMMENT ON COLUMN public.profiles.timezone   IS 'IANA tz — örn. "Europe/Istanbul"';

-- Bio karakter sınırı (uygulama tarafında da kontrol edilir)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_bio_max_chk CHECK (bio IS NULL OR char_length(bio) <= 200);
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 2) Storage bucket: avatars (public read; auth kullanıcı kendi dosyasına yazar/siler)
-- Supabase storage policies (RLS) — bucket varsa create skip, yoksa oluştur.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                                        -- public read
  5242880,                                     -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) Storage policies
-- Herkes (anonim dahil) public bucket'tan okuyabilir — bu Supabase'in default'u
-- olduğu için ek SELECT policy gerekmez (public=true ile zaten açık).
--
-- Yazma / güncelleme / silme: sadece kendi user_id altındaki klasöre.
-- Dosya yolu konvansiyonu: "<user_id>/avatar.<ext>" (uygulama tarafında belirlenir)

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;

CREATE POLICY avatars_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
