"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { useSettings, parseListOptionString } from "@/contexts/settings-context";
import { TaskDetailSheet } from "@/components/TaskDetailSheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";
import { getStatusKind } from "@/lib/statusKind";
import { urgentPrioritySetFromCsv } from "@/lib/urgentTaskPriority";
import { getTaskDisplayLabel, getTaskDisplayCard } from "@/lib/taskDisplayLabel";
import { parseDateFlexible } from "@/lib/parseDate";

type Props = {
  projectFilter?: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/**
 * Hafta indeksini (0 = Pzt, 6 = Paz) döner — JS getDay() 0 = Pazar yapıyor, biz Pzt başı istiyoruz.
 */
function mondayIndex(date: Date): number {
  const d = date.getDay();
  return (d + 6) % 7;
}

/** Aynı gün mü? */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

const DATE_KEY_RE = /(bitiş|bitis|deadline|son\s*tarih|son\s*g[uü]n|due|tamamlanma|teslim)/i;

function findDueFromExtra(task: Task): Date | null {
  if (!task.extra_data || typeof task.extra_data !== "object") return null;
  for (const [k, v] of Object.entries(task.extra_data)) {
    if (!DATE_KEY_RE.test(k)) continue;
    const raw = String(v ?? "").trim();
    if (!raw) continue;
    const parsed = parseDateFlexible(raw);
    if (parsed) return parsed;
  }
  return null;
}

function taskDueDate(task: Task): Date | null {
  if (task.due_date) {
    const parsed = parseDateFlexible(task.due_date);
    if (parsed) return parsed;
  }
  return findDueFromExtra(task);
}

/** Görev hücre çubuğu için duruma göre stil. */
function chipClasses(task: Task, isUrgent: boolean, isOverdue: boolean): string {
  const kind = getStatusKind(task.status);
  if (kind === "done") {
    return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60";
  }
  if (isOverdue) {
    return "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/60";
  }
  if (isUrgent) {
    return "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60";
  }
  if (kind === "in_progress") {
    return "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60";
  }
  return "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-700";
}

export function TasksCalendar({ projectFilter = [] }: Props) {
  const { tasks } = useTasksWithRealtime();
  const { projects } = useProjects();
  const { settings } = useSettings();
  const urgentPrioritySet = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  const preferredLabelKeys = useMemo(
    () => parseListOptionString(settings.taskSummaryPreferredExtraKeys),
    [settings.taskSummaryPreferredExtraKeys]
  );

  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Görüntülenen ayın ilk günü (lokal saat 00:00).
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const scopedTasks = useMemo(() => {
    const projectLinked = tasks.filter(
      (t) => t.project_id != null && String(t.project_id).trim() !== ""
    );
    if (projectFilter.length === 0) return projectLinked;
    const selected = new Set(projectFilter);
    return projectLinked.filter((t) => selected.has(String(t.project_id)));
  }, [tasks, projectFilter]);

  // Görevleri due-date'e göre sınıfla.
  const tasksByDayKey = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of scopedTasks) {
      const due = taskDueDate(t);
      if (!due) continue;
      const key = `${due.getFullYear()}-${due.getMonth()}-${due.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    // Aynı gün içinde: önce tamamlanmayan, sonra alfabe.
    map.forEach((arr) => {
      arr.sort((a: Task, b: Task) => {
        const ad = getStatusKind(a.status) === "done" ? 1 : 0;
        const bd = getStatusKind(b.status) === "done" ? 1 : 0;
        if (ad !== bd) return ad - bd;
        return (a.content ?? "").localeCompare(b.content ?? "", "tr");
      });
    });
    return map;
  }, [scopedTasks]);

  // Ay ızgarası: ilk haftanın Pzt'sinden başlar, 6 hafta (42 hücre).
  const monthCells = useMemo(() => {
    const firstDay = new Date(viewMonth);
    const leading = mondayIndex(firstDay);
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - leading);
    gridStart.setHours(0, 0, 0, 0);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getTime() + i * DAY_MS);
      cells.push(d);
    }
    return cells;
  }, [viewMonth]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);
  const projectTitleColumnById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of projects) m.set(p.id, p.title_column ?? null);
    return m;
  }, [projects]);
  const projectSubtitleColumnsById = useMemo(() => {
    const m = new Map<string, string[] | null>();
    for (const p of projects) m.set(p.id, p.subtitle_columns ?? null);
    return m;
  }, [projects]);

  // Detay panelinde prev/next gezintisi için aylık görevlerin sıralı düz listesi.
  const orderedMonthTasks = useMemo(() => {
    const flat: Task[] = [];
    for (const cell of monthCells) {
      const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
      const arr = tasksByDayKey.get(key);
      if (arr) flat.push(...arr);
    }
    return flat;
  }, [monthCells, tasksByDayKey]);

  const shownTaskCount = useMemo(() => {
    let n = 0;
    for (const cell of monthCells) {
      const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
      n += tasksByDayKey.get(key)?.length ?? 0;
    }
    return n;
  }, [monthCells, tasksByDayKey]);

  const goPrev = () => {
    setViewMonth((m) => {
      const n = new Date(m);
      n.setMonth(m.getMonth() - 1);
      return n;
    });
  };
  const goNext = () => {
    setViewMonth((m) => {
      const n = new Date(m);
      n.setMonth(m.getMonth() + 1);
      return n;
    });
  };
  const goToday = () => {
    const n = new Date();
    n.setDate(1);
    n.setHours(0, 0, 0, 0);
    setViewMonth(n);
  };

  if (scopedTasks.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title="Takvimde görüntülenecek görev yok"
          description="Görev ekleyip bitiş tarihi (due date) belirleyin."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Araç çubuğu */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goPrev} aria-label="Önceki ay">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Bugün
          </Button>
          <Button variant="ghost" size="sm" onClick={goNext} aria-label="Sonraki ay">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium capitalize text-slate-700 dark:text-slate-200">
            {formatMonthLabel(viewMonth)}
          </span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {shownTaskCount} görev (bitiş tarihi olan) · Süresi geçenler kırmızı
        </span>
      </div>

      {/* Gün başlıkları */}
      <div className="grid shrink-0 grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      {/* Ay ızgarası */}
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-auto">
        {monthCells.map((cell, idx) => {
          const isCurrentMonth = cell.getMonth() === viewMonth.getMonth();
          const isToday = sameDay(cell, today);
          const isWeekend = idx % 7 >= 5;
          const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
          const dayTasks = tasksByDayKey.get(key) ?? [];
          const visibleTasks = dayTasks.slice(0, 3);
          const hiddenCount = dayTasks.length - visibleTasks.length;
          return (
            <div
              key={idx}
              className={cn(
                "flex min-h-[6rem] flex-col gap-1 border-b border-r border-slate-200 p-1.5 text-xs dark:border-slate-700",
                !isCurrentMonth && "bg-slate-50/60 text-slate-400 dark:bg-slate-900/30 dark:text-slate-600",
                isWeekend && isCurrentMonth && "bg-slate-50/40 dark:bg-slate-800/30",
                idx % 7 === 6 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px] font-medium",
                    isToday
                      ? "bg-blue-600 text-white"
                      : isCurrentMonth
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-400 dark:text-slate-600"
                  )}
                >
                  {cell.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {dayTasks.length}
                  </span>
                )}
              </div>
              <div className="flex min-h-0 flex-col gap-0.5">
                {visibleTasks.map((task) => {
                  const isUrgent = task.priority
                    ? urgentPrioritySet.has(task.priority.trim().toLowerCase())
                    : false;
                  const due = taskDueDate(task);
                  const isOverdue =
                    !!due &&
                    due.getTime() < today.getTime() &&
                    getStatusKind(task.status) !== "done";
                  const card = getTaskDisplayCard(task, {
                    projectTitleColumn: task.project_id
                      ? projectTitleColumnById.get(String(task.project_id)) ?? null
                      : null,
                    subtitleColumns: task.project_id
                      ? projectSubtitleColumnsById.get(String(task.project_id)) ?? null
                      : null,
                    preferredExtraKeys: preferredLabelKeys,
                  });
                  const label = card.label;
                  const subtitleStr = card.subtitle.map((s) => s.value).join(" · ");
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setDetailTask(task)}
                      className={cn(
                        "w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                        chipClasses(task, isUrgent, isOverdue),
                        getStatusKind(task.status) === "done" && "line-through opacity-75"
                      )}
                      title={subtitleStr ? `${label} — ${subtitleStr}` : label || "(başlıksız)"}
                    >
                      <span className="block truncate">{label || "(başlıksız)"}</span>
                      {subtitleStr && (
                        <span className="block truncate text-[9px] font-normal opacity-75">
                          {subtitleStr}
                        </span>
                      )}
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      // İlk gizli görevi aç — küçük bir kullanım kolaylığı.
                      const firstHidden = dayTasks[visibleTasks.length];
                      if (firstHidden) setDetailTask(firstHidden);
                    }}
                    className="w-full rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200"
                  >
                    +{hiddenCount} daha
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detailTask && (() => {
        const idx = orderedMonthTasks.findIndex((t) => t.id === detailTask.id);
        const prevTask = idx > 0 ? orderedMonthTasks[idx - 1] : null;
        const nextTask =
          idx >= 0 && idx < orderedMonthTasks.length - 1
            ? orderedMonthTasks[idx + 1]
            : null;
        return (
          <TaskDetailSheet
            task={detailTask}
            onClose={() => setDetailTask(null)}
            onPrev={prevTask ? () => setDetailTask(prevTask) : undefined}
            onNext={nextTask ? () => setDetailTask(nextTask) : undefined}
            canPrev={!!prevTask}
            canNext={!!nextTask}
            positionLabel={idx >= 0 ? `${idx + 1} / ${orderedMonthTasks.length}` : undefined}
            projectName={
              detailTask.project_id
                ? projectNameById.get(String(detailTask.project_id)) ?? null
                : null
            }
            dateFormat={settings.dateFormat}
            urgentPrioritySet={urgentPrioritySet}
            canEdit={false}
            onEdit={undefined}
          />
        );
      })()}
    </div>
  );
}
