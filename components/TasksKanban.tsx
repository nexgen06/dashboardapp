"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  FolderKanban,
  Plus,
} from "lucide-react";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/auth-context";
import { useSettings, getStatusOptions } from "@/contexts/settings-context";
import { useToast } from "@/components/ui/toast";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { TaskDetailSheet } from "@/components/TaskDetailSheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";
import { getStatusKind, type StatusKind } from "@/lib/statusKind";
import { formatDate } from "@/lib/formatDate";
import { urgentPrioritySetFromCsv } from "@/lib/urgentTaskPriority";
import { getTaskDisplayLabel } from "@/lib/taskDisplayLabel";
import { parseListOptionString } from "@/contexts/settings-context";

type Column = {
  kind: StatusKind;
  label: string;
  /** Statü kolonuna kart düşünce kullanılacak hedef statü string'i (settings.customStatusList) */
  targetStatus: string;
  toneBar: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ReactNode;
};

type Props = {
  projectFilter?: string[];
};

/**
 * Kanban görünümü — TasksTable ile aynı veri kaynağı (useTasksWithRealtime).
 *
 * Davranış:
 *  - Görevler proje-bağlı kapsamla filtrelenir (Tablo varsayılanıyla aynı)
 *  - 3 statü kolonu: Yapılacak / Devam ediyor / Tamamlandı
 *  - "Diğer" statüsündeki (Beklemede vb.) görevler ayrı bir alt bölümde gösterilir
 *  - Native HTML5 drag-drop: kart bir kolona bırakılınca durumu güncellenir
 *  - Karta tıklayınca TaskDetailSheet açılır (Tablo ile aynı)
 *  - Realtime senkron: başka kullanıcı durum değiştirirse kart anında taşınır
 */
