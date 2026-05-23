import {
  advancedFilterRuleIsActive,
  taskMatchesAdvancedRule,
  type AdvancedFilterRule,
} from "@/lib/liveTableAdvancedFilters";
import { isUrgentPriorityValue } from "@/lib/urgentTaskPriority";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

export type LiveTableFilterInput = {
  tasks: Task[];
  projectLinkedFilter: "proje" | "tümü";
  projectFilter: string[];
  globalSearch: string;
  statusFilter: string[];
  assigneeFilter: string[];
  dateFrom: string;
  dateTo: string;
  columnFilters: Record<string, string[]>;
  advancedFilterRules: AdvancedFilterRule[];
};

export type SmartFilterCountsInput = {
  tasks: Task[];
  projectFilter: string[];
  projectById: Map<string, Project>;
  urgentPrioritySet: Set<string>;
  currentUserEmail: string;
};

/** Toolbar "Durum" filtresindeki seçimin görev durumuyla eşleşmesi. */
export function taskStatusMatchesToolbarChip(taskStatus: string, filterLabel: string): boolean {
  const s = taskStatus.trim();
  const f = filterLabel.trim();
  if (f === "Devam ediyor" || f === "Devam") return /devam|sürüyor/i.test(s);
  if (f === "Yapılacak") return /yapılacak|yapilacak/i.test(s);
  if (f === "Tamamlandı") return /tamamlandı|tamamlandi|done|completed/i.test(s);
  return s === f;
}

function getColumnFilterCellValue(task: Task, columnId: string): string {
  if (columnId === "content") return task.content ?? "";
  if (columnId === "status") return task.status ?? "";
  if (columnId === "assignee") return task.assignee ?? "";
  if (columnId === "priority") return task.priority ?? "";
  if (columnId === "due_date") return task.due_date ?? "";
  if (columnId.startsWith("extra:") && task.extra_data) {
    const extraKey = columnId.replace("extra:", "");
    return String(task.extra_data[extraKey] ?? "");
  }
  return "";
}

export function filterLiveTableTasks(input: LiveTableFilterInput): Task[] {
  const {
    tasks,
    projectLinkedFilter,
    projectFilter,
    globalSearch,
    statusFilter,
    assigneeFilter,
    dateFrom,
    dateTo,
    columnFilters,
    advancedFilterRules,
  } = input;

  let result = tasks;
  if (projectLinkedFilter === "proje") {
    result = result.filter((t) => t.project_id != null && String(t.project_id).trim() !== "");
  }

  const projectArr = Array.isArray(projectFilter) ? projectFilter : [];
  if (projectArr.length > 0) {
    const selected = new Set(projectArr);
    result = result.filter((t) => t.project_id != null && selected.has(String(t.project_id)));
  }

  const q = globalSearch.trim().toLowerCase();
  if (q) {
    result = result.filter((t) => {
      if ((t.content ?? "").toLowerCase().includes(q) || (t.assignee ?? "").toLowerCase().includes(q)) return true;
      if (t.extra_data) {
        for (const v of Object.values(t.extra_data)) {
          if (String(v ?? "").toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }

  const statusArr = Array.isArray(statusFilter) ? statusFilter : [];
  if (statusArr.length > 0) {
    result = result.filter((t) => {
      const s = (t.status ?? "").trim();
      return statusArr.some((filter) => taskStatusMatchesToolbarChip(s, filter));
    });
  }

  const assigneeArr = Array.isArray(assigneeFilter) ? assigneeFilter : [];
  if (assigneeArr.length > 0) {
    result = result.filter((t) => {
      const assignee = (t.assignee ?? "").trim();
      return assigneeArr.some((filter) => {
        if (filter === "__unassigned__") return !assignee;
        return assignee === filter || assignee.toLowerCase().includes(filter.toLowerCase());
      });
    });
  }

  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
    result = result.filter((t) => {
      const ts = t.due_date ? new Date(t.due_date).getTime() : 0;
      if (!t.due_date && (dateFrom || dateTo)) return false;
      return ts >= from && ts <= to;
    });
  }

  const activeColumnFilters = Object.entries(columnFilters).filter(([, values]) => values.length > 0);
  if (activeColumnFilters.length > 0) {
    result = result.filter((t) =>
      activeColumnFilters.every(([colId, selectedValues]) => {
        const cellValue = getColumnFilterCellValue(t, colId);
        const isEmpty = !cellValue || cellValue.trim() === "";
        if (selectedValues.includes("__empty__") && isEmpty) return true;
        if (selectedValues.includes("__filled__") && !isEmpty) return true;
        return selectedValues.some((v) => {
          if (v === "__empty__" || v === "__filled__") return false;
          return cellValue.toLowerCase() === v.toLowerCase();
        });
      })
    );
  }

  const activeAdv = advancedFilterRules.filter(advancedFilterRuleIsActive);
  if (activeAdv.length > 0) {
    result = result.filter((t) => activeAdv.every((r) => taskMatchesAdvancedRule(t, r)));
  }

  return result;
}

export function countActiveLiveTableFilters(input: {
  globalSearch: string;
  statusFilter: string[];
  assigneeFilter: string[];
  projectFilter: string[];
  dateFrom: string;
  dateTo: string;
  datePreset: string;
  columnFilters: Record<string, string[]>;
  activeAdvancedFilterRuleCount: number;
}): number {
  let n = 0;
  if (input.globalSearch.trim()) n++;
  if (Array.isArray(input.statusFilter) && input.statusFilter.length > 0) n++;
  if (Array.isArray(input.assigneeFilter) && input.assigneeFilter.length > 0) n++;
  if (Array.isArray(input.projectFilter) && input.projectFilter.length > 0) n++;
  if (input.dateFrom || input.dateTo || input.datePreset !== "custom") n++;
  n += Object.values(input.columnFilters).filter((arr) => arr.length > 0).length;
  n += input.activeAdvancedFilterRuleCount;
  return n;
}

export function getSmartFilterCounts(input: SmartFilterCountsInput) {
  const { tasks, projectFilter, projectById, urgentPrioritySet, currentUserEmail } = input;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  let scoped = tasks.filter((t) => t.project_id != null && String(t.project_id).trim() !== "");
  const projectArr = Array.isArray(projectFilter) ? projectFilter : [];
  if (projectArr.length > 0) {
    const selected = new Set(projectArr);
    scoped = scoped.filter((t) => t.project_id != null && selected.has(String(t.project_id)));
  }

  const overdue = scoped.filter((t) => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const isCompleted = /tamamlandı|tamamlandi|done|completed/i.test(t.status ?? "");
    return dueDate < today && !isCompleted;
  }).length;

  const thisWeek = scoped.filter((t) => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate >= today && dueDate <= weekEnd;
  }).length;

  const priority = scoped.filter((t) => {
    if (!t.project_id) return false;
    const proj = projectById.get(String(t.project_id));
    const projPriority = proj?.priority ?? null;
    if (!isUrgentPriorityValue(projPriority, urgentPrioritySet)) return false;
    const isCompleted = /tamamlandı|tamamlandi|done|completed/i.test(t.status ?? "");
    return !isCompleted;
  }).length;

  const mine = scoped.filter((t) =>
    (t.assignee ?? "").toLowerCase().includes(currentUserEmail.toLowerCase())
  ).length;

  const unassigned = scoped.filter((t) => !t.assignee || t.assignee.trim() === "").length;

  return { overdue, thisWeek, priority, mine, unassigned };
}
