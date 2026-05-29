import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Anon ile Auth + Postgres (profiles); URL ve anon key eksik/geçersizse false */
export function isSupabaseConfigured(): boolean {
  const url = supabaseUrl.trim();
  const key = supabaseAnonKey.trim();
  const urlOk =
    (/^https:\/\/.+\.supabase\.co\/?$/i.test(url) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(url)) &&
    !/your-project\.supabase\.co|placeholder\.supabase\.co/i.test(url);
  const keyOk =
    key.length >= 20 && key !== "placeholder-anon-key" && key !== "your-anon-key";
  return urlOk && keyOk;
}

function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== "undefined") {
      console.error(
        "[Supabase] NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı. Railway: Service → Variables."
      );
    }
    return createClient(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseAnonKey || "placeholder-anon-key"
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = getSupabase();
