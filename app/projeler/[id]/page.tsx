"use client";

import { useParams } from "next/navigation";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useSettings } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/formatDate";
import { parseCSV } from "@/lib/csvParser";
import { parseJSON } from "@/lib/jsonParser";
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
import { ArrowLeft, PlusCircle, Unlink, Loader2, ListTodo, User, Calendar, Upload, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["Yapılacak", "Devam ediyor", "Tamamlandı"];
const STATUS_STYLES: Record<string, string> = {
  Yapılacak: "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300",
  "Devam ediyor": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Tamamlandı: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};
const PRIORITY_OPTIONS = ["High", "Medium", "Low"] as const;
const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300",
};
const ME_LABEL = "Ben";
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

/** CSV'den gelen görevlerde content boş olabilir; listede göstermek için extra_data'dan başlık/ilk değer alır. */
function getTaskDisplayLabel(task: { content?: string | null; extra_data?: Record<string, string> | null }): string {
  const c = (task.content ?? "").trim();
  if (c) return c;
  const ed = task.extra_data;
  if (!ed || typeof ed !== "object") return "—";
  const preferKeys = ["Başlık", "Görev", "Ad", "İsim", "Title", "Name", "Açıklama", "Description"];
  for (const k of preferKeys) {
    const v = ed[k] ?? ed[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  const first = Object.values(ed).find((v) => v != null && String(v).trim() !== "");
  return first != null ? String(first).trim() : "—";
}

export default function ProjeDetayPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const { settings } = useSettings();
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
  const [importing, setImporting] = useState(false);
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
      setNewStatus("Yapılacak");
      setNewAssignee("");
      setNewDueDate("");
      setNewPriority(project?.priority ?? "Medium");
    }
  }, [addTaskOpen, project?.priority]);

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
          assignee: newAssignee.trim() || null,
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
    [id, createTask, newContent, newStatus, newAssignee, newDueDate, newPriority]
  );

  const handleAssignToMe = useCallback(
    async (taskId: string) => {
      setUpdatingId(taskId);
      try {
        await saveTask(taskId, { assignee: ME_LABEL, last_updated_by: "anon" });
      } finally {
        setUpdatingId(null);
      }
    },
    [saveTask]
  );

  const handleRemoveFromProject = useCallback(
    async (taskId: string) => {
      setUpdatingId(taskId);
      try {
        await saveTask(taskId, { project_id: null });
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
      type TaskInsert = { content: string; status: string; assignee: string | null; project_id: string; extra_data: Record<string, string> | null; priority?: string | null };
      const tasksToInsert: TaskInsert[] = [];
      if (isJson) {
        const { headers, rows } = parseJSON(text);
        if (headers.length > 0 && rows.length > 0) {
          for (const row of rows) {
            const extra_data: Record<string, string> = {};
            headers.forEach((h) => {
              const key = (h ?? "").trim() || "Sütun";
              extra_data[key] = row[key] ?? "";
            });
            const hasAnyData = Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
            if (hasAnyData) {
              const firstValue = Object.values(extra_data).find((v) => v != null && String(v).trim() !== "");
              const content = firstValue != null ? String(firstValue).trim() : "";
              tasksToInsert.push({
                content,
                status: "Yapılacak",
                assignee: null,
                project_id: id,
                extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                priority: projectPriority,
              });
            }
          }
        }
      } else {
        const { headers, rows } = parseCSV(text);
        if (headers.length > 0 && rows.length > 0) {
          for (const row of rows) {
            const extra_data: Record<string, string> = {};
            headers.forEach((h, i) => {
              const key = (h ?? "").trim() || `Sütun ${i + 1}`;
              extra_data[key] = (row[i] != null ? String(row[i]).trim() : "") ?? "";
            });
            const hasAnyData = Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
            if (hasAnyData) {
              // Liste satırında anlamlı görünsün: ilk sütun (veya ilk dolu değer) content olarak kullanılır
              const firstValue = Object.values(extra_data).find((v) => v != null && String(v).trim() !== "");
              const content = firstValue != null ? String(firstValue).trim() : "";
              tasksToInsert.push({
                content,
                status: "Yapılacak",
                assignee: null,
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
    } catch (e) {
      console.error("[ProjeDetay] Import failed:", e);
    } finally {
      setImporting(false);
    }
  }, [importFile, id, project?.priority, createTasksBulk]);

  const handleStatusChange = useCallback(
    async (taskId: string, status: string) => {
      setUpdatingId(taskId);
      try {
        await saveTask(taskId, { status });
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

  const assignedEmails = project.assigned_emails ?? [];
  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();
  const isAssigned =
    currentUserEmail &&
    assignedEmails.some((e) => String(e).trim().toLowerCase() === currentUserEmail);
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

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-4">
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
        </div>

        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">Bu projedeki görevler</h2>
            <div className="flex items-center gap-2">
              {canAddTask && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddTaskOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Görev ekle
                </Button>
              )}
              {canImportCsv && (
                <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)} className="text-slate-700 dark:text-slate-300">
                  <Upload className="mr-2 h-4 w-4" />
                  CSV/JSON
                </Button>
              )}
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
                <option key={a} value={a}>{a}</option>
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
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="outline" className={cn("text-xs font-normal", STATUS_STYLES[task.status] ?? "")}>
                      {task.status}
                    </Badge>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[4rem]">
                    {task.assignee ? task.assignee : "—"}
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
                  {task.priority && (
                    <Badge variant="outline" className={cn("text-xs font-normal", PRIORITY_STYLES[task.priority] ?? "")}>
                      {task.priority}
                    </Badge>
                  )}
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
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {STATUS_OPTIONS.map((s) => (
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
                  onClick={() => setNewAssignee(ME_LABEL)}
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
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {PRIORITY_OPTIONS.map((p) => (
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
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSV / JSON ile toplu görev ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              CSV veya JSON dosyası yükleyin. Tüm sütunlar olduğu gibi tabloya yansır; ilk sütun boş olamaz.
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setImportOpen(false); setImportFile(null); }}>
              İptal
            </Button>
            <Button type="button" onClick={handleImportFile} disabled={!importFile || importing} className="bg-blue-600 hover:bg-blue-700">
              {importing ? "Ekleniyor…" : "Görevleri ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
