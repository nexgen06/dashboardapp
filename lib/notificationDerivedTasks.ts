import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  filterTasksAssignedToEmail,
  normalizeNotificationEmail,
  type NotificationTaskHint,
} from "@/lib/notificationDerivedHelpers";

function mapRow(row: Record<string, unknown>): NotificationTaskHint {
  return {
    id: String(row.id),
    content: String(row.content ?? ""),
    assignee: row.assignee != null ? String(row.assignee) : null,
    due_date: row.due_date != null ? String(row.due_date) : null,
    project_id: row.project_id != null ? String(row.project_id) : null,
  };
}

/** Bildirim türetimi için yalnızca kullanıcıya atanmış görevleri çeker (tam tasks listesi değil). */
export async function fetchNotificationTaskHints(assigneeEmail: string): Promise<NotificationTaskHint[]> {
  const email = normalizeNotificationEmail(assigneeEmail);
  if (!email || !isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("id, content, assignee, due_date, project_id")
    .ilike("assignee", email);

  if (error) {
    console.warn("[notificationDerivedTasks] fetch:", error.message);
    return [];
  }

  return filterTasksAssignedToEmail((data ?? []).map(mapRow), email);
}
