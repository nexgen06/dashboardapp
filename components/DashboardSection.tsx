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
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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

export function DashboardSection() {
  const { user, hasPermission } = useAuth();
  const { settings } = useSettings();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasksWithRealtime();

  const canProjects = hasPermission("area.projects") && hasPermission("projects.view");
  const canLiveTable = hasPermission("area.liveTable") && hasPermission("liveTable.view");
  const canCreateProject = hasPermission("projects.create");

  // `projects` ve `tasks` Supabase RLS tarafından sunucuda filtrelenmiş geliyor.
  const projectById = useMemo(() => {
    const map: Record<string, Project> = {};
    projects.forEach((p) => { map[p.id] = p; });
    return map;
  }, [projects]);

  const kpi = useMemo(() => {
    const totalProjects = projects.length;
    const totalTasks = tasks.length;
    const done = tasks.filter((t) => isStatusDone(t.status)).length;
    const inProgress = tasks.filter((t) => isStatusInProgress(t.status)).length;
    const todo = tasks.filter((t) => isStatusTodo(t.status)).length;
    return { totalProjects, totalTasks, done, inProgress, todo };
  }, [projects.length, tasks]);

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [tasks]);

  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return tb - ta;
      })
      .slice(0, 5);
  }, [projects]);

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
      <div className="min-h-0 space-y-6" aria-busy="true" aria-label="Dashboard yükleniyor">
        {/* Hoş geldin band */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-blue-500/5 to-emerald-500/5 p-6 dark:border-slate-700/80 sm:p-8">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        </div>
        {/* KPI grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* İki sütun kart */}
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton variant="circle" className="h-6 w-6" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 space-y-6">
      {/* Hoş geldin + gradient alan */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-slate-50 to-emerald-500/10 dark:from-blue-600/20 dark:via-slate-800 dark:to-emerald-600/20 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8">
        <div className="relative z-10">
          <h1 className="text-ui-h1 tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Hoş geldin, {displayName}
          </h1>
          <p className="mt-2 text-ui-body text-slate-600 dark:text-slate-400">
            Özet ve hızlı erişim. Bugün neler yapmak istersiniz? Aşağıdan KPI özetinize, son projelere ve görevlere ulaşabilirsiniz.
          </p>
        </div>
      </section>

      {projects.length === 0 && canProjects && (
        <section
          className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-950/35"
          aria-label="Başlangıç adımları"
        >
          <h2 className="text-ui-h3 text-slate-800 dark:text-slate-100">Başlamak için</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-ui-body text-slate-700 dark:text-slate-300">
            <li>
              {canCreateProject ? (
                <>
                  <Link href="/projeler" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 dark:text-blue-300">
                    Projeler
                  </Link>{" "}
                  sayfasında yeni proje oluşturun veya görev içe aktarın.
                </>
              ) : (
                "Yöneticiden size proje atanmasını isteyebilirsiniz."
              )}
            </li>
            <li>Görev ekleyin veya Canlı Tabloda paylaşılan liste üzerinde çalışın.</li>
            {canLiveTable && (
              <li>
                İsteğe bağlı: proje formunda «Canlı tablo ek sütunları» ile CSV beklemeden sütun başlıklarını tanımlayın (veritabanında{" "}
                <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-800">extra_column_keys</code> gerekir).
              </li>
            )}
          </ol>
        </section>
      )}

      {/* KPI kartları */}
      <section>
        <SectionHeader
          level="section"
          title="Özet"
          icon={<LayoutGrid className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-ui-display text-slate-900 dark:text-slate-50">{kpi.totalProjects}</p>
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
                <p className="text-ui-display text-slate-900 dark:text-slate-50">{kpi.totalTasks}</p>
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
                <p className="text-ui-display text-slate-900 dark:text-slate-50">{kpi.todo}</p>
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
                <p className="text-ui-display text-slate-900 dark:text-slate-50">{kpi.inProgress}</p>
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
                <p className="text-ui-display text-slate-900 dark:text-slate-50">{kpi.done}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tamamlandı</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Görev durum dağılımı (çubuk grafik) */}
      {kpi.totalTasks > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
          <SectionHeader level="card" title="Görev durum dağılımı" spacing="sm" />
          <div className="space-y-2">
            {statusChartData.map(({ label, value, pct, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 text-ui-caption text-slate-500 dark:text-slate-400">{label}</span>
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
        <SectionHeader
          level="section"
          title="Hızlı aksiyonlar"
          icon={<ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        />
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Son aktiviteler */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80 overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <SectionHeader
              level="section"
              title="Son aktiviteler"
              spacing="none"
              icon={<Activity className="h-5 w-5 text-amber-500 dark:text-amber-400" />}
              actions={
                canLiveTable ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/canli-tablo">Tümünü gör</Link>
                  </Button>
                ) : null
              }
            />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
            {recentTasks.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<ListTodo className="h-8 w-8" />}
                title="Henüz aktivite yok"
                description="Görev oluşturuldukça son aktiviteler burada listelenir."
              />
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
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <SectionHeader
              level="section"
              title="Son projeler"
              spacing="none"
              icon={<FolderKanban className="h-5 w-5 text-blue-500 dark:text-blue-400" />}
              actions={
                canProjects ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/projeler">Tümünü gör</Link>
                  </Button>
                ) : null
              }
            />
          </div>
          <div className="p-4 grid gap-3 sm:grid-cols-2">
            {recentProjects.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  variant="inline"
                  icon={<FolderKanban className="h-8 w-8" />}
                  title="Henüz proje yok"
                  description={
                    canCreateProject ? "Projeler sayfasından ilk projenizi oluşturun." : undefined
                  }
                  action={
                    canCreateProject ? (
                      <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Link href="/projeler">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Yeni proje
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
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
