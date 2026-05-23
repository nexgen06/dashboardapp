"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  FolderKanban,
  Loader2,
  ListTodo,
  Shield,
  Sparkles,
  Trophy,
  UserCheck,
  UserX,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSettings, getStatusOptions, parseListOptionString } from "@/contexts/settings-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { AssigneeBadge } from "@/components/ui/assignee-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { Section } from "@/components/ui/section";
import { SectionHeader } from "@/components/ui/section-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/formatDate";
import { getStatusKind, isStatusDone } from "@/lib/statusKind";
import { getTaskDisplayCard } from "@/lib/taskDisplayLabel";
import { isTaskAssignedToMe } from "@/lib/taskAssignment";
import { canEditTaskRow } from "@/lib/taskRowPermissions";
import { urgentPrioritySetFromCsv } from "@/lib/urgentTaskPriority";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";

type InboxTab = "today" | "overdue" | "mine" | "unassigned";

const TAB_LABELS: Record<InboxTab, string> = {
  today: "Bugün",
  overdue: "Geciken",
  mine: "Bana atanan",
  unassigned: "Atanmamış",
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function matchesCurrentUser(task: Task, email: string) {
  return isTaskAssignedToMe(task.assignee, email);
}

function taskDueTime(task: Task) {
  return task.due_date ? new Date(task.due_date).getTime() : Number.MAX_SAFE_INTEGER;
}

function resolveDoneStatus(statusOptions: string[]) {
  return (
    statusOptions.find((s) => /tamamlandı|tamamlandi|done|completed/i.test(s)) ??
    statusOptions.find((s) => /tamam|bitti/i.test(s)) ??
    "Tamamlandı"
  );
}

function resolveInProgressStatus(statusOptions: string[]) {
  return (
    statusOptions.find((s) => /devam|sürüyor|progress/i.test(s)) ??
    statusOptions.find((s) => !/tamamlandı|tamamlandi|done|completed/i.test(s)) ??
    "Devam ediyor"
  );
}

function TaskInboxCard({
  task,
  displayTitle,
  displaySubtitle,
  projectName,
  urgentPrioritySet,
  onSetStatus,
  busy,
  canEdit,
}: {
  task: Task;
  displayTitle: string;
  displaySubtitle: string;
  projectName: string;
  urgentPrioritySet: Set<string>;
  onSetStatus: (task: Task, status: string) => void;
  busy: boolean;
  canEdit: boolean;
}) {
  const { settings } = useSettings();
  const statusOptions = getStatusOptions(settings);
  const doneStatus = resolveDoneStatus(statusOptions);
  const progressStatus = resolveInProgressStatus(statusOptions);
  const kind = getStatusKind(task.status);
  const done = isStatusDone(task.status);
  const todayStart = startOfToday();
  const overdue = !!task.due_date && new Date(task.due_date) < todayStart && !done;

  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-3 shadow-sm dark:bg-slate-800",
        overdue ? "border-red-200 dark:border-red-800" : "border-slate-200 dark:border-slate-700"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                kind === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
                kind === "in_progress" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
              )}
            >
              {kind === "done" ? <CheckCircle2 className="h-3 w-3" /> : kind === "in_progress" ? <Loader2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {task.status || "Yapılacak"}
            </Badge>
            {task.priority && <PriorityBadge priority={task.priority} urgentSet={urgentPrioritySet} />}
            {overdue && (
              <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" />
                Gecikmiş
              </Badge>
            )}
          </div>
          <h2 className="mt-2 line-clamp-3 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {displayTitle || "İçerik yok"}
          </h2>
          {displaySubtitle && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400">
              {displaySubtitle}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        {task.assignee ? <AssigneeBadge assignee={task.assignee} compact /> : <span className="inline-flex items-center gap-1"><UserX className="h-3 w-3" /> Atanmamış</span>}
        {projectName && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <FolderKanban className="h-3 w-3 shrink-0" />
            <span className="max-w-[12rem] truncate">{projectName}</span>
          </span>
        )}
        {task.due_date && (
          <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-red-700 dark:text-red-300")}>
            <CalendarDays className="h-3 w-3" />
            {formatDate(new Date(task.due_date), settings.dateFormat)}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {!done && (
          <Button type="button" size="sm" variant="outline" disabled={busy || !canEdit} onClick={() => onSetStatus(task, progressStatus)}>
            <Clock3 className="mr-1.5 h-3.5 w-3.5" />
            Devam
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={busy || done || !canEdit}
          onClick={() => onSetStatus(task, doneStatus)}
          className={cn(done && "bg-emerald-600 text-white")}
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
          Tamamla
        </Button>
        {task.project_id && (
          <Button type="button" size="sm" variant="ghost" asChild className="col-span-2">
            <Link href={`/canli-tablo?project=${encodeURIComponent(task.project_id)}`}>
              Canlı tabloda aç
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

export default function GorevlerimPage() {
  const { user, isLoaded, hasPermission } = useAuth();
  const { settings } = useSettings();
  const { tasks, isLoading, error, saveTask, updateTaskOptimistic } = useTasksWithRealtime();
  const { projects } = useProjects();
  const [tab, setTab] = useState<InboxTab>("today");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCompletionPulse, setShowCompletionPulse] = useState(false);

  const canView = hasPermission("area.liveTable") && hasPermission("liveTable.view");
  const canEdit = hasPermission("liveTable.editTask");
  const email = (user?.email ?? "").trim().toLowerCase();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const urgentPrioritySet = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  const preferredLabelKeys = useMemo(
    () => parseListOptionString(settings.taskSummaryPreferredExtraKeys),
    [settings.taskSummaryPreferredExtraKeys]
  );
  const projectById = useMemo(() => {
    const map = new Map<string, (typeof projects)[number]>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);
  const projectTitleColumnById = useMemo(() => {
    const map = new Map<string, string | null>();
    projects.forEach((p) => map.set(p.id, p.title_column ?? null));
    return map;
  }, [projects]);
  const projectSubtitleColumnsById = useMemo(() => {
    const map = new Map<string, string[] | null>();
    projects.forEach((p) => map.set(p.id, p.subtitle_columns ?? null));
    return map;
  }, [projects]);

  const visibleTasks = useMemo(() => {
    const projectLinked = tasks.filter((t) => t.project_id != null && String(t.project_id).trim() !== "");
    return projectLinked.sort((a, b) => taskDueTime(a) - taskDueTime(b));
  }, [tasks]);

  const lists = useMemo(() => {
    const mine = visibleTasks.filter((t) => matchesCurrentUser(t, email));
    const unassigned = visibleTasks.filter((t) => !t.assignee || t.assignee.trim() === "");
    const overdue = mine.filter((t) => !!t.due_date && new Date(t.due_date) < todayStart && !isStatusDone(t.status));
    const today = mine.filter((t) => {
      if (!t.due_date || isStatusDone(t.status)) return false;
      const due = new Date(t.due_date);
      return due >= todayStart && due <= todayEnd;
    });
    return { today, overdue, mine, unassigned };
  }, [visibleTasks, email, todayStart, todayEnd]);

  const currentTasks = lists[tab];
  const mineTotal = lists.mine.length;
  const mineDoneCount = lists.mine.filter((t) => isStatusDone(t.status)).length;
  const mineOpenCount = mineTotal - mineDoneCount;
  const allMineDone = mineTotal > 0 && mineOpenCount === 0;

  useEffect(() => {
    if (!allMineDone || !email || typeof window === "undefined") return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `gorevlerim:completion-pulse:${email}:${todayKey}:${mineTotal}`;
    if (window.localStorage.getItem(storageKey) === "1") return;
    window.localStorage.setItem(storageKey, "1");
    setShowCompletionPulse(true);
    const timer = window.setTimeout(() => setShowCompletionPulse(false), 2600);
    return () => window.clearTimeout(timer);
  }, [allMineDone, email, mineTotal]);

  const setTaskStatus = async (task: Task, status: string) => {
    if (!canEdit) return;
    setBusyId(task.id);
    const patch = { status, last_updated_by: user?.email ?? "anon" };
    try {
      updateTaskOptimistic(task.id, patch);
      const result = await saveTask(task.id, patch);
      if (!result.ok) {
        // Hook focus/realtime ile tekrar senkronlanır; kullanıcıya net hata göster.
        console.warn("[Görevlerim] Durum güncellenemedi:", result.message);
      }
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoaded) {
    return <div className="flex flex-1 items-center justify-center text-slate-500">Yükleniyor…</div>;
  }

  if (!canView) {
    return (
      <div className="container max-w-2xl py-12">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-10 w-10 text-amber-600 dark:text-amber-400" />
          <p className="font-medium text-slate-800 dark:text-slate-200">Görevlerinizi görüntüleme yetkiniz yok.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl">
      <Section className="space-y-4">
        <SectionHeader
          title="Görevlerim"
          subtitle="Mobil kullanım için sadeleştirilmiş kişisel görev akışı."
          icon={<ListTodo className="h-5 w-5" aria-hidden />}
        />

        {allMineDone && (
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50",
              showCompletionPulse && "animate-[pulse_1.3s_ease-in-out_2]"
            )}
            role="status"
            aria-live="polite"
          >
            {showCompletionPulse && (
              <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
                <Sparkles className="absolute right-5 top-3 h-5 w-5 animate-bounce text-emerald-500 dark:text-emerald-300" />
                <Sparkles className="absolute bottom-3 left-8 h-4 w-4 animate-pulse text-amber-500 dark:text-amber-300" />
              </div>
            )}
            <div className="relative flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                <Trophy className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Sana atanan tüm görevler tamamlandı.</p>
                <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-100/80">
                  Bugün iyi kapandı: {mineDoneCount} görev tamamlandı. Yeni görev gelene kadar görünüm temiz.
                </p>
              </div>
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(value) => setTab(value as InboxTab)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            {(Object.keys(TAB_LABELS) as InboxTab[]).map((key) => (
              <TabsTrigger key={key} value={key} className="gap-1.5 text-xs sm:text-sm">
                {key === "today" && <CalendarDays className="h-3.5 w-3.5" />}
                {key === "overdue" && <AlertTriangle className="h-3.5 w-3.5" />}
                {key === "mine" && <UserCheck className="h-3.5 w-3.5" />}
                {key === "unassigned" && <UserX className="h-3.5 w-3.5" />}
                {TAB_LABELS[key]}
                <span className="rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {lists[key].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Görevler yükleniyor…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : currentTasks.length === 0 ? (
          <EmptyState
            icon={tab === "overdue" ? <AlertTriangle className="h-10 w-10" /> : <ListTodo className="h-10 w-10" />}
            title={`${TAB_LABELS[tab]} listesi boş`}
            description="Bu görünümde aksiyon bekleyen görev yok."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {currentTasks.map((task) => {
              const projectId = task.project_id ? String(task.project_id) : null;
              const project = projectId ? projectById.get(projectId) ?? null : null;
              const card = getTaskDisplayCard(task, {
                projectTitleColumn: projectId ? projectTitleColumnById.get(projectId) : null,
                subtitleColumns: projectId ? projectSubtitleColumnsById.get(projectId) : null,
                preferredExtraKeys: preferredLabelKeys,
              });
              const rowCanEdit = canEditTaskRow({
                hasBaseEditPermission: canEdit,
                task,
                project,
                viewerEmail: email,
                viewerRoleId: user?.roleId ?? null,
              });
              return (
                <TaskInboxCard
                  key={task.id}
                  task={task}
                  displayTitle={card.label}
                  displaySubtitle={card.subtitle.map((s) => s.value).join(" · ")}
                  projectName={project?.name ?? ""}
                  urgentPrioritySet={urgentPrioritySet}
                  onSetStatus={setTaskStatus}
                  busy={busyId === task.id}
                  canEdit={rowCanEdit}
                />
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
