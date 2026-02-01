"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useSettings } from "@/contexts/settings-context";
import type { DateFormat } from "@/contexts/settings-context";
import { formatDate } from "@/lib/formatDate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock,
  Circle,
  ArrowRight,
  PlusCircle,
  Table2,
  Activity,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";

function isStatusDone(s: string): boolean {
  return /tamamlandı|tamamlandi|done|completed/i.test((s ?? "").trim());
}
function isStatusInProgress(s: string): boolean {
  return /devam|sürüyor|in progress|progress/i.test((s ?? "").trim());
}
function isStatusTodo(s: string): boolean {
  return /yapılacak|yapilacak|todo/i.test((s ?? "").trim()) || (!isStatusDone(s) && !isStatusInProgress(s) && (s ?? "").trim() !== "");
}

/** Projeyi mevcut kullanıcı görebilir mi: admin her zaman; atama varsa sadece atananlar, atama yoksa kimse (sadece admin). */
function canViewProject(p: Project, isAdmin: boolean, currentUserEmail: string): boolean {
  const email = currentUserEmail.trim().toLowerCase();
  if (!email) return isAdmin;
  return (
    isAdmin ||
    ((p.assigned_emails?.length ?? 0) > 0 &&
      (p.assigned_emails ?? []).some((e) => String(e).trim().toLowerCase() === email))
  );
}

