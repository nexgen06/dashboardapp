import { getTaskDueDate } from "@/lib/dueUrgency";
import { isStatusDone } from "@/lib/statusKind";
import type { Task } from "@/types/tasks";

export const ME_LABEL = "Ben";

export type DateFilterKind = "all" | "week" | "month" | "overdue";

/** Katı RLS için DB'de e-posta tutulur; arayüzde kendi satırında "Ben" gösterilir. */
export function formatAssigneeForDisplay(
  assignee: string | null | undefined,
  viewerEmail: string
): string {
  const a = assignee?.trim() ?? "";
  if (!a) return "—";
  const v = viewerEmail.trim().toLowerCase();
  if (v && a.toLowerCase() === v) return ME_LABEL;
  return a;
}

/** Katı modda atananda "Ben" yerine oturum e-postası yazılır (RLS eşleşmesi). */
export function assigneeValueForDatabase(
  strictAssigneeVisibility: boolean | undefined,
  formValue: string,
  viewerEmail: string
): string | null {
  const t = formValue.trim();
  if (!t) return null;
  if (!strictAssigneeVisibility) return t;
  if (t === ME_LABEL) {
    const e = viewerEmail.trim().toLowerCase();
    return e || null;
  }
  return t;
}

export function isOverdueDueDate(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today && String(dueDate).trim() !== "";
}

export function inDateRange(dueDate: string | null | undefined, kind: DateFilterKind): boolean {
  if (!dueDate || kind === "all") return true;
  const d = new Date(dueDate);
  const now = new Date();
  if (kind === "overdue") return isOverdueDueDate(dueDate);
  if (kind === "week") {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= now && d <= weekEnd;
  }
  if (kind === "month") {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return d >= now && d <= monthEnd;
  }
  return true;
}

export function isTaskOverdue(task: Task): boolean {
  const due = getTaskDueDate(task);
  if (!due || isStatusDone(task.status)) return false;
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  return due.getTime() < t0.getTime();
}

export type ProjectTaskFilters = {
  assignee: string;
  status: string;
  date: DateFilterKind;
};

/** Görevler sekmesi filtreleri — atanan, durum, tarih/gecikmiş. */
export function filterProjectTasks(tasks: Task[], filters: ProjectTaskFilters): Task[] {
  return tasks.filter((task) => {
    if (filters.assignee === "__unassigned__") {
      if (task.assignee?.trim()) return false;
    } else if (filters.assignee !== "all" && (task.assignee?.trim() ?? "") !== filters.assignee) {
      return false;
    }
    if (filters.status !== "all" && task.status !== filters.status) return false;
    if (filters.date === "overdue") {
      if (!isTaskOverdue(task)) return false;
    } else if (!inDateRange(task.due_date, filters.date)) {
      return false;
    }
    return true;
  });
}

export function sortTasksByUpdatedDesc(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bt - at;
  });
}
