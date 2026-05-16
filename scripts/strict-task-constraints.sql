-- ================================================================
-- Faz 2 / Faz 6: Görev şema kısıtları + performans indeksleri
-- ================================================================
-- Tasks tablosu için:
--   - status: boş olamaz, varsayılan "Yapılacak", NOT NULL
--   - priority: NULL veya {High, Medium, Low}
--   - assignee / status / updated_at üzerinde indeksler (sık filtre/sort)
--
-- Status, customStatusList özelliğini kırmamak için SERBEST METİN kalır;
-- yalnızca boş/null engellenir. Sınıflandırma kodda lib/statusKind.ts üzerinden
-- yapılır.
--
-- Idempotent: birden fazla çalıştırılabilir.
-- Önce legacy veriyi normalize ediyor, sonra constraint'leri ekliyor.
-- ================================================================

-- 1) Legacy normalize: boş/null status'leri "Yapılacak" yap
UPDATE public.tasks
SET status = 'Yapılacak'
WHERE status IS NULL OR length(trim(coalesce(status, ''))) = 0;

-- 2) Status: NOT NULL + default + non-empty CHECK
ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'Yapılacak';

DO $$
BEGIN
  -- NOT NULL ekle (zaten NOT NULL ise hata yutulur)
  BEGIN
    ALTER TABLE public.tasks ALTER COLUMN status SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'status NOT NULL zaten ayarlı veya başka bir sorun: %', SQLERRM;
  END;

  -- CHECK chk_status_nonempty (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_status_nonempty' AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT chk_status_nonempty
      CHECK (length(trim(coalesce(status, ''))) > 0);
  END IF;
END $$;

-- 3) Priority CHECK: NULL veya {High, Medium, Low}
DO $$
BEGIN
  -- Legacy normalize: yanlış değerleri NULL'a çek (veri kaybı yerine "belirsiz")
  UPDATE public.tasks
  SET priority = NULL
  WHERE priority IS NOT NULL
    AND priority NOT IN ('High', 'Medium', 'Low');

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_priority_enum' AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT chk_priority_enum
      CHECK (priority IS NULL OR priority IN ('High', 'Medium', 'Low'));
  END IF;
END $$;

-- 4) Performans indeksleri (sık filtre/sort yapılan alanlar)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks (assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at_desc ON public.tasks (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON public.tasks (project_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

-- 5) Doğrulama özeti
DO $$
DECLARE
  task_count int;
  null_status_count int;
  invalid_priority_count int;
  idx_count int;
BEGIN
  SELECT count(*) INTO task_count FROM public.tasks;
  SELECT count(*) INTO null_status_count
    FROM public.tasks WHERE status IS NULL OR length(trim(coalesce(status,''))) = 0;
  SELECT count(*) INTO invalid_priority_count
    FROM public.tasks WHERE priority IS NOT NULL AND priority NOT IN ('High','Medium','Low');
  SELECT count(*) INTO idx_count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'idx_tasks_assignee','idx_tasks_status','idx_tasks_updated_at_desc',
        'idx_tasks_project_status','idx_profiles_email'
      );

  RAISE NOTICE 'tasks satır sayısı: %', task_count;
  RAISE NOTICE 'boş status: %', null_status_count;
  RAISE NOTICE 'geçersiz priority: %', invalid_priority_count;
  RAISE NOTICE 'yeni indeks sayısı (beklenen 5): %', idx_count;

  IF null_status_count > 0 OR invalid_priority_count > 0 THEN
    RAISE WARNING 'Kısıtlar uygulandı ama anormal veri tespit edildi.';
  ELSE
    RAISE NOTICE 'Kısıtlar ve indeksler hazır ✓';
  END IF;
END $$;
