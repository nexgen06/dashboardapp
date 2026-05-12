import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase aynı `topic` ile mevcut RealtimeChannel döndürür; subscribe sonrası .on() hatasını önlemek için önce listedekileri kaldırın. */
export async function removeRealtimeChannelsByTopic (
  client: SupabaseClient,
  topicWithoutRealtimePrefix: string
): Promise<void> {
  const fullTopic = `realtime:${topicWithoutRealtimePrefix}`;
  const stale = client.getChannels().filter((c) => c.topic === fullTopic);
  for (const ch of stale) {
    await client.removeChannel(ch);
  }
}
