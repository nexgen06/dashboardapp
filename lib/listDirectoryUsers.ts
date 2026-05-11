import { getAuthBackend } from "@/lib/authConfig";
import { listDirectoryUsers as listFromSupabase, type DirectoryUserProfile } from "@/lib/supabaseProfiles";
import { supabase } from "@/lib/supabaseClient";

export type { DirectoryUserProfile };

/** Profil dizini — yalnızca Supabase `profiles`; demo modda boş liste. */
export async function listDirectoryUsers(): Promise<DirectoryUserProfile[]> {
  if (getAuthBackend() !== "supabase") return [];
  return listFromSupabase(supabase);
}
