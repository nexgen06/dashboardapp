"use client";

import { useMemo, useState } from "react";
import { Calendar, FolderKanban, ChevronLeft, ChevronRight } from "lucide-react";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { useSettings } from "@/contexts/settings-context";
import { TaskDetailSheet } from "@/components/TaskDetailSheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/ui/priority-badge";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";
import { getStatusKind } from "@/lib/statusKind";
import { urgentPrioritySetFromCsv } from "@/lib/urgentTaskPriority";
import { getTaskDisplayLabel } from "@/lib/taskDisplayLabel";
import { parseListOptionString } from "@/contexts/settings-context";
import { parseDateFlexible } from "@/lib/parseDate";

type Props = {
  projectFilter?: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAY_PX = 18;
const DEFAULT_DAY_PX = 28;
const MAX_DAY_PX = 80;

/**
 * Gantt timeline görünümü — görevler için start..due bar'ları.
 *
 * Tasarım kararları (v1):
 *  - `created_at` start, `due_date` bitiş olarak kullanılır (henüz ayrı start_date
 *    yok; A.3 sonrası date tipi sütunlarla genişletilebilir).
 *  - due_date olmayan görevler gösterilmez (tek nokta da gösterilebilir, sonra).
 *  - Yatay kaydırma (uzun süreli projeler için).
 *  - Bugün çizgisi.
 *  - Hafta sınırlarında soft grid.
 *  - Bar rengi statüye göre (todo gri, devam amber, tamamlandı yeşil).
 *  - Kart tıklanınca TaskDetailSheet açar.
 */
export function TasksGantt({ projectFilter = [] }: Props) {
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
  const [dayPx, setDayPx] = useState(DEFAULT_DAY_PX);

  const scopedTasks = useMemo(() => {
    const projectLinked = tasks.filter(
      (t) => t.project_id != null && String(t.project_id).trim() !== ""
    );
    if (projectFilter.length === 0) return projectLinked;
    const selected = new Set(projectFilter);
    return projectLinked.filter((t) => selected.has(String(t.project_id)));
  }, [tasks, projectFilter]);

  /**
   * Bar için lazımlık: due_date olmalı. Start = created_at (ya da due'dan 7 gün önce).
   * Sıralama: due_date'e göre (yakın → uzak).
   */
  const { rows: ganttRows, diagnostics } = useMemo(() => {
    const rows: Array<{ task: Task; startMs: number; endMs: number }> = [];
    let noDue = 0;
    let badDue = 0;
    const badSamples: Array<{ id: string; due: string; content: string }> = [];
    for (const t of scopedTasks) {
      if (!t.due_date) {
        noDue++;
        continue;
      }
      // Tolerant parser — Türkçe (01.06.2026) ve ISO (2026-06-01) hepsini yakalar
      const dueDate = parseDateFlexible(t.due_date);
      if (!dueDate) {
        badDue++;
        if (badSamples.length < 3) {
          badSamples.push({
            id: t.id,
            due: String(t.due_date),
            content: (t.content ?? "").slice(0, 40) || "(içerik yok)",
          });
        }
        continue;
      }
      const due = dueDate.getTime();
      // `created_at` Task tipinde doğrudan tanımlı değil ama Supabase'den her zaman gelir
      const rawCreated = (t as unknown as Record<string, unknown>).created_at;
      const createdDate =
        typeof rawCreated === "string" || typeof rawCreated === "number"
          ? parseDateFlexible(rawCreated)
          : null;
      const created = createdDate ? createdDate.getTime() : NaN;
      // Start: created varsa ve due'dan önceyse onu kullan. Yoksa due - 3 gün.
      const start =
        Number.isFinite(created) && created < due ? created : due - 3 * DAY_MS;
      rows.push({ task: t, startMs: start, endMs: due });
    }
    rows.sort((a, b) => a.endMs - b.endMs);
    return {
      rows,
      diagnostics: {
        scoped: scopedTasks.length,
        shown: rows.length,
        noDue,
        badDue,
        badSamples,
      },
    };
  }, [scopedTasks]);

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

  // Zaman ekseni: en erken başlangıç - 7 gün → en geç bitiş + 7 gün
  const range = useMemo(() => {
    if (ganttRows.length === 0) {
      const now = Date.now();
      return { startMs: now - 7 * DAY_MS, endMs: now + 21 * DAY_MS };
    }
    const minStart = Math.min(...ganttRows.map((r) => r.startMs));
    const maxEnd = Math.max(...ganttRows.map((r) => r.endMs));
    return {
      startMs: minStart - 7 * DAY_MS,
      endMs: maxEnd + 7 * DAY_MS,
    };
  }, [ganttRows]);

  const totalDays = Math.max(7, Math.ceil((range.endMs - range.startMs) / DAY_MS));
  const totalWidth = totalDays * dayPx;
  const todayMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const todayX = ((todayMs - range.startMs) / DAY_MS) * dayPx;

  // Ay başlıkları için günleri grupla
  const monthLabels = useMemo(() => {
    const labels: Array<{ label: string; startX: number; widthPx: number }> = [];
    let cursorDay = new Date(range.startMs);
    cursorDay.setHours(0, 0, 0, 0);
    let curStart = cursorDay.getTime();
    let curLabel = cursorDay.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    let curDays = 0;
    for (let d = 0; d < totalDays; d++) {
      const dayDate = new Date(range.startMs + d * DAY_MS);
      const label = dayDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
      if (label !== curLabel) {
        labels.push({
          label: curLabel,
          startX: ((curStart - range.startMs) / DAY_MS) * dayPx,
          widthPx: curDays * dayPx,
        });
        curStart = dayDate.getTime();
        curLabel = label;
        curDays = 1;
      } else {
        curDays++;
      }
    }
    labels.push({
      label: curLabel,
      startX: ((curStart - range.startMs) / DAY_MS) * dayPx,
      widthPx: curDays * dayPx,
    });
    return labels;
  }, [range.startMs, totalDays, dayPx]);

  if (ganttRows.length === 0) {
    let description: React.ReactNode = "Bu projeye görev ekle ve bitiş tarihi belirle.";
    if (scopedTasks.length > 0) {
      const lines: string[] = [`${diagnostics.scoped} görev kapsamda.`];
      if (diagnostics.noDue > 0) lines.push(`${diagnostics.noDue} tanesinin bitiş tarihi yok.`);
      if (diagnostics.badDue > 0) {
        lines.push(`${diagnostics.badDue} tanesinin bitiş tarihi okunamadı.`);
      }
      description = (
        <span className="space-y-1">
          {lines.map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
          {diagnostics.badSamples.length > 0 && (
            <span className="mt-2 block rounded-md border border-amber-200 bg-amber-50 p-2 text-left text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <strong>Okunamayan örnek değerler:</strong>
              {diagnostics.badSamples.map((s, i) => (
                <span key={i} className="mt-0.5 block break-all font-mono">
                  • {s.content}: <code>{s.due}</code>
                </span>
              ))}
            </span>
          )}
        </span>
      );
    }
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<Calendar className="h-10 w-10" aria-hidden />}
          title="Gantt için uygun görev yok"
          description={description}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Zoom kontrolü */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <strong className="text-slate-700 dark:text-slate-200">{ganttRows.length}</strong> görev
          {" · "}
          <strong className="text-slate-700 dark:text-slate-200">{totalDays}</strong> gün
          {(diagnostics.noDue > 0 || diagnostics.badDue > 0) && (
            <span
              className="ml-2 text-amber-700 dark:text-amber-400"
              title={
                diagnostics.badSamples.length > 0
                  ? `Okunamayan: ${diagnostics.badSamples.map((s) => s.due).join(", ")}`
                  : undefined
              }
            >
              ({diagnostics.noDue + diagnostics.badDue} görev dışarıda)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setDayPx((p) => Math.max(MIN_DAY_PX, p - 6))}
            aria-label="Daralt"
            disabled={dayPx <= MIN_DAY_PX}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            {dayPx}px/gün
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setDayPx((p) => Math.min(MAX_DAY_PX, p + 6))}
            aria-label="Genişlet"
            disabled={dayPx >= MAX_DAY_PX}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div className="flex">
          {/* Sol sabit kolon: görev adları */}
          <div className="sticky left-0 z-10 w-[240px] shrink-0 border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
            <div className="h-14 border-b border-slate-200 bg-slate-100 px-3 py-1 dark:border-slate-700 dark:bg-slate-700/60">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Görev
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                Proje · Öncelik
              </div>
            </div>
            {ganttRows.map(({ task }) => {
              const label = getTaskDisplayLabel(task, {
                projectTitleColumn: task.project_id
                  ? projectTitleColumnById.get(String(task.project_id))
                  : null,
                preferredExtraKeys: preferredLabelKeys,
              });
              const projectName = task.project_id ? projectNameById.get(String(task.project_id)) : null;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setDetailTask(task)}
                  className="flex h-9 w-full min-w-0 items-center gap-1.5 border-b border-slate-100 px-3 text-left text-xs transition-colors hover:bg-slate-100 dark:border-slate-700/60 dark:hover:bg-slate-700/40"
                >
                  <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">
                    {label}
                  </span>
                  {task.priority && (
                    <PriorityBadge priority={task.priority} urgentSet={urgentPrioritySet} />
                  )}
                  {projectName && (
                    <span className="inline-flex max-w-[80px] items-center gap-0.5 truncate rounded bg-slate-200/70 px-1 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      <FolderKanban className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
                      <span className="truncate">{projectName}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sağ scroll alanı: zaman çizgisi + bar'lar */}
          <div className="relative" style={{ width: totalWidth, minWidth: totalWidth }}>
            {/* Üst header: aylar + günler */}
            <div className="sticky top-0 z-[5] h-14 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
              {/* Aylar */}
              <div className="relative h-7">
                {monthLabels.map((m, i) => (
                  <div
                    key={`m-${i}`}
                    className="absolute top-0 flex h-7 items-center border-l border-slate-200 px-2 text-[11px] font-semibold capitalize text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    style={{ left: m.startX, width: m.widthPx }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Günler */}
              <div className="relative h-7">
                {Array.from({ length: totalDays }).map((_, d) => {
                  const date = new Date(range.startMs + d * DAY_MS);
                  const dow = date.getDay(); // 0 = Sunday
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <div
                      key={`d-${d}`}
                      className={cn(
                        "absolute top-0 flex h-7 items-center justify-center border-l text-[10px] tabular-nums",
                        isWeekend
                          ? "border-slate-200 bg-slate-100/60 text-slate-400 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-500"
                          : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
                      )}
                      style={{ left: d * dayPx, width: dayPx }}
                    >
                      {dayPx >= 28 ? date.getDate() : ""}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bar'lar + grid */}
            <div className="relative">
              {/* Zemindeki grid çizgileri */}
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: totalDays }).map((_, d) => {
                  const date = new Date(range.startMs + d * DAY_MS);
                  const dow = date.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <div
                      key={`g-${d}`}
                      className={cn(
                        "absolute top-0 h-full border-l",
                        isWeekend
                          ? "border-slate-100 bg-slate-50/50 dark:border-slate-700/60 dark:bg-slate-800/40"
                          : "border-slate-100 dark:border-slate-700/40"
                      )}
                      style={{ left: d * dayPx, width: dayPx }}
                    />
                  );
                })}
              </div>

              {/* Bugün çizgisi */}
              {todayX >= 0 && todayX <= totalWidth && (
                <div
                  className="pointer-events-none absolute top-0 z-[3] h-full w-px bg-blue-500/70 shadow-[0_0_4px_rgba(59,130,246,0.5)]"
                  style={{ left: todayX }}
                  aria-hidden
                >
                  <span className="absolute -top-5 -left-6 rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                    Bugün
                  </span>
                </div>
              )}

              {/* Görev bar'ları */}
              {ganttRows.map(({ task, startMs, endMs }) => {
                const kind = getStatusKind(task.status);
                const barLeft = ((startMs - range.startMs) / DAY_MS) * dayPx;
                const barWidth = Math.max(((endMs - startMs) / DAY_MS) * dayPx, 8);
                const barColor =
                  kind === "done"
                    ? "bg-emerald-500/80 border-emerald-600 dark:bg-emerald-600/70"
                    : kind === "in_progress"
                      ? "bg-amber-500/80 border-amber-600 dark:bg-amber-600/70"
                      : "bg-slate-400/80 border-slate-500 dark:bg-slate-500/70";
                const isOverdue = kind !== "done" && endMs < todayMs;
                return (
                  <div key={task.id} className="relative h-9 border-b border-slate-100 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setDetailTask(task)}
                      className={cn(
                        "group absolute top-1.5 z-[2] h-6 rounded-md border text-left shadow-sm transition-all hover:shadow-md hover:brightness-110",
                        barColor,
                        isOverdue && "ring-2 ring-red-400 ring-offset-1 dark:ring-red-500"
                      )}
                      style={{ left: barLeft, width: barWidth }}
                      title={`${getTaskDisplayLabel(task, {
                        projectTitleColumn: task.project_id
                          ? projectTitleColumnById.get(String(task.project_id))
                          : null,
                        preferredExtraKeys: preferredLabelKeys,
                      })} (${new Date(startMs).toLocaleDateString("tr-TR")} → ${new Date(endMs).toLocaleDateString("tr-TR")})`}
                    >
                      <span className="block truncate px-2 text-[11px] font-medium leading-6 text-white">
                        {getTaskDisplayLabel(task, {
                          projectTitleColumn: task.project_id
                            ? projectTitleColumnById.get(String(task.project_id))
                            : null,
                          preferredExtraKeys: preferredLabelKeys,
                        })}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detay paneli — Tablo/Kanban ile aynı */}
      {detailTask && (() => {
        const ordered = ganttRows.map((r) => r.task);
        const idx = ordered.findIndex((t) => t.id === detailTask.id);
        const prevTask = idx > 0 ? ordered[idx - 1] : null;
        const nextTask = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
        return (
          <TaskDetailSheet
            task={detailTask}
            onClose={() => setDetailTask(null)}
            onPrev={prevTask ? () => setDetailTask(prevTask) : undefined}
            onNext={nextTask ? () => setDetailTask(nextTask) : undefined}
            canPrev={!!prevTask}
            canNext={!!nextTask}
            positionLabel={idx >= 0 ? `${idx + 1} / ${ordered.length}` : undefined}
            projectName={detailTask.project_id ? projectNameById.get(String(detailTask.project_id)) ?? null : null}
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
