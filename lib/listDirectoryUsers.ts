import { getAuthBackend } from "@/lib/authConfig";
import { listUsers as listFirestoreUsers, type FirestoreUserProfile } from "@/lib/firestoreUsers";
import { listDirectoryUsers as listSupabaseDirectory } from "@/lib/supabaseProfiles";
import { supabase } from "@/lib/supabaseClient";

export type { FirestoreUserProfile };

/** Kullanıcı yetkileri sayfası: Supabase profiles veya Firestore users */
export async function listDirectoryUsers(): Promise<FirestoreUserProfile[]> {
  const backend = getAuthBackend();
  if (backend === "supabase") {
    const rows = await listSupabaseDirectory(supabase);
    return rows.map((r) => ({
      uid: r.uid,
      email: r.email,
      displayName: r.displayName,
      roleId: r.roleId,
      updatedAt: r.updatedAt,
    }));
  }
  if (backend === "firebase") {
    return listFirestoreUsers();
  }
  return [];
}
