-- Hücre-bazlı yorum desteği — task_comments tablosunu genişletir.
-- Çalışır: Supabase Studio > SQL Editor > yapıştır > Run
-- Idempotent: tekrar çalıştırılabilir.
--
-- Amaç: Mevcut "görev altında tek thread" yorum sistemine ek olarak,
-- belirli bir HÜCREYE (örn. "Sicil No", "Durum", "extra:İl") thread açabilmek.
--
-- Tasarım kararı: Aynı tablo + opsiyonel field_key kolonu.
--  - field_key IS NULL  → görev-seviyesi yorum (eski davranış)
--  - field_key = 'status' / 'extra:Sicil No' / vb. → hücre-seviyesi
--
-- Bu sayede:
--  - Mevcut RLS politikaları (task erişimi = yorum erişimi) HİÇ değişmez
--  - Realtime aynı kanaldan akar (filter task_id eq)
--  - Audit log / mention sistemi aynı kalır
--  - Hem görev hem hücre yorumları aynı sorguda alınabilir

-- 1) Kolon ekle (idempotent)
ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS field_key text;

-- 2) Kısa açıklayıcı yorum
COMMENT ON COLUMN public.task_comments.field_key IS
  'Hücre-bazlı yorum hedefi. NULL = görev seviyesi (eski). Dolu = belirli hücre, örn. "status", "due_date", "extra:Sicil No"';

-- 3) Tip kısıtlaması: anlamlı string veya NULL — boş string verilmesin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_comments_field_key_nonempty'
      AND conrelid = 'public.task_comments'::regclass
  ) THEN
    ALTER TABLE public.task_comments
      ADD CONSTRAINT task_comments_field_key_nonempty
      CHECK (field_key IS NULL OR length(trim(field_key)) > 0);
  END IF;
END $$;

-- 4) İndeks: belirli bir hücrenin yorumlarını çekme + sayım (yalnızca hücre yorumları)
CREATE INDEX IF NOT EXISTS task_comments_cell_idx
  ON public.task_comments (task_id, field_key, created_at DESC)
  WHERE field_key IS NOT NULL;

-- 5) Doğrulama (manuel kontrol için — comment'lı bırakılabilir)
-- SELECT field_key, COUNT(*) FROM public.task_comments GROUP BY field_key;
