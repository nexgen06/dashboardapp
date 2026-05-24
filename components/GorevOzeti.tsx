"use client";

import { useMemo, useState, useCallback } from "react";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/auth-context";
import { useSettings, parseListOptionString } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";
import { getRelativeTime } from "@/lib/relativeTime";
import { getTaskDisplayLabel, getTaskDisplayCard } from "@/lib/taskDisplayLabel";
import { isTaskCompleted, isTaskInProgress } from "@/lib/taskStats";
import { isStatusTodo } from "@/lib/statusKind";
import { urgentPrioritySetFromCsv, isUrgentPriorityValue } from "@/lib/urgentTaskPriority";
import { isTaskAssignedToMe } from "@/lib/taskAssignment";
import type { Task } from "@/types/tasks";
import { CheckCircle2, Clock, Circle, Flame, Users, TrendingUp, ListTodo, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const GECMIS_GOREV_SAYISI = 12;

/** Durum dağılımı satırı — renkli nokta + label + sayı (kompakt). */
function StatRow({
  dotClass,
  icon,
  label,
  count,
  emphasize = false,
}: {
  dotClass: string;
  icon?: React.ReactNode;
  label: string;
  count: number;
  emphasize?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-2 py-1.5 text-sm",
        emphasize && "text-red-700 dark:text-red-300"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} aria-hidden />
        <span className={cn("text-slate-600 dark:text-slate-300", emphasize && "font-medium text-red-700 dark:text-red-300")}>
          {label}
        </span>
      </span>
      <span className={cn("shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100", emphasize && "text-red-700 dark:text-red-300")}>
        {count}
      </span>
    </li>
  );
}


type GorevOzetiProps = {
  /**
   * Üst seviyeden (Canlı Tablo sayfası) gelen proje filtresi.
   * Boş dizi = tüm projeler. TasksTable ile aynı state'i paylaşır.
   */
  projectFilter?: string[];
};

