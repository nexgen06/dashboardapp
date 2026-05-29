import { isStatusDone } from "@/lib/statusKind";
import { getTaskDueDate } from "@/lib/dueUrgency";
import type { Task } from "@/types/tasks";

export type ProjectScoreRow = {
  assignee: string;
  total: number;
  done: number;
  onTimeDone: number;
  overdueOpen: number;
  highDone: number;
  score: number;
};

export type ProjectScoreSummary = {
  averageScore: number;
  teamCount: number;
  leader: ProjectScoreRow | null;
};

/** Atanan kullanıcı bazında skor satırları — formül: done*10 + onTime*6 + high*2 - overdue*4 */
export function computeProjectScoreRows(tasks: Task[]): ProjectScoreRow[] {
  const map = new Map<string, ProjectScoreRow>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const task of tasks) {
    const assigneeRaw = (task.assignee ?? "").trim();
    if (!assigneeRaw) continue;
    const key = assigneeRaw.toLowerCase();
    const row =
      map.get(key) ??
      ({
        assignee: assigneeRaw,
        total: 0,
        done: 0,
        onTimeDone: 0,
        overdueOpen: 0,
        highDone: 0,
        score: 0,
      } satisfies ProjectScoreRow);
    row.total += 1;
    const done = isStatusDone(task.status);
    const due = getTaskDueDate(task);
    if (done) {
      row.done += 1;
      const completedAt = task.updated_at ? new Date(task.updated_at) : null;
      if (!due || (completedAt != null && completedAt.getTime() <= due.getTime())) {
        row.onTimeDone += 1;
      }
      if (String(task.priority ?? "").toLowerCase() === "high") {
        row.highDone += 1;
      }
    } else if (due && due.getTime() < today.getTime()) {
      row.overdueOpen += 1;
    }
    map.set(key, row);
  }

  const rows = Array.from(map.values()).map((row) => {
    row.score = row.done * 10 + row.onTimeDone * 6 + row.highDone * 2 - row.overdueOpen * 4;
    return row;
  });

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.done !== a.done) return b.done - a.done;
    return a.assignee.localeCompare(b.assignee, "tr", { sensitivity: "base" });
  });

  return rows;
}

export function summarizeProjectScoreRows(rows: ProjectScoreRow[]): ProjectScoreSummary {
  const teamCount = rows.length;
  const totalScore = rows.reduce((sum, row) => sum + row.score, 0);
  const averageScore = teamCount > 0 ? Math.round((totalScore / teamCount) * 10) / 10 : 0;
  const leader = rows[0] ?? null;
  return { averageScore, teamCount, leader };
}
