import { isFirebaseConfigured } from "@/lib/firebase";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

/** Öncelik: Supabase Auth → Firebase Auth → demo kullanıcı */
export type AuthBackend = "supabase" | "firebase" | "demo";

export function getAuthBackend(): AuthBackend {
  if (isSupabaseConfigured()) return "supabase";
  if (isFirebaseConfigured()) return "firebase";
  return "demo";
}

/** Gerçek giriş (/giris) kullanılıyor mu */
export function isAuthEnabled(): boolean {
  return getAuthBackend() !== "demo";
}
