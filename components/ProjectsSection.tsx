"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { useTaskCountByProject } from "@/hooks/useTaskCountByProject";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useSettings } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/formatDate";
import { parseCSV } from "@/lib/csvParser";
import { parseJSON } from "@/lib/jsonParser";
import type { Project, ProjectStatus, ProjectPriority } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, PlusCircle, MoreVertical, Pencil, Archive, Trash2, RotateCw, Upload, FileText, UserPlus, X, Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export type NewProjectSubmitData = {
  name: string;
  description: string;
  status: ProjectStatus;
  importFile?: File | null;
  assignee?: string;
  /** Projede çalışabilecek kullanıcıların e-postaları. Bu kişiler oturum açıp projeyi açtığında canlı tablo verisini görüntüleyip çalışabilir. */
  assignedEmails?: string[];
  /** Proje hedef / bitiş tarihi (ISO date string). */
  due_date?: string | null;
  /** Proje önceliği (High / Medium / Low). */
  priority?: ProjectPriority | null;
};

const STATUS_OPTIONS: ProjectStatus[] = ["Aktif", "Tamamlandı", "Beklemede"];
const STATUS_STYLES: Record<ProjectStatus, string> = {
  Aktif: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  Tamamlandı: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
  Beklemede: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
};

const PRIORITY_OPTIONS: ProjectPriority[] = ["High", "Medium", "Low"];
const PRIORITY_STYLES: Record<ProjectPriority, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

/** Form/API'den gelen önceliği "High" | "Medium" | "Low" olarak normalleştirir; JSON/CSV importta görevlere yansıtılır. */
function normalizeProjectPriority(v: string | ProjectPriority | null | undefined): ProjectPriority | null {
  const s = (v != null ? String(v).trim() : "").toLowerCase();
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return null;
}

/** Proje hedef tarihine göre "Gecikmiş" veya "Yaklaşan" etiketi. */
function getProjectDueLabel(project: Project): "Gecikmiş" | "Yaklaşan" | null {
  const d = project.due_date?.trim();
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  if (due.getTime() < today.getTime()) return "Gecikmiş";
  const inDays = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (inDays <= 30) return "Yaklaşan";
  return null;
}

