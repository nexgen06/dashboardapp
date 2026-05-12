"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { aggregateStatsByAssignee, isTaskCompleted, isTaskInProgress } from "@/lib/taskStats";
import { Button } from "@/components/ui/button";
import { BarChart3, Loader2, Shield, LayoutList } from "lucide-react";

export default function GorevIstatistikleriPage() {
  const { isLoaded, isAdmin } = useAuth();
  const { tasks, isLoading, error } = useTasksWithRealtime();
  const { projects, isLoading: projectsLoading } = useProjects();
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const filteredTasks = useMemo(() => {
    if (projectFilter === "all") return tasks;
    if (projectFilter === "no_project") {
      return tasks.filter((t) => !t.project_id || String(t.project_id).trim() === "");
    }
    return tasks.filter((t) => t.project_id === projectFilter);
  }, [tasks, projectFilter]);

  const byAssignee = useMemo(() => aggregateStatsByAssignee(filteredTasks), [filteredTasks]);

  const totals = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(isTaskCompleted).length;
    const inProgress = filteredTasks.filter(isTaskInProgress).length;
    const open = Math.max(0, total - completed - inProgress);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, open, pct };
  }, [filteredTasks]);

  if (!isLoaded) {
    return (
      <div className="container max-w-5xl py-12 flex items-center justify-center text-slate-500">
        Yükleniyor…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container max-w-5xl py-8">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-6 text-center">
          <Shield className="h-12 w-12 mx-auto text-amber-600 dark:text-amber-400 mb-3" />
          <p className="text-slate-800 dark:text-slate-200 font-medium">Bu sayfa yalnızca yöneticiler içindir.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">Ana sayfaya dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  const loading = isLoading || projectsLoading;

  return (
    <div className="container max-w-5xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          Görev istatistikleri
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tüm görevlerde atanan kişi başına tamamlanan, devam eden ve kalan görev sayıları. Veriler Canlı Tablo ile aynı kaynaktan gelir; yalnızca yönetici tüm satırları görür.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <LayoutList className="h-4 w-4 text-slate-500" />
          Proje:
        </label>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 min-w-[200px]"
        >
          <option value="all">Tüm projeler</option>
          <option value="no_project">Projesiz görevler</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          Veriler yükleniyor…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Toplam görev</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{totals.total}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 shadow-sm">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Tamamlanan</p>
              <p className="text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{totals.completed}</p>
            </div>
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-4 shadow-sm">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Devam eden</p>
              <p className="text-2xl font-semibold text-amber-900 dark:text-amber-100">{totals.inProgress}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Kalan (açık)</p>
              <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{totals.open}</p>
              <p className="text-xs text-slate-500 mt-1">Tamamlanma: %{totals.pct}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Atanan kişi bazında</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Açık: yapılacak / beklemede vb. (tamamlanmamış ve “devam” sayılmayan durumlar)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-600 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    <th className="px-4 py-3">Atanan</th>
                    <th className="px-4 py-3 text-right">Toplam</th>
                    <th className="px-4 py-3 text-right">Tamamlanan</th>
                    <th className="px-4 py-3 text-right">Devam</th>
                    <th className="px-4 py-3 text-right">Kalan</th>
                    <th className="px-4 py-3 text-right">Oran</th>
                  </tr>
                </thead>
                <tbody>
                  {byAssignee.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        Bu filtrede görev yok.
                      </td>
                    </tr>
                  ) : (
                    byAssignee.map((row) => (
                      <tr
                        key={row.key}
                        className="border-b border-slate-100 dark:border-slate-700/80 hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 max-w-[220px] truncate" title={row.displayAssignee}>
                          {row.displayAssignee}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.total}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{row.completed}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">{row.inProgress}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.open}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">%{row.completionPct}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {byAssignee.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100/80 dark:bg-slate-900/50 font-semibold text-slate-900 dark:text-slate-100">
                      <td className="px-4 py-3">Toplam</td>
                      <td className="px-4 py-3 text-right tabular-nums">{totals.total}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{totals.completed}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{totals.inProgress}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{totals.open}</td>
                      <td className="px-4 py-3 text-right tabular-nums">%{totals.pct}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {projectFilter !== "all" && projectFilter !== "no_project" && (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Seçili proje: <strong>{projectNameById.get(projectFilter) ?? projectFilter}</strong>
            </p>
          )}
        </>
      )}
    </div>
  );
}
