-- ================================================================
-- realtime.messages — Broadcast / Presence kanalları için RLS
-- ================================================================
-- NOT (Faz 1.4): postgres_changes kanallarına `config.private = true`
-- eklendiğinde Supabase, kaynak tablonun (tasks, projects, vb.) RLS
-- politikalarını payload başına otomatik uygular — bu durumda
-- realtime.messages politikalarına gerek YOKTUR.
--
-- Aşağıdaki politikalar yalnızca `broadcast` ve `presence` tipi
-- kanallar için geçerlidir (usePresence, useProjectPresence,
-- useProjectChatRoom). Şu an her authenticated kullanıcı tüm
-- broadcast/presence kanallarına okuma/yazma yapabilir.
--
-- İLERİ PLAN (faz 1.4 sonrası takibi):
--   1) Bu kanalları da `config.private = true` ile aç
--   2) Aşağıdaki politikaları topic-aware yap. Örnek desen:
--      USING (
--        -- presence-project-<uuid> formatındaki topiclerde,
--        -- kullanıcının projeye erişim yetkisi olmalı:
--        (split_part(realtime.topic(), '-', 1) <> 'presence-project'
--         OR public.user_has_project_access_by_id(
--              split_part(realtime.topic(), '-', 3)::uuid))
--      )
--   3) Demo modu / anon kullanıcılar için fallback davranışını test et.
-- ================================================================

DROP POLICY IF EXISTS realtime_messages_select_authenticated ON realtime.messages;
DROP POLICY IF EXISTS realtime_messages_insert_authenticated ON realtime.messages;

CREATE POLICY realtime_messages_select_authenticated ON realtime.messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY realtime_messages_insert_authenticated ON realtime.messages
  FOR INSERT TO authenticated WITH CHECK (true);
