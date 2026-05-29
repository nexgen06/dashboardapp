"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

type ToastApi = {
  error: (msg: string) => void;
  success: (msg: string) => void;
};

export type UseTasksTableRemoveExtraColumnOptions = {
  projects: Project[];
  tasks: Task[];
  scopedProjectIdSet: Set<string> | null;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  saveTask: (id: string, patch: Partial<Task>) => Promise<{ ok: boolean; message?: string }>;
  updateTaskOptimistic: (id: string, patch: Partial<Task>) => void;
  fetchTasks: () => Promise<void>;
  toast: ToastApi;
};

export function useTasksTableRemoveExtraColumn({
  projects,
  tasks,
  scopedProjectIdSet,
  updateProject,
  saveTask,
  updateTaskOptimistic,
  fetchTasks,
  toast,
}: UseTasksTableRemoveExtraColumnOptions) {
  const [removeExtraColumnKey, setRemoveExtraColumnKey] = useState<string | null>(null);
  const [removingExtraColumn, setRemovingExtraColumn] = useState(false);

  const removeExtraColumnImpact = useMemo(() => {
    if (!removeExtraColumnKey) return { projects: [] as typeof projects, taskCount: 0 };
    const key = removeExtraColumnKey;
    const scopeProjectIds = scopedProjectIdSet;
    const affectedProjects = projects.filter((p) => {
      if (scopeProjectIds != null && !scopeProjectIds.has(p.id)) return false;
      return (p.extra_column_keys ?? []).some((k) => String(k ?? "").trim() === key);
    });
    const affectedProjectIdSet = new Set(affectedProjects.map((p) => p.id));
    const taskCount = tasks.reduce((acc, t) => {
      if (t.extra_data == null || typeof t.extra_data !== "object") return acc;
      if (!(key in t.extra_data)) return acc;
      if (scopeProjectIds != null) {
        if (t.project_id == null) return acc;
        if (!scopeProjectIds.has(String(t.project_id))) return acc;
      } else {
        if (t.project_id != null && !affectedProjectIdSet.has(String(t.project_id))) return acc;
      }
      return acc + 1;
    }, 0);
    return { projects: affectedProjects, taskCount };
  }, [removeExtraColumnKey, projects, tasks, scopedProjectIdSet]);

  const executeRemoveExtraColumn = useCallback(async () => {
    if (!removeExtraColumnKey) return;
    const key = removeExtraColumnKey;
    const { projects: affectedProjects, taskCount } = removeExtraColumnImpact;
    setRemovingExtraColumn(true);
    try {
      for (const p of affectedProjects) {
        const next = (p.extra_column_keys ?? []).filter((k) => String(k ?? "").trim() !== key);
        await updateProject(p.id, { extra_column_keys: next });
      }
      const affectedProjectIdSet = new Set(affectedProjects.map((p) => p.id));
      const scopeProjectIds = scopedProjectIdSet;
      const tasksToClear = tasks.filter((t) => {
        if (t.extra_data == null || typeof t.extra_data !== "object") return false;
        if (!(key in t.extra_data)) return false;
        if (scopeProjectIds != null) {
          return t.project_id != null && scopeProjectIds.has(String(t.project_id));
        }
        return t.project_id == null || affectedProjectIdSet.has(String(t.project_id));
      });
      for (const t of tasksToClear) {
        const nextExtra = { ...(t.extra_data ?? {}) };
        delete nextExtra[key];
        const nextValue = Object.keys(nextExtra).length > 0 ? nextExtra : null;
        await saveTask(t.id, { extra_data: nextValue });
        updateTaskOptimistic(t.id, { extra_data: nextValue });
      }
      setRemoveExtraColumnKey(null);
      const projCount = affectedProjects.length;
      toast.success(
        `"${key}" sütunu kaldırıldı` +
          (projCount > 0 || taskCount > 0
            ? ` (${projCount} proje şeması, ${taskCount} görev verisi)`
            : "")
      );
      await fetchTasks();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Sütun kaldırılamadı.";
      toast.error(msg);
    } finally {
      setRemovingExtraColumn(false);
    }
  }, [
    removeExtraColumnKey,
    removeExtraColumnImpact,
    tasks,
    scopedProjectIdSet,
    updateProject,
    saveTask,
    updateTaskOptimistic,
    fetchTasks,
    toast,
  ]);

  return {
    removeExtraColumnKey,
    setRemoveExtraColumnKey,
    removingExtraColumn,
    removeExtraColumnImpact,
    executeRemoveExtraColumn,
  };
}
