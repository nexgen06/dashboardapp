import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Task } from "@/types/tasks";

export type TaskWorkflowStatus = NonNullable<Task["workflow_status"]>;

export const WORKFLOW_STATUS_LABELS: Record<TaskWorkflowStatus, string> = {
  draft: "Taslak",
  submitted: "Kontrol bekliyor",
  revision_requested: "Revize istendi",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

export const WORKFLOW_STATUS_CLASS: Record<TaskWorkflowStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700 dark:!border-slate-500/70 dark:!bg-slate-800 dark:!text-slate-100 dark:shadow-[0_0_0_1px_rgba(148,163,184,0.16)]",
  submitted: "border-blue-200 bg-blue-50 text-blue-800 dark:!border-blue-400/75 dark:!bg-blue-950 dark:!text-blue-100 dark:shadow-[0_0_0_1px_rgba(96,165,250,0.18)]",
  revision_requested: "border-amber-200 bg-amber-50 text-amber-900 dark:!border-amber-400/80 dark:!bg-amber-950 dark:!text-amber-100 dark:shadow-[0_0_0_1px_rgba(251,191,36,0.2)]",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:!border-emerald-400/90 dark:!bg-emerald-900 dark:!text-emerald-50 dark:shadow-[0_0_0_1px_rgba(52,211,153,0.28),0_0_16px_rgba(16,185,129,0.18)]",
  rejected: "border-red-200 bg-red-50 text-red-800 dark:!border-red-400/80 dark:!bg-red-950 dark:!text-red-100 dark:shadow-[0_0_0_1px_rgba(248,113,113,0.2)]",
};

export type TaskWorkflowAction = "submit" | "approve" | "request_revision" | "reject" | "reset" | "unlock" | "unlock_request";

export const WORKFLOW_ACTION_LABELS: Record<TaskWorkflowAction, string> = {
  submit: "Kontrole gönder",
  approve: "Onayla",
  request_revision: "Revize iste",
  reject: "Reddet",
  reset: "Taslağa al",
  unlock: "Kilidi aç",
  unlock_request: "Kilit açma talep et",
};

export function normalizeWorkflowStatus(status: Task["workflow_status"]): TaskWorkflowStatus {
  return status ?? "draft";
}

export function nextWorkflowStatus(action: TaskWorkflowAction): TaskWorkflowStatus {
  if (action === "submit") return "submitted";
  if (action === "approve") return "approved";
  if (action === "request_revision") return "revision_requested";
  if (action === "reject") return "rejected";
  // reset, unlock → draft
  return "draft";
}

/**
 * Görev satırı, mevcut kullanıcı için (workflow onay sonrası) kilitli mi?
 * Kilitli = proje workflow + lock_on_approval açık + status 'approved' +
 *           kullanıcı yetkili değil (review yetkisi yok).
 */
export function isTaskLockedForUser(input: {
  workflowStatus: TaskWorkflowStatus;
  projectWorkflowEnabled: boolean;
  projectLockOnApproval: boolean;
  isReviewer: boolean;
}): boolean {
  if (!input.projectWorkflowEnabled) return false;
  if (!input.projectLockOnApproval) return false;
  if (input.workflowStatus !== "approved") return false;
  if (input.isReviewer) return false;
  return true;
}

export async function logTaskWorkflowEvent(input: {
  taskId: string;
  projectId?: string | null;
  fromStatus?: TaskWorkflowStatus | null;
  toStatus: TaskWorkflowStatus;
  action: TaskWorkflowAction;
  actorEmail?: string | null;
  note?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("task_workflow_events").insert({
    task_id: input.taskId,
    project_id: input.projectId ?? null,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus,
    action: input.action,
    actor_id: auth.user?.id ?? null,
    actor_email: input.actorEmail?.trim().toLowerCase() || auth.user?.email?.trim().toLowerCase() || null,
    note: input.note?.trim() || null,
  });
  if (error && error.code !== "42P01") {
    console.warn("[task workflow] event insert:", error.message);
  }
}