function ProjectFormModal({
  open,
  onOpenChange,
  project,
  onSubmit,
  isSubmitting,
  formError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSubmit: (data: NewProjectSubmitData) => Promise<void>;
  isSubmitting: boolean;
  formError?: string | null;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "Aktif");
  const [dueDate, setDueDate] = useState(project?.due_date?.slice(0, 10) ?? "");
  const [priority, setPriority] = useState<ProjectPriority | "">(project?.priority ?? "");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [assignee, setAssignee] = useState("");
  const [assignedEmails, setAssignedEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!project;
  const title = isEdit ? "Projeyi düzenle" : "Yeni proje";

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description);
      setStatus(project.status);
      setDueDate(project.due_date?.slice(0, 10) ?? "");
      setPriority(project.priority ?? "");
      setImportFile(null);
      setAssignee("");
      setAssignedEmails(project.assigned_emails ?? []);
      setEmailInput("");
    } else if (open && !project) {
      setName("");
      setDescription("");
      setStatus("Aktif");
      setDueDate("");
      setPriority("");
      setImportFile(null);
      setAssignee("");
      setAssignedEmails([]);
      setEmailInput("");
    }
  }, [open, project]);

  const addAssignedEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (assignedEmails.includes(email)) return;
    setAssignedEmails((prev) => [...prev, email]);
    setEmailInput("");
  };

  const removeAssignedEmail = (email: string) => {
    setAssignedEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      status,
      due_date: dueDate.trim() || undefined,
      priority: priority ? (priority as ProjectPriority) : undefined,
      importFile: isEdit ? undefined : importFile ?? undefined,
      assignee: isEdit ? undefined : (assignee.trim() || undefined),
      assignedEmails: assignedEmails.length > 0 ? assignedEmails : undefined,
    });
    onOpenChange(false);
    setName("");
    setDescription("");
    setStatus("Aktif");
    setDueDate("");
    setPriority("");
    setImportFile(null);
    setAssignee("");
    setAssignedEmails([]);
    setEmailInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={true} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Ad
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Proje adı"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="project-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Açıklama
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kısa açıklama"
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 resize-none"
            />
          </div>
          <div>
            <label htmlFor="project-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Durum
            </label>
            <select
              id="project-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="project-due-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Calendar className="inline h-3.5 w-3.5 mr-1" />
              Hedef tarih
            </label>
            <input
              id="project-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Proje hedef / bitiş tarihi. Kartlarda &quot;Yaklaşan&quot; / &quot;Gecikmiş&quot; etiketi için kullanılır.
            </p>
          </div>
          <div>
            <label htmlFor="project-priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Flag className="inline h-3.5 w-3.5 mr-1" />
              Öncelik
            </label>
            <select
              id="project-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectPriority | "")}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">Seçin</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <UserPlus className="inline h-3.5 w-3.5 mr-1" />
              Atanan kullanıcılar (e-posta)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Bu kişiler oturum açtığında proje kartını açıp canlı tablo verisini görüntüleyip çalışabilir. E-posta yazıp Ekle ile ekleyin.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAssignedEmail(); } }}
                placeholder="ornek@email.com"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 w-48"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAssignedEmail}
                disabled={!emailInput.trim()}
              >
                Ekle
              </Button>
            </div>
            {assignedEmails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {assignedEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs text-slate-700 dark:text-slate-200"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeAssignedEmail(email)}
                      className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500"
                      aria-label={`${email} kaldır`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {!isEdit && (
            <>
              <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 p-3 space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  CSV / JSON ile görev aktar
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proje oluşturulduktan sonra dosyadaki satırlar canlı tabloya görev olarak eklenir. Orijinal sütun başlıkları korunur; işlemi yapacak kullanıcıyı seçin.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  aria-hidden
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importFile ? importFile.name : "CSV veya JSON dosyası seç"}
                </Button>
                {importFile && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <FileText className="h-4 w-4 shrink-0" />
                    {importFile.name}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="project-assignee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  İşlemi yapacak kullanıcı (atanan)
                </label>
                <input
                  id="project-assignee"
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Dosyadan eklenen görevlere atanacak kişi"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Dosya yüklediyseniz bu alan tüm görevlere atanan olarak uygulanır.
                </p>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isEdit ? "Kaydet" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type ProjectsSectionVariant = "default" | "page";

export function ProjectsSection({ variant = "default" }: { variant?: ProjectsSectionVariant }) {
  const { settings } = useSettings();
  const { user, hasPermission, isAdmin } = useAuth();
  const canCreateProject = hasPermission("projects.create");
  const currentUserEmail = (user?.email ?? "").toLowerCase();
  const isPageVariant = variant === "page";
  const canEditProject = hasPermission("projects.edit");
  /** Projeyi gösterebilir mi: admin her zaman; atama varsa sadece atananlar, atama yoksa kimse (sadece admin). */
  const canViewProject = useCallback(
    (p: Project) => {
      const email = currentUserEmail.trim().toLowerCase();
      if (!email) return isAdmin;
      return (
        isAdmin ||
        ((p.assigned_emails?.length ?? 0) > 0 &&
          (p.assigned_emails ?? []).some((e) => String(e).trim().toLowerCase() === email))
      );
    },
    [isAdmin, currentUserEmail]
  );
  const canDeleteProject = hasPermission("projects.delete");
  const canArchiveProject = hasPermission("projects.archive");
  const {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
  } = useProjects();
  const { createTasksBulk } = useTasksWithRealtime();
  const taskCountByProject = useTaskCountByProject();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Tümü");
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    let result = projects.filter(canViewProject);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "Tümü") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (assignedToMeOnly && currentUserEmail) {
      result = result.filter((p) =>
        (p.assigned_emails ?? []).some((e) => e.toLowerCase() === currentUserEmail)
      );
    }
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom).getTime() : 0;
      const to = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
      result = result.filter((p) => {
        const ts = p.updated_at ? new Date(p.updated_at).getTime() : (p.created_at ? new Date(p.created_at).getTime() : 0);
        return ts >= from && ts <= to;
      });
    }
    return result;
  }, [projects, canViewProject, search, statusFilter, assignedToMeOnly, currentUserEmail, dateFrom, dateTo]);

  const handleFormSubmit = async (data: NewProjectSubmitData) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: data.name,
          description: data.description,
          status: data.status,
          assigned_emails: data.assignedEmails ?? [],
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
        });
        setFormOpen(false);
        setEditingProject(null);
        setFormError(null);
        return;
      }
      const projectId = await createProject({
        name: data.name,
        description: data.description,
        status: data.status,
        assigned_emails: data.assignedEmails?.length ? data.assignedEmails : undefined,
        due_date: data.due_date ?? undefined,
        priority: data.priority ?? undefined,
      });
      if (data.importFile && projectId) {
        const text = await data.importFile.text();
        const fileName = (data.importFile.name || "").toLowerCase();
        const isJson = fileName.endsWith(".json");
        const assignee = (data.assignee ?? "").trim() || null;
        const projectPriority = normalizeProjectPriority(data.priority);
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
                  assignee,
                  project_id: projectId,
                  extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                  priority: projectPriority ?? undefined,
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
                const firstValue = Object.values(extra_data).find((v) => v != null && String(v).trim() !== "");
                const content = firstValue != null ? String(firstValue).trim() : "";
                tasksToInsert.push({
                  content,
                  status: "Yapılacak",
                  assignee,
                  project_id: projectId,
                  extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                  priority: projectPriority ?? undefined,
                });
              }
            }
          }
        }
        if (tasksToInsert.length > 0) {
          await createTasksBulk(tasksToInsert);
        }
      }
      setFormOpen(false);
      setEditingProject(null);
      setFormError(null);
    } catch (e) {
      console.error("[Projects] Form submit failed:", e);
      const message = e instanceof Error ? e.message : String(e);
      setFormError(message || "Proje oluşturulurken veya güncellenirken bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteProject(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (e) {
      console.error("[Projects] Delete failed:", e);
    }
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
        Projeler yükleniyor…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border-2 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 p-6 text-center">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">
          Supabase&apos;de <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">projects</code> tablosunu oluşturun. <code className="text-xs">scripts/create-projects-table.sql</code> dosyasını kullanabilirsiniz.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={fetchProjects} className="mt-4">
          <RotateCw className="mr-2 h-4 w-4" />
          Yeniden dene
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm",
      isPageVariant && "border-slate-200/80 dark:border-slate-600/80"
    )}>
      {!isPageVariant && (
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">Projeler</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Proje listesi. Yeni proje ekleyin, arama ve filtre ile listeleyin.
          </p>
        </div>
      )}
      <div className={cn(isPageVariant ? "pt-4 px-4 pb-4" : "p-4", "space-y-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              placeholder="Projede ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value="Tümü">Durum: Tümü</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {currentUserEmail && (
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={assignedToMeOnly}
                onChange={(e) => setAssignedToMeOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <UserPlus className="h-4 w-4 text-slate-500" />
              Bana atananlar
            </label>
          )}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Başlangıç"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Bitiş"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          />
          {canCreateProject && (
            <Button
              type="button"
              size="sm"
              onClick={() => { setEditingProject(null); setFormOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700 shrink-0"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Yeni proje
            </Button>
          )}
        </div>

        {filteredProjects.length === 0 ? (
          <div className={cn("text-center", isPageVariant ? "py-16" : "py-12")}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {projects.length === 0
                ? (isPageVariant ? "İlk projenizi oluşturun." : "Henüz proje yok.")
                : "Arama veya filtreye uyan proje yok."}
            </p>
            {projects.length === 0 && canCreateProject && (
              <Button
                type="button"
                size="sm"
                onClick={() => setFormOpen(true)}
                className={cn("mt-3", isPageVariant ? "bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500" : "bg-blue-600 hover:bg-blue-700")}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Yeni proje
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const taskCount = taskCountByProject[project.id] ?? 0;
              return (
                <div
                  key={project.id}
                  className={cn(
                    "flex flex-col rounded-lg border p-4 transition-shadow",
                    isPageVariant
                      ? "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-500"
                      : "border-slate-200 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50 hover:shadow-md",
                    project.status === "Beklemede" && "opacity-80"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projeler/${project.id}`}
                        className={cn(
                          "truncate block focus:outline-none focus:ring-0",
                          isPageVariant
                            ? "font-semibold text-slate-800 dark:text-slate-100 hover:text-slate-600 dark:hover:text-slate-200"
                            : "font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                        )}
                      >
                        {project.name || "İsimsiz proje"}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{project.description || "—"}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Menü">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEditProject && (
                          <DropdownMenuItem onClick={() => openEdit(project)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Düzenle
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/projeler/${project.id}`}>
                            Proje detayı / görevler
                          </Link>
                        </DropdownMenuItem>
                        {canArchiveProject && (
                          <DropdownMenuItem onClick={() => archiveProject(project.id)} disabled={project.status === "Beklemede"}>
                            <Archive className="mr-2 h-3.5 w-3.5" />
                            Arşivle
                          </DropdownMenuItem>
                        )}
                        {(canEditProject || canArchiveProject) && canDeleteProject && <DropdownMenuSeparator />}
                        {canDeleteProject && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteConfirm(project)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Sil
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs font-normal", STATUS_STYLES[project.status])}>
                      {project.status}
                    </Badge>
                    {project.priority && (
                      <Badge variant="outline" className={cn("text-xs font-normal", PRIORITY_STYLES[project.priority])}>
                        {project.priority}
                      </Badge>
                    )}
                    {project.due_date && (
                      <span className="text-xs text-slate-600 dark:text-slate-400" title="Hedef tarih">
                        Hedef: {formatDate(new Date(project.due_date), settings.dateFormat)}
                      </span>
                    )}
                    {getProjectDueLabel(project) === "Gecikmiş" && (
                      <Badge variant="outline" className="text-xs font-normal bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700">
                        Gecikmiş
                      </Badge>
                    )}
                    {getProjectDueLabel(project) === "Yaklaşan" && (
                      <Badge variant="outline" className="text-xs font-normal bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
                        Yaklaşan
                      </Badge>
                    )}
                    <Link
                      href={`/projeler/${project.id}`}
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-0",
                        isPageVariant
                          ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                      )}
                    >
                      {taskCount} görev
                    </Link>
                    {(project.assigned_emails?.length ?? 0) > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                          (project.assigned_emails ?? []).some((e) => e.toLowerCase() === currentUserEmail)
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        )}
                        title={(project.assigned_emails ?? []).join(", ")}
                      >
                        <UserPlus className="mr-1 h-3 w-3" />
                        {(project.assigned_emails ?? []).some((e) => e.toLowerCase() === currentUserEmail)
                          ? "Atandınız"
                          : `${project.assigned_emails!.length} kişi`}
                      </span>
                    )}
                    {(project.updated_at || project.created_at) && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDate(new Date(project.updated_at || project.created_at!), settings.dateFormat)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ProjectFormModal
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (open) setFormError(null); else setEditingProject(null); }}
        project={editingProject}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
        formError={formError}
      />
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle className="text-red-700 dark:text-red-300">Projeyi sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            &quot;{deleteConfirm?.name}&quot; projesi kalıcı olarak silinecek. Bu projeye bağlı tüm görevler canlı tablodan da silinecektir. Bu işlem geri alınamaz.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
