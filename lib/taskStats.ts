/**
 * Görev durumu sınıflandırma ve atanan bazlı istatistik.
 * Status sınıflandırması artık `lib/statusKind.ts` üzerinden tek noktada yönetilir.
 */
import type { Task } from "@/types/tasks";
import { isStatusDone, isStatusInProgress, isStatusTodo } from "@/lib/statusKind";

export function isTaskCompleted(task: Pick<Task, "status">): boolean {
  return isStatusDone(task.status);
}

export function isTaskInProgress(task: Pick<Task, "status">): boolean {
  return isStatusInProgress(task.status);
}

export type AssigneeStatsRow = {
  key: string;
  displayAssignee: string;
  total: number;
  completed: number;
  inProgress: number;
  /** Tamamlanmayan ve devam durumunda sayılmayan (ör. Yapılacak, Beklemede) */
  open: number;
  completionPct: number;
};

/** Atanan e-posta / metin anahtarına göre birleştirir (e-posta büyük/küçük harf tek satır). */
export function aggregateStatsByAssignee(tasks: Task[]): AssigneeStatsRow[] {
  const groups = new Map<string, { display: string; list: Task[] }>();

  for (const t of tasks) {
    const raw = (t.assignee ?? "").trim();
    const key = raw ? raw.toLowerCase() : "__unassigned__";
    if (!groups.has(key)) {
      groups.set(key, { display: raw || "Atanmamış", list: [] });
    }
    groups.get(key)!.list.push(t);
  }

  const rows: AssigneeStatsRow[] = [];
  for (const [key, { display, list }] of Array.from(groups.entries())) {
    const total = list.length;
    const completed = list.filter(isTaskCompleted).length;
    const inProgress = list.filter(isTaskInProgress).length;
    // "Kalan/açık" = gerçek todo statüsündekiler. Beklemede/İptal gibi "diğer" statüler
    // burada sayılmaz (eski formül total-completed-inProgress yanlış davranıyordu).
    const open = list.filter((t) => isStatusTodo(t.status)).length;
    rows.push({
      key,
      displayAssignee: display,
      total,
      completed,
      inProgress,
      open,
      completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  }

  rows.sort((a, b) => b.total - a.total);
  return rows;
}