export function TasksKanban({ projectFilter = [] }: Props) {
  const { tasks, saveTask } = useTasksWithRealtime();
  const { projects } = useProjects();
  const { user } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const statusOptions = useMemo(() => getStatusOptions(settings), [settings]);
  const urgentPrioritySet = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  /** Görev başlığı için fallback sırası: content → extra_data (Başlık/Görev/Ad/...) → "—" */
  const preferredLabelKeys = useMemo(
    () => parseListOptionString(settings.taskSummaryPreferredExtraKeys),
    [settings.taskSummaryPreferredExtraKeys]
  );
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  /** Sürüklenen görevin id'si — kolon hover stilleri için */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetKind, setDropTargetKind] = useState<StatusKind | null>(null);

  /** Tablo ile aynı kapsam: projesi olan + (filtre varsa) seçili projeler */
  const scopedTasks = useMemo(() => {
    const projectLinked = tasks.filter(
      (t) => t.project_id != null && String(t.project_id).trim() !== ""
    );
    if (projectFilter.length === 0) return projectLinked;
    const selected = new Set(projectFilter);
    return projectLinked.filter((t) => selected.has(String(t.project_id)));
  }, [tasks, projectFilter]);

  /** Statü string → target statü için statusOptions'tan en uygun olanı seç */
  const targetStatusFor = useCallback(
    (kind: StatusKind): string => {
      const lookup = (matchers: RegExp[]) =>
        statusOptions.find((s) => matchers.some((re) => re.test(s)));
      if (kind === "done") {
        return lookup([/^tamam/i, /done|complete/i]) ?? "Tamamlandı";
      }
      if (kind === "in_progress") {
        return lookup([/^devam|sürüyor|progress/i]) ?? "Devam ediyor";
      }
      if (kind === "todo") {
        return lookup([/^yapılacak|todo/i]) ?? "Yapılacak";
      }
      return "Yapılacak";
    },
    [statusOptions]
  );

  const columns: Column[] = useMemo(
    () => [
      {
        kind: "todo",
        label: "Yapılacak",
        targetStatus: targetStatusFor("todo"),
        toneBar: "bg-slate-300 dark:bg-slate-600",
        badgeBg: "bg-slate-100 dark:bg-slate-700",
        badgeText: "text-slate-700 dark:text-slate-200",
        icon: <Circle className="h-3.5 w-3.5" aria-hidden />,
      },
      {
        kind: "in_progress",
        label: "Devam ediyor",
        targetStatus: targetStatusFor("in_progress"),
        toneBar: "bg-amber-400 dark:bg-amber-500",
        badgeBg: "bg-amber-100 dark:bg-amber-900/40",
        badgeText: "text-amber-800 dark:text-amber-200",
        icon: <Loader2 className="h-3.5 w-3.5" aria-hidden />,
      },
      {
        kind: "done",
        label: "Tamamlandı",
        targetStatus: targetStatusFor("done"),
        toneBar: "bg-emerald-400 dark:bg-emerald-500",
        badgeBg: "bg-emerald-100 dark:bg-emerald-900/40",
        badgeText: "text-emerald-800 dark:text-emerald-200",
        icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
      },
    ],
    [targetStatusFor]
  );

  /** kind → tasks dizisi */
  const tasksByKind = useMemo(() => {
    const map: Record<StatusKind, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
      other: [],
    };
    for (const t of scopedTasks) {
      const k = getStatusKind(t.status);
      map[k].push(t);
    }
    // Stabil sıra: önce öncelik (acil önce), sonra updated_at (yeni üstte)
    for (const k of Object.keys(map) as StatusKind[]) {
      map[k].sort((a, b) => {
        const ua = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const ub = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return ub - ua;
      });
    }
    return map;
  }, [scopedTasks]);

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);
  /** Proje-bazlı başlık sütunu lookup'ı — Kanban kartı başlığını projeye göre seçer */
  const projectTitleColumnById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of projects) m.set(p.id, p.title_column ?? null);
    return m;
  }, [projects]);

  /**
   * WIP limit (Devam ediyor) — kapsamdaki görevler tek bir projeye aitse o projenin
   * limiti kullanılır. Karışık projelerde limit gösterilmez (anlamlı değil).
   */
  const inProgressWipLimit = useMemo<number | null>(() => {
    const projectIds = new Set(
      scopedTasks
        .map((t) => (t.project_id ? String(t.project_id) : null))
        .filter((x): x is string => !!x)
    );
    if (projectIds.size !== 1) return null;
    const onlyId = Array.from(projectIds)[0];
    const proj = projects.find((p) => p.id === onlyId);
    return proj?.wip_in_progress_limit ?? null;
  }, [scopedTasks, projects]);

  const handleDragStart = (taskId: string) => (e: React.DragEvent) => {
    setDraggingId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (kind: StatusKind) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetKind !== kind) setDropTargetKind(kind);
  };

  const handleDragLeave = () => {
    setDropTargetKind(null);
  };

  const handleDrop = (col: Column) => async (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setDropTargetKind(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const currentKind = getStatusKind(task.status);
    if (currentKind === col.kind) return; // aynı kolon
    const result = await saveTask(id, {
      status: col.targetStatus,
      last_updated_by: user?.email ?? "anon",
    });
    if (!result.ok) {
      toast.error(result.message ?? "Durum güncellenemedi");
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetKind(null);
  };

  // Detay paneli için sıralı görev listesi (prev/next için tüm kapsamı kullan)
  const orderedForDetail = useMemo(
    () => [...tasksByKind.todo, ...tasksByKind.in_progress, ...tasksByKind.done, ...tasksByKind.other],
    [tasksByKind]
  );

  if (scopedTasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<FolderKanban className="h-10 w-10" aria-hidden />}
          title="Henüz görev yok"
          description={
            projectFilter.length > 0
              ? "Seçili projelerde görev yok. Tablo'ya geçip yeni görev ekleyebilirsin."
              : "Bir projeye görev ekleyince burada kart olarak görünecek."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((col) => {
          const list = tasksByKind[col.kind];
          const isHovered = dropTargetKind === col.kind;
          // WIP limit yalnızca "Devam ediyor" kolonu için anlamlı
          const wipLimit = col.kind === "in_progress" ? inProgressWipLimit : null;
          const wipState: "ok" | "near" | "over" =
            wipLimit == null
              ? "ok"
              : list.length > wipLimit
                ? "over"
                : list.length === wipLimit
                  ? "near"
                  : "ok";
          return (
            <section
              key={col.kind}
              onDragOver={handleDragOver(col.kind)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(col)}
              className={cn(
                "flex min-h-0 flex-col overflow-hidden rounded-lg border bg-slate-50 transition-colors dark:bg-slate-800/60",
                isHovered
                  ? "border-blue-400 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30"
                  : wipState === "over"
                    ? "border-red-300 dark:border-red-700"
                    : wipState === "near"
                      ? "border-amber-300 dark:border-amber-700"
                      : "border-slate-200 dark:border-slate-700"
              )}
            >
              <header
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800",
                  wipState === "over" && "bg-red-50 dark:bg-red-950/30",
                  wipState === "near" && "bg-amber-50 dark:bg-amber-950/30"
                )}
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", col.toneBar)} aria-hidden />
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                    col.badgeBg,
                    col.badgeText
                  )}
                >
                  {col.icon}
                  {col.label}
                </span>
                {wipLimit != null ? (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      wipState === "over"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                        : wipState === "near"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    )}
                    title={
                      wipState === "over"
                        ? `WIP limiti aşıldı! Limit: ${wipLimit}, mevcut: ${list.length}`
                        : `WIP limiti: ${wipLimit}`
                    }
                  >
                    {list.length} / {wipLimit}
                    {wipState === "over" && " ⚠"}
                  </span>
                ) : (
                  <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {list.length}
                  </span>
                )}
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                {list.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    Boş — sürükle bırak
                  </p>
                ) : (
                  list.map((t) => (
                    <KanbanCard
                      key={t.id}
                      task={t}
                      label={getTaskDisplayLabel(t, {
                        projectTitleColumn: t.project_id
                          ? projectTitleColumnById.get(String(t.project_id))
                          : null,
                        preferredExtraKeys: preferredLabelKeys,
                      })}
                      projectName={t.project_id ? projectNameById.get(String(t.project_id)) ?? null : null}
                      dateFormat={settings.dateFormat}
                      urgentPrioritySet={urgentPrioritySet}
                      isDragging={draggingId === t.id}
                      onDragStart={handleDragStart(t.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setDetailTask(t)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Diğer ("Beklemede", "İptal" vb. özel statüler) */}
      {tasksByKind.other.length > 0 && (
        <section className="mt-2 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Diğer statüler ({tasksByKind.other.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {tasksByKind.other.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetailTask(t)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span className="mr-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-600 dark:bg-slate-600 dark:text-slate-200">
                  {(t.status || "?").slice(0, 12)}
                </span>
                <span className="line-clamp-1 align-middle">{t.content || "(içerik yok)"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Detay paneli (Tablo ile aynı bileşen, prev/next + j/k destekli) */}
      {detailTask && (() => {
        const idx = orderedForDetail.findIndex((t) => t.id === detailTask.id);
        const prevTask = idx > 0 ? orderedForDetail[idx - 1] : null;
        const nextTask = idx >= 0 && idx < orderedForDetail.length - 1 ? orderedForDetail[idx + 1] : null;
        return (
          <TaskDetailSheet
            task={detailTask}
            onClose={() => setDetailTask(null)}
            onPrev={prevTask ? () => setDetailTask(prevTask) : undefined}
            onNext={nextTask ? () => setDetailTask(nextTask) : undefined}
            canPrev={!!prevTask}
            canNext={!!nextTask}
            positionLabel={idx >= 0 ? `${idx + 1} / ${orderedForDetail.length}` : undefined}
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

function KanbanCard({
  task,
  label,
  projectName,
  dateFormat,
  urgentPrioritySet,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task: Task;
  label: string;
  projectName: string | null;
  dateFormat: ReturnType<typeof useSettings>["settings"]["dateFormat"];
  urgentPrioritySet: Set<string>;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = (() => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  })();
  // CSV içe aktarımda content boş kalabilir; extra_data'dan başlık seçilir
  const content = label && label !== "—" ? label : (task.content?.trim() || "İçerik yok");

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group cursor-grab rounded-md border bg-white p-2.5 text-left shadow-sm transition-all hover:shadow-md active:cursor-grabbing dark:bg-slate-900",
        isDragging
          ? "border-blue-400 opacity-50 ring-2 ring-blue-300"
          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
      )}
    >
      <p className="line-clamp-3 text-sm leading-snug text-slate-800 dark:text-slate-100">
        {content}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {task.priority && (
          <PriorityBadge priority={task.priority} urgentSet={urgentPrioritySet} />
        )}
        {projectName && (
          <span className="inline-flex max-w-[120px] items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <FolderKanban className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{projectName}</span>
          </span>
        )}
        {task.assignee && (
          <span className="inline-flex items-center gap-0.5">
            <User className="h-2.5 w-2.5 opacity-70" aria-hidden />
            <span className="max-w-[100px] truncate">{task.assignee}</span>
          </span>
        )}
        {dueDate && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5",
              isOverdue && "font-semibold text-red-600 dark:text-red-400"
            )}
          >
            {isOverdue ? (
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <Calendar className="h-2.5 w-2.5 opacity-70" aria-hidden />
            )}
            {formatDate(dueDate, dateFormat)}
          </span>
        )}
      </div>
    </article>
  );
}
