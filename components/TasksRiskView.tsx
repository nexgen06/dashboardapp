"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CreditCard,
  FileWarning,
  FolderKanban,
  Loader2,
  ShieldAlert,
  TimerOff,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { parseListOptionString, useSettings } from "@/contexts/settings-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { ChipBadge } from "@/components/chips/ChipBadge";
import { TaskDetailSheet } from "@/components/TaskDetailSheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { listChipCatalog, listRowChipValues, type ChipCatalog, type ChipOption, type ChipTemplate, type RowChipValue } from "@/lib/chipSystem";
import { getTaskDisplayCard } from "@/lib/taskDisplayLabel";
import { getRelativeTime } from "@/lib/relativeTime";
import { isStatusDone } from "@/lib/statusKind";
import { urgentPrioritySetFromCsv } from "@/lib/urgentTaskPriority";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";

type Props = {
  projectFilter?: string[];
};

type RiskSignal = {
  id: string;
  task: Task;
  reason: string;
  tone: "red" | "amber" | "violet" | "slate";
  chips: Array<{ template: ChipTemplate; option: ChipOption; row: RowChipValue }>;
};

type RiskGroup = {
  id: string;
  title: string;
  description: string;
  icon: typeof ShieldAlert;
  tone: "red" | "amber" | "violet" | "slate";
  items: RiskSignal[];
};

const EMPTY_CATALOG: ChipCatalog = { templates: [], options: [], bindings: [] };

function includesAny(value: string, tokens: string[]) {
  const haystack = value.toLocaleLowerCase("tr");
  return tokens.some((token) => haystack.includes(token));
}

function isOverdueTask(task: Task) {
  if (!task.due_date || isStatusDone(task.status)) return false;
  const d = new Date(task.due_date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function isStaleTask(task: Task) {
  if (!task.updated_at || isStatusDone(task.status)) return false;
  const updated = new Date(task.updated_at).getTime();
  return Number.isFinite(updated) && Date.now() - updated > 7 * 24 * 60 * 60 * 1000;
}

function chipText(template: ChipTemplate, option: ChipOption) {
  return `${template.name} ${template.category} ${option.label} ${option.value}`.toLocaleLowerCase("tr");
}

function taskChips(task: Task, catalog: ChipCatalog, rows: RowChipValue[]) {
  const values = rows.filter((row) => row.taskId === task.id);
  return values.flatMap((row) => {
    const template = catalog.templates.find((item) => item.id === row.templateId);
    const option = catalog.options.find((item) => item.id === row.optionId);
    return template && option ? [{ template, option, row }] : [];
  });
}

function uniqueSignals(items: RiskSignal[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.task.id)) return false;
    seen.add(item.task.id);
    return true;
  });
}

