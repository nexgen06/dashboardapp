"use client";

import { useParams } from "next/navigation";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useSettings, getStatusOptions, getPriorityOptions } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/formatDate";
import { parseCSV } from "@/lib/csvParser";
import { parseJSON } from "@/lib/jsonParser";
import { urgentPrioritySetFromCsv } from "@/lib/urgentTaskPriority";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { RestrictedButton } from "@/components/ui/permission-gate";
import {
  findAssigneeColumnIndex,
  findAssigneeJsonKey,
  normalizeTaskAssigneeEmail,
  pickRoundRobinAssignee,
} from "@/lib/projectImportAssignee";
import type { ProjectStatus } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, PlusCircle, Unlink, Loader2, ListTodo, User, Calendar, Upload, Users, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectPresence } from "@/hooks/useProjectPresence";
import { useProjectChatRoom } from "@/hooks/useProjectChatRoom";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import { OnlineUsersPanel } from "@/components/OnlineUsersPanel";
import { ProjectChatPanel } from "@/components/ProjectChatPanel";
import {
  requestNotificationPermission,
  notificationApiAvailable,
} from "@/lib/browserNotifications";
import { getTaskDisplayLabel } from "@/lib/taskDisplayLabel";

const STATUS_STYLES: Record<string, string> = {
  Yapılacak: "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300",
  "Devam ediyor": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Tamamlandı: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};
const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300",
};
const ME_LABEL = "Ben";

/** Katı RLS için DB'de e-posta tutulur; arayüzde kendi satırında "Ben" gösterilir. */
function formatAssigneeForDisplay(assignee: string | null | undefined, viewerEmail: string): string {
  const a = assignee?.trim() ?? "";
  if (!a) return "—";
  const v = viewerEmail.trim().toLowerCase();
  if (v && a.toLowerCase() === v) return ME_LABEL;
  return a;
}

/** Katı modda atananda "Ben" yerine oturum e-postası yazılır (RLS eşleşmesi). */
function assigneeValueForDatabase(
  strictAssigneeVisibility: boolean | undefined,
  formValue: string,
  viewerEmail: string
): string | null {
  const t = formValue.trim();
  if (!t) return null;
  if (!strictAssigneeVisibility) return t;
  if (t === ME_LABEL) {
    const e = viewerEmail.trim().toLowerCase();
    return e || null;
  }
  return t;
}
const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  Aktif: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  Tamamlandı: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
  Beklemede: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
};

type DateFilterKind = "all" | "week" | "month" | "overdue";

function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today && String(dueDate).trim() !== "";
}

function inDateRange(dueDate: string | null | undefined, kind: DateFilterKind): boolean {
  if (!dueDate || kind === "all") return true;
  const d = new Date(dueDate);
  const now = new Date();
  if (kind === "overdue") return isOverdue(dueDate);
  if (kind === "week") {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= now && d <= weekEnd;
  }
  if (kind === "month") {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return d >= now && d <= monthEnd;
  }
  return true;
}

