import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type NotificationType =
  | "project_assigned"
  | "task_assigned"
  | "overdue"
  | "admin_team_done"
  | "chat_unread"
  | "announcement"
  | "automation"
  | "workflow";

export type WorkflowNotificationAction =
  | "submit"
  | "approve"
  | "request_revision"
  | "reject"
  | "unlock"
  | "unlock_request";

export type CentralNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string;
  count: number;
  source_table: string | null;
  source_id: string | null;
  source_key: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type NotificationUpsertInput = {
  type: NotificationType;
  title: string;
  body?: string | null;
  href: string;
  count?: number;
  sourceTable?: string | null;
  sourceId?: string | null;
  sourceKey: string;
  payload?: Record<string, unknown> | null;
  resetRead?: boolean;
};

function isMissingNotificationsTable(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return code === "42P01" || code === "42883" || message.includes("notifications") || message.includes("upsert_my_notifications");
}

export async function listMyNotifications(limit = 100): Promise<{ ok: true; data: CentralNotification[] } | { ok: false }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,title,body,href,count,source_table,source_id,source_key,payload,read_at,created_at,updated_at")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (!isMissingNotificationsTable(error)) console.warn("[notifications] list:", error.message);
    return { ok: false };
  }

  return { ok: true, data: (data ?? []) as CentralNotification[] };
}

export async function upsertMyNotifications(items: NotificationUpsertInput[]): Promise<boolean> {
  if (!isSupabaseConfigured() || items.length === 0) return false;
  const payload = items.map((item) => ({
    type: item.type,
    title: item.title,
    body: item.body ?? null,
    href: item.href,
    count: Math.max(1, Math.floor(Number(item.count ?? 1))),
    source_table: item.sourceTable ?? null,
    source_id: item.sourceId ?? null,
    source_key: item.sourceKey,
    payload: item.payload ?? {},
    reset_read: item.resetRead === true,
  }));

  const { error } = await supabase.rpc("upsert_my_notifications", { p_items: payload });
  if (error) {
    if (!isMissingNotificationsTable(error)) console.warn("[notifications] upsert:", error.message);
    return false;
  }
  return true;
}

export async function markAllMyNotificationsRead(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) {
    if (!isMissingNotificationsTable(error)) console.warn("[notifications] mark all read:", error.message);
    return false;
  }
  return true;
}

export async function markNotificationTypesRead(types: NotificationType[]): Promise<boolean> {
  if (!isSupabaseConfigured() || types.length === 0) return false;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("type", types)
    .is("read_at", null);
  if (error) {
    if (!isMissingNotificationsTable(error)) console.warn("[notifications] mark types read:", error.message);
    return false;
  }
  return true;
}

export type WorkflowNotifyResult = "ok" | "missing_rpc" | "error";

/**
 * Workflow (onay akışı) bildirimi üretir. Hedef alıcıları (PM/admin veya gönderen üye)
 * sunucu tarafındaki RPC seçer; istemci yalnızca aksiyon ve not bilgisini geçer.
 * Bildirim yazımı başarısız olursa workflow geçişini etkilemez.
 *
 * Dönüşler:
 *   - "ok"          → bildirim(ler) yazıldı
 *   - "missing_rpc" → migration uygulanmamış (RPC veya tablo yok); UI bunu sessizce yutmalı
 *   - "error"       → beklenmeyen hata; UI uyarı toast'ı gösterebilir
 */
export async function notifyWorkflowEvent(input: {
  taskId: string;
  action: WorkflowNotificationAction;
  toStatus: string;
  note?: string | null;
}): Promise<WorkflowNotifyResult> {
  if (!isSupabaseConfigured()) return "missing_rpc";
  const { error } = await supabase.rpc("create_workflow_notification", {
    p_task_id: input.taskId,
    p_action: input.action,
    p_to_status: input.toStatus,
    p_note: input.note?.trim() || null,
  });
  if (!error) return "ok";

  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  // 42883 = function not found, 42P01 = table not found
  if (
    code === "42883" ||
    code === "42P01" ||
    msg.includes("create_workflow_notification") ||
    msg.includes("does not exist")
  ) {
    console.info(
      "[notifications] workflow RPC bulunamadı — scripts/task-workflow-notifications.sql migration'ı Supabase'e uygulanmamış olabilir."
    );
    return "missing_rpc";
  }
  console.warn("[notifications] workflow:", error.message);
  return "error";
}

export async function markNotificationSourceRead(sourceKey: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !sourceKey.trim()) return false;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("source_key", sourceKey)
    .is("read_at", null);
  if (error) {
    if (!isMissingNotificationsTable(error)) console.warn("[notifications] mark source read:", error.message);
    return false;
  }
  return true;
}