export function TasksRiskView({ projectFilter = [] }: Props) {
  const { hasPermission } = useAuth();
  const { settings } = useSettings();
  const { projects } = useProjects();
  const { tasks } = useTasksWithRealtime();
  const [catalog, setCatalog] = useState<ChipCatalog>(EMPTY_CATALOG);
  const [rowChipValues, setRowChipValues] = useState<RowChipValue[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const urgentPrioritySet = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  const preferredLabelKeys = useMemo(
    () => parseListOptionString(settings.taskSummaryPreferredExtraKeys),
    [settings.taskSummaryPreferredExtraKeys]
  );

  const scopedTasks = useMemo(() => {
    if (!projectFilter.length) return tasks.filter((task) => task.project_id);
    const selected = new Set(projectFilter);
    return tasks.filter((task) => task.project_id && selected.has(String(task.project_id)));
  }, [projectFilter, tasks]);

  const projectIds = useMemo(
    () => Array.from(new Set(projects.map((project) => project.id).filter(Boolean))),
    [projects]
  );
  const taskIds = useMemo(() => scopedTasks.map((task) => task.id), [scopedTasks]);
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const projectTitleColumnById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const project of projects) map.set(project.id, project.title_column ?? null);
    return map;
  }, [projects]);
  const projectSubtitleColumnsById = useMemo(() => {
    const map = new Map<string, string[] | null>();
    for (const project of projects) map.set(project.id, project.subtitle_columns ?? null);
    return map;
  }, [projects]);

  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    void Promise.all([
      listChipCatalog(projectIds),
      taskIds.length > 0 ? listRowChipValues(taskIds) : Promise.resolve([]),
    ])
      .then(([nextCatalog, nextRows]) => {
        if (cancelled) return;
        setCatalog(nextCatalog);
        setRowChipValues(nextRows);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(EMPTY_CATALOG);
        setRowChipValues([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectIds, taskIds]);

  const groups = useMemo<RiskGroup[]>(() => {
    const critical: RiskSignal[] = [];
    const payments: RiskSignal[] = [];
    const documents: RiskSignal[] = [];
    const approvals: RiskSignal[] = [];
    const stale: RiskSignal[] = [];

    for (const task of scopedTasks) {
      const chips = taskChips(task, catalog, rowChipValues);
      const criticalChips = chips.filter(({ template, option }) =>
        includesAny(chipText(template, option), ["kritik", "critical", "sla aşıldı", "breached"])
      );
      const paymentChips = chips.filter(({ template, option }) =>
        includesAny(chipText(template, option), ["ödeme", "odeme", "payment"]) &&
        includesAny(chipText(template, option), ["gecikti", "gecikmiş", "overdue"])
      );
      const documentChips = chips.filter(({ template, option }) =>
        includesAny(chipText(template, option), ["evrak", "document", "dosya", "file", "eksik", "missing"]) &&
        includesAny(chipText(template, option), ["eksik", "missing"])
      );
      const approvalChips = chips.filter(({ template, option }) =>
        includesAny(chipText(template, option), ["onay", "approval", "reddedildi", "rejected", "revize", "revision", "bekliyor", "pending"])
      );
      const staleChips = chips.filter(({ template, option }) =>
        includesAny(chipText(template, option), ["sistem", "system", "hareketsiz", "stale"])
      );

      if (criticalChips.length > 0 || isOverdueTask(task)) {
        critical.push({
          id: `critical:${task.id}`,
          task,
          reason: criticalChips.length > 0 ? "Kritik risk çipi var" : "Son tarih geçti ve görev tamamlanmadı",
          tone: "red",
          chips: criticalChips,
        });
      }
      if (paymentChips.length > 0) {
        payments.push({
          id: `payment:${task.id}`,
          task,
          reason: "Ödeme gecikmesi tespit edildi",
          tone: "amber",
          chips: paymentChips,
        });
      }
      if (documentChips.length > 0) {
        documents.push({
          id: `document:${task.id}`,
          task,
          reason: "Eksik evrak/dosya sinyali var",
          tone: "violet",
          chips: documentChips,
        });
      }
      if (
        approvalChips.length > 0 ||
        task.workflow_status === "submitted" ||
        task.workflow_status === "rejected" ||
        task.workflow_status === "revision_requested"
      ) {
        approvals.push({
          id: `approval:${task.id}`,
          task,
          reason: task.workflow_status === "submitted"
            ? "Onay bekliyor"
            : task.workflow_status === "rejected"
              ? "Onay reddedildi"
              : task.workflow_status === "revision_requested"
                ? "Revize istendi"
                : "Onay çipi dikkat gerektiriyor",
          tone: "violet",
          chips: approvalChips,
        });
      }
      if (staleChips.length > 0 || isStaleTask(task)) {
        stale.push({
          id: `stale:${task.id}`,
          task,
          reason: staleChips.length > 0 ? "Hareketsiz satır çipi var" : "7 günden uzun süredir güncellenmedi",
          tone: "slate",
          chips: staleChips,
        });
      }
    }

    return [
      { id: "critical", title: "Kritik Risk", description: "Acil müdahale gerektiren satırlar", icon: ShieldAlert, tone: "red", items: uniqueSignals(critical) },
      { id: "payment", title: "Ödeme Gecikmeleri", description: "Ödeme durumu gecikmiş satırlar", icon: CreditCard, tone: "amber", items: uniqueSignals(payments) },
      { id: "document", title: "Eksik Evrak", description: "Dosya/evrak tamamlanması gereken satırlar", icon: FileWarning, tone: "violet", items: uniqueSignals(documents) },
      { id: "approval", title: "Onay Aksiyonları", description: "Kontrol, ret veya revize bekleyen satırlar", icon: CalendarClock, tone: "violet", items: uniqueSignals(approvals) },
      { id: "stale", title: "Hareketsiz Satırlar", description: "Uzun süredir güncellenmeyen operasyon kayıtları", icon: TimerOff, tone: "slate", items: uniqueSignals(stale) },
    ];
  }, [catalog, rowChipValues, scopedTasks]);

  const totalSignals = groups.reduce((sum, group) => sum + group.items.length, 0);
  const toneClass = {
    red: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/25 dark:text-red-200",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/25 dark:text-amber-200",
    violet: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/25 dark:text-violet-200",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
  } as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              Risk Görünümü
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Çipler, onay durumu, son tarih ve hareketsizlik sinyallerinden operasyon riski çıkarılır.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loadingMeta && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            <Badge variant="outline" className="bg-white dark:bg-slate-900">{totalSignals} risk sinyali</Badge>
          </div>
        </div>
      </div>

      {totalSignals === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<ShieldAlert className="h-10 w-10" />}
            title="Aktif risk sinyali yok"
            description="Kritik risk, geciken ödeme, eksik evrak, onay aksiyonu veya hareketsiz satır bulunamadı."
          />
        </div>
      ) : (
        <div className="scrollbar-themed min-h-0 flex-1 overflow-auto p-3">
          <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {groups.map((group) => {
              const Icon = group.icon;
              return (
                <section key={group.id} className="min-h-[16rem] rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className={cn("flex items-start justify-between gap-3 rounded-t-xl border-b px-4 py-3", toneClass[group.tone])}>
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="h-4 w-4" />
                        {group.title}
                      </h3>
                      <p className="mt-0.5 text-xs opacity-80">{group.description}</p>
                    </div>
                    <span className="rounded-full bg-white/75 px-2 py-0.5 text-xs font-bold tabular-nums dark:bg-slate-950/60">
                      {group.items.length}
                    </span>
                  </div>
                  {group.items.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                      Bu grupta kayıt yok.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {group.items.slice(0, 12).map((signal) => {
                        const project = signal.task.project_id ? projectById.get(String(signal.task.project_id)) : null;
                        const projectId = signal.task.project_id ? String(signal.task.project_id) : null;
                        const displayCard = getTaskDisplayCard(signal.task, {
                          projectTitleColumn: projectId ? projectTitleColumnById.get(projectId) ?? null : null,
                          subtitleColumns: projectId ? projectSubtitleColumnsById.get(projectId) ?? null : null,
                          preferredExtraKeys: preferredLabelKeys,
                        });
                        const subtitle = displayCard.subtitle.map((item) => item.value).join(" · ");
                        const displayTitle = subtitle ? `${displayCard.label} - ${subtitle}` : displayCard.label;
                        return (
                          <button
                            key={signal.id}
                            type="button"
                            onClick={() => setDetailTask(signal.task)}
                            className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
                          >
                            <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", signal.tone === "red" ? "text-red-500" : signal.tone === "amber" ? "text-amber-500" : "text-violet-500")} />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span
                                  className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
                                  title={displayTitle}
                                >
                                  {displayCard.label}
                                </span>
                                {project && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    <FolderKanban className="h-3 w-3" />
                                    {project.name}
                                  </span>
                                )}
                              </div>
                              {subtitle && (
                                <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400" title={subtitle}>
                                  {subtitle}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{signal.reason}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {signal.chips.slice(0, 3).map(({ template, option, row }) => (
                                  <ChipBadge key={`${row.templateId}:${row.optionId}`} template={template} option={option} rowValue={row} />
                                ))}
                                {signal.task.assignee && (
                                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                    {signal.task.assignee}
                                  </span>
                                )}
                              </div>
                              {signal.task.updated_at && (
                                <p className="mt-1 text-[10px] text-slate-400">
                                  Son güncelleme: {getRelativeTime(new Date(signal.task.updated_at))}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" />
                          </button>
                        );
                      })}
                      {group.items.length > 12 && (
                        <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                          +{group.items.length - 12} kayıt daha var. Filtreyi daraltarak inceleyin.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {detailTask && (
        <TaskDetailSheet
          task={detailTask}
          onClose={() => setDetailTask(null)}
          projectName={detailTask.project_id ? projectById.get(String(detailTask.project_id))?.name ?? null : null}
          dateFormat={settings.dateFormat}
          urgentPrioritySet={urgentPrioritySet}
          canEdit={false}
          canComment={hasPermission("liveTable.commentTask")}
        />
      )}
    </div>
  );
}
