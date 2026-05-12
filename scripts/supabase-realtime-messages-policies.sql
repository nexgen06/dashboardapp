-- Supabase: Realtime Authorization açıksa presence/broadcast için `realtime.messages`
-- üzerinde SELECT/INSERT izni gerekir; aksi halde kanal SUBSCRIBED olmaz veya sessizce hata verir.
-- Dashboard → SQL Editor ile bir kez uygulayın. Aynı isimde policy varsa önce DROP edin veya isimleri değiştirin.
--
-- Giriş yapmış kullanıcılar (JWT = authenticated):

CREATE POLICY "realtime_messages_select_authenticated"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "realtime_messages_insert_authenticated"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Demo / anon istemci (önerilmez, üretimde daraltın):
-- CREATE POLICY "realtime_messages_select_anon" ON realtime.messages FOR SELECT TO anon USING (true);
-- CREATE POLICY "realtime_messages_insert_anon" ON realtime.messages FOR INSERT TO anon WITH CHECK (true);
