"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";
import { useTaskCountByProject } from "@/hooks/useTaskCountByProject";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useConfirm, usePrompt } from "@/components/ui/modals";
import { useToast } from "@/components/ui/toast";
import { useSettings } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import { formatDate } from "@/lib/formatDate";
import { parseCSV } from "@/lib/csvParser";
import {
  buildStandardFieldMap,
  normalizeImportedStatus,
  normalizeImportedPriority,
} from "@/lib/csvHeaderMapping";
import { parseJSON } from "@/lib/jsonParser";
import {
  findAssigneeColumnIndex,
  findAssigneeJsonKey,
  normalizeTaskAssigneeEmail,
  pickRoundRobinAssignee,
} from "@/lib/projectImportAssignee";
import {
  assigneeForRowRange,
  collectColumnValues,
  parseRowRangeAssignments,
  type ImportAssignmentMode,
} from "@/lib/importAssignment";
import { offsetToDateIso, type ProjectTemplate } from "@/lib/projectTemplates";
import { listDirectoryUsers, type DirectoryUserProfile } from "@/lib/listDirectoryUsers";
import {
  defaultProjectMemberPermission,
  listProjectMemberPermissions,
  upsertProjectMemberPermissions,
  type ProjectMemberPermission,
  type ProjectMemberRole,
} from "@/lib/projectMemberPermissions";
import { SaveTemplateDialog, TemplateListDialog } from "@/components/ProjectTemplateDialogs";
import { isSensitiveExtraColumnKey } from "@/lib/extraColumnSensitiveDisplay";
import { isStatusDone } from "@/lib/statusKind";
import { normalizeWorkflowStatus } from "@/lib/taskWorkflow";
import { listChipCatalog, upsertTableChipBinding } from "@/lib/chipSystem";
import type { Project, ProjectStatus, ProjectPriority } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { RestrictedButton } from "@/components/ui/permission-gate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, PlusCircle, MoreVertical, Pencil, Archive, Trash2, RotateCw, Upload, FileText, UserPlus, X, Calendar, Flag, FolderKanban, Check, Bookmark, ShieldCheck, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectColumnManager } from "@/components/ProjectColumnManager";
import {
  ProjectFormModal,
  normalizeProjectPriority,
  SMART_CHIP_COLUMN_PRESETS,
  type NewProjectSubmitData,
} from "@/components/projects/ProjectFormModal";

const STATUS_OPTIONS: ProjectStatus[] = ["Aktif", "Tamamlandı", "Beklemede"];
const STATUS_STYLES: Record<ProjectStatus, string> = {
  Aktif: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  Tamamlandı: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
  Beklemede: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
};
const PRIORITY_STYLES: Record<ProjectPriority, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

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

export type ProjectsSectionVariant = "default" | "page";

