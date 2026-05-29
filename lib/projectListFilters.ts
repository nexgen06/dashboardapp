import { isStatusDone } from "@/lib/statusKind";
import { normalizeWorkflowStatus } from "@/lib/taskWorkflow";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

export type ProjectListFilters = {
  search: string;
  statusFilter: string;
  assignedToMeOnly: boolean;
  currentUserEmail: string;
  dateFrom: string;
  dateTo: string;
};

export type TaskCompletionStats = { total: number; done: number; approved: number };

export function filterProjectsList(projects: Project[], filters: ProjectListFilters): Project[] {
  let result = projects;
  const q = filters.search.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    );
  }
  if (filters.statusFilter !== "Tümü") {
    result = result.filter((p) => p.status === filters.statusFilter);
  }
  if (filters.assignedToMeOnly && filters.currentUserEmail) {
    result = result.filter((p) =>
      (p.assigned_emails ?? []).some((e) => e.toLowerCase() === filters.currentUserEmail)
    );
  }
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : 0;
    const to = filters.dateTo
      ? new Date(filters.dateTo).setHours(23, 59, 59, 999)
      : Number.MAX_SAFE_INTEGER;
    result = result.filter((p) => {
      const ts = p.updated_at
        ? new Date(p.updated_at).getTime()
        : p.created_at
          ? new Date(p.created_at).getTime()
          : 0;
      return ts >= from && ts <= to;
    });
  }
  return result;
}

export function computeTaskCompletionByProject(tasks: Task[]): Record<string, TaskCompletionStats> {
  const map: Record<string, TaskCompletionStats> = {};
  for (const task of tasks) {
    const projectId = String(task.project_id ?? "").trim();
    if (!projectId) continue;
    if (!map[projectId]) map[projectId] = { total: 0, done: 0, approved: 0 };
    map[projectId].total += 1;
    if (isStatusDone(task.status)) map[projectId].done += 1;
    if (normalizeWorkflowStatus(task.workflow_status) === "approved") {
      map[projectId].approved += 1;
    }
  }
  return map;
}

export type ProjectCardStats = {
  taskCount: number;
  taskDone: number;
  taskProgressPct: number;
  isProjectCompleted: boolean;
  completionLabel: string;
  progressTitle: string;
};

export function buildProjectCardStats(
  project: Project,
  taskCountByProject: Record<string, { total: number; done: number }>,
  taskCompletionByProject: Record<string, TaskCompletionStats>
): ProjectCardStats {
  const taskStats = taskCountByProject[project.id] ?? { total: 0, done: 0 };
  const completionStats = taskCompletionByProject[project.id] ?? {
    total: taskStats.total,
    done: taskStats.done,
    approved: 0,
  };
  const taskCount = completionStats.total;
  const taskDone = project.workflow_enabled ? completionStats.approved : completionStats.done;
  const taskProgressPct = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;
  const isProjectCompleted = taskCount > 0 && taskDone === taskCount;
  const completionLabel = project.workflow_enabled ? "Tüm görevler onaylandı" : "Proje tamamlandı";
  const progressTitle = project.workflow_enabled
    ? `${taskDone} / ${taskCount} görev onaylandı (${taskProgressPct}%)`
    : `${taskDone} / ${taskCount} görev tamamlandı (${taskProgressPct}%)`;
  return { taskCount, taskDone, taskProgressPct, isProjectCompleted, completionLabel, progressTitle };
}
