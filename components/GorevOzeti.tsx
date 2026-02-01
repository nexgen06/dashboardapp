"use client";

import { useMemo, useState } from "react";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { getRelativeTime } from "@/lib/relativeTime";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import { Loader2, CheckCircle2, Clock, Circle, AlertCircle, AlertTriangle, Flame, User, Users, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const GECMIS_GOREV_SAYISI = 12;

function isTaskCompleted(task: Task): boolean {
  const s = (task.status ?? "").toLowerCase();
  return s === "tamamlandı" || s === "tamamlandi" || s === "yapıldı" || s === "yapildi" || s === "done" || s === "completed";
}

/** Projeyi kullanıcı görebilir mi: admin her zaman; atama varsa sadece atananlar, atama yoksa sadece admin. */
function canViewProject(p: Project, isAdmin: boolean, currentUserEmail: string): boolean {
  const email = currentUserEmail.trim().toLowerCase();
  if (!email) return isAdmin;
  return (
    isAdmin ||
    ((p.assigned_emails?.length ?? 0) > 0 &&
      (p.assigned_emails ?? []).some((e) => String(e).trim().toLowerCase() === email))
  );
}

export function GorevOzeti() {
  const { tasks, isLoading, error, isRealtimeConnected, saveTask } = useTasksWithRealtime();
  const { projects } = useProjects();
  const { user, isAdmin } = useAuth();
  const now = new Date();
  const [filterMode, setFilterMode] = useState<"all" | "mine" | "byAssignee">("all");
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();

  /** Atanmamış kullanıcılar sadece kendisine atanmış projelerin görevlerini görür; admin tüm projeleri görür. */
  const visibleProjectIds = useMemo(
    () =>
      new Set(
        projects
          .filter((p) => canViewProject(p, isAdmin, currentUserEmail))
          .map((p) => p.id)
      ),
    [projects, isAdmin, currentUserEmail]
  );

  /** Görev özetinde gösterilecek görevler: sadece görünür projelere ait olanlar (veya projesi olmayanlar). */
  const tasksVisibleByProject = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.project_id ||
          String(t.project_id).trim() === "" ||
          visibleProjectIds.has(t.project_id)
      ),
    [tasks, visibleProjectIds]
  );

  // Filtrelenmiş görevler (görünür projelere göre + kullanıcı filtresi)
  const filteredTasks = useMemo(() => {
    if (filterMode === "mine") {
      return tasksVisibleByProject.filter((t) => (t.assignee ?? "").toLowerCase().includes(currentUserEmail) || (t.assignee ?? "").toLowerCase() === currentUserEmail);
    }
    return tasksVisibleByProject;
  }, [tasksVisibleByProject, filterMode, currentUserEmail]);

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

  const stats = useMemo(() => {
    const tamamlandi = filteredTasks.filter((t) => isTaskCompleted(t)).length;
    const devam = filteredTasks.filter((t) => {
      const s = (t.status ?? "").toLowerCase();
      return s === "devam" || s === "devam ediyor" || s === "in progress";
    }).length;
    const total = filteredTasks.length;
    const yapilacak = Math.max(0, total - tamamlandi - devam);
    const highPriority = filteredTasks.filter((t) => (t.priority ?? "").toLowerCase() === "high").length;
    const completionRate = total > 0 ? Math.round((tamamlandi / total) * 100) : 0;
    return { tamamlandi, devam, yapilacak, total, highPriority, completionRate };
  }, [filteredTasks]);

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

  // Acil görevler: High öncelik VEYA bugün/geçmiş bitiş tarihi
  const acilGorevler = useMemo(() => {
    const bugun = new Date();
    bugun.setHours(23, 59, 59, 999); // Bugün sonu
    return filteredTasks.filter((t) => {
      if (isTaskCompleted(t)) return false; // Tamamlanmış görevleri dahil etme
      const isHighPriority = (t.priority ?? "").toLowerCase() === "high";
      const hasDueDate = t.due_date && t.due_date.trim() !== "";
      if (!isHighPriority && !hasDueDate) return false;
      if (isHighPriority && !hasDueDate) return true; // High öncelik, tarih yok
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
      // Sonra önceliğe göre (High önce)
      const pa = (a.priority ?? "").toLowerCase() === "high" ? 0 : 1;
      const pb = (b.priority ?? "").toLowerCase() === "high" ? 0 : 1;
      return pa - pb;
    });
  }, [filteredTasks]);

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
    if ((task.priority ?? "").toLowerCase() === "high") return "high";
    return "normal";
  }

  async function handleQuickComplete(taskId: string) {
    try {
      await saveTask(taskId, { status: "Tamamlandı", last_updated_by: user?.email || "anon" });
    } catch (e) {
      console.error("Hızlı tamamlama hatası:", e);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[180px] items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
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
      {/* Atanmamış kullanıcı veya görünür proje yoksa istatistik/görev listesi gösterilmez */}
      {tasksVisibleByProject.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Size atanmış bir proje bulunmuyor. Görev özeti ve istatistikler yalnızca atandığınız projelerin görevlerini gösterir.
        </div>
      )}
      {/* Filtre Butonları - sadece görünür projelere ait görev varsa göster */}
      {tasksVisibleByProject.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("all")}
            className="text-xs"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Tümü ({tasksVisibleByProject.length})
          </Button>
          {currentUserEmail && (
            <Button
              variant={filterMode === "mine" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("mine")}
              className="text-xs"
            >
              <User className="mr-1.5 h-3.5 w-3.5" />
              Bana atanan ({tasksVisibleByProject.filter((t) => (t.assignee ?? "").toLowerCase().includes(currentUserEmail)).length})
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

      {/* Progress Bar + Haftalık Trend */}
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

      {/* İstatistik Kartları */}
      {filteredTasks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 p-2.5 transition-all hover:shadow-sm">
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
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-2.5 transition-all hover:shadow-sm">
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/30 p-2.5 transition-all hover:shadow-sm">
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
          <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20 p-2.5 transition-all hover:shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
                <AlertCircle className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-purple-700 dark:text-purple-300 truncate">Yüksek öncelik</p>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{stats.highPriority}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20 p-2.5 transition-all hover:shadow-sm">
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/30 p-2.5 transition-all hover:shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-600 text-white text-xs font-bold">
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
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300 mb-2">
            <Flame className="h-4 w-4" />
            Acil Görevler ({acilGorevler.length})
          </h3>
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
                  <span className="min-w-0 flex-1 truncate font-medium" title={task.content}>
                    {task.content || "—"}
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
                  {(task.priority ?? "").toLowerCase() === "high" && !task.due_date && (
                    <span className="shrink-0 rounded-full bg-purple-600 px-2 py-0.5 text-xs font-bold text-white">
                      HIGH
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
            {isRealtimeConnected && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                Canlı
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
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={task.content}>
                    {task.content || "—"}
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
