import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const LIVE_TABLE_DENSITY_KEY = "live_table_density";

/** `contexts/settings-context` ile aynı değer kümesi (döngüsel import önlenir). */
export type ServerLiveTableDensity = "compact" | "normal" | "comfortable";

function coerceLiveTableDensity(v: unknown): ServerLiveTableDensity {
  if (v === "compact" || v === "normal" || v === "comfortable") return v;
  return "normal";
}

/** Sunucudaki canlı tablo yoğunluğu (tüm üyeler ortak). */
export async function fetchLiveTableDensityFromServer(): Promise<ServerLiveTableDensity | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LIVE_TABLE_DENSITY_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[app_settings] fetch live_table_density:", error.message);
    return null;
  }
  if (!data?.value) return null;
  return coerceLiveTableDensity(data.value);
}

/** Yoğunluk değişince tüm istemcilerde güncellenmesi için (RLS: giriş yapmış kullanıcı). */
export async function persistLiveTableDensityToServer(density: ServerLiveTableDensity): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session) return false;
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LIVE_TABLE_DENSITY_KEY,
      value: density,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) {
    console.warn("[app_settings] upsert live_table_density:", error.message);
    return false;
  }
  return true;
}

export const LIVE_TABLE_DENSITY_APP_SETTINGS_KEY = LIVE_TABLE_DENSITY_KEY;
