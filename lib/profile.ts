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
 * Avatar yükle — Next.js API route üzerinden (server-side proxy).
 *
 * Önceden doğrudan Supabase Storage'a upload yapılıyordu, ama Storage RLS
 * `auth.uid()`'yi context'inde tam okuyamadığı için sıkı sahibe-özel policy
 * çalıştırılamıyordu. Bu nedenle upload artık `/api/avatar/upload` üzerinden:
 *  - Server JWT'yi anon-key client ile doğrular
 *  - MIME + boyut kontrolünü server-side yapar
 *  - Service-role client ile <user_id>/avatar-<ts>.<ext> yoluna yükler
 *  - Eski avatar dosyalarını otomatik temizler
 *  - profiles.avatar_url'i de günceller
 */
export async function uploadAvatar(file: File): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("Oturum açık değil.");

  if (!file.type.startsWith("image/")) {
    throw new Error("Sadece resim dosyası kabul edilir.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Dosya en fazla 5 MB olabilir.");
  }

  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/avatar/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    let msg = "Yükleme başarısız.";
    try {
      const body = await res.json();
      if (body?.error) msg = String(body.error);
    } catch {
      // body parse hatası — varsayılan mesaj
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as { url: string };
  if (!data?.url) throw new Error("Sunucu URL döndürmedi.");
  return data.url;
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
