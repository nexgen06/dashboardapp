import { isSupabaseConfigured } from "@/lib/supabaseClient";

export type AuthBackend = "supabase" | "demo";

/** Yerel geliştirme: .env.local içinde NEXT_PUBLIC_ALLOW_DEMO_MODE=true */
function isDemoModeExplicitlyAllowed(): boolean {
  const v = (process.env.NEXT_PUBLIC_ALLOW_DEMO_MODE ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function getAuthBackend(): AuthBackend {
  if (isSupabaseConfigured()) return "supabase";
  if (isDemoModeExplicitlyAllowed()) return "demo";
  /* Üretimde Supabase env eksikse demo'ya düşme; oturum zorunlu kalır, giriş yapılandırma hatası verir. */
  return "supabase";
}

/** Gerçek giriş (/giris) kullanılıyor mu */
export function isAuthEnabled(): boolean {
  return getAuthBackend() !== "demo";
}
