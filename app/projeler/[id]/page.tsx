"use client";

import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useSettings, getStatusOptions, getPriorityOptions, parseListOptionString } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/formatDate";
import { urgentPrioritySetFromCsv } from "@/lib/urgentTaskPriority";
import { RestrictedButton } from "@/components/ui/permission-gate";
import type { ImportValidationReport, TaskImportRow } from "@/lib/taskImportWizard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, Loader2, User, ShieldCheck, Upload, X } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useProjectPresence } from "@/hooks/useProjectPresence";
import { ProjectActivityTimeline } from "@/components/ProjectActivityTimeline";
import { ProjectCommandHeader } from "@/components/project-detail/ProjectCommandHeader";
import { ProjectOverviewSummary } from "@/components/project-detail/ProjectOverviewSummary";
import { ProjectRecentTasksPanel } from "@/components/project-detail/ProjectRecentTasksPanel";
import { ProjectScoreboardTab } from "@/components/project-detail/ProjectScoreboardTab";
import { ProjectAddTaskDialog } from "@/components/project-detail/ProjectAddTaskDialog";
import { ProjectImportTasksDialog } from "@/components/project-detail/ProjectImportTasksDialog";
import { ProjectImportReportDialog } from "@/components/project-detail/ProjectImportReportDialog";
import { ProjectTasksFilterBar } from "@/components/project-detail/ProjectTasksFilterBar";
import type { ProjectDetailTab } from "@/components/project-detail/projectDetailTypes";
import { ProjectMemberPermissionsPanel } from "@/components/ProjectMemberPermissionsPanel";
import {
  requestNotificationPermission,
  notificationApiAvailable,
} from "@/lib/browserNotifications";
import { getTaskDisplayCard } from "@/lib/taskDisplayLabel";
import { computeProjectScoreRows, summarizeProjectScoreRows } from "@/lib/projectScoreboard";
import {
  ME_LABEL,
  type DateFilterKind,
  formatAssigneeForDisplay,
  assigneeValueForDatabase,
  isTaskOverdue,
  filterProjectTasks,
  sortTasksByUpdatedDesc,
} from "@/lib/projectDetailPageHelpers";
import type { Task } from "@/types/tasks";
import { isStatusDone } from "@/lib/statusKind";
import { getTaskDueDate } from "@/lib/dueUrgency";

const PROJECT_DETAIL_TABS = new Set<ProjectDetailTab>(["overview", "tasks", "activity", "scoreboard"]);

