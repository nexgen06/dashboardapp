-- Projelere atanan kullanıcı e-postaları (çoklu). Yeni proje eklerken "Atanan kullanıcılar" alanını kullanmadan önce Supabase SQL Editor'da bu script'i çalıştırın.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS assigned_emails text[] DEFAULT '{}';

COMMENT ON COLUMN public.projects.assigned_emails IS 'Bu projede çalışabilecek kullanıcıların e-posta adresleri. Oturum açan kullanıcı bu listede ise projeyi açıp canlı tablo verisiyle çalışabilir.';