export default function ProjeDetayPage() {
  const params = useParams();
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
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects();
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

  const { refresh: refreshChatUnread } = useProjectChatUnread();

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

  const { chatMessages, sendChatMessage, chatReady } = useProjectChatRoom({
    projectId: id,
    enabled: canPresenceSubscribe,
    userEmail: user?.email,
    userName: user?.displayName ?? user?.email,
    onAfterMarkRead: refreshChatUnread,
  });

  const [browserNotifPerm, setBrowserNotifPerm] = useState<NotificationPermission | null>(null);
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
  const [dateFilter, setDateFilter] = useState<DateFilterKind>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRoundRobin, setImportRoundRobin] = useState(false);
  const [importDefaultAssignee, setImportDefaultAssignee] = useState("");
  const [importing, setImporting] = useState(false);
  const [taskMutationError, setTaskMutationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectTasks = useMemo(() => {
    return rawProjectTasks.filter((t) => {
      if (assigneeFilter !== "all" && (t.assignee?.trim() ?? "") !== assigneeFilter) return false;
      return inDateRange(t.due_date, dateFilter);
    });
  }, [rawProjectTasks, assigneeFilter, dateFilter]);

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

  const handleImportFile = useCallback(async () => {
    if (!importFile || !id) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const fileName = (importFile.name || "").toLowerCase();
      const isJson = fileName.endsWith(".json");
      const p = (project?.priority != null ? String(project.priority).trim() : "").toLowerCase();
      const projectPriority = p === "high" ? "High" : p === "medium" ? "Medium" : p === "low" ? "Low" : null;
      const recipients = assignedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
      const roundRobin = importRoundRobin && recipients.length >= 2;
      const defaultRaw = importDefaultAssignee.trim();
      const defaultAssignee =
        normalizeTaskAssigneeEmail(defaultRaw) ?? (defaultRaw || null);
      type TaskInsert = { content: string; status: string; assignee: string | null; project_id: string; extra_data: Record<string, string> | null; priority?: string | null };
      const tasksToInsert: TaskInsert[] = [];
      let distributeIndex = 0;
      if (isJson) {
        const { headers, rows } = parseJSON(text);
        const assigneeKey = roundRobin ? null : findAssigneeJsonKey(headers);
        if (headers.length > 0 && rows.length > 0) {
          for (const row of rows) {
            const extra_data: Record<string, string> = {};
            headers.forEach((h) => {
              const key = (h ?? "").trim() || "Sütun";
              extra_data[key] = row[key] ?? "";
            });
            const hasAnyData = Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
            if (hasAnyData) {
              const fromCol =
                assigneeKey != null ? normalizeTaskAssigneeEmail(row[assigneeKey]) : null;
              const assignee = roundRobin
                ? pickRoundRobinAssignee(recipients, distributeIndex)
                : (fromCol ?? defaultAssignee);
              distributeIndex += 1;
              tasksToInsert.push({
                content: "",
                status: "Yapılacak",
                assignee,
                project_id: id,
                extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                priority: projectPriority,
              });
            }
          }
        }
      } else {
        const { headers, rows } = parseCSV(text);
        const assigneeCol = roundRobin ? null : findAssigneeColumnIndex(headers);
        if (headers.length > 0 && rows.length > 0) {
          for (const row of rows) {
            const extra_data: Record<string, string> = {};
            headers.forEach((h, i) => {
              const key = (h ?? "").trim() || `Sütun ${i + 1}`;
              extra_data[key] = (row[i] != null ? String(row[i]).trim() : "") ?? "";
            });
            const hasAnyData = Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
            if (hasAnyData) {
              const fromCol =
                assigneeCol != null ? normalizeTaskAssigneeEmail(row[assigneeCol]) : null;
              const assignee = roundRobin
                ? pickRoundRobinAssignee(recipients, distributeIndex)
                : (fromCol ?? defaultAssignee);
              distributeIndex += 1;
              tasksToInsert.push({
                content: "",
                status: "Yapılacak",
                assignee,
                project_id: id,
                extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                priority: projectPriority,
              });
            }
          }
        }
      }
      if (tasksToInsert.length > 0) {
        await createTasksBulk(tasksToInsert);
      }
      setImportOpen(false);
      setImportFile(null);
      setImportRoundRobin(false);
      setImportDefaultAssignee("");
    } catch (e) {
      console.error("[ProjeDetay] Import failed:", e);
    } finally {
      setImporting(false);
    }
  }, [
    importFile,
    id,
    project?.priority,
    createTasksBulk,
    assignedEmails,
    importRoundRobin,
    importDefaultAssignee,
  ]);

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
    <div className="container max-w-4xl py-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="text-slate-600 dark:text-slate-400 -ml-2">
          <Link href="/?tab=projeler" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Projelere dön
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

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-4">
          {settings.notificationsPush && browserNotifPerm === "default" && (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              role="region"
              aria-label="Tarayıcı bildirim izni"
            >
              <span>Projede katılım bildirimleri için tarayıcıdan izin verin.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300 bg-white hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-900/50"
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
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{project.name || "İsimsiz proje"}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{project.description || "—"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("text-xs font-normal", PROJECT_STATUS_STYLES[project.status])}>
              {project.status}
            </Badge>
            {isAssigned && (
              <Badge variant="outline" className="text-xs font-normal bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Bu projeye atandınız — canlı tablo verisiyle çalışabilirsiniz
              </Badge>
            )}
            {(project.updated_at || project.created_at) && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatDate(new Date(project.updated_at || project.created_at!), settings.dateFormat)}
              </span>
            )}
          </div>
          {assignedEmails.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Atanan kullanıcılar:</span>
              {assignedEmails.map((email) => (
                <span
                  key={email}
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs",
                    email.toLowerCase() === currentUserEmail
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  )}
                >
                  {email}
                </span>
              ))}
            </div>
          )}
          {onlineUsers.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 shrink-0" />
                Şu an bu projede çevrimiçi:
              </span>
              <OnlineUsersPanel
                onlineUsers={onlineUsers}
                editorsByRowId={new Map()}
                currentUserEmail={currentUserEmail}
                tasks={[]}
              />
            </div>
          )}
          <ProjectChatPanel
            messages={chatMessages}
            onSend={sendChatMessage}
            currentUserEmail={currentUserEmail}
            chatReady={chatReady}
          />
        </div>

        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">Bu projedeki görevler</h2>
            <div className="flex items-center gap-2">
              <RestrictedButton
                permission="projectDetail.addTask"
                type="button"
                size="sm"
                onClick={() => setAddTaskOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Görev ekle
              </RestrictedButton>
              <RestrictedButton
                permission="projectDetail.importCsv"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="text-slate-700 dark:text-slate-300"
              >
                <Upload className="mr-2 h-4 w-4" />
                CSV/JSON
              </RestrictedButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Atayana göre:
            </span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="all">Tümü</option>
              {uniqueAssignees.map((a) => (
                <option key={a} value={a}>
                  {formatAssigneeForDisplay(a, currentUserEmail)}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-2">
              <Calendar className="h-3.5 w-3.5" />
              Tarihine göre:
            </span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterKind)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="all">Tümü</option>
              <option value="week">Bu hafta</option>
              <option value="month">Bu ay</option>
              <option value="overdue">Gecikmiş</option>
            </select>
          </div>

          {tasksError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{tasksError}</p>
          )}

          {tasksLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Görevler yükleniyor…
            </div>
          ) : projectTasks.length === 0 ? (
            <div className="py-12 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50">
              <ListTodo className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Bu projede henüz görev yok.</p>
              {canAddTask && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddTaskOpen(true)}
                  className="mt-3 bg-blue-600 hover:bg-blue-700"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Görev ekle
                </Button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {projectTasks.map((task) => (
                <li
                  key={task.id}
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-lg border p-3",
                    updatingId === task.id && "opacity-70",
                    isOverdue(task.due_date)
                      ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30"
                      : "border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50"
                  )}
                >
                  <span className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100 truncate" title={getTaskDisplayLabel(task)}>
                    {getTaskDisplayLabel(task)}
                  </span>
                  {canEditTaskInProject ? (
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      disabled={updatingId === task.id}
                      className={cn(
                        "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100",
                        STATUS_STYLES[task.status] ?? ""
                      )}
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="outline" className={cn("text-xs font-normal", STATUS_STYLES[task.status] ?? "")}>
                      {task.status}
                    </Badge>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[4rem]">
                    {formatAssigneeForDisplay(task.assignee, currentUserEmail)}
                  </span>
                  {canEditTaskInProject && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAssignToMe(task.id)}
                      disabled={updatingId === task.id}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 text-xs"
                      title="Bana ata"
                    >
                      Bana ata
                    </Button>
                  )}
                  {task.due_date ? (
                    <span
                      className={cn(
                        "text-xs",
                        isOverdue(task.due_date)
                          ? "text-red-600 dark:text-red-400 font-medium"
                          : "text-slate-500 dark:text-slate-400"
                      )}
                      title={isOverdue(task.due_date) ? "Gecikmiş" : undefined}
                    >
                      {formatDate(new Date(task.due_date), settings.dateFormat)}
                      {isOverdue(task.due_date) ? " (Gecikmiş)" : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                  )}
                  <PriorityBadge priority={task.priority} urgentSet={urgentPrioritySet} />
                  {task.updated_at && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(new Date(task.updated_at), settings.dateFormat)}
                    </span>
                  )}
                  {canRemoveTask && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFromProject(task.id)}
                      disabled={updatingId === task.id}
                      className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                      title="Projeden çıkar"
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle>Bu projeye görev ekle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="grid gap-4 py-2">
            {addTaskError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
                {addTaskError}
              </div>
            )}
            <div>
              <label htmlFor="proje-task-content" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Görev adı / İçerik
              </label>
              <input
                id="proje-task-content"
                type="text"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Görev açıklaması"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="proje-task-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Durum
              </label>
              <select
                id="proje-task-status"
                value={statusOptions.includes(newStatus) ? newStatus : statusOptions[0]}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="proje-task-assignee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Atanan kişi (opsiyonel)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Görevin sorumlusu olarak görünecek isim veya e-posta. Listede &quot;Atayana göre&quot; filtresinde kullanılır; yetki vermez.
              </p>
              <div className="flex gap-2">
                <input
                  id="proje-task-assignee"
                  type="text"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Örn. Ahmet veya ahmet@firma.com"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNewAssignee(project?.strict_assignee_visibility ? currentUserEmail : ME_LABEL)
                  }
                  className="shrink-0"
                >
                  Bana ata
                </Button>
              </div>
            </div>
            <div>
              <label htmlFor="proje-task-due" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Son tarih (opsiyonel)
              </label>
              <input
                id="proje-task-due"
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="proje-task-priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Öncelik
              </label>
              <select
                id="proje-task-priority"
                value={priorityOptions.includes(newPriority) ? newPriority : priorityOptions[0]}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddTaskOpen(false)}>
                İptal
              </Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                {submitting ? "Ekleniyor…" : "Ekle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV/JSON Import Modal */}
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportFile(null);
            setImportRoundRobin(false);
            setImportDefaultAssignee("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSV / JSON ile toplu görev ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              CSV veya JSON dosyası yükleyin. Tüm sütunlar tabloya yansır. &quot;Atanan&quot; / &quot;assignee&quot; başlıklı sütun varsa satır bazında kullanılır; yoksa aşağıdaki e-posta tüm satırlara uygulanır (atama boş kalabilir).
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="hidden"
              aria-hidden
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {importFile ? importFile.name : "Dosya seç"}
            </Button>
            {importFile && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                ✓ Dosya seçildi: {importFile.name}
              </p>
            )}
            <div>
              <label htmlFor="import-default-assignee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Varsayılan atanan (e-posta, opsiyonel)
              </label>
              <input
                id="import-default-assignee"
                type="email"
                value={importDefaultAssignee}
                onChange={(e) => setImportDefaultAssignee(e.target.value)}
                placeholder="atanan@ornek.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            {assignedEmails.length >= 2 && (
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={importRoundRobin}
                  onChange={(e) => setImportRoundRobin(e.target.checked)}
                />
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  <strong>Eşit dağıt (round-robin):</strong> Projedeki atanan e-posta listesine sırayla paylaştır. İşaretliyken dosyadaki atanan sütunu yok sayılır.
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setImportOpen(false); setImportFile(null); setImportRoundRobin(false); setImportDefaultAssignee(""); }}>
              İptal
            </Button>
            <Button type="button" onClick={handleImportFile} disabled={!importFile || importing} className="bg-blue-600 hover:bg-blue-700">
              {importing ? "Ekleniyor…" : "Görevleri ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
