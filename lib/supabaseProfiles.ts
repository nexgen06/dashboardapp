/**
 * Supabase Auth kullanıcı profilleri: public.profiles (scripts/supabase-auth-profiles.sql)
 */

import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import type { RoleId } from "@/types/permissions";
import { coerceRoleId } from "@/lib/permissions";
import { getFullAdminEmailSet } from "@/lib/full-admin-emails";

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

/** Oturum açılmış kullanıcı için profili oluşturur/günceller ve efektif rolü döndürür */
export async function ensureSupabaseProfileAndRole(client: SupabaseClient, sbUser: SupabaseUser): Promise<RoleId> {
  const uid = sbUser.id;
  const email = (sbUser.email ?? "").trim();
  const lower = email.toLowerCase();
  const displayName =
    typeof sbUser.user_metadata?.full_name === "string"
      ? (sbUser.user_metadata.full_name as string)
      : sbUser.email ?? null;

  const fullAdmins = getFullAdminEmailSet();

  const { data: existing, error: readErr } = await client
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (readErr) {
    console.warn("[supabaseProfiles] profiles read:", readErr);
  }

  const prev = existing != null ? coerceRoleId((existing as Record<string, unknown>).role_id) : null;
  const existingDisplay =
    existing != null && (existing as { display_name?: string | null }).display_name != null
      ? String((existing as { display_name?: string | null }).display_name)
      : null;

  const roleId: RoleId = fullAdmins.has(lower) ? "admin" : prev ?? "member";

  const payload = {
    id: uid,
    email,
    display_name: displayName ?? existingDisplay ?? null,
    role_id: roleId,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await client.from("profiles").upsert(payload, { onConflict: "id" });

  if (upErr) {
    console.warn("[supabaseProfiles] profiles upsert:", upErr);
    return coerceRoleId(roleId);
  }

  return coerceRoleId(roleId);
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
