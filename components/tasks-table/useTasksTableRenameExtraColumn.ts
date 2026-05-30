"use client";

import { useCallback, useMemo, useState } from "react";
import { renameProjectExtraColumn } from "@/lib/renameProjectExtraColumn";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

type ToastApi = {
  error: (msg: string) => void;
  success: (msg: string) => void;
};

export type RenameExtraColumnDraft = {
  oldKey: string;
  newKey: string;
};

export type UseTasksTableRenameExtraColumnOptions = {
  projects: Project[];
  tasks: Task[];
  scopedProjectIdSet: Set<string> | null;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  updateTaskOptimistic: (id: string, patch: Partial<Task>) => void;
  fetchTasks: () => Promise<void>;
  toast: ToastApi;
};

export function useTasksTableRenameExtraColumn({
  projects,
  tasks,
  scopedProjectIdSet,
  updateProject,
  updateTaskOptimistic,
  fetchTasks,
  toast,
}: UseTasksTableRenameExtraColumnOptions) {
  const [renameExtraColumnDraft, setRenameExtraColumnDraft] = useState<RenameExtraColumnDraft | null>(
    null
  );
  const [renamingExtraColumn, setRenamingExtraColumn] = useState(false);

  const renameExtraColumnImpact = useMemo(() => {
    if (!renameExtraColumnDraft) {
      return { projects: [] as Project[], taskCount: 0 };
    }
    const oldKey = renameExtraColumnDraft.oldKey;
    const scopeProjectIds = scopedProjectIdSet;
    const affectedProjects = projects.filter((p) => {
      if (scopeProjectIds != null && !scopeProjectIds.has(p.id)) return false;
      const inSchema = (p.extra_column_keys ?? []).some(
        (k) => String(k ?? "").trim() === oldKey
      );
      if (inSchema) return true;
      return tasks.some(
        (t) =>
          String(t.project_id) === p.id &&
          t.extra_data != null &&
          typeof t.extra_data === "object" &&
          oldKey in t.extra_data
      );
    });
    const affectedProjectIdSet = new Set(affectedProjects.map((p) => p.id));
    const taskCount = tasks.reduce((acc, t) => {
      if (t.extra_data == null || typeof t.extra_data !== "object") return acc;
      if (!(oldKey in t.extra_data)) return acc;
      if (scopeProjectIds != null) {
        if (t.project_id == null || !scopeProjectIds.has(String(t.project_id))) return acc;
      } else if (t.project_id != null && !affectedProjectIdSet.has(String(t.project_id))) {
        return acc;
      }
      return acc + 1;
    }, 0);
    return { projects: affectedProjects, taskCount };
  }, [renameExtraColumnDraft, projects, tasks, scopedProjectIdSet]);

  const executeRenameExtraColumn = useCallback(async () => {
    if (!renameExtraColumnDraft) return;
    const { oldKey, newKey } = renameExtraColumnDraft;
    const trimmedNew = newKey.trim();
    if (!trimmedNew) {
      toast.error("Yeni sütun adı girin.");
      return;
    }
    const { projects: affectedProjects, taskCount } = renameExtraColumnImpact;
    if (affectedProjects.length === 0) {
      toast.error("Bu sütun aktif kapsamda bulunamadı.");
      return;
    }
    setRenamingExtraColumn(true);
    try {
      let totalTasks = 0;
      let totalBindings = 0;
      for (const project of affectedProjects) {
        const result = await renameProjectExtraColumn({
          projectId: project.id,
          oldKey,
          newKey: trimmedNew,
        });
        await updateProject(project.id, {
          extra_column_keys: result.extraColumnKeys,
          title_column: result.titleColumn,
          subtitle_columns: result.subtitleColumns,
        });
        totalTasks += result.tasksUpdated;
        totalBindings += result.chipBindingsUpdated;
      }

      const scopeProjectIds = scopedProjectIdSet;
      for (const task of tasks) {
        if (task.extra_data == null || typeof task.extra_data !== "object") continue;
        if (!(oldKey in task.extra_data)) continue;
        if (scopeProjectIds != null) {
          if (task.project_id == null || !scopeProjectIds.has(String(task.project_id))) continue;
        }
        const nextExtra = { ...task.extra_data };
        nextExtra[trimmedNew] = nextExtra[oldKey];
        delete nextExtra[oldKey];
        updateTaskOptimistic(task.id, {
          extra_data: Object.keys(nextExtra).length > 0 ? nextExtra : null,
        });
      }

      setRenameExtraColumnDraft(null);
      toast.success(
        `"${oldKey}" → "${trimmedNew}"` +
          ` (${affectedProjects.length} proje, ${Math.max(totalTasks, taskCount)} görev` +
          (totalBindings > 0 ? `, ${totalBindings} çip bağlantısı` : "") +
          ")"
      );
      await fetchTasks();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Sütun yeniden adlandırılamadı.";
      toast.error(msg);
    } finally {
      setRenamingExtraColumn(false);
    }
  }, [
    renameExtraColumnDraft,
    renameExtraColumnImpact,
    tasks,
    scopedProjectIdSet,
    updateProject,
    updateTaskOptimistic,
    fetchTasks,
    toast,
  ]);

  return {
    renameExtraColumnDraft,
    setRenameExtraColumnDraft,
    renamingExtraColumn,
    renameExtraColumnImpact,
    executeRenameExtraColumn,
  };
}
