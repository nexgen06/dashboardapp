"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Table } from "@tanstack/react-table";
import type { DateFormat } from "@/contexts/settings-context";
import { TaskFormDialog } from "@/components/tasks-table/TaskFormDialog";
import { CSVImportDialog } from "@/components/tasks-table/CSVImportDialog";
import { TaskDetailSheet } from "@/components/TaskDetailSheet";
import type { TaskFormData } from "@/components/tasks-table/taskFormHelpers";
import type { ProjectColumn } from "@/lib/projectColumns";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

export type TasksTableDialogsProps = {
  table: Table<Task>;
  canCreateTask: boolean;
  canImportCsv: boolean;
  newTaskOpen: boolean;
  setNewTaskOpen: Dispatch<SetStateAction<boolean>>;
  editTask: Task | null;
  setEditTask: Dispatch<SetStateAction<Task | null>>;
  importOpen: boolean;
  setImportOpen: Dispatch<SetStateAction<boolean>>;
  detailTask: Task | null;
  setDetailTask: Dispatch<SetStateAction<Task | null>>;
  handleNewTask: (data: TaskFormData) => void | Promise<void>;
  handleEditSubmit: (data: TaskFormData) => void | Promise<void>;
  handleCSVImport: (
    imported: Array<{
      content: string;
      status: string;
      assignee: string | null;
      priority?: string | null;
      extra_data?: Record<string, string> | null;
    }>,
    replaceExisting: boolean
  ) => Promise<void>;
  canEditRow: (task: Task) => boolean;
  canCommentRow: (task: Task) => boolean;
  statusOptions: string[];
  priorityOptions: string[];
  defaultStatus: string;
  defaultPriority: string;
  projectById: Map<string, Project>;
  projectFilter: string[];
  dateFormat: DateFormat;
  urgentPrioritySetForTable: Set<string>;
  activeReferenceColumns: ProjectColumn[];
  extraDataKeys: string[];
};

export function TasksTableDialogs({
  table,
  canCreateTask,
  canImportCsv,
  newTaskOpen,
  setNewTaskOpen,
  editTask,
  setEditTask,
  importOpen,
  setImportOpen,
  detailTask,
  setDetailTask,
  handleNewTask,
  handleEditSubmit,
  handleCSVImport,
  canEditRow,
  canCommentRow,
  statusOptions,
  priorityOptions,
  defaultStatus,
  defaultPriority,
  projectById,
  projectFilter,
  dateFormat,
  urgentPrioritySetForTable,
  activeReferenceColumns,
  extraDataKeys,
}: TasksTableDialogsProps) {
  const detailSheetProps = useMemo(() => {
    if (!detailTask) return null;
    const orderedTasks = table.getSortedRowModel().rows.map((r) => r.original);
    const idx = orderedTasks.findIndex((t) => t.id === detailTask.id);
    const prevTask = idx > 0 ? orderedTasks[idx - 1] : null;
    const nextTask = idx >= 0 && idx < orderedTasks.length - 1 ? orderedTasks[idx + 1] : null;
    const positionLabel = idx >= 0 ? `${idx + 1} / ${orderedTasks.length}` : undefined;
    const proj = detailTask.project_id ? projectById.get(String(detailTask.project_id)) : null;
    const detailCanEdit = canEditRow(detailTask);
    return {
      prevTask,
      nextTask,
      positionLabel,
      projectName: proj?.name ?? null,
      detailCanEdit,
    };
  }, [detailTask, table, projectById, canEditRow]);

  const replaceTargetProjectName =
    projectFilter.length === 1 ? projectById.get(projectFilter[0])?.name ?? null : null;

  return (
    <>
      {canCreateTask && (
        <TaskFormDialog
          open={newTaskOpen}
          onOpenChange={setNewTaskOpen}
          initialTask={null}
          onSubmit={handleNewTask}
          submitLabel="Oluştur"
          title="Yeni görev"
          statusOptions={statusOptions}
          priorityOptions={priorityOptions}
          defaultStatus={defaultStatus}
          defaultPriority={defaultPriority}
        />
      )}
      {editTask && canEditRow(editTask) && (
        <TaskFormDialog
          open={!!editTask}
          onOpenChange={(open) => !open && setEditTask(null)}
          initialTask={editTask ?? undefined}
          onSubmit={handleEditSubmit}
          submitLabel="Kaydet"
          title="Görevi düzenle"
          statusOptions={statusOptions}
          priorityOptions={priorityOptions}
          defaultStatus={defaultStatus}
          defaultPriority={defaultPriority}
        />
      )}
      {canImportCsv && (
        <CSVImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImport={handleCSVImport}
          referenceColumns={activeReferenceColumns}
          referenceKnownKeys={extraDataKeys}
          defaultStatus={defaultStatus}
          defaultPriority={defaultPriority}
          replaceTargetProjectName={replaceTargetProjectName}
        />
      )}
      {detailTask && detailSheetProps && (
        <TaskDetailSheet
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onPrev={detailSheetProps.prevTask ? () => setDetailTask(detailSheetProps.prevTask) : undefined}
          onNext={detailSheetProps.nextTask ? () => setDetailTask(detailSheetProps.nextTask) : undefined}
          canPrev={!!detailSheetProps.prevTask}
          canNext={!!detailSheetProps.nextTask}
          positionLabel={detailSheetProps.positionLabel}
          projectName={detailSheetProps.projectName}
          dateFormat={dateFormat}
          urgentPrioritySet={urgentPrioritySetForTable}
          canEdit={detailSheetProps.detailCanEdit}
          canComment={canCommentRow(detailTask)}
          onEdit={() => {
            if (!detailSheetProps.detailCanEdit) return;
            setEditTask(detailTask);
            setDetailTask(null);
          }}
        />
      )}
    </>
  );
}
