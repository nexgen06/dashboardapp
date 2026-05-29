import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type NotificationPhase2Status = {
  enqueue_notification: boolean;
  project_trigger: boolean;
  task_trigger: boolean;
  refresh_overdue_fn: boolean;
};

export function isNotificationPhase2Active(status: NotificationPhase2Status | null | undefined): boolean {
  if (!status) return false;
  return (
    status.enqueue_notification === true &&
    status.project_trigger === true &&
    status.task_trigger === true &&
    status.refresh_overdue_fn === true
  );
}

function parsePhase2Status(raw: unknown): NotificationPhase2Status | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    enqueue_notification: o.enqueue_notification === true,
    project_trigger: o.project_trigger === true,
    task_trigger: o.task_trigger === true,
    refresh_overdue_fn: o.refresh_overdue_fn === true,
  };
}

/** Bildirim Faz 2 sunucu tetikleyicileri kurulu mu? RPC yoksa null döner. */
export async function fetchNotificationPhase2Status(): Promise<NotificationPhase2Status | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.rpc("notification_phase2_status");
  if (error) {
    const code = String(error.code ?? "");
    const msg = String(error.message ?? "").toLowerCase();
    if (code === "42883" || msg.includes("notification_phase2_status")) {
      return null;
    }
    console.warn("[notifications] phase2 status:", error.message);
    return null;
  }
  return parsePhase2Status(data);
}

export const ASSIGNMENT_NOTIFICATION_TYPES = new Set([
  "project_assigned",
  "task_assigned",
  "overdue",
]);

export function shouldToastCentralNotification(row: {
  type?: string;
  read_at?: string | null;
}): boolean {
  const type = String(row.type ?? "");
  if (!ASSIGNMENT_NOTIFICATION_TYPES.has(type)) return false;
  return row.read_at == null;
}

/** Aynı bildirimin tekrar toast göstermemesi için (UPSERT / poll yedeği). */
export function notificationToastDedupKey(row: {
  source_key?: string | null;
  id?: string | null;
  updated_at?: string | null;
}): string {
  const sourceKey = String(row.source_key ?? row.id ?? "").trim();
  const updatedAt = String(row.updated_at ?? "").trim();
  return `${sourceKey}::${updatedAt || "0"}`;
}

export type AssignmentToastInput = {
  type?: string;
  title?: string;
  body?: string | null;
  read_at?: string | null;
  source_key?: string | null;
  id?: string | null;
  updated_at?: string | null;
};

/**
 * Yeni atama/gecikme bildirimleri için toast üretir.
 * İlk çağrıda mevcut okunmamışları sessizce işaretler (sayfa açılışında spam yok).
 */
export function collectAssignmentToasts(
  rows: AssignmentToastInput[],
  state: { baselineReady: boolean; seenKeys: Set<string> }
): { toToast: AssignmentToastInput[]; baselineReady: boolean } {
  const toToast: AssignmentToastInput[] = [];
  let baselineReady = state.baselineReady;

  for (const row of rows) {
    if (!shouldToastCentralNotification(row)) continue;
    const key = notificationToastDedupKey(row);
    if (!baselineReady) {
      state.seenKeys.add(key);
      continue;
    }
    if (state.seenKeys.has(key)) continue;
    state.seenKeys.add(key);
    toToast.push(row);
  }

  if (!state.baselineReady) {
    baselineReady = true;
  }

  return { toToast, baselineReady };
}
