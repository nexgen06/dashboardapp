"use client";

import { supabase } from "@/lib/supabaseClient";

export type Announcement = {
  id: string;
  author_id: string;
  author_email: string;
  title: string;
  body: string;
  pinned: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: String(row.id),
    author_id: String(row.author_id ?? ""),
    author_email: String(row.author_email ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    pinned: row.pinned === true,
    expires_at: row.expires_at != null ? String(row.expires_at) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Aktif (expire olmamış) duyurular — pinli üstte, sonra tarih azalan. */
export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToAnnouncement);
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
  pinned?: boolean;
  expiresAt?: string | null;
}): Promise<Announcement> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  const email = authUser?.user?.email ?? "";
  if (!uid) throw new Error("Oturum açık değil.");
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      author_id: uid,
      author_email: email.trim().toLowerCase(),
      title: input.title.trim(),
      body: input.body.trim(),
      pinned: input.pinned ?? false,
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToAnnouncement(data);
}

export async function updateAnnouncement(
  id: string,
  patch: Partial<Pick<Announcement, "title" | "body" | "pinned" | "expires_at">>
): Promise<void> {
  const updateRow: Record<string, unknown> = {};
  if (patch.title !== undefined) updateRow.title = patch.title.trim();
  if (patch.body !== undefined) updateRow.body = patch.body.trim();
  if (patch.pinned !== undefined) updateRow.pinned = patch.pinned;
  if (patch.expires_at !== undefined) updateRow.expires_at = patch.expires_at ?? null;
  const { error } = await supabase.from("announcements").update(updateRow).eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

/** Kullanıcının okuduğu duyuru id'leri (Set). */
export async function getMyReadAnnouncementIds(): Promise<Set<string>> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) return new Set();
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("reader_id", uid);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String((r as Record<string, unknown>).announcement_id)));
}

/** Duyurunun "okundu" işaretini ata (idempotent). */
export async function markAnnouncementRead(announcementId: string): Promise<void> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) return;
  // Upsert: tekrar yazarsa hata vermez
  const { error } = await supabase
    .from("announcement_reads")
    .upsert({ announcement_id: announcementId, reader_id: uid }, { onConflict: "announcement_id,reader_id" });
  if (error && error.code !== "23505") {
    // Unique violation dışında bir hata varsa logla
    if (typeof console !== "undefined") console.warn("[announcements] markRead failed", error);
  }
}

/** Toplu okundu: tüm aktif duyuruları işaretler. */
export async function markAllAnnouncementsRead(announcements: Announcement[]): Promise<void> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid || announcements.length === 0) return;
  const rows = announcements.map((a) => ({
    announcement_id: a.id,
    reader_id: uid,
  }));
  const { error } = await supabase
    .from("announcement_reads")
    .upsert(rows, { onConflict: "announcement_id,reader_id" });
  if (error) {
    if (typeof console !== "undefined") console.warn("[announcements] markAllRead failed", error);
  }
}

/** Bir duyuruyu kaç farklı kullanıcı okudu (admin viewer için). */
export async function getReadCount(announcementId: string): Promise<number> {
  const { count, error } = await supabase
    .from("announcement_reads")
    .select("reader_id", { count: "exact", head: true })
    .eq("announcement_id", announcementId);
  if (error) throw error;
  return count ?? 0;
}
