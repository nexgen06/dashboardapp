import {
  assigneeForRowRange,
  parseRowRangeAssignments,
  type ImportAssignmentMode,
} from "@/lib/importAssignment";
import {
  findAssigneeColumnIndex,
  normalizeTaskAssigneeEmail,
  pickRoundRobinAssignee,
} from "@/lib/projectImportAssignee";
import type { TaskImportRow } from "@/lib/taskImportWizard";

export type ProjectImportAssignmentOptions = {
  mode: ImportAssignmentMode;
  assignedEmails: string[];
  defaultAssignee: string | null;
  groupByColumn: string;
  groupAssignments: Record<string, string>;
  rowRangesText: string;
  headers: string[];
  sourceRows: string[][];
};

export function resolveProjectImportAssignee(
  taskIndex: number,
  task: TaskImportRow,
  options: ProjectImportAssignmentOptions
): string | null {
  const {
    mode,
    assignedEmails,
    defaultAssignee,
    groupByColumn,
    groupAssignments,
    rowRangesText,
    headers,
    sourceRows,
  } = options;

  const recipients = assignedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  const roundRobin = mode === "roundRobin" && recipients.length >= 2;
  const rangeAssignments = mode === "rowRanges" ? parseRowRangeAssignments(rowRangesText) : [];

  const fromColumn = task.assignee ? normalizeTaskAssigneeEmail(task.assignee) : null;

  if (roundRobin) {
    return pickRoundRobinAssignee(recipients, taskIndex);
  }

  if (mode === "groupByColumn" && groupByColumn.trim()) {
    const colIndex = headers.findIndex((h) => ((h ?? "").trim() || h) === groupByColumn);
    const groupValue = colIndex >= 0 ? String(sourceRows[taskIndex]?.[colIndex] ?? "").trim() : "";
    return normalizeTaskAssigneeEmail(groupAssignments[groupValue]) ?? null;
  }

  if (mode === "rowRanges") {
    return assigneeForRowRange(taskIndex + 1, rangeAssignments);
  }

  if (mode === "single") {
    return defaultAssignee;
  }

  if (mode === "file") {
    return fromColumn ?? defaultAssignee;
  }

  return fromColumn;
}

export function applyProjectImportAssignment(
  tasks: TaskImportRow[],
  options: ProjectImportAssignmentOptions
): TaskImportRow[] {
  const hasAssigneeHeader = findAssigneeColumnIndex(options.headers) != null;
  const effectiveMode =
    options.mode === "file" && !hasAssigneeHeader && !tasks.some((t) => t.assignee)
      ? "unassigned"
      : options.mode;

  return tasks.map((task, index) => ({
    ...task,
    assignee: resolveProjectImportAssignee(index, task, { ...options, mode: effectiveMode }),
  }));
}

export function validateImportAssignmentOptions(
  mode: ImportAssignmentMode,
  options: {
    defaultAssignee: string | null;
    assignedEmails: string[];
    rowRangesText: string;
    groupByColumn: string;
  }
): string | null {
  if (mode === "single" && !options.defaultAssignee) {
    return "Tek kişiye atama için e-posta girilmeli.";
  }
  if (mode === "roundRobin" && options.assignedEmails.length < 2) {
    return "Eşit dağıtım için proje ekibinde en az 2 e-posta olmalı.";
  }
  if (mode === "rowRanges" && parseRowRangeAssignments(options.rowRangesText).length === 0) {
    return "Satır aralığına göre dağıtım için en az bir aralık girilmeli.";
  }
  if (mode === "groupByColumn" && !options.groupByColumn.trim()) {
    return "Sütuna göre dağıtım için bir sütun seçilmeli.";
  }
  return null;
}
