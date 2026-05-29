"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";
import { useTaskCountByProject } from "@/hooks/useTaskCountByProject";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useConfirm, usePrompt } from "@/components/ui/modals";
import { useToast } from "@/components/ui/toast";
import { useSettings } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import { offsetToDateIso, type ProjectTemplate } from "@/lib/projectTemplates";
import { submitProjectForm } from "@/lib/projectFormSubmit";
import {
  computeTaskCompletionByProject,
  filterProjectsList,
} from "@/lib/projectListFilters";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FolderKanban, PlusCircle, RotateCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectFormModal, type NewProjectSubmitData } from "@/components/projects/ProjectFormModal";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectsLoadingGrid } from "@/components/projects/ProjectsLoadingGrid";
import { ProjectsToolbar } from "@/components/projects/ProjectsToolbar";
import { SaveTemplateDialog, TemplateListDialog } from "@/components/ProjectTemplateDialogs";

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
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [saveTemplateProject, setSaveTemplateProject] = useState<Project | null>(null);

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

  const filteredProjects = useMemo(
    () =>
      filterProjectsList(projects, {
        search,
        statusFilter,
        assignedToMeOnly,
        currentUserEmail,
        dateFrom,
        dateTo,
      }),
    [projects, search, statusFilter, assignedToMeOnly, currentUserEmail, dateFrom, dateTo]
  );

  const taskCompletionByProject = useMemo(() => computeTaskCompletionByProject(tasks), [tasks]);

  const handleFormSubmit = async (data: NewProjectSubmitData) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await submitProjectForm({
        data,
        editingProject,
        isAdmin,
        canManageTeamTaskEditing,
        currentUserEmail,
        userEmail: user?.email,
        tasks,
        updateProject,
        createProject,
        createTasksBulk,
        updateTaskOptimistic,
        saveTask,
      });
      setFormOpen(false);
      setEditingProject(null);
      setFormError(null);
    } catch (e) {
      console.error("[Projects] Form submit failed:", e);
      const supaErr = e as { code?: string; message?: string; details?: string; hint?: string };
      const parts = [supaErr?.message, supaErr?.details, supaErr?.hint, supaErr?.code].filter(
        (x) => x != null && String(x).trim() !== ""
      );
      const message =
        parts.length > 0
          ? parts.join(" — ")
          : e instanceof Error
            ? e.message
            : String(e);
      setFormError(message || "Proje oluşturulurken veya güncellenirken bir hata oluştu.");
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
    return <ProjectsLoadingGrid />;
  }

  if (error) {
    return (
      <div className="rounded-lg border-2 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 p-6 text-center">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">
          Supabase&apos;de <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">projects</code> tablosunu oluşturun.{" "}
          <code className="text-xs">scripts/create-projects-table.sql</code> dosyasını kullanabilirsiniz.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={fetchProjects} className="mt-4">
          <RotateCw className="mr-2 h-4 w-4" />
          Yeniden dene
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm",
        isPageVariant && "border-slate-200/80 dark:border-slate-600/80"
      )}
    >
      {!isPageVariant && (
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">Projeler</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Proje listesi. Yeni proje ekleyin, arama ve filtre ile listeleyin.
          </p>
        </div>
      )}
      <div className={cn(isPageVariant ? "pt-4 px-4 pb-4" : "p-4", "space-y-4")}>
        <ProjectsToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          assignedToMeOnly={assignedToMeOnly}
          onAssignedToMeOnlyChange={setAssignedToMeOnly}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          currentUserEmail={currentUserEmail}
          canCreateProject={canCreateProject}
          onOpenTemplates={() => setTemplateListOpen(true)}
          onNewProject={() => {
            setEditingProject(null);
            setFormOpen(true);
          }}
        />

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
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isPageVariant={isPageVariant}
                dateFormat={settings.dateFormat}
                currentUserEmail={currentUserEmail}
                chatUnread={unreadByProjectId[project.id] ?? 0}
                canEditProject={canEditProject}
                canCreateProject={canCreateProject}
                canArchiveProject={canArchiveProject}
                canDeleteProject={canDeleteProject}
                taskCountByProject={taskCountByProject}
                taskCompletionByProject={taskCompletionByProject}
                onEdit={openEdit}
                onSaveAsTemplate={setSaveTemplateProject}
                onArchive={(p) => void handleArchiveProject(p)}
                onUnarchive={(p) => void handleUnarchiveProject(p)}
                onDelete={setDeleteConfirm}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (open) setFormError(null);
          else setEditingProject(null);
        }}
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
            <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>
              İptal
            </Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
