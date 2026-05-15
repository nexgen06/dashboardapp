/**
 * Supabase Auth kullanıcı profilleri: public.profiles (scripts/supabase-auth-profiles.sql)
 */

import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import type { RoleId } from "@/types/permissions";
import { coerceRoleId } from "@/lib/permissions";
import { pickMetadataDisplayName } from "@/lib/userDisplayName";

export type DirectoryUserProfile = {
  uid: string;
  email: string;
  displayName: string | null;
  roleId: RoleId;
  updatedAt?: string | null;
};

function mapRowToProfile(uid: string, row: Record<string, unknown>): DirectoryUserProfile {
  return {
    uid,
    email: String(row.email ?? ""),
    displayName: row.display_name != null ? String(row.display_name) : null,
    roleId: coerceRoleId(row.role_id),
    updatedAt: row.updated_at != null ? String(row.updated_at) : null,
  };
}

/**
 * Oturum açılmış kullanıcı için DB profilini okur; gerekiyorsa display_name'i günceller.
 *
 * Önemli: Rol (role_id) burada ASLA değiştirilmez. Admin atama yalnızca
 * sunucu tarafında (`scripts/seed-admin-roles.sql` veya `admin_set_role` RPC)
 * yapılır. İstemci kodu hiç bir kullanıcıyı admin olarak işaretleyemez.
 *
 * Profil yoksa `auth.users` INSERT trigger'ı tarafından oluşturulmuş olmalıdır
 * (`scripts/supabase-auto-create-profile.sql`). Yoksa varsayılan olarak
 * 'member' döner ve uyarı loglanır.
 */
export async function ensureSupabaseProfileAndRole(
  client: SupabaseClient,
  sbUser: SupabaseUser
): Promise<{ roleId: RoleId; profileDisplayName: string | null }> {
  const uid = sbUser.id;
  const email = (sbUser.email ?? "").trim();
  const metaName = pickMetadataDisplayName(sbUser.user_metadata as Record<string, unknown>);
  const display_name: string | null = metaName ?? null;

  const { data: existing, error: readErr } = await client
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (readErr) {
    console.warn("[supabaseProfiles] profiles read:", readErr);
  }

  if (existing == null) {
    // Trigger henüz çalışmamış olabilir (yeni hesap, replikasyon gecikmesi).
    // En kısıtlı rolle dön; sonraki oturum açma denemesinde DB'den okunur.
    console.warn("[supabaseProfiles] profil bulunamadı; member varsayılanıyla devam ediliyor (uid:", uid, ")");
    return { roleId: "member", profileDisplayName: display_name ?? (email || null) };
  }

  const row = existing as Record<string, unknown>;
  const dbRoleId = coerceRoleId(row.role_id);
  const existingDisplay = row.display_name != null ? String(row.display_name) : null;
  const desiredDisplayName = display_name ?? existingDisplay ?? (email || null);

  // Sadece display_name veya email değiştiyse güncelle; role_id'ye dokunma.
  if (existingDisplay !== desiredDisplayName || String(row.email ?? "") !== email) {
    const { error: upErr } = await client
      .from("profiles")
      .update({
        email,
        display_name: desiredDisplayName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", uid);
    if (upErr) {
      console.warn("[supabaseProfiles] profiles update:", upErr);
    }
  }

  return { roleId: dbRoleId, profileDisplayName: desiredDisplayName };
}

export async function listDirectoryUsers(client: SupabaseClient): Promise<DirectoryUserProfile[]> {
  const { data, error } = await client.from("profiles").select("*").order("updated_at", { ascending: false });
  if (error) {
    console.warn("[supabaseProfiles] listDirectoryUsers:", error);
    return [];
  }
  return (data ?? []).map((row) =>
    mapRowToProfile(String((row as { id: string }).id), row as Record<string, unknown>)
  );
}

export async function adminSetRoleForUid(client: SupabaseClient, targetUid: string, roleId: RoleId): Promise<void> {
  const { error } = await client.rpc("admin_set_role", { target_id: targetUid, new_role: roleId });
  if (error) throw error;
}
