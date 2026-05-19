"use client";

import { supabase } from "@/lib/supabaseClient";

export type FeedbackType = "suggestion" | "bug" | "question" | "other";
export type FeedbackStatus = "new" | "reviewing" | "planned" | "done" | "wontfix";
export type FeedbackPriority = "low" | "medium" | "high";

export type Feedback = {
  id: string;
  user_id: string;
  user_email: string;
  type: FeedbackType;
  title: string;
  body: string;
  page_url: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToFeedback(row: Record<string, unknown>): Feedback {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    user_email: String(row.user_email ?? ""),
    type: (row.type ?? "suggestion") as FeedbackType,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    page_url: row.page_url != null ? String(row.page_url) : null,
    user_agent: row.user_agent != null ? String(row.user_agent) : null,
    status: (row.status ?? "new") as FeedbackStatus,
    priority:
      row.priority === "low" || row.priority === "medium" || row.priority === "high"
        ? (row.priority as FeedbackPriority)
        : null,
    admin_notes: row.admin_notes != null ? String(row.admin_notes) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function submitFeedback(input: {
  type: FeedbackType;
  title: string;
  body: string;
  pageUrl?: string | null;
  userAgent?: string | null;
}): Promise<Feedback> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  const email = authUser?.user?.email ?? "";
  if (!uid) throw new Error("Oturum açık değil.");
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw new Error("Başlık boş olamaz.");
  if (!body) throw new Error("Açıklama boş olamaz.");
  if (title.length > 100) throw new Error("Başlık en fazla 100 karakter.");
  if (body.length > 2000) throw new Error("Açıklama en fazla 2000 karakter.");

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      user_id: uid,
      user_email: email.trim().toLowerCase(),
      type: input.type,
      title,
      body,
      page_url: input.pageUrl ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToFeedback(data);
}

export async function listMyFeedback(): Promise<Feedback[]> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToFeedback);
}

export async function listAllFeedback(filters?: {
  status?: FeedbackStatus | null;
  type?: FeedbackType | null;
  limit?: number;
}): Promise<Feedback[]> {
  let query = supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.type) query = query.eq("type", filters.type);
  query = query.limit(filters?.limit ?? 500);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToFeedback);
}

/** Admin: status / priority / admin_notes günceller. */
export async function updateFeedback(
  id: string,
  patch: Partial<Pick<Feedback, "status" | "priority" | "admin_notes">>
): Promise<void> {
  const updateRow: Record<string, unknown> = {};
  if (patch.status !== undefined) updateRow.status = patch.status;
  if (patch.priority !== undefined) updateRow.priority = patch.priority ?? null;
  if (patch.admin_notes !== undefined) updateRow.admin_notes = patch.admin_notes;
  const { error } = await supabase.from("feedback").update(updateRow).eq("id", id);
  if (error) throw error;
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) throw error;
}

/** Admin için "yeni" sayısı — sidebar rozet'ında kullanılır. */
export async function countNewFeedback(): Promise<number> {
  const { count, error } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}
