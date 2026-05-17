-- ================================================================
-- Eski / gevşek RLS politikalarını temizle
-- ================================================================
-- Sorun: Supabase Studio UI üzerinden manuel oluşturulmuş türkçe-isimli
-- politikalar `USING true` / `WITH CHECK true` ile her authenticated
-- kullanıcıya tam erişim verdiği için bizim scripts/supabase-rls-policies.sql
-- içindeki katı politikalarımız (admin/PM/atanan koşulları) etkisiz kalıyor.
--
-- PostgreSQL'de permissive RLS politikaları OR ile birleştirilir; bu yüzden
-- en gevşek olan her zaman kazanır.
--
-- Çalıştırma:
--   1) Supabase Studio → SQL Editor'da bu dosyayı çalıştırın.
--   2) Aşağıdaki doğrulama bloğunun sonuçlarını inceleyin.
--   3) Aynı kontrolü `tasks` tablosu için de yapın (en altta).
--
-- Idempotent: birden fazla çalıştırılabilir.
-- ================================================================

-- 1) Projects: gevşek politikaları sil
DROP POLICY IF EXISTS "Giriş yapan kullanıcılar projeleri görebilir" ON public.projects;
DROP POLICY IF EXISTS "Giriş yapan kullanıcılar proje ekleyebilir" ON public.projects;
DROP POLICY IF EXISTS "Giriş yapan kullanıcılar projeleri güncelleyebilir" ON public.projects;
DROP POLICY IF EXISTS "Giriş yapan kullanıcılar projeleri silebilir" ON public.projects;
-- Olası diğer eski isimler (eski seedlerde görülmüş):
DROP POLICY IF EXISTS "Enable read access for all users" ON public.projects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.projects;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can read projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS projects_select_authenticated ON public.projects;
DROP POLICY IF EXISTS projects_insert_authenticated ON public.projects;
DROP POLICY IF EXISTS projects_update_authenticated ON public.projects;

-- 2) Tasks: tespit edilen gevşek INSERT politikası ve olası diğerleri
DROP POLICY IF EXISTS "Herkes görev ekleyebilir" ON public.tasks;
DROP POLICY IF EXISTS "Herkes görevleri görebilir" ON public.tasks;
DROP POLICY IF EXISTS "Herkes görevleri güncelleyebilir" ON public.tasks;
DROP POLICY IF EXISTS "Herkes görevleri silebilir" ON public.tasks;
DROP POLICY IF EXISTS "Giriş yapan kullanıcılar görevleri görebilir" ON public.tasks;
DROP POLICY IF EXISTS "Giriş yapan kullanıcılar görev ekleyebilir" ON public.tasks;
DROP POLICY IF EXISTS "Giriş yapan kullanıcılar görevleri güncelleyebilir" ON public.tasks;
DROP POLICY IF EXISTS "Giriş yapan kullanıcılar görevleri silebilir" ON public.tasks;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.tasks;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can read tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS tasks_select_authenticated ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_authenticated ON public.tasks;
DROP POLICY IF EXISTS tasks_update_authenticated ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_authenticated ON public.tasks;

-- 3) Doğrulama: artık tablolarda hangi politikalar kalmış?
DO $$
DECLARE
  proj_count int;
  task_count int;
  permissive_remaining text;
BEGIN
  -- Projects'te kaç politika kaldı?
  SELECT count(*) INTO proj_count FROM pg_policy WHERE polrelid = 'public.projects'::regclass;
  RAISE NOTICE 'projects tablosu politika sayısı: %', proj_count;

  -- Hâlâ permissive (USING true / WITH CHECK true) bir politika var mı?
  SELECT string_agg(polname, ', ' ORDER BY polname) INTO permissive_remaining
  FROM pg_policy
  WHERE polrelid IN ('public.projects'::regclass, 'public.tasks'::regclass)
    AND (
      pg_get_expr(polqual, polrelid) = 'true'
      OR pg_get_expr(polwithcheck, polrelid) = 'true'
    );

  IF permissive_remaining IS NOT NULL THEN
    RAISE WARNING 'Hâlâ permissive politika var: %', permissive_remaining;
  ELSE
    RAISE NOTICE 'Permissive politika kalmadı ✓';
  END IF;

  SELECT count(*) INTO task_count FROM pg_policy WHERE polrelid = 'public.tasks'::regclass;
  RAISE NOTICE 'tasks tablosu politika sayısı: %', task_count;
END $$;

-- 4) Beklenen son durum:
--    projects: 4 katı politika (projects_select_visible, _insert_staff, _update_staff, _delete_admin)
--    tasks:    4 katı politika (tasks_select_visible, _insert_staff, _update_staff, _delete_staff)
--    Permissive (USING true) hiçbiri OLMAMALI.
