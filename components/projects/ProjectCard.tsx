"use client";

import Link from "next/link";
import {
  Pencil,
  Archive,
  Trash2,
  RotateCw,
  FolderKanban,
  Bookmark,
  Crown,
  MoreVertical,
} from "lucide-react";
import type { Project } from "@/types/project";
import type { DateFormat } from "@/contexts/settings-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar-stack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PROJECT_STATUS_STYLES,
  PROJECT_PRIORITY_STYLES,
} from "@/components/projects/projectSectionStyles";
import { getProjectDueLabel } from "@/lib/projectDueLabel";
import {
  buildProjectCardStats,
  type ProjectCardStats,
  type TaskCompletionStats,
} from "@/lib/projectListFilters";
import { formatDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";

export type ProjectCardProps = {
  project: Project;
  isPageVariant?: boolean;
  dateFormat: DateFormat;
  currentUserEmail?: string;
  chatUnread?: number;
  canEditProject: boolean;
  canCreateProject: boolean;
  canArchiveProject: boolean;
  canDeleteProject: boolean;
  /** Raw task counts keyed by project id — stats are computed via buildProjectCardStats when stats is omitted. */
  taskCountByProject?: Record<string, { total: number; done: number }>;
  taskCompletionByProject?: Record<string, TaskCompletionStats>;
  /** Pre-computed stats; when provided, taskCountByProject/taskCompletionByProject are ignored. */
  stats?: ProjectCardStats;
  onEdit: (project: Project) => void;
  onSaveAsTemplate: (project: Project) => void;
  onArchive: (project: Project) => void;
  onUnarchive: (project: Project) => void;
  onDelete: (project: Project) => void;
};

export function ProjectCard({
  project,
  isPageVariant = false,
  dateFormat,
  currentUserEmail,
  chatUnread = 0,
  canEditProject,
  canCreateProject,
  canArchiveProject,
  canDeleteProject,
  taskCountByProject = {},
  taskCompletionByProject = {},
  stats: statsProp,
  onEdit,
  onSaveAsTemplate,
  onArchive,
  onUnarchive,
  onDelete,
}: ProjectCardProps) {
  const stats =
    statsProp ??
    buildProjectCardStats(project, taskCountByProject, taskCompletionByProject);
  const {
    taskCount,
    taskDone,
    taskProgressPct,
    isProjectCompleted,
    completionLabel,
    progressTitle,
  } = stats;

  const dueLabel = getProjectDueLabel(project);
  const isArchived = !!project.archived_at;

  return (
    <article
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
          {canEditProject && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(project);
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
                <DropdownMenuItem onClick={() => onEdit(project)}>
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
                <DropdownMenuItem onClick={() => onSaveAsTemplate(project)}>
                  <Bookmark className="mr-2 h-3.5 w-3.5" />
                  Şablon olarak kaydet
                </DropdownMenuItem>
              )}
              {canArchiveProject && (project.archived_at
                ? (
                  <DropdownMenuItem onClick={() => onUnarchive(project)}>
                    <RotateCw className="mr-2 h-3.5 w-3.5" />
                    Arşivden çıkar
                  </DropdownMenuItem>
                )
                : (
                  <DropdownMenuItem onClick={() => onArchive(project)}>
                    <Archive className="mr-2 h-3.5 w-3.5" />
                    Arşivle
                  </DropdownMenuItem>
                )
              )}
              {(canEditProject || canArchiveProject) && canDeleteProject && <DropdownMenuSeparator />}
              {canDeleteProject && (
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => onDelete(project)}
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
        <Badge variant="outline" className={cn("text-xs font-normal", PROJECT_STATUS_STYLES[project.status])}>
          {project.status}
        </Badge>
        {project.priority && (
          <Badge variant="outline" className={cn("text-xs font-normal", PROJECT_PRIORITY_STYLES[project.priority])}>
            {project.priority}
          </Badge>
        )}
        {project.due_date && (
          <span className="text-xs text-slate-600 dark:text-slate-400" title="Hedef tarih">
            Hedef: {formatDate(new Date(project.due_date), dateFormat)}
          </span>
        )}
        {dueLabel === "Gecikmiş" && (
          <Badge variant="outline" className="text-xs font-normal bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700">
            Gecikmiş
          </Badge>
        )}
        {dueLabel === "Yaklaşan" && (
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
            {formatDate(new Date(project.updated_at || project.created_at!), dateFormat)}
          </span>
        )}
      </div>
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
}