export function DashboardSection() {
  const { user, hasPermission, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasksWithRealtime();
  const currentUserEmail = (user?.email ?? "").toLowerCase();

  const canProjects = hasPermission("area.projects");
  const canLiveTable = hasPermission("area.liveTable");
  const canCreateProject = hasPermission("projects.create");

  const visibleProjects = useMemo(
    () => projects.filter((p) => canViewProject(p, isAdmin, currentUserEmail)),
    [projects, isAdmin, currentUserEmail]
  );
  const visibleProjectIds = useMemo(() => new Set(visibleProjects.map((p) => p.id)), [visibleProjects]);

  const projectById = useMemo(() => {
    const map: Record<string, Project> = {};
    projects.forEach((p) => { map[p.id] = p; });
    return map;
  }, [projects]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => !t.project_id || visibleProjectIds.has(t.project_id)),
    [tasks, visibleProjectIds]
  );
  const kpi = useMemo(() => {
    const totalProjects = visibleProjects.length;
    const totalTasks = visibleTasks.length;
    const done = visibleTasks.filter((t) => isStatusDone(t.status)).length;
    const inProgress = visibleTasks.filter((t) => isStatusInProgress(t.status)).length;
    const todo = visibleTasks.filter((t) => isStatusTodo(t.status)).length;
    return { totalProjects, totalTasks, done, inProgress, todo };
  }, [visibleProjects.length, visibleTasks]);

  const recentTasks = useMemo(() => {
    return [...visibleTasks]
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [visibleTasks]);

  const recentProjects = useMemo(() => {
    return [...visibleProjects]
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return tb - ta;
      })
      .slice(0, 5);
  }, [visibleProjects]);

  const statusChartData = useMemo(() => {
    const { todo, inProgress, done } = kpi;
    const total = todo + inProgress + done || 1;
    return [
      { label: "Yapılacak", value: todo, pct: Math.round((todo / total) * 100), color: "bg-slate-400 dark:bg-slate-500" },
      { label: "Devam", value: inProgress, pct: Math.round((inProgress / total) * 100), color: "bg-amber-500 dark:bg-amber-400" },
      { label: "Tamamlandı", value: done, pct: Math.round((done / total) * 100), color: "bg-emerald-500 dark:bg-emerald-400" },
    ];
  }, [kpi]);

  const displayName = user?.displayName || user?.email || "Kullanıcı";

  if (projectsLoading && tasksLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400">
        <div className="animate-pulse">Yükleniyor…</div>
      </div>
    );
  }

  return (
    <div className="min-h-0 space-y-8">
      {/* Hoş geldin + gradient alan */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-slate-50 to-emerald-500/10 dark:from-blue-600/20 dark:via-slate-800 dark:to-emerald-600/20 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8">
        <div className="relative z-10">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 sm:text-3xl">
            Hoş geldin, {displayName}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Özet ve hızlı erişim. Bugün neler yapmak istersiniz? Aşağıdan KPI özetinize, son projelere ve görevlere ulaşabilirsiniz.
          </p>
        </div>
      </section>

      {/* KPI kartları */}
      <section>
        <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Özet
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{kpi.totalProjects}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Toplam proje</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                <ListTodo className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{kpi.totalTasks}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Toplam görev</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                <Circle className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{kpi.todo}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Yapılacak</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{kpi.inProgress}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Devam eden</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{kpi.done}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tamamlandı</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Görev durum dağılımı (çubuk grafik) */}
      {kpi.totalTasks > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Görev durum dağılımı</h2>
          <div className="space-y-2">
            {statusChartData.map(({ label, value, pct, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 text-xs text-slate-500 dark:text-slate-400">{label}</span>
                <div className="flex-1 h-6 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color)}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-8">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hızlı aksiyonlar */}
      <section>
        <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Hızlı aksiyonlar
        </h2>
        <div className="flex flex-wrap gap-3">
          {canProjects && (
            <Button asChild variant="outline" size="sm" className="rounded-lg border-slate-200 dark:border-slate-600">
              <Link href="/projeler">
                <FolderKanban className="mr-2 h-4 w-4" />
                Projelere git
              </Link>
            </Button>
          )}
          {canLiveTable && (
            <Button asChild variant="outline" size="sm" className="rounded-lg border-slate-200 dark:border-slate-600">
              <Link href="/canli-tablo">
                <Table2 className="mr-2 h-4 w-4" />
                Canlı Tabloya git
              </Link>
            </Button>
          )}
          {canProjects && canCreateProject && (
            <Button asChild size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
              <Link href="/projeler">
                <PlusCircle className="mr-2 h-4 w-4" />
                Yeni proje
              </Link>
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Son aktiviteler */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80 overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              Son aktiviteler
            </h2>
            {canLiveTable && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/canli-tablo">Tümünü gör</Link>
              </Button>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
            {recentTasks.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Henüz görev yok.
              </div>
            ) : (
              recentTasks.map((task) => (
                <RecentTaskRow
                  key={task.id}
                  task={task}
                  projectName={task.project_id ? projectById[task.project_id]?.name : null}
                  dateFormat={settings.dateFormat}
                />
              ))
            )}
          </div>
        </section>

        {/* Son projeler */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80 overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              Son projeler
            </h2>
            {canProjects && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/projeler">Tümünü gör</Link>
              </Button>
            )}
          </div>
          <div className="p-4 grid gap-3 sm:grid-cols-2">
            {recentProjects.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Henüz proje yok.
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projeler/${project.id}`}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 transition-colors hover:bg-slate-100 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/30 dark:hover:bg-slate-700/50"
                >
                  <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{project.name || "İsimsiz proje"}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{project.description || "—"}</p>
                  <Badge variant="outline" className="mt-2 text-xs font-normal">
                    {project.status}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function RecentTaskRow({
  task,
  projectName,
  dateFormat,
}: {
  task: Task;
  projectName: string | null;
  dateFormat: DateFormat;
}) {
  const statusLabel = task.status?.trim() || "—";
  const isDone = isStatusDone(task.status);
  const isProgress = isStatusInProgress(task.status);

  return (
    <div className="px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{task.content || "—"}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {projectName ? (
            <span className="truncate">{projectName}</span>
          ) : (
            <span>—</span>
          )}
          {task.updated_at && (
            <span className="ml-1"> · {formatDate(new Date(task.updated_at), dateFormat)}</span>
          )}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "w-fit text-xs font-normal mt-1 sm:mt-0",
          isDone && "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
          isProgress && "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
          !isDone && !isProgress && "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
        )}
      >
        {statusLabel}
      </Badge>
    </div>
  );
}
