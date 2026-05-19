"use client";

import { supabase } from "@/lib/supabaseClient";

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  nickname: string | null;
  full_name: string | null;
  avatar_url: string | null;
  title: string | null;
  department: string | null;
  bio: string | null;
  timezone: string | null;
  role_id: string;
  updated_at: string;
};

export type EditableProfileFields = {
  nickname?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  title?: string | null;
  department?: string | null;
  bio?: string | null;
  timezone?: string | null;
};

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    display_name: row.display_name != null ? String(row.display_name) : null,
    nickname: row.nickname != null ? String(row.nickname) : null,
    full_name: row.full_name != null ? String(row.full_name) : null,
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : null,
    title: row.title != null ? String(row.title) : null,
    department: row.department != null ? String(row.department) : null,
    bio: row.bio != null ? String(row.bio) : null,
    timezone: row.timezone != null ? String(row.timezone) : null,
    role_id: String(row.role_id ?? "member"),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Mevcut kullanıcının profilini getirir. */
export async function getMyProfile(): Promise<UserProfile | null> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToProfile(data);
}

/** Profil güncelle — sadece izin verilen alanlar. */
export async function updateMyProfile(fields: EditableProfileFields): Promise<void> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) throw new Error("Oturum açık değil.");
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  // Sadece tanımlı alanları yaz (null geçerli — alanı temizleme demek)
  for (const k of [
    "nickname",
    "full_name",
    "avatar_url",
    "title",
    "department",
    "bio",
    "timezone",
  ] as const) {
    if (k in fields) {
      const v = fields[k];
      payload[k] = typeof v === "string" ? v.trim() || null : v;
    }
  }
  if (typeof payload.bio === "string" && (payload.bio as string).length > 200) {
    throw new Error("Bio en fazla 200 karakter olabilir.");
  }
  const { error } = await supabase.from("profiles").update(payload).eq("id", uid);
  if (error) throw error;
}

/**
 * Avatar yükle: `<user_id>/avatar-<timestamp>.<ext>` → public URL döner.
 * Bucket: "avatars" (public read, sahip yazar — Storage RLS).
 */
export async function uploadAvatar(file: File): Promise<string> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) throw new Error("Oturum açık değil.");
  if (!file.type.startsWith("image/")) {
    throw new Error("Sadece resim dosyası kabul edilir.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Dosya en fazla 5 MB olabilir.");
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${uid}/avatar-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  return urlData.publicUrl;
}

/** Bir grup user_id için profile sözlüğü (Görev atananlarını avatar ile göstermek için). */
export async function getProfilesByIds(ids: string[]): Promise<Map<string, UserProfile>> {
  const m = new Map<string, UserProfile>();
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return m;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", uniq);
  if (error) throw error;
  for (const row of data ?? []) {
    const p = rowToProfile(row as Record<string, unknown>);
    m.set(p.id, p);
  }
  return m;
}
