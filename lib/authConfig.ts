import { isSupabaseConfigured } from "@/lib/supabaseClient";

export type AuthBackend = "supabase" | "demo";

export function getAuthBackend(): AuthBackend {
  if (isSupabaseConfigured()) return "supabase";
  return "demo";
}

/** Gerçek giriş (/giris) kullanılıyor mu */
export function isAuthEnabled(): boolean {
  return getAuthBackend() !== "demo";
}
