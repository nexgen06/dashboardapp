"use client";

import { cn } from "@/lib/utils";
import { OnlineUsersPanel } from "@/components/OnlineUsersPanel";
import { isStatusDone, isStatusInProgress } from "@/lib/statusKind";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";
import { Filter, Table2, Zap } from "lucide-react";
import { useMemo } from "react";

export type TasksTableTopStripProps = {
  tasks: Task[];
  filteredData: Task[];
  projects: Project[];
  projectFilter: string[];
  realtimeConnection: string;
  onlineUsers: Parameters<typeof OnlineUsersPanel>[0]["onlineUsers"];
  editorsByRowId: Parameters<typeof OnlineUsersPanel>[0]["editorsByRowId"];
  currentUserEmail: string;
  spotlightSummary: {
    label: string;
    ruleName: string;
    additionalRuleCount: number;
    highlightedCount: number;
    remainingLabel: string | null;
  } | null;
  onJumpToSpotlightRows: () => void;
};

export function TasksTableTopStrip({
  tasks,
  filteredData,
  projects,
  projectFilter,
  realtimeConnection,
  onlineUsers,
  editorsByRowId,
  currentUserEmail,
  spotlightSummary,
  onJumpToSpotlightRows,
}: TasksTableTopStripProps) {
  const topStripMetrics = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => isStatusDone(t.status)).length;
    const inProgress = tasks.filter((t) => isStatusInProgress(t.status)).length;
    const isFiltered = filteredData.length !== tasks.length;
    return { total, done, inProgress, filteredCount: filteredData.length, isFiltered };
  }, [tasks, filteredData]);

  const topStripActiveProject = useMemo(() => {
    if (projectFilter.length !== 1) return null;
    return projects.find((p) => p.id === projectFilter[0]) ?? null;
  }, [projectFilter, projects]);

  const realtimeChipMeta =
    realtimeConnection === "live"
      ? { dot: "bg-emerald-500", ring: "ring-emerald-400/30", label: "Canlı", textColor: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", pulse: true }
      : realtimeConnection === "connecting"
        ? { dot: "bg-amber-500", ring: "ring-amber-400/30", label: "Bağlanıyor", textColor: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", pulse: true }
        : { dot: "bg-rose-500", ring: "ring-rose-400/30", label: "Bağlantı yok", textColor: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", pulse: false };

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-200/80 bg-white/60 px-3 py-2 backdrop-blur sm:px-4 dark:border-slate-700/80 dark:bg-slate-900/40">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 ring-1 ring-blue-600/20 dark:bg-blue-500/15 dark:ring-blue-500/30">
          <Table2 className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" aria-hidden />
        </span>
        <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Canlı Tablo
        </h1>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            realtimeChipMeta.bg,
            realtimeChipMeta.border,
            realtimeChipMeta.textColor
          )}
          title={`Realtime: ${realtimeChipMeta.label}`}
        >
          <span className="relative inline-flex h-1.5 w-1.5">
            {realtimeChipMeta.pulse && (
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", realtimeChipMeta.dot)} aria-hidden />
            )}
            <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full ring-2", realtimeChipMeta.dot, realtimeChipMeta.ring)} aria-hidden />
          </span>
          {realtimeChipMeta.label}
        </span>
      </div>

      <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

      <span className="inline-flex items-baseline gap-1.5 text-sm">
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          {topStripMetrics.total.toLocaleString("tr-TR")}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">görev</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5 text-sm">
        <span className="self-center h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
          {topStripMetrics.done.toLocaleString("tr-TR")}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">tamamlandı</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5 text-sm">
        <span className="self-center h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
        <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">
          {topStripMetrics.inProgress.toLocaleString("tr-TR")}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">devam ediyor</span>
      </span>

      {topStripMetrics.isFiltered && (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/30 dark:text-blue-300" title={`Aktif filtre: ${topStripMetrics.filteredCount} / ${topStripMetrics.total} kayıt`}>
          <Filter className="h-2.5 w-2.5" aria-hidden />
          {topStripMetrics.filteredCount.toLocaleString("tr-TR")}
        </span>
      )}

      {spotlightSummary && (
        <button
          type="button"
          onClick={onJumpToSpotlightRows}
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold text-violet-800 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/35 dark:text-violet-200 dark:hover:bg-violet-900/40"
          title="Spotlight satırlarına kaydır"
        >
          <Zap className="h-3 w-3" aria-hidden />
          Spotlight aktif · {spotlightSummary.highlightedCount} satır
          <span className="hidden max-w-[14rem] truncate rounded bg-violet-100/80 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900/45 dark:text-violet-200 sm:inline">
            {spotlightSummary.ruleName}
          </span>
          {spotlightSummary.additionalRuleCount > 0 ? (
            <span className="hidden text-[9px] font-bold uppercase tracking-wide sm:inline">
              +{spotlightSummary.additionalRuleCount} kural
            </span>
          ) : null}
          {spotlightSummary.remainingLabel ? (
            <span className="hidden rounded bg-violet-100/80 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900/45 dark:text-violet-200 sm:inline">
              kalan {spotlightSummary.remainingLabel}
            </span>
          ) : null}
          <span className="hidden max-w-[18rem] truncate sm:inline">({spotlightSummary.label})</span>
        </button>
      )}

      {topStripActiveProject && (
        <>
          <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700/70">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
            <span className="max-w-[14rem] truncate">{topStripActiveProject.name || "İsimsiz proje"}</span>
            {topStripActiveProject.workflow_enabled && (
              <span
                className="rounded bg-violet-100 px-1 text-[9px] font-semibold uppercase text-violet-700 dark:bg-violet-900/50 dark:text-violet-200"
                title="Onay akışı açık"
              >
                onay
              </span>
            )}
          </span>
        </>
      )}

      {onlineUsers.length > 0 && (
        <div className="ml-auto">
          <OnlineUsersPanel
            onlineUsers={onlineUsers}
            editorsByRowId={editorsByRowId}
            currentUserEmail={currentUserEmail}
            tasks={tasks}
            label={projectFilter.length === 1 ? "Aktif ekip" : "Aktif kullanıcılar"}
          />
        </div>
      )}
    </header>
  );
}
