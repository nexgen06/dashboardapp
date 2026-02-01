-- Realtime: tasks ve projects tablolarını supabase_realtime publication'a ekler.
-- Birden fazla kullanıcının değişiklikleri sayfa yenilemeden yansır.
--
-- Çalıştırma: Supabase Dashboard > SQL Editor > bu dosyanın içeriğini yapıştır > Run

-- Tabloları publication'a ekle (zaten ekliyse hata alırsınız; yok sayabilirsiniz)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- Kontrol: Hangi tablolar Realtime'da?
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