export function ProjectsSection({ variant = "default" }: { variant?: ProjectsSectionVariant }) {
  const { settings } = useSettings();
  const { user, hasPermission, isAdmin } = useAuth();
  const canCreateProject = hasPermission("projects.create");
  const currentUserEmail = (user?.email ?? "").toLowerCase();
  const isPageVariant = variant === "page";
  const canEditProject = hasPermission("projects.edit");
  const canManageTeamTaskEditing = isAdmin || user?.roleId === "project_manager";
  const canDeleteProject = hasPermission("projects.delete");
  const canArchiveProject = hasPermission("projects.archive");
  const [showArchived, setShowArchived] = useState(false);
  const {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
  } = useProjects({ includeArchived: showArchived });
  const { createTasksBulk, tasks, saveTask, updateTaskOptimistic } = useTasksWithRealtime();
  const promptUser = usePrompt();
  const confirmDialog = useConfirm();
  const toast = useToast();

  const handleArchiveProject = useCallback(
    async (project: Project) => {
      const ok = await confirmDialog({
        title: "Projeyi arşivle",
        message: `"${project.name}" projesi arşivlenecek. Liste ve dashboard'da gizlenir ancak silinmez; istediğinizde geri getirebilirsiniz.`,
        confirmLabel: "Arşivle",
        variant: "default",
      });
      if (!ok) return;
      try {
        await archiveProject(project.id);
        toast.success(`"${project.name}" arşivlendi`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Proje arşivlenemedi");
      }
    },
    [archiveProject, confirmDialog, toast]
  );

  const handleUnarchiveProject = useCallback(
    async (project: Project) => {
      try {
        await unarchiveProject(project.id);
        toast.success(`"${project.name}" arşivden çıkarıldı`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Arşivden çıkarılamadı");
      }
    },
    [unarchiveProject, toast]
  );
  const taskCountByProject = useTaskCountByProject();
  const { unreadByProjectId } = useProjectChatUnread();

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
  // Şablon dialogları
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [saveTemplateProject, setSaveTemplateProject] = useState<Project | null>(null);

  /** Komut paletinden "Yeni proje" tetiklendiğinde formu aç */
  useEffect(() => {
    const openNew = () => {
      if (canCreateProject) {
        setEditingProject(null);
        setFormOpen(true);
      }
    };
    window.addEventListener("commandpalette:newProject", openNew);
    return () => window.removeEventListener("commandpalette:newProject", openNew);
  }, [canCreateProject]);

  const filteredProjects = useMemo(() => {
    // `projects` Supabase RLS tarafından sunucuda filtrelenmiş geliyor.
    let result = projects;
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
  }, [projects, search, statusFilter, assignedToMeOnly, currentUserEmail, dateFrom, dateTo]);

  const taskCompletionByProject = useMemo(() => {
    const map: Record<string, { total: number; done: number; approved: number }> = {};
    for (const task of tasks) {
      const projectId = String(task.project_id ?? "").trim();
      if (!projectId) continue;
      if (!map[projectId]) map[projectId] = { total: 0, done: 0, approved: 0 };
      map[projectId].total += 1;
      if (isStatusDone(task.status)) map[projectId].done += 1;
      if (normalizeWorkflowStatus(task.workflow_status) === "approved") {
        map[projectId].approved += 1;
      }
    }
    return map;
  }, [tasks]);

  const ensureSmartChipBindings = useCallback(
    async (projectId: string, columnLabels: string[] | undefined) => {
      const requested = (columnLabels ?? [])
        .map((label) => label.trim())
        .filter(Boolean);
      if (requested.length === 0) return;
      const catalog = await listChipCatalog([projectId]);
      for (const columnKey of requested) {
        const preset = SMART_CHIP_COLUMN_PRESETS.find(
          (item) => item.label.toLocaleLowerCase("tr") === columnKey.toLocaleLowerCase("tr")
        );
        if (!preset) continue;
        const template = catalog.templates.find(
          (item) => item.name.toLocaleLowerCase("tr") === preset.templateName.toLocaleLowerCase("tr")
        );
        if (!template) {
          console.warn(`[Projects] Çip şablonu bulunamadı: ${preset.templateName}`);
          continue;
        }
        await upsertTableChipBinding({
          projectId,
          columnKey,
          templateId: template.id,
        });
      }
    },
    []
  );

  const handleFormSubmit = async (data: NewProjectSubmitData) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const effectiveAssignedEmails = (() => {
        const list = (data.assignedEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
        if (!isAdmin && currentUserEmail && !list.includes(currentUserEmail)) {
          list.push(currentUserEmail);
        }
        return Array.from(new Set(list));
      })();
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: data.name,
          description: data.description,
          status: data.status,
          assigned_emails: effectiveAssignedEmails,
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          extra_column_keys:
            data.extraColumnKeys && data.extraColumnKeys.length > 0 ? data.extraColumnKeys : [],
          title_column: data.titleColumn ?? null,
          subtitle_columns: data.subtitleColumns ?? null,
          wip_in_progress_limit: data.wipInProgressLimit ?? null,
          workflow_enabled: data.workflowEnabled ?? false,
          lock_on_approval: (data.workflowEnabled ?? false) ? (data.lockOnApproval ?? false) : false,
          ...(isAdmin
            ? { strict_assignee_visibility: data.strictAssigneeVisibility ?? false }
            : {}),
          ...(canManageTeamTaskEditing
            ? { team_edit_all_tasks: data.teamEditAllTasks ?? false }
            : {}),
        });
        await ensureSmartChipBindings(editingProject.id, data.smartChipColumns);
        if (data.reassignExistingTasks) {
          const projectTasks = tasks.filter((t) => String(t.project_id ?? "") === editingProject.id);
          const targetTasks =
            data.reassignExistingTaskScope === "all"
              ? projectTasks
              : projectTasks.filter((t) => !t.assignee || t.assignee.trim() === "");
          const recipients = effectiveAssignedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
          const mode = data.reassignExistingTaskMode ?? "unassigned";
          const singleRaw = data.reassignExistingTaskAssignee?.trim() ?? "";
          const singleAssignee = normalizeTaskAssigneeEmail(singleRaw) ?? (singleRaw || null);
          const rangeAssignments =
            mode === "rowRanges" ? parseRowRangeAssignments(data.reassignExistingRowRangesText ?? "") : [];
          if (mode === "roundRobin" && recipients.length < 2) {
            throw new Error("Eşit dağıtım için proje ekibinde en az 2 e-posta olmalı.");
          }
          if (mode === "single" && !singleAssignee) {
            throw new Error("Tek kişiye atama için e-posta girilmeli.");
          }
          if (mode === "groupByColumn" && !(data.reassignExistingGroupByColumn ?? "").trim()) {
            throw new Error("Sütuna göre dağıtım için bir sütun seçilmeli.");
          }
          if (mode === "rowRanges" && rangeAssignments.length === 0) {
            throw new Error("Satır aralığına göre dağıtım için en az bir aralık girilmeli.");
          }
          for (let i = 0; i < targetTasks.length; i += 1) {
            const task = targetTasks[i];
            const groupValue =
              mode === "groupByColumn"
                ? String(task.extra_data?.[data.reassignExistingGroupByColumn ?? ""] ?? "").trim()
                : "";
            const groupAssignee =
              mode === "groupByColumn"
                ? normalizeTaskAssigneeEmail(data.reassignExistingGroupAssignments?.[groupValue])
                : null;
            const rangeAssignee =
              mode === "rowRanges" ? assigneeForRowRange(i + 1, rangeAssignments) : null;
            const nextAssignee =
              mode === "roundRobin"
                ? pickRoundRobinAssignee(recipients, i)
                : mode === "single"
                  ? singleAssignee
                  : mode === "groupByColumn"
                    ? groupAssignee
                    : mode === "rowRanges"
                      ? rangeAssignee
                      : null;
            updateTaskOptimistic(task.id, {
              assignee: nextAssignee,
              last_updated_by: user?.email ?? "anon",
            });
            const result = await saveTask(task.id, {
              assignee: nextAssignee,
              last_updated_by: user?.email ?? "anon",
            });
            if (!result.ok) throw new Error(result.message);
          }
        }
        setFormOpen(false);
        setEditingProject(null);
        setFormError(null);
        return;
      }
      const projectId = await createProject({
        name: data.name,
        description: data.description,
        status: data.status,
        assigned_emails: effectiveAssignedEmails.length ? effectiveAssignedEmails : undefined,
        due_date: data.due_date ?? undefined,
        priority: data.priority ?? undefined,
        strict_assignee_visibility: isAdmin ? (data.strictAssigneeVisibility ?? false) : false,
        team_edit_all_tasks: canManageTeamTaskEditing ? (data.teamEditAllTasks ?? false) : false,
        extra_column_keys:
          data.extraColumnKeys && data.extraColumnKeys.length > 0 ? data.extraColumnKeys : undefined,
        title_column: data.titleColumn ?? null,
        subtitle_columns: data.subtitleColumns ?? null,
        wip_in_progress_limit: data.wipInProgressLimit ?? null,
        workflow_enabled: data.workflowEnabled ?? false,
        lock_on_approval: (data.workflowEnabled ?? false) ? (data.lockOnApproval ?? false) : false,
      });
      if (projectId) {
        await ensureSmartChipBindings(projectId, data.smartChipColumns);
      }
      if (data.importFile && projectId) {
        const text = await data.importFile.text();
        const fileName = (data.importFile.name || "").toLowerCase();
        const isJson = fileName.endsWith(".json");
        const recipients = effectiveAssignedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
        const importMode = data.importAssignmentMode ?? "unassigned";
        const roundRobin = importMode === "roundRobin" && recipients.length >= 2;
        const defaultRaw = (data.assignee ?? "").trim();
        const defaultAssignee =
          importMode === "single" ? normalizeTaskAssigneeEmail(defaultRaw) ?? (defaultRaw || null) : null;
        if (importMode === "single" && !defaultAssignee) {
          throw new Error("Tek kişiye atama için e-posta girilmeli.");
        }
        if (importMode === "roundRobin" && recipients.length < 2) {
          throw new Error("Eşit dağıtım için proje ekibinde en az 2 e-posta olmalı.");
        }
        const rangeAssignments =
          importMode === "rowRanges" ? parseRowRangeAssignments(data.importRowRangesText ?? "") : [];
        if (importMode === "rowRanges" && rangeAssignments.length === 0) {
          throw new Error("Satır aralığına göre dağıtım için en az bir aralık girilmeli.");
        }
        if (importMode === "groupByColumn" && !(data.importGroupByColumn ?? "").trim()) {
          throw new Error("Sütuna göre dağıtım için bir sütun seçilmeli.");
        }
        const projectPriority = normalizeProjectPriority(data.priority);
        /**
         * Kullanıcı önizleme üzerinden bazı sütunları kapatmış olabilir.
         * Whitelist (trimlenmiş başlık adı). Undefined → tüm sütunlar dahil (geriye uyumluluk).
         */
        const columnWhitelist = data.selectedImportColumns
          ? new Set(data.selectedImportColumns.map((s) => (s ?? "").trim()))
          : null;
        const isColumnIncluded = (rawKey: string) =>
          columnWhitelist == null || columnWhitelist.has(rawKey.trim());
        type TaskInsert = { content: string; status: string; assignee: string | null; project_id: string; extra_data: Record<string, string> | null; priority?: string | null; due_date?: string | null };
        const tasksToInsert: TaskInsert[] = [];
        let distributeIndex = 0;
        if (isJson) {
          const { headers, rows } = parseJSON(text);
          const assigneeKey = importMode === "file" && !roundRobin ? findAssigneeJsonKey(headers) : null;
          const groupJsonKey =
            importMode === "groupByColumn" && data.importGroupByColumn
              ? headers.find((h) => ((h ?? "").trim() || h) === data.importGroupByColumn) ?? data.importGroupByColumn
              : null;
          // Standart alan eşlemesi (DURUM → status, AÇIKLAMA → content vs.)
          // Bu sütunlar extra_data'ya yazılmaz, doğrudan task field'ına gider.
          const stdMap = buildStandardFieldMap(headers);
          const mappedHeaders = new Set(Object.values(stdMap).map((m) => m!.header));
          if (headers.length > 0 && rows.length > 0) {
            for (const row of rows) {
              const extra_data: Record<string, string> = {};
              headers.forEach((h) => {
                const key = (h ?? "").trim() || "Sütun";
                if (!isColumnIncluded(key)) return;
                if (mappedHeaders.has(h)) return; // standart alanlar extra_data'ya gitmez
                extra_data[key] = row[key] ?? "";
              });
              const hasAnyData = Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
              if (hasAnyData) {
                const fromCol =
                  assigneeKey != null ? normalizeTaskAssigneeEmail(row[assigneeKey]) : null;
                const groupValue = groupJsonKey != null ? String(row[groupJsonKey] ?? "").trim() : "";
                const fromGroup =
                  importMode === "groupByColumn"
                    ? normalizeTaskAssigneeEmail(data.importGroupAssignments?.[groupValue])
                    : null;
                const fromRange =
                  importMode === "rowRanges" ? assigneeForRowRange(distributeIndex + 1, rangeAssignments) : null;
                const assignee = roundRobin
                  ? pickRoundRobinAssignee(recipients, distributeIndex)
                  : importMode === "groupByColumn"
                    ? fromGroup
                    : importMode === "rowRanges"
                      ? fromRange
                      : (fromCol ?? defaultAssignee);
                distributeIndex += 1;
                // Standart alanları stdMap'ten doldur (JSON)
                const stdContent = stdMap.content ? String(row[stdMap.content.header] ?? "").trim() : "";
                const stdStatusRaw = stdMap.status ? String(row[stdMap.status.header] ?? "").trim() : "";
                const stdPriorityRaw = stdMap.priority ? String(row[stdMap.priority.header] ?? "").trim() : "";
                const stdDueRaw = stdMap.due_date ? String(row[stdMap.due_date.header] ?? "").trim() : "";
                // assignee: stdMap.assignee varsa onu da kullan (mevcut findAssigneeJsonKey ile tutarlı)
                const finalAssignee = stdMap.assignee && !assignee
                  ? normalizeTaskAssigneeEmail(row[stdMap.assignee.header]) ?? assignee
                  : assignee;
                tasksToInsert.push({
                  content: stdContent,
                  status: stdStatusRaw ? normalizeImportedStatus(stdStatusRaw) : "Yapılacak",
                  assignee: finalAssignee,
                  project_id: projectId,
                  extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                  priority: stdPriorityRaw ? (normalizeImportedPriority(stdPriorityRaw) ?? projectPriority ?? undefined) : (projectPriority ?? undefined),
                  ...(stdDueRaw ? { due_date: stdDueRaw } : {}),
                } as TaskInsert);
              }
            }
          }
        } else {
          const { headers, rows } = parseCSV(text);
          const assigneeCol = importMode === "file" && !roundRobin ? findAssigneeColumnIndex(headers) : null;
          const groupCol =
            importMode === "groupByColumn" && data.importGroupByColumn
              ? headers.findIndex((h) => ((h ?? "").trim() || h) === data.importGroupByColumn)
              : -1;
          // Standart alan eşlemesi (DURUM → status, AÇIKLAMA → content vs.)
          const stdMap = buildStandardFieldMap(headers);
          const mappedIndices = new Set(Object.values(stdMap).map((m) => m!.index));
          if (headers.length > 0 && rows.length > 0) {
            for (const row of rows) {
              const extra_data: Record<string, string> = {};
              headers.forEach((h, i) => {
                if (mappedIndices.has(i)) return; // standart alanlar extra_data'ya gitmez
                const key = (h ?? "").trim() || `Sütun ${i + 1}`;
                if (!isColumnIncluded(key)) return;
                extra_data[key] = (row[i] != null ? String(row[i]).trim() : "") ?? "";
              });
              // Standart alanları çek
              const stdContent = stdMap.content ? String(row[stdMap.content.index] ?? "").trim() : "";
              const stdStatusRaw = stdMap.status ? String(row[stdMap.status.index] ?? "").trim() : "";
              const stdPriorityRaw = stdMap.priority ? String(row[stdMap.priority.index] ?? "").trim() : "";
              const stdDueRaw = stdMap.due_date ? String(row[stdMap.due_date.index] ?? "").trim() : "";

              const hasAnyData = stdContent.length > 0 || Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
              if (hasAnyData) {
                const fromCol =
                  assigneeCol != null ? normalizeTaskAssigneeEmail(row[assigneeCol]) : null;
                const fromStdAssignee = stdMap.assignee
                  ? normalizeTaskAssigneeEmail(row[stdMap.assignee.index])
                  : null;
                const groupValue = groupCol >= 0 ? String(row[groupCol] ?? "").trim() : "";
                const fromGroup =
                  importMode === "groupByColumn"
                    ? normalizeTaskAssigneeEmail(data.importGroupAssignments?.[groupValue])
                    : null;
                const fromRange =
                  importMode === "rowRanges" ? assigneeForRowRange(distributeIndex + 1, rangeAssignments) : null;
                const assignee = roundRobin
                  ? pickRoundRobinAssignee(recipients, distributeIndex)
                  : importMode === "groupByColumn"
                    ? fromGroup
                    : importMode === "rowRanges"
                      ? fromRange
                      : (fromCol ?? fromStdAssignee ?? defaultAssignee);
                distributeIndex += 1;
                tasksToInsert.push({
                  content: stdContent,
                  status: stdStatusRaw ? normalizeImportedStatus(stdStatusRaw) : "Yapılacak",
                  assignee,
                  project_id: projectId,
                  extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                  priority: stdPriorityRaw
                    ? (normalizeImportedPriority(stdPriorityRaw) ?? projectPriority ?? undefined)
                    : (projectPriority ?? undefined),
                  ...(stdDueRaw ? { due_date: stdDueRaw } : {}),
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
      // Supabase hatası genelde { code, message, details, hint } yapısındadır.
      const supaErr = e as { code?: string; message?: string; details?: string; hint?: string };
      const parts = [supaErr?.message, supaErr?.details, supaErr?.hint, supaErr?.code]
        .filter((x) => x != null && String(x).trim() !== "");
      const message = parts.length > 0
        ? parts.join(" — ")
        : e instanceof Error
          ? e.message
          : String(e);
      setFormError(message || "Proje oluşturulurken veya güncellenirken bir hata oluştu.");
      // Form'un yakalayıp modal'ı açık tutması için re-throw et
      throw e;
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

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const editId = searchParams.get("editProject");
    if (!editId || isLoading) return;
    const target = projects.find((p) => p.id === editId);
    if (!target) return;
    openEdit(target);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("editProject");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname || "/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isLoading, projects, pathname, router]);

  /**
   * Şablondan yeni proje oluştur: şablon proje şeması + opsiyonel görev seti.
   * Görevlerin due_offset_days değerleri bugünden tarihe çevrilir.
   */
  const handleUseTemplate = async (template: ProjectTemplate) => {
    try {
      const td = template.template_data ?? {};
      const newName = await promptUser({
        title: `Şablondan yeni proje`,
        message: `"${template.name}" şablonundan oluşturulacak projenin adını gir:`,
        defaultValue: template.name.replace(/\s+—\s+şablonu$/i, ""),
        placeholder: "Yeni proje adı",
        confirmLabel: "Oluştur",
      });
      if (!newName || !newName.trim()) return;
      const templateAssignedEmails = (() => {
        const list = (td.assigned_emails ?? []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
        if (!isAdmin && currentUserEmail && !list.includes(currentUserEmail)) {
          list.push(currentUserEmail);
        }
        return Array.from(new Set(list));
      })();
      const projectId = await createProject({
        name: newName.trim(),
        description: template.description || "",
        status: td.status ?? "Aktif",
        priority: td.priority ?? undefined,
        due_date: offsetToDateIso(td.due_offset_days ?? null) ?? undefined,
        assigned_emails: templateAssignedEmails.length > 0 ? templateAssignedEmails : undefined,
        strict_assignee_visibility: isAdmin ? (td.strict_assignee_visibility ?? false) : false,
        team_edit_all_tasks: canManageTeamTaskEditing ? (td.team_edit_all_tasks ?? false) : false,
        extra_column_keys: td.extra_column_keys ?? undefined,
        title_column: td.title_column ?? null,
        subtitle_columns: td.subtitle_columns ?? null,
        wip_in_progress_limit: td.wip_in_progress_limit ?? null,
      });
      if (projectId && template.tasks.length > 0) {
        // Görevleri toplu olarak ekle (createTasksBulk mevcut)
        const taskRows = template.tasks.map((t) => ({
          content: t.content,
          status: t.status ?? "Yapılacak",
          priority: t.priority ?? null,
          assignee: t.assignee ?? null,
          due_date: offsetToDateIso(t.due_offset_days ?? null) ?? null,
          extra_data: t.extra_data ?? null,
          project_id: projectId,
        }));
        await createTasksBulk(taskRows);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Şablondan oluşturulamadı");
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Projeler yükleniyor">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton variant="circle" className="h-6 w-6" />
            </div>
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
            <div className="mt-4 flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
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
          <label
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
              showArchived
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200"
                : "border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            )}
            title="Arşivlenmiş projeleri de listele"
          >
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <Archive className="h-4 w-4" />
            Arşivlenenleri göster
          </label>
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
              variant="outline"
              size="sm"
              onClick={() => setTemplateListOpen(true)}
              className="shrink-0 gap-1.5"
              title="Şablondan yeni proje oluştur veya kayıtlı şablonları yönet"
            >
              <Bookmark className="h-4 w-4" />
              Şablonlar
            </Button>
          )}
          <RestrictedButton
            permission="projects.create"
            type="button"
            size="sm"
            onClick={() => { setEditingProject(null); setFormOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Yeni proje
          </RestrictedButton>
        </div>

        {filteredProjects.length === 0 ? (
          projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-10 w-10" />}
              title="Henüz proje yok"
              description={
                canCreateProject
                  ? "İlk projenizi oluşturarak başlayın. Aynı modal'dan CSV/JSON ile toplu görev de aktarabilirsiniz."
                  : "Bir yöneticinizden size proje atanmasını isteyebilirsiniz."
              }
              action={
                canCreateProject ? (
                  <Button type="button" size="sm" onClick={() => setFormOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Yeni proje
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              variant="compact"
              icon={<Search className="h-8 w-8" />}
              title="Eşleşen proje yok"
              description="Arama veya filtre kriterlerinize uyan proje bulunamadı."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("Tümü");
                    setAssignedToMeOnly(false);
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Filtreleri temizle
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const taskStats = taskCountByProject[project.id] ?? { total: 0, done: 0 };
              const completionStats = taskCompletionByProject[project.id] ?? {
                total: taskStats.total,
                done: taskStats.done,
                approved: 0,
              };
              const taskCount = completionStats.total;
              const taskDone = project.workflow_enabled ? completionStats.approved : completionStats.done;
              const taskProgressPct = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;
              const isProjectCompleted = taskCount > 0 && taskDone === taskCount;
              const completionLabel = project.workflow_enabled ? "Tüm görevler onaylandı" : "Proje tamamlandı";
              const progressTitle = project.workflow_enabled
                ? `${taskDone} / ${taskCount} görev onaylandı (${taskProgressPct}%)`
                : `${taskDone} / ${taskCount} görev tamamlandı (${taskProgressPct}%)`;
              const chatUnread = unreadByProjectId[project.id] ?? 0;
              const isArchived = !!project.archived_at;
              return (
                <article
                  key={project.id}
                  className={cn(
                    "group relative flex flex-col rounded-lg border p-4 transition-all",
                    isArchived
                      ? "border-slate-300 bg-slate-100/70 opacity-75 grayscale-[40%] dark:border-slate-600 dark:bg-slate-800/40"
                      : isProjectCompleted
                        ? "border-amber-300 bg-amber-50/70 shadow-sm dark:border-amber-500/60 dark:bg-amber-950/20"
                        : isPageVariant
                          ? "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-blue-600"
                          : "border-slate-200 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-blue-600",
                    !isArchived && isProjectCompleted && "hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-amber-400",
                    !isArchived && project.status === "Beklemede" && "opacity-80"
                  )}
                >
                  {isArchived && (
                    <span
                      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-slate-400 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm dark:border-slate-500 dark:bg-slate-900 dark:text-slate-300"
                      title={`Arşivlendi: ${project.archived_at ? new Date(project.archived_at).toLocaleDateString("tr-TR") : ""}`}
                    >
                      <Archive className="h-3 w-3" aria-hidden />
                      Arşivli
                    </span>
                  )}
                  {/* Stretched link: tüm kart tıklanabilir; içeride z-10'lu elementler kendi davranışlarını korur. */}
                  <Link
                    href={`/projeler/${project.id}`}
                    aria-label={`${project.name || "İsimsiz proje"} projesine git`}
                    className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  />
                  <div className="relative z-10 flex items-start justify-between gap-2 pointer-events-none">
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "flex min-w-0 items-center gap-1.5",
                          isPageVariant
                            ? "font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                            : "font-medium text-slate-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                        )}
                      >
                        <span className="truncate">{project.name || "İsimsiz proje"}</span>
                        {isProjectCompleted && (
                          <span
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-700 shadow-sm dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-200"
                            title={completionLabel}
                          >
                            <Crown className="h-3.5 w-3.5" aria-hidden />
                          </span>
                        )}
                        {chatUnread > 0 && (
                          <span
                            className="inline-flex h-5 shrink-0 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white"
                            title="Okunmamış sohbet"
                          >
                            {chatUnread > 99 ? "99+" : chatUnread}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{project.description || "—"}</p>
                    </div>
                    <div className="pointer-events-auto flex shrink-0 items-center gap-0.5">
                      {/* Hover/odak ile beliren hızlı eylemler — Düzenle + Detay */}
                      {canEditProject && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEdit(project);
                          }}
                          aria-label="Projeyi düzenle"
                          title="Düzenle"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
                        aria-label="Proje detayı"
                        title="Detay"
                      >
                        <Link
                          href={`/projeler/${project.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FolderKanban className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Proje menüsü">
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
                        {canCreateProject && (
                          <DropdownMenuItem onClick={() => setSaveTemplateProject(project)}>
                            <Bookmark className="mr-2 h-3.5 w-3.5" />
                            Şablon olarak kaydet
                          </DropdownMenuItem>
                        )}
                        {canArchiveProject && (project.archived_at
                          ? (
                            <DropdownMenuItem onClick={() => void handleUnarchiveProject(project)}>
                              <RotateCw className="mr-2 h-3.5 w-3.5" />
                              Arşivden çıkar
                            </DropdownMenuItem>
                          )
                          : (
                            <DropdownMenuItem onClick={() => void handleArchiveProject(project)}>
                              <Archive className="mr-2 h-3.5 w-3.5" />
                              Arşivle
                            </DropdownMenuItem>
                          )
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
                  </div>
                  <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 pointer-events-none">
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
                    {isProjectCompleted && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-300 bg-amber-100 text-xs font-medium text-amber-800 dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-200"
                      >
                        <Crown className="h-3 w-3" aria-hidden />
                        {completionLabel}
                      </Badge>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                        isPageVariant
                          ? "border-slate-300 bg-white text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200"
                          : "border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      )}
                      title={taskCount > 0 ? progressTitle : "Görev yok"}
                    >
                      {taskCount === 0
                        ? "0 görev"
                        : <>{taskDone}<span className="opacity-60">/{taskCount}</span> {project.workflow_enabled ? "onay" : "görev"}</>}
                    </span>
                    {(project.assigned_emails?.length ?? 0) > 0 && (
                      <AvatarStack
                        emails={project.assigned_emails ?? []}
                        highlightEmail={currentUserEmail}
                        max={4}
                        size={24}
                        className="pointer-events-auto"
                      />
                    )}
                    {(project.updated_at || project.created_at) && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDate(new Date(project.updated_at || project.created_at!), settings.dateFormat)}
                      </span>
                    )}
                  </div>
                  {/* Tamamlanma progress bar — sıfır görev yoksa görünür */}
                  {taskCount > 0 && (
                    <div className="relative z-10 mt-3 pointer-events-none">
                      <div className="flex items-center justify-between text-ui-caption text-slate-500 dark:text-slate-400">
                        <span>{project.workflow_enabled ? "Onay ilerlemesi" : "İlerleme"}</span>
                        <span className={cn(
                          "font-medium",
                          taskProgressPct === 100 && "text-emerald-700 dark:text-emerald-300",
                          taskProgressPct > 0 && taskProgressPct < 100 && "text-amber-700 dark:text-amber-300",
                          taskProgressPct === 0 && "text-slate-500 dark:text-slate-400"
                        )}>
                          %{taskProgressPct}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            taskProgressPct === 100
                              ? "bg-emerald-500 dark:bg-emerald-400"
                              : taskProgressPct >= 50
                                ? "bg-blue-500 dark:bg-blue-400"
                                : taskProgressPct > 0
                                  ? "bg-amber-500 dark:bg-amber-400"
                                  : "bg-slate-300 dark:bg-slate-600"
                          )}
                          style={{ width: `${Math.max(2, taskProgressPct)}%` }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  )}
                </article>
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
        isAdmin={isAdmin}
        canManageTeamTaskEditing={canManageTeamTaskEditing}
        observedExtraKeys={
          editingProject
            ? (() => {
                const out = new Set<string>();
                for (const t of tasks) {
                  if (String(t.project_id ?? "") !== editingProject.id) continue;
                  if (t.extra_data && typeof t.extra_data === "object") {
                    for (const k of Object.keys(t.extra_data)) {
                      const key = String(k).trim();
                      if (key) out.add(key);
                    }
                  }
                }
                return Array.from(out);
              })()
            : []
        }
        observedSampleValues={
          editingProject
            ? (() => {
                const out: Record<string, string[]> = {};
                for (const t of tasks) {
                  if (String(t.project_id ?? "") !== editingProject.id) continue;
                  if (!t.extra_data || typeof t.extra_data !== "object") continue;
                  for (const [k, v] of Object.entries(t.extra_data)) {
                    const key = String(k).trim();
                    const value = String(v ?? "").trim();
                    if (!key || !value) continue;
                    if (!out[key]) out[key] = [];
                    if (out[key].length < 20) out[key].push(value);
                  }
                }
                return out;
              })()
            : {}
        }
      />

      {/* Şablon dialogları */}
      <TemplateListDialog
        open={templateListOpen}
        onOpenChange={setTemplateListOpen}
        isAdmin={isAdmin}
        currentUserId={user?.id ?? null}
        onUseTemplate={(t) => void handleUseTemplate(t)}
      />
      <SaveTemplateDialog
        open={!!saveTemplateProject}
        onOpenChange={(o) => !o && setSaveTemplateProject(null)}
        project={saveTemplateProject}
        tasks={saveTemplateProject ? tasks.filter((t) => String(t.project_id ?? "") === saveTemplateProject.id) : []}
        isAdmin={isAdmin}
        onSaved={() => setSaveTemplateProject(null)}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle className="text-red-700 dark:text-red-300">Projeyi sil</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              &quot;{deleteConfirm?.name}&quot; projesi kalıcı olarak silinecek. Bu projeye bağlı tüm görevler canlı tablodan da silinecektir. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
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