export function GorevOzeti({ projectFilter = [] }: GorevOzetiProps = {}) {
  const { tasks, isLoading, error, realtimeConnection, saveTask } = useTasksWithRealtime();
  const { projects } = useProjects();
  const { user } = useAuth();
  const { settings } = useSettings();
  const now = new Date();
  const [filterMode, setFilterMode] = useState<"all" | "mine" | "byAssignee">("all");
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const [quickSaveError, setQuickSaveError] = useState<string | null>(null);

  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();

  const urgentPrioritySet = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  const summaryExtraKeys = useMemo(
    () => parseListOptionString(settings.taskSummaryPreferredExtraKeys),
    [settings.taskSummaryPreferredExtraKeys]
  );
  /** Proje-bazlı başlık sütunu lookup'ı — getTaskDisplayLabel'a aktarılır */
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
  const taskLabel = useCallback(
    (task: Task) =>
      getTaskDisplayLabel(task, {
        projectTitleColumn: task.project_id
          ? projectTitleColumnById.get(String(task.project_id))
          : null,
        preferredExtraKeys: summaryExtraKeys,
      }),
    [summaryExtraKeys, projectTitleColumnById]
  );
  const taskSubtitle = useCallback(
    (task: Task): string => {
      const card = getTaskDisplayCard(task, {
        projectTitleColumn: task.project_id
          ? projectTitleColumnById.get(String(task.project_id))
          : null,
        subtitleColumns: task.project_id
          ? projectSubtitleColumnsById.get(String(task.project_id))
          : null,
        preferredExtraKeys: summaryExtraKeys,
      });
      return card.subtitle.map((s) => s.value).join(" · ");
    },
    [summaryExtraKeys, projectTitleColumnById, projectSubtitleColumnsById]
  );

  // `projects` ve `tasks` Supabase RLS tarafından sunucu tarafında filtrelenmiş geliyor.

  /**
   * Önce proje filtresine göre kapsamlandır — KPI ve listeler artık bu kapsama göre hesaplanır.
   * Tablo (Canlı Tablo) varsayılan olarak yalnızca projeye bağlı görevleri gösterir
   * (`projectLinkedFilter === "proje"`); bu nedenle özet de projesi olmayan ("orphan")
   * görevleri hariç tutar — aksi halde özet ile tablo sayıları tutmaz.
   */
  const projectScopedTasks = useMemo(() => {
    const projectLinked = tasks.filter(
      (t) => t.project_id != null && String(t.project_id).trim() !== ""
    );
    if (projectFilter.length === 0) return projectLinked;
    const selected = new Set(projectFilter);
    return projectLinked.filter((t) => selected.has(String(t.project_id)));
  }, [tasks, projectFilter]);

  // Kapsamı insan-okunabilir etiketle ifade et (başlık için)
  const scopeLabel = useMemo(() => {
    if (projectFilter.length === 0) return "Tüm projeler";
    if (projectFilter.length === 1) {
      const p = projects.find((x) => x.id === projectFilter[0]);
      return (p?.name ?? "").trim() || "1 proje";
    }
    return `${projectFilter.length} proje seçili`;
  }, [projectFilter, projects]);

  // Kullanıcı filtresine göre alt-kapsam ("Tümü" veya "Bana atanan")
  const filteredTasks = useMemo(() => {
    if (filterMode === "mine") {
      return projectScopedTasks.filter((t) => isTaskAssignedToMe(t.assignee, currentUserEmail));
    }
    return projectScopedTasks;
  }, [projectScopedTasks, filterMode, currentUserEmail]);

  // Takım üyelerine göre gruplandırma
  const tasksByAssignee = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    filteredTasks.forEach((t) => {
      const assignee = t.assignee?.trim() || "Atanmamış";
      if (!grouped.has(assignee)) grouped.set(assignee, []);
      grouped.get(assignee)!.push(t);
    });
    return Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredTasks]);

  /**
   * Project öncelik haritası — id -> normalized priority.
   * "Acil öncelik" KPI'ı projenin önceliğini esas alır (görevin kendi priority alanını DEĞİL),
   * böylece projeyi Low/optional bırakırsan KPI 0 gösterir.
   */
  const projectPriorityById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of projects) m.set(p.id, p.priority ?? null);
    return m;
  }, [projects]);

  /** Görevin bağlı olduğu projenin önceliği acil set'inde mi? Projesi yoksa false. */
  const taskInheritsUrgentProject = useCallback(
    (t: Task) => {
      if (!t.project_id) return false;
      const projPriority = projectPriorityById.get(String(t.project_id)) ?? null;
      return isUrgentPriorityValue(projPriority, urgentPrioritySet);
    },
    [projectPriorityById, urgentPrioritySet]
  );

  const stats = useMemo(() => {
    const tamamlandi = filteredTasks.filter((t) => isTaskCompleted(t)).length;
    const devam = filteredTasks.filter((t) => isTaskInProgress(t)).length;
    // Yapılacak SADECE gerçek "todo" statüsündekiler (boş/Yapılacak/todo varyantları);
    // "Beklemede"/"İptal"/özel statüler "diğer" kategorisine girer ve buraya katılmaz.
    const yapilacak = filteredTasks.filter((t) => isStatusTodo(t.status)).length;
    const total = filteredTasks.length;
    const diger = Math.max(0, total - tamamlandi - devam - yapilacak);
    // Acil öncelik = tamamlanmamış + projenin önceliği acil set'inde (varsayılan: High/Yüksek/...)
    const highPriority = filteredTasks.filter(
      (t) => !isTaskCompleted(t) && taskInheritsUrgentProject(t)
    ).length;
    const completionRate = total > 0 ? Math.round((tamamlandi / total) * 100) : 0;
    return { tamamlandi, devam, yapilacak, diger, total, highPriority, completionRate };
  }, [filteredTasks, taskInheritsUrgentProject]);

  // Haftalık trend (son 7 gün)
  const weeklyTrend = useMemo(() => {
    const yediGunOnce = new Date();
    yediGunOnce.setDate(yediGunOnce.getDate() - 7);
    const recentCompleted = filteredTasks.filter((t) => {
      if (!isTaskCompleted(t) || !t.updated_at) return false;
      const updated = new Date(t.updated_at);
      return updated >= yediGunOnce;
    }).length;
    return recentCompleted;
  }, [filteredTasks]);

  const sonGorevler = useMemo(() => {
    return [...filteredTasks]
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, GECMIS_GOREV_SAYISI);
  }, [filteredTasks]);

  // Acil görevler: projenin önceliği acil set'inde VEYA bugün/geçmiş bitiş tarihi (due_date)
  const acilGorevler = useMemo(() => {
    const bugun = new Date();
    bugun.setHours(23, 59, 59, 999); // Bugün sonu
    return filteredTasks.filter((t) => {
      if (isTaskCompleted(t)) return false; // Tamamlanmış görevleri dahil etme
      const isUrgentP = taskInheritsUrgentProject(t);
      const hasDueDate = t.due_date && t.due_date.trim() !== "";
      if (!isUrgentP && !hasDueDate) return false;
      if (isUrgentP && !hasDueDate) return true;
      if (hasDueDate) {
        const dueDate = new Date(t.due_date!);
        return dueDate <= bugun; // Bugün veya geçmiş
      }
      return false;
    }).sort((a, b) => {
      // Önce bitiş tarihine göre sırala (geçmiş en üstte)
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (da !== db) return da - db;
      // Sonra önceliğe göre (acil proje önce)
      const pa = taskInheritsUrgentProject(a) ? 0 : 1;
      const pb = taskInheritsUrgentProject(b) ? 0 : 1;
      return pa - pb;
    });
  }, [filteredTasks, taskInheritsUrgentProject]);

  function getTaskUrgency(task: Task): "overdue" | "today" | "high" | "normal" {
    if (isTaskCompleted(task)) return "normal";
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const bugunSonu = new Date(bugun);
    bugunSonu.setHours(23, 59, 59, 999);
    if (task.due_date && task.due_date.trim() !== "") {
      const dueDate = new Date(task.due_date);
      if (dueDate < bugun) return "overdue";
      if (dueDate >= bugun && dueDate <= bugunSonu) return "today";
    }
    if (taskInheritsUrgentProject(task)) return "high";
    return "normal";
  }

  async function handleQuickComplete(taskId: string) {
    setQuickSaveError(null);
    const r = await saveTask(taskId, { status: "Tamamlandı", last_updated_by: user?.email || "anon" });
    if (!r.ok) setQuickSaveError(r.message);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Görev özeti yükleniyor">
        {/* İstatistik bar */}
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-2 h-5 w-8" />
            </div>
          ))}
        </div>
        {/* Filtre butonları */}
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
        {/* Görev satırları */}
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-2 dark:border-slate-700">
              <Skeleton variant="circle" className="h-4 w-4" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
        {error}
      </div>
    );
  }

  // Yeni tasarım: segmented control için tek state, "byAssignee" alt-modu listenin içinde toggle
  const setFilterModeSimple = (m: "all" | "mine") => setFilterMode(m);
  const isByAssignee = filterMode === "byAssignee";
  const toggleByAssignee = () =>
    setFilterMode(filterMode === "byAssignee" ? "all" : "byAssignee");
  const baseFilter: "all" | "mine" =
    filterMode === "mine" ? "mine" : "all";

  return (
    <div className="flex flex-col">
      {/* ─── Başlık satırı ─── */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <Users className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">
            <span className="font-medium text-slate-800 dark:text-slate-100">{scopeLabel}</span>
            <span className="ml-1.5 text-slate-400 dark:text-slate-500">· {projectScopedTasks.length}</span>
          </span>
        </div>
        {realtimeConnection === "live" && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
            Canlı
          </span>
        )}
        {realtimeConnection === "connecting" && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Bağlanıyor…
          </span>
        )}
        {realtimeConnection === "disconnected" && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Anlık yok
          </span>
        )}
      </div>

      {quickSaveError && (
        <div
          role="alert"
          className="mb-3 flex items-start justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
        >
          <span>{quickSaveError}</span>
          <button
            type="button"
            className="shrink-0 underline"
            onClick={() => setQuickSaveError(null)}
          >
            Kapat
          </button>
        </div>
      )}

      {/* ─── Boş durum ─── */}
      {projectScopedTasks.length === 0 && (
        <EmptyState
          variant="inline"
          icon={<ListTodo className="h-8 w-8" />}
          title={projectFilter.length > 0 ? "Seçili projelerde görev yok" : "Henüz görev yok"}
          description={
            projectFilter.length > 0
              ? "Üstteki proje filtresini değiştirebilirsiniz."
              : "Size atanmış bir proje bulunmuyor."
          }
        />
      )}

      {projectScopedTasks.length > 0 && (
        <>
          {/* ─── Segmented filter: Tümü / Bana atanan ─── */}
          {currentUserEmail && (
            <div className="mb-3 inline-flex w-full rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setFilterModeSimple("all")}
                className={cn(
                  "flex-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  baseFilter === "all"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                Tümü ({projectScopedTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterModeSimple("mine")}
                className={cn(
                  "flex-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  baseFilter === "mine"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                Bana atanan ({projectScopedTasks.filter((t) => isTaskAssignedToMe(t.assignee, currentUserEmail)).length})
              </button>
            </div>
          )}

          {/* ─── Tamamlanma satırı + haftalık trend ─── */}
          {filteredTasks.length > 0 && (
            <div className="mb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  %{stats.completionRate} tamamlandı
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {stats.tamamlandi} / {stats.total}
                  {weeklyTrend > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-3 w-3" aria-hidden /> +{weeklyTrend}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            </div>
          )}

          {/* ─── Durum dağılımı (3 sade satır + acil vurgu) ─── */}
          <ul className="mb-1 divide-y divide-slate-100 dark:divide-slate-700/60">
            <StatRow
              dotClass="bg-emerald-500"
              icon={<CheckCircle2 className="h-3 w-3" />}
              label="Tamamlandı"
              count={stats.tamamlandi}
            />
            <StatRow
              dotClass="bg-amber-500"
              icon={<Clock className="h-3 w-3" />}
              label="Devam ediyor"
              count={stats.devam}
            />
            <StatRow
              dotClass="bg-slate-400"
              icon={<Circle className="h-3 w-3" />}
              label="Yapılacak"
              count={stats.yapilacak}
            />
            {stats.highPriority > 0 && (
              <StatRow
                dotClass="bg-red-500"
                icon={<Flame className="h-3 w-3" />}
                label="Acil öncelik"
                count={stats.highPriority}
                emphasize
              />
            )}
          </ul>

          {/* ─── Acil görevler bölümü ─── */}
          {acilGorevler.length > 0 && (
            <section className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Acil ({acilGorevler.length})
                  </h3>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    title='Projenin önceliği "acil öncelik" listesine uyan veya bugün / geçmiş son tarihi olan tamamlanmamış görevler.'
                    aria-label="Acil görev tanımı"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <ul className="scrollbar-themed max-h-[180px] space-y-1 overflow-auto pr-1">
                {acilGorevler.map((task) => {
                  const urgency = getTaskUrgency(task);
                  const isOverdue = urgency === "overdue";
                  const isToday = urgency === "today";
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          isOverdue && "bg-red-500",
                          !isOverdue && isToday && "bg-orange-500",
                          !isOverdue && !isToday && "bg-slate-400"
                        )}
                        aria-hidden
                      />
                      <span
                        className="flex min-w-0 flex-1 flex-col leading-tight"
                        title={taskSubtitle(task) ? `${taskLabel(task)} — ${taskSubtitle(task)}` : taskLabel(task)}
                      >
                        <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                          {taskLabel(task)}
                        </span>
                        {taskSubtitle(task) && (
                          <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                            {taskSubtitle(task)}
                          </span>
                        )}
                      </span>
                      {task.due_date && (
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-semibold uppercase tracking-wide",
                            isOverdue && "text-red-600 dark:text-red-400",
                            isToday && "text-orange-600 dark:text-orange-400",
                            !isOverdue && !isToday && "text-slate-500 dark:text-slate-400"
                          )}
                        >
                          {isOverdue
                            ? "gecikmiş"
                            : isToday
                            ? "bugün"
                            : new Date(task.due_date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ─── Son liste — sekmeli (Liste / Kişilere göre) ─── */}
          <section className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {isByAssignee ? "Kişilere göre" : "Son güncellenenler"}
              </h3>
              <button
                type="button"
                onClick={toggleByAssignee}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200"
                title={isByAssignee ? "Listeye dön" : "Kişilere göre grupla"}
              >
                {isByAssignee ? (
                  <>
                    <ListTodo className="h-3 w-3" /> Liste
                  </>
                ) : (
                  <>
                    <Users className="h-3 w-3" /> Kişiler
                  </>
                )}
              </button>
            </div>

            {isByAssignee ? (
              tasksByAssignee.length === 0 ? (
                <p className="py-2 text-xs text-slate-500 dark:text-slate-400">Görev yok.</p>
              ) : (
                <ul className="scrollbar-themed max-h-[280px] space-y-2 overflow-auto pr-1">
                  {tasksByAssignee.map(([assignee, assigneeTasks]) => {
                    const completed = assigneeTasks.filter((t) => isTaskCompleted(t)).length;
                    const rate = assigneeTasks.length > 0 ? Math.round((completed / assigneeTasks.length) * 100) : 0;
                    return (
                      <li key={assignee}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                            {assignee}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {completed}/{assigneeTasks.length} · %{rate}
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : filteredTasks.length === 0 ? (
              <p className="py-2 text-xs text-slate-500 dark:text-slate-400">
                {filterMode === "mine" ? "Size atanmış görev yok." : "Henüz görev yok."}
              </p>
            ) : (
              <ul className="scrollbar-themed max-h-[220px] space-y-0.5 overflow-auto pr-1">
                {sonGorevler.map((task) => {
                  const urgency = getTaskUrgency(task);
                  const isOverdue = urgency === "overdue";
                  const isToday = urgency === "today";
                  const isHigh = urgency === "high";
                  const isHovered = hoveredTaskId === task.id;
                  return (
                    <li
                      key={task.id}
                      onMouseEnter={() => setHoveredTaskId(task.id)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                      className="group relative flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          isTaskCompleted(task) && "bg-emerald-500",
                          !isTaskCompleted(task) && isOverdue && "bg-red-500",
                          !isTaskCompleted(task) && !isOverdue && isToday && "bg-orange-500",
                          !isTaskCompleted(task) && !isOverdue && !isToday && isHigh && "bg-red-400",
                          !isTaskCompleted(task) && !isOverdue && !isToday && !isHigh && "bg-slate-300 dark:bg-slate-600"
                        )}
                        aria-hidden
                      />
                      <span
                        className="flex min-w-0 flex-1 flex-col leading-tight text-slate-700 dark:text-slate-200"
                        title={taskSubtitle(task) ? `${taskLabel(task)} — ${taskSubtitle(task)}` : taskLabel(task)}
                      >
                        <span className={cn("truncate", isTaskCompleted(task) && "line-through opacity-60")}>
                          {taskLabel(task)}
                        </span>
                        {taskSubtitle(task) && (
                          <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                            {taskSubtitle(task)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                        {task.updated_at ? getRelativeTime(new Date(task.updated_at), now) : "—"}
                      </span>
                      {!isTaskCompleted(task) && isHovered && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleQuickComplete(task.id)}
                          className="absolute right-1 top-1/2 h-6 -translate-y-1/2 bg-emerald-500 px-2 text-xs text-white opacity-0 transition-opacity hover:bg-emerald-600 group-hover:opacity-100"
                          title="Tamamla"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

    </div>
  );
}
