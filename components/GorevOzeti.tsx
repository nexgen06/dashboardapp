"use client";

import { useMemo, useState, useCallback } from "react";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/auth-context";
import { useSettings, parseListOptionString } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";
import { getRelativeTime } from "@/lib/relativeTime";
import { getTaskDisplayLabel } from "@/lib/taskDisplayLabel";
import { isTaskCompleted, isTaskInProgress } from "@/lib/taskStats";
import { isStatusTodo } from "@/lib/statusKind";
import { urgentPrioritySetFromCsv, isUrgentPriorityValue } from "@/lib/urgentTaskPriority";
import { isTaskAssignedToMe } from "@/lib/taskAssignment";
import type { Task } from "@/types/tasks";
import { Loader2, CheckCircle2, Clock, Circle, AlertCircle, AlertTriangle, Flame, User, Users, TrendingUp, X, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const GECMIS_GOREV_SAYISI = 12;

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
  const taskLabel = useCallback(
    (task: Task) => getTaskDisplayLabel(task, summaryExtraKeys),
    [summaryExtraKeys]
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

  return (
    <div className="flex flex-col gap-4">
      {/* Scope label: hangi proje(ler) için sayım yapılıyor */}
      <div className="flex items-center gap-1.5 text-ui-caption text-slate-600 dark:text-slate-300">
        <Users className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">
          <span className="font-medium">{scopeLabel}</span>
          <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
          <span>{projectScopedTasks.length} görev</span>
        </span>
      </div>
      {quickSaveError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
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
      {/* Atanmamış kullanıcı veya kapsamda görev yoksa istatistik/görev listesi gösterilmez */}
      {projectScopedTasks.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          {projectFilter.length > 0
            ? "Seçili projelerde görev yok. Üstteki proje filtresini değiştirebilirsiniz."
            : "Size atanmış bir proje bulunmuyor. Görev özeti yalnızca atandığınız projelerin görevlerini gösterir."}
        </div>
      )}
      {/* Filtre Butonları - sadece görünür projelere ait görev varsa göster */}
      {projectScopedTasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("all")}
            className="text-xs"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Tümü ({projectScopedTasks.length})
          </Button>
          {currentUserEmail && (
            <Button
              variant={filterMode === "mine" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("mine")}
              className="text-xs"
            >
              <User className="mr-1.5 h-3.5 w-3.5" />
              Bana atanan ({projectScopedTasks.filter((t) => isTaskAssignedToMe(t.assignee, currentUserEmail)).length})
            </Button>
          )}
          <Button
            variant={filterMode === "byAssignee" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("byAssignee")}
            className="text-xs"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Kişilere göre grupla
          </Button>
          {filterMode !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterMode("all")}
              className="text-xs text-slate-500"
            >
              <X className="mr-1 h-3 w-3" />
              Filtreyi kaldır
            </Button>
          )}
        </div>
      )}

      {/* Progress Bar + Haftalık Trend — sadece seçili filtreye uyan görev varken anlamlı */}
      {filteredTasks.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:border-slate-600 dark:from-slate-800 dark:to-slate-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Tamamlanma: {stats.completionRate}%
              </span>
              {weeklyTrend > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                  <TrendingUp className="h-3 w-3" />
                  +{weeklyTrend} bu hafta
                </span>
              )}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {stats.tamamlandi} / {stats.total}
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      )}

      {/* İstatistik kartları — dar sütunda da okunaklı olsun (viewport lg değil panel genişliği); filtre boşken 0 göster */}
      {projectScopedTasks.length > 0 && (
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 transition-all hover:shadow-sm dark:border-emerald-700 dark:bg-emerald-900/20">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 truncate">Tamamlandı</p>
                <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{stats.tamamlandi}</p>
              </div>
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-amber-200 bg-amber-50 p-2.5 transition-all hover:shadow-sm dark:border-amber-700 dark:bg-amber-900/20">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate">Devam ediyor</p>
                <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{stats.devam}</p>
              </div>
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 transition-all hover:shadow-sm dark:border-slate-600 dark:bg-slate-700/30">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-400 text-white">
                <Circle className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">Yapılacak</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{stats.yapilacak}</p>
              </div>
            </div>
          </div>
          <div
            className="min-w-0 rounded-lg border border-purple-200 bg-purple-50 p-2.5 transition-all hover:shadow-sm dark:border-purple-700 dark:bg-purple-900/20"
            title="Projenin önceliği 'High/Yüksek/Kritik' set'inde olan, tamamlanmamış görevler"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
                <AlertCircle className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-purple-700 dark:text-purple-300 truncate">Acil öncelik</p>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{stats.highPriority}</p>
              </div>
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-blue-200 bg-blue-50 p-2.5 transition-all hover:shadow-sm dark:border-blue-700 dark:bg-blue-900/20">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold">
                %
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">Tamamlanma</p>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{stats.completionRate}%</p>
              </div>
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 transition-all hover:shadow-sm dark:border-slate-600 dark:bg-slate-700/30">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                Σ
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">Toplam</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Acil Görevler */}
      {acilGorevler.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
            <Flame className="h-4 w-4" />
            Acil Görevler ({acilGorevler.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Projesinin önceliği ayarlardaki “acil öncelik” listesine uyan görevler veya bugün / geçmiş son tarihi olan tamamlanmamış görevler. Satır başlığı için önce görev metni, yoksa belirttiğiniz ek sütun adları kullanılır.
          </p>
          <ul className="space-y-1.5 max-h-[180px] overflow-auto pr-1">
            {acilGorevler.map((task) => {
              const urgency = getTaskUrgency(task);
              const isOverdue = urgency === "overdue";
              const isToday = urgency === "today";
              return (
                <li
                  key={task.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all",
                    isOverdue && "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 shadow-sm",
                    isToday && "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20",
                    !isOverdue && !isToday && "border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20"
                  )}
                >
                  {isOverdue ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  ) : isToday ? (
                    <Clock className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium" title={taskLabel(task)}>
                    {taskLabel(task)}
                  </span>
                  {task.due_date && (
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold",
                        isOverdue && "text-red-700 dark:text-red-300",
                        isToday && "text-orange-700 dark:text-orange-300",
                        !isOverdue && !isToday && "text-purple-700 dark:text-purple-300"
                      )}
                    >
                      {isOverdue ? "GECİKMİŞ" : isToday ? "BUGÜN" : new Date(task.due_date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                    </span>
                  )}
                  {taskInheritsUrgentProject(task) && !task.due_date && (
                    <span
                      className="shrink-0 rounded-full bg-purple-600 px-2 py-0.5 text-xs font-bold text-white"
                      title="Bu görevin bağlı olduğu projenin önceliği acil"
                    >
                      {(projectPriorityById.get(String(task.project_id ?? "")) ?? "").toString().trim() || "Acil proje"}
                    </span>
                  )}
                  {task.assignee && (
                    <span className="shrink-0 max-w-[80px] truncate text-xs text-slate-600 dark:text-slate-400" title={task.assignee}>
                      {task.assignee}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Kişilere göre gruplandırma */}
      {filterMode === "byAssignee" && tasksByAssignee.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Takım üyelerine göre görevler
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-auto pr-1">
            {tasksByAssignee.map(([assignee, assigneeTasks]) => {
              const completed = assigneeTasks.filter((t) => isTaskCompleted(t)).length;
              const rate = assigneeTasks.length > 0 ? Math.round((completed / assigneeTasks.length) * 100) : 0;
              return (
                <div key={assignee} className="rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{assignee}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {completed}/{assigneeTasks.length} ({rate}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Son güncellenen görevler listesi */}
      {filterMode !== "byAssignee" && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Son güncellenen görevler
            {realtimeConnection === "live" && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                Canlı
              </span>
            )}
            {realtimeConnection === "connecting" && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                Bağlanıyor…
              </span>
            )}
            {realtimeConnection === "disconnected" && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Anlık yok
              </span>
            )}
          </h3>
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
              {filterMode === "mine" ? "Size atanmış görev yok." : "Henüz görev yok."}
            </p>
          ) : (
          <ul className="space-y-1.5 max-h-[200px] overflow-auto pr-1">
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
                  className={cn(
                    "group relative flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all",
                    isTaskCompleted(task) && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10",
                    !isTaskCompleted(task) && isOverdue && "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10",
                    !isTaskCompleted(task) && !isOverdue && isToday && "border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10",
                    !isTaskCompleted(task) && !isOverdue && !isToday && isHigh && "border-purple-200 bg-purple-50/30 dark:border-purple-800 dark:bg-purple-900/10",
                    !isTaskCompleted(task) && !isOverdue && !isToday && !isHigh && "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/50",
                    isHovered && "shadow-md ring-2 ring-blue-200 dark:ring-blue-700"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      isTaskCompleted(task) && "bg-emerald-500",
                      !isTaskCompleted(task) && isOverdue && "bg-red-500",
                      !isTaskCompleted(task) && !isOverdue && isToday && "bg-orange-500",
                      !isTaskCompleted(task) && !isOverdue && !isToday && isHigh && "bg-purple-500",
                      !isTaskCompleted(task) && !isOverdue && !isToday && !isHigh && "bg-amber-500"
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={taskLabel(task)}>
                    {taskLabel(task)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {task.updated_at ? getRelativeTime(new Date(task.updated_at), now) : "—"}
                  </span>
                  {task.assignee && (
                    <span className="shrink-0 max-w-[80px] truncate text-xs text-slate-500 dark:text-slate-400" title={task.assignee}>
                      {task.assignee}
                    </span>
                  )}
                  {/* Hızlı Tamamla Butonu (hover'da görünür) */}
                  {!isTaskCompleted(task) && isHovered && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleQuickComplete(task.id)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 px-2 text-xs bg-emerald-500 text-white hover:bg-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Tamamla
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          )}
        </div>
      )}
    </div>
  );
}
