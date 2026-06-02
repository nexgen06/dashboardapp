"use client";

import { supabase } from "@/lib/supabaseClient";

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  user_email: string;
  user_display_name: string | null;
  body: string;
  /**
   * Hücre-bazlı yorum hedefi.
   * - null  → görev seviyesi yorum (TaskDetailSheet Yorumlar sekmesi)
   * - string → belirli hücre, örn. "status", "due_date", "extra:Sicil No"
   *
   * Konvansiyon: tablo column id'leri (TanStack column.id) ile birebir aynı.
   * Extra alanlar `extra:` prefix'i ile (useTasksTableColumns kullanır).
   */
  field_key: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Listeleme/filtre seçenekleri.
 *  - "task"  → sadece görev seviyesi (field_key IS NULL) — eski davranış
 *  - "all"   → tümü (görev + hücre)
 *  - string  → belirli hücre (field_key = X)
 */
export type CommentScope = "task" | "all" | { fieldKey: string };

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
    field_key:
      row.field_key != null && String(row.field_key).trim() !== ""
        ? String(row.field_key)
        : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/**
 * Bir görevin yorumlarını eskiden yeniye sıralı listeler.
 *
 * @param taskId Hedef görev
 * @param scope Hangi tip yorumlar — varsayılan "task" (görev seviyesi, geriye dönük uyum)
 */
export async function listTaskComments(
  taskId: string,
  scope: CommentScope = "task"
): Promise<TaskComment[]> {
  let q = supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (scope === "task") {
    q = q.is("field_key", null);
  } else if (typeof scope === "object" && scope.fieldKey) {
    q = q.eq("field_key", scope.fieldKey);
  }
  // scope === "all" → filtre yok

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToComment);
}

/**
 * BİR çoklu görev için hücre yorumlarını agg eder — tek sorguda.
 * Tablodaki visible satırların hepsi için badge sayımları toplu çekmek için.
 *
 * @returns Record<taskId, Record<fieldKey, count>>
 */
export async function listAllCellCommentCounts(
  taskIds: string[]
): Promise<Record<string, Record<string, number>>> {
  if (!taskIds || taskIds.length === 0) return {};
  const { data, error } = await supabase
    .from("task_comments")
    .select("task_id, field_key")
    .in("task_id", taskIds)
    .not("field_key", "is", null);
  if (error) throw error;
  const out: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    const t = row.task_id != null ? String(row.task_id) : null;
    const k = row.field_key != null ? String(row.field_key) : null;
    if (!t || !k) continue;
    if (!out[t]) out[t] = {};
    out[t][k] = (out[t][k] ?? 0) + 1;
  }
  return out;
}

/**
 * Bir görevin tüm hücre yorumlarını field_key bazlı sayar.
 * Tablodaki hücre rozetleri için kullanılır (örn. "extra:Sicil No" üzerinde 💬 2).
 *
 * @returns Record<fieldKey, count> — sadece field_key IS NOT NULL satırlar dahil
 */
export async function listCellCommentCounts(
  taskId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("task_comments")
    .select("field_key")
    .eq("task_id", taskId)
    .not("field_key", "is", null);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const k = row.field_key != null ? String(row.field_key) : null;
    if (!k) continue;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export async function createTaskComment(input: {
  taskId: string;
  body: string;
  userEmail: string;
  userDisplayName?: string | null;
  /** Hücre yorumu için doldurulur; görev seviyesi yorumda omit/undefined/null */
  fieldKey?: string | null;
}): Promise<TaskComment> {
  const body = input.body.trim();
  if (!body) throw new Error("Yorum boş olamaz.");
  const fieldKey = input.fieldKey?.trim() || null;
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
      field_key: fieldKey,
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
