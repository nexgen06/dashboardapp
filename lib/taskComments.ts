"use client";

import { supabase } from "@/lib/supabaseClient";

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  user_email: string;
  user_display_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

function rowToComment(row: Record<string, unknown>): TaskComment {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    user_id: String(row.user_id),
    user_email: String(row.user_email ?? ""),
    user_display_name:
      row.user_display_name != null && String(row.user_display_name).trim() !== ""
        ? String(row.user_display_name)
        : null,
    body: String(row.body ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Bir görevin yorumlarını eskiden yeniye sıralı listeler. */
export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToComment);
}

export async function createTaskComment(input: {
  taskId: string;
  body: string;
  userEmail: string;
  userDisplayName?: string | null;
}): Promise<TaskComment> {
  const body = input.body.trim();
  if (!body) throw new Error("Yorum boş olamaz.");
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) throw new Error("Oturum açık değil.");
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: input.taskId,
      user_id: uid,
      user_email: input.userEmail.trim().toLowerCase(),
      user_display_name: input.userDisplayName ?? null,
      body,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToComment(data);
}

export async function updateTaskComment(id: string, body: string): Promise<void> {
  const b = body.trim();
  if (!b) throw new Error("Yorum boş olamaz.");
  const { error } = await supabase
    .from("task_comments")
    .update({ body: b })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTaskComment(id: string): Promise<void> {
  const { error } = await supabase.from("task_comments").delete().eq("id", id);
  if (error) throw error;
}