export default function ProjeDetayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = typeof params?.id === "string" ? params.id : "";
  const { settings } = useSettings();
  const urgentPrioritySet = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  const statusOptions = getStatusOptions(settings);
  const priorityOptions = getPriorityOptions(settings);
  const { user, hasPermission, isAdmin } = useAuth();
  const canAddTask = hasPermission("projectDetail.addTask");
  const canEditTaskInProject = hasPermission("projectDetail.editTask");
  const canRemoveTask = hasPermission("projectDetail.removeTask");
  const canDeleteTask = hasPermission("projectDetail.deleteTask");
  const canImportCsv = hasPermission("projectDetail.importCsv");
  const canEditProject = hasPermission("projects.edit");
  // Arşivli projelere de detay sayfasından erişilebilsin
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects({ includeArchived: true });
  const {
    tasks,
    createTask,
    createTasksBulk,
    saveTask,
    isLoading: tasksLoading,
    error: tasksError,
  } = useTasksWithRealtime();

  const project = projects.find((p) => p.id === id);
  const assignedEmails = project?.assigned_emails ?? [];
  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();
  const isAssigned =
    !!currentUserEmail &&
    assignedEmails.some((e) => String(e).trim().toLowerCase() === currentUserEmail);
  const canPresenceSubscribe =
    !!id && !!project && (isAdmin || (assignedEmails.length > 0 && isAssigned));

  const {
    onlineUsers,
    viewerNotice,
    dismissViewerNotice,
  } = useProjectPresence({
    projectId: id,
    enabled: canPresenceSubscribe,
    userEmail: user?.email,
    userName: user?.displayName ?? user?.email,
    userId: user?.id,
    soundEnabled: settings.notificationsSound,
    browserPushEnabled: settings.notificationsPush,
    projectTitle: project?.name?.trim() || "Proje",
  });

  const [browserNotifPerm, setBrowserNotifPerm] = useState<NotificationPermission | null>(null);
  const [memberPermsOpen, setMemberPermsOpen] = useState(false);
  useEffect(() => {
    if (notificationApiAvailable()) setBrowserNotifPerm(Notification.permission);
  }, [user?.id]);

  const rawProjectTasks = id ? tasks.filter((t) => t.project_id === id) : [];
  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    rawProjectTasks.forEach((t) => { if (t.assignee?.trim()) set.add(t.assignee!.trim()); });
    return Array.from(set).sort();
  }, [rawProjectTasks]);

  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [newStatus, setNewStatus] = useState("Yapılacak");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<string>("Medium");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterKind>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReportOpen, setImportReportOpen] = useState(false);
  const [importReport, setImportReport] = useState<ImportValidationReport | null>(null);
  const [importInsertedCount, setImportInsertedCount] = useState(0);
  const [taskMutationError, setTaskMutationError] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<ProjectDetailTab>("overview");
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const taskParam = searchParams.get("task")?.trim() || null;
    if (tabParam && PROJECT_DETAIL_TABS.has(tabParam as ProjectDetailTab)) {
      setDetailView(tabParam as ProjectDetailTab);
    }
    if (taskParam) setFocusTaskId(taskParam);
    if (tabParam || taskParam) router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredProjectTasks = useMemo(
    () =>
      filterProjectTasks(rawProjectTasks, {
        assignee: assigneeFilter,
        status: statusFilter,
        date: dateFilter,
      }),
    [rawProjectTasks, assigneeFilter, statusFilter, dateFilter]
  );

  const filteredSortedProjectTasks = useMemo(
    () => sortTasksByUpdatedDesc(filteredProjectTasks),
    [filteredProjectTasks]
  );

  const hasTaskFiltersActive =
    assigneeFilter !== "all" || statusFilter !== "all" || dateFilter !== "all";

  const handleScoreboardAssigneeClick = useCallback((assignee: string) => {
    setAssigneeFilter(assignee);
    setStatusFilter("all");
    setDateFilter("all");
    setDetailView("tasks");
  }, []);

  /**
   * Proje sağlık KPI'ları — tüm proje görevleri üzerinden (filtreden bağımsız).
   * Tamamlanma % = tamamlanan / toplam; Gecikmiş/Bugün = tamamlanmamış görevlerden.
   */
  const projectKpis = useMemo(() => {
    const total = rawProjectTasks.length;
    let done = 0;
    let overdue = 0;
    let dueToday = 0;
    let unassigned = 0;
    const today0 = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
    for (const t of rawProjectTasks) {
      const isDone = isStatusDone(t.status);
      if (isDone) done++;
      if (!t.assignee || !t.assignee.trim()) unassigned++;
      if (!isDone) {
        const due = getTaskDueDate(t);
        if (due) {
          const due0 = (() => {
            const d = new Date(due);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          })();
          if (due0 < today0) overdue++;
          else if (due0 === today0) dueToday++;
        }
      }
    }
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, completionPct, overdue, dueToday, unassigned };
  }, [rawProjectTasks]);

  /** Son güncellenen 5 görev — Genel Bakış preview. */
  const recentTasks = useMemo(() => sortTasksByUpdatedDesc(rawProjectTasks).slice(0, 5), [rawProjectTasks]);

  /** Görev Özeti ile aynı başlık + alt satır mantığı (title_column, subtitle_columns). */
  const summaryExtraKeys = useMemo(
    () => parseListOptionString(settings.taskSummaryPreferredExtraKeys),
    [settings.taskSummaryPreferredExtraKeys]
  );
  const getRecentTaskDisplay = useCallback(
    (task: Task) => {
      const card = getTaskDisplayCard(task, {
        projectTitleColumn: project?.title_column ?? null,
        subtitleColumns: project?.subtitle_columns ?? null,
        preferredExtraKeys: summaryExtraKeys,
      });
      return {
        label: card.label,
        subtitle: card.subtitle.map((s) => s.value).join(" · "),
      };
    },
    [project?.title_column, project?.subtitle_columns, summaryExtraKeys]
  );

  const scoreRows = useMemo(() => computeProjectScoreRows(rawProjectTasks), [rawProjectTasks]);

  const scoreSummary = useMemo(() => summarizeProjectScoreRows(scoreRows), [scoreRows]);

  useEffect(() => {
    if (addTaskOpen) {
      setAddTaskError(null);
      setNewContent("");
      setNewStatus(settings.defaultTaskStatus);
      setNewAssignee("");
      setNewDueDate("");
      setNewPriority(project?.priority ?? settings.defaultTaskPriority);
    }
  }, [addTaskOpen, project?.priority, settings.defaultTaskStatus, settings.defaultTaskPriority]);

  const handleAddTask = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setSubmitting(true);
      setAddTaskError(null);
      try {
        await createTask({
          content: newContent.trim() || "Yeni görev",
          status: newStatus,
          assignee: assigneeValueForDatabase(project?.strict_assignee_visibility, newAssignee, currentUserEmail),
          project_id: id,
          due_date: newDueDate.trim() || null,
          priority: newPriority || null,
        });
        setAddTaskOpen(false);
      } catch (err) {
        console.error("[ProjeDetay] createTask failed:", err);
        const msg = err instanceof Error ? err.message : "Görev eklenemedi. Supabase tasks tablosunda project_id, due_date veya priority sütunları eksik olabilir.";
        setAddTaskError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [id, createTask, newContent, newStatus, newAssignee, newDueDate, newPriority, project?.strict_assignee_visibility, currentUserEmail]
  );

  const handleAssignToMe = useCallback(
    async (taskId: string) => {
      setTaskMutationError(null);
      setUpdatingId(taskId);
      try {
        const r = await saveTask(taskId, {
          assignee: project?.strict_assignee_visibility ? (currentUserEmail || null) : ME_LABEL,
          last_updated_by: "anon",
        });
        if (!r.ok) setTaskMutationError(r.message);
      } finally {
        setUpdatingId(null);
      }
    },
    [saveTask, project?.strict_assignee_visibility, currentUserEmail]
  );

  const handleRemoveFromProject = useCallback(
    async (taskId: string) => {
      setTaskMutationError(null);
      setUpdatingId(taskId);
      try {
        const r = await saveTask(taskId, { project_id: null });
        if (!r.ok) setTaskMutationError(r.message);
      } finally {
        setUpdatingId(null);
      }
    },
    [saveTask]
  );

  const handleImportTasks = useCallback(
    async (tasks: TaskImportRow[], report: ImportValidationReport) => {
      if (!id) return;
      setImporting(true);
      setTaskMutationError(null);
      try {
        const tasksToInsert = tasks.map((t) => ({
          content: t.content,
          status: t.status,
          assignee: t.assignee,
          project_id: id,
          due_date: t.due_date?.trim() || null,
          priority: t.priority?.trim() || null,
          extra_data: t.extra_data,
        }));
        if (tasksToInsert.length > 0) {
          await createTasksBulk(tasksToInsert);
        }
        setImportReport(report);
        setImportInsertedCount(tasksToInsert.length);
        setImportReportOpen(true);
      } catch (e) {
        console.error("[ProjeDetay] Import failed:", e);
        const msg = e instanceof Error ? e.message : "İçe aktarma tamamlanamadı.";
        setTaskMutationError(msg);
        throw e;
      } finally {
        setImporting(false);
      }
    },
    [id, createTasksBulk]
  );

  const handleStatusChange = useCallback(
    async (taskId: string, status: string) => {
      setTaskMutationError(null);
      setUpdatingId(taskId);
      try {
        const r = await saveTask(taskId, { status });
        if (!r.ok) setTaskMutationError(r.message);
      } finally {
        setUpdatingId(null);
      }
    },
    [saveTask]
  );

  if (!id) {
    return (
      <div className="container max-w-4xl py-8">
        <p className="text-slate-600 dark:text-slate-400">Proje bulunamadı.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/?tab=projeler">Projelere dön</Link>
        </Button>
      </div>
    );
  }

  if (projectsLoading || (projects.length > 0 && !project && !projectsError)) {
    return (
      <div className="container max-w-4xl py-12 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Proje yükleniyor…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container max-w-4xl py-8">
        <p className="text-slate-600 dark:text-slate-400">Proje bulunamadı.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/?tab=projeler">Projelere dön</Link>
        </Button>
      </div>
    );
  }

  /** Atama yoksa sadece admin; atama varsa admin veya atanan kullanıcılar. */
  const canAccessProject = isAdmin || (assignedEmails.length > 0 && isAssigned);

  if (!canAccessProject) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-amber-600 dark:text-amber-400 mb-3" />
          <p className="font-medium text-slate-800 dark:text-slate-200">Bu projeye erişim yetkiniz yok</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {assignedEmails.length === 0
              ? "Bu projeye henüz kullanıcı atanmamış. Yalnızca yöneticiler projeyi görüntüleyebilir ve atama yapabilir."
              : "Bu proje yalnızca atanan kullanıcılar tarafından açılabilir. Atanan kullanıcılar oturum açtığında projeyi açıp görevlerle çalışabilir."}
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/projeler">Projelere dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!hasPermission("projectDetail.view")) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-amber-600 dark:text-amber-400 mb-3" />
          <p className="font-medium text-slate-800 dark:text-slate-200">Proje detayını görüntüleme yetkiniz yok</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Bu sayfa için <code className="text-xs">projectDetail.view</code> yetkisi gerekir.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/projeler">Projelere dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "Projeler", href: "/?tab=projeler" },
            { label: project.name || "İsimsiz proje" },
          ]}
        />
        <Button variant="ghost" size="sm" asChild className="shrink-0 text-slate-600 dark:text-slate-400">
          <Link href="/?tab=projeler" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Projelere dön</span>
          </Link>
        </Button>
      </div>

      {taskMutationError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100"
        >
          <span className="min-w-0">{taskMutationError}</span>
          <button
            type="button"
            className="shrink-0 rounded px-1 font-medium underline underline-offset-2 hover:opacity-90"
            onClick={() => setTaskMutationError(null)}
          >
            Kapat
          </button>
        </div>
      )}

      {settings.notificationsPush && browserNotifPerm === "default" && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="region"
          aria-label="Tarayıcı bildirim izni"
        >
          <span>Projede katılım bildirimleri için tarayıcıdan izin verin.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-100 dark:hover:bg-amber-900/50"
            onClick={async () => {
              await requestNotificationPermission();
              if (notificationApiAvailable()) setBrowserNotifPerm(Notification.permission);
            }}
          >
            İzin ver
          </Button>
        </div>
      )}
      {settings.notificationsPush && browserNotifPerm === "denied" && (
        <p className="mb-4 text-xs text-amber-800 dark:text-amber-200/90">
          Tarayıcı bildirimleri engellenmiş. Adres çubuğundaki kilit / site ayarlarından bildirimlere izin verin.
        </p>
      )}

      <ProjectCommandHeader
        name={project.name || "İsimsiz proje"}
        description={project.description}
        status={project.status}
        dateLabel={formatDate(
          new Date(project.updated_at || project.created_at || Date.now()),
          settings.dateFormat
        )}
        targetDueDate={project.due_date}
        priority={project.priority}
        dateFormat={settings.dateFormat}
        assignedEmails={assignedEmails}
        currentUserEmail={currentUserEmail}
        isAssigned={isAssigned}
        onlineUsers={onlineUsers}
        kpis={projectKpis}
        liveTableHref={`/canli-tablo?project=${encodeURIComponent(id)}`}
        editHref={`/?tab=projeler&editProject=${encodeURIComponent(id)}`}
        canEdit={canEditProject}
        canManageMembers={isAdmin || user?.roleId === "project_manager"}
        onMemberPermissions={() => setMemberPermsOpen(true)}
        activeTab={detailView}
        onTabChange={setDetailView}
      />

      <div className="mt-4">
        {detailView === "overview" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
            <ProjectRecentTasksPanel
              projectId={id}
              tasks={recentTasks}
              totalCount={projectKpis.total}
              loading={tasksLoading}
              getTaskDisplay={getRecentTaskDisplay}
              formatAssignee={(a) => formatAssigneeForDisplay(a, currentUserEmail)}
              isOverdue={isTaskOverdue}
              className="lg:max-h-[calc(100dvh-12rem)]"
            />
            <ProjectOverviewSummary
              kpis={projectKpis}
              onOpenScoreboard={() => setDetailView("scoreboard")}
            />
          </div>
        )}

        {detailView === "tasks" && (
          <>
            {(canAddTask || canImportCsv) && (
              <div className="mb-3 flex flex-wrap gap-2">
                {canAddTask && (
                  <RestrictedButton
                    permission="projectDetail.addTask"
                    type="button"
                    size="sm"
                    className="h-9 gap-1.5 bg-orange-600 text-white hover:bg-orange-700"
                    onClick={() => setAddTaskOpen(true)}
                  >
                    <PlusCircle className="h-4 w-4" aria-hidden />
                    Görev ekle
                  </RestrictedButton>
                )}
                {canImportCsv && (
                  <RestrictedButton
                    permission="projectDetail.importCsv"
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    CSV / JSON içe aktar
                  </RestrictedButton>
                )}
              </div>
            )}
            <ProjectTasksFilterBar
              assigneeFilter={assigneeFilter}
              onAssigneeFilterChange={setAssigneeFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              dateFilter={dateFilter}
              onDateFilterChange={setDateFilter}
              assigneeOptions={uniqueAssignees}
              statusOptions={statusOptions}
              formatAssignee={(email) => formatAssigneeForDisplay(email, currentUserEmail)}
              filteredCount={filteredProjectTasks.length}
              totalCount={rawProjectTasks.length}
            />
            <ProjectRecentTasksPanel
              projectId={id}
              tasks={filteredSortedProjectTasks}
              totalCount={rawProjectTasks.length}
              loading={tasksLoading}
              title="Proje görevleri"
              showViewAll={false}
              emptyMessage={
                hasTaskFiltersActive && filteredSortedProjectTasks.length === 0
                  ? "Seçili filtrelere uyan görev bulunamadı."
                  : undefined
              }
              getTaskDisplay={getRecentTaskDisplay}
              formatAssignee={(a) => formatAssigneeForDisplay(a, currentUserEmail)}
              isOverdue={isTaskOverdue}
              className="max-h-[calc(100dvh-14rem)]"
            />
          </>
        )}

        {detailView === "activity" && (
          <div className="lg:max-h-[calc(100dvh-12rem)]">
            <ProjectActivityTimeline
              projectId={id}
              taskIds={rawProjectTasks.map((t) => t.id)}
              tasks={rawProjectTasks}
              projectTitleColumn={project?.title_column ?? null}
              subtitleColumns={project?.subtitle_columns ?? null}
              preferredExtraKeys={summaryExtraKeys}
              layout="panel"
              className="h-full min-h-[24rem] lg:min-h-0"
              focusTaskId={focusTaskId}
              onClearFocusTask={() => setFocusTaskId(null)}
            />
          </div>
        )}

        {detailView === "scoreboard" && (
          <ProjectScoreboardTab
            scoreRows={scoreRows}
            scoreSummary={scoreSummary}
            formatAssignee={(assignee) => formatAssigneeForDisplay(assignee, currentUserEmail)}
            onAssigneeClick={handleScoreboardAssigneeClick}
          />
        )}
      </div>


      <ProjectAddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        error={addTaskError}
        content={newContent}
        onContentChange={setNewContent}
        status={newStatus}
        onStatusChange={setNewStatus}
        assignee={newAssignee}
        onAssigneeChange={setNewAssignee}
        dueDate={newDueDate}
        onDueDateChange={setNewDueDate}
        priority={newPriority}
        onPriorityChange={setNewPriority}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        strictAssigneeVisibility={project?.strict_assignee_visibility}
        currentUserEmail={currentUserEmail}
        submitting={submitting}
        onSubmit={handleAddTask}
      />

      <ProjectImportTasksDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        assignedEmails={assignedEmails}
        defaultStatus={settings.defaultTaskStatus}
        defaultPriority={project?.priority ?? settings.defaultTaskPriority}
        importing={importing}
        onImport={handleImportTasks}
      />

      <ProjectImportReportDialog
        open={importReportOpen}
        onOpenChange={setImportReportOpen}
        inserted={importInsertedCount}
        report={importReport}
      />

      {/* Üye izinleri paneli — admin/PM tarafından açılır */}
      {project && (
        <ProjectMemberPermissionsPanel
          open={memberPermsOpen}
          onOpenChange={setMemberPermsOpen}
          projectId={project.id}
          projectName={project.name || "İsimsiz proje"}
          assignedEmails={assignedEmails}
        />
      )}

      {viewerNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-[70] top-[4.5rem] end-3 max-w-[min(18rem,calc(100vw-1.5rem))] animate-in fade-in slide-in-from-right-4 duration-300 sm:end-6 sm:top-20"
        >
          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-white/95 px-3.5 py-2.5 text-sm font-medium text-sky-950 shadow-lg backdrop-blur-sm dark:border-sky-800 dark:bg-slate-900/95 dark:text-sky-50">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
            <span className="min-w-0 flex-1 leading-snug">{viewerNotice.message}</span>
            <button
              type="button"
              onClick={dismissViewerNotice}
              className="-m-1 shrink-0 rounded-md p-1 text-sky-700 hover:bg-sky-100 dark:text-sky-200 dark:hover:bg-sky-900/60"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
