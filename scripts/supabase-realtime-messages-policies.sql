DROP POLICY IF EXISTS realtime_messages_select_authenticated ON realtime.messages;
DROP POLICY IF EXISTS realtime_messages_insert_authenticated ON realtime.messages;

CREATE POLICY realtime_messages_select_authenticated ON realtime.messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY realtime_messages_insert_authenticated ON realtime.messages
  FOR INSERT TO authenticated WITH CHECK (true);
