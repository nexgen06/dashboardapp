"use client";

import { supabase } from "@/lib/supabaseClient";

export type PiiAccessAction = "copy" | "unmask" | "export";

export type PiiAccessLogEntry = {
  id: string;
  user_id: string | null;
  user_email: string;
  action: PiiAccessAction;
  field_name: string;
  record_id: string | null;
  record_count: number;
  at: string;
};

function rowToEntry(row: Record<string, unknown>): PiiAccessLogEntry {
  return {
    id: String(row.id),
    user_id: row.user_id != null ? String(row.user_id) : null,
    user_email: String(row.user_email ?? ""),
    action: (row.action ?? "copy") as PiiAccessAction,
    field_name: String(row.field_name ?? ""),
    record_id: row.record_id != null ? String(row.record_id) : null,
    record_count: Number(row.record_count ?? 1),
    at: String(row.at ?? ""),
  };
}

/**
 * PII erişimi kaydet. Best-effort: bir kayıt başarısız olursa kullanıcının
 * eylemini engellemiyor (try/catch ile yutar, console'a yazar).
 */
export async function logPiiAccess(input: {
  userEmail: string;
  action: PiiAccessAction;
  fieldName: string;
  recordId?: string | null;
  recordCount?: number;
}): Promise<void> {
  try {
    const { data: authUser } = await supabase.auth.getUser();
    const uid = authUser?.user?.id;
    if (!uid) return; // oturum yoksa log atma
    await supabase.from("pii_access_log").insert({
      user_id: uid,
      user_email: input.userEmail.trim().toLowerCase(),
      action: input.action,
      field_name: input.fieldName.trim(),
      record_id: input.recordId ?? null,
      record_count: input.recordCount ?? 1,
    });
  } catch (e) {
    // Sessizce başarısız (denetim olayını engellemesin)
    if (typeof console !== "undefined") {
      console.warn("[piiAccessLog] insert failed", e);
    }
  }
}

/**
 * Son N saatte kullanıcının kaç PII erişimi yaptığını döner.
 * Rate limit kontrolü için kullanılır.
 */
export async function countPiiAccessLastHour(
  userId: string,
  action?: PiiAccessAction
): Promise<number> {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let query = supabase
      .from("pii_access_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("at", since);
    if (action) query = query.eq("action", action);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch {
    // Sayım başarısızsa rate limit'i devre dışı say (eylem geçer)
    return 0;
  }
}

/**
 * Admin viewer için liste — filtreli son 500.
 */
export async function listPiiAccessLog(filters?: {
  userId?: string | null;
  action?: PiiAccessAction | null;
  since?: string | null; // ISO
  limit?: number;
}): Promise<PiiAccessLogEntry[]> {
  let query = supabase
    .from("pii_access_log")
    .select("*")
    .order("at", { ascending: false });
  if (filters?.userId) query = query.eq("user_id", filters.userId);
  if (filters?.action) query = query.eq("action", filters.action);
  if (filters?.since) query = query.gte("at", filters.since);
  query = query.limit(filters?.limit ?? 500);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}
