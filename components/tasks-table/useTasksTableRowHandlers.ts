"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { Task } from "@/types/tasks";
import type { ProjectColumn } from "@/lib/projectColumns";
import { REFERENCE_WARNINGS_KEY } from "@/components/tasks-table/constants";
import { cssAttrValue } from "@/components/tasks-table/EditableCell";
import type { TaskFormData } from "@/components/tasks-table/taskFormHelpers";
import type { ActiveEditableCell } from "@/components/tasks-table/types";
import { isSensitiveExtraColumnKey } from "@/lib/extraColumnSensitiveDisplay";
import { normalizeExtraDataBySmartRules } from "@/lib/extraColumnFormatRules";
import {
  referenceWarningsFromRecord,
  resolveReferenceTargetKey,
} from "@/lib/referenceExtraDataEnrichment";

type ToastApi = {
  error: (msg: string) => void;
  success: (msg: string, opts?: { action?: { label: string; onClick: () => void | Promise<void> }; durationMs?: number }) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
};

export type UseTasksTableRowHandlersOptions = {
  tasks: Task[];
  filteredData: Task[];
  editTask: Task | null;
  setEditTask: Dispatch<SetStateAction<Task | null>>;
  canCreateTask: boolean;
  canEditRow: (task: Task) => boolean;
  canBulkDeleteRow: (task: Task) => boolean;
  isAdmin: boolean;
  projectFilter: string[];
  extraDataKeys: string[];
  saveTask: (id: string, patch: Partial<Task>) => Promise<{ ok: boolean; message?: string }>;
  updateTaskOptimistic: (id: string, patch: Partial<Task>) => void;
  createTask: (
    task: Pick<Task, "content" | "status" | "assignee"> & {
      priority?: string | null;
      project_id?: string | null;
      due_date?: string | null;
      extra_data?: Record<string, string> | null;
    }
  ) => Promise<string | null>;
  createTasksBulk: (rows: Array<{ content: string; status: string; assignee: string | null; priority?: string | null; extra_data?: Record<string, string> | null; project_id?: string | null; due_date?: string | null }>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteTasks: (ids: string[]) => Promise<void>;
  setDeletingIds: Dispatch<SetStateAction<Set<string>>>;
  setEditingRow: (rowId: string | null) => void;
  logSensitivePolicyDecision: (args: {
    fieldKey: string;
    action: "view" | "edit" | "copy" | "export_masked" | "export_unmasked";
    legacyDecision: "allow" | "deny";
    task?: Task | null;
    context?: Record<string, unknown>;
  }) => void | Promise<void>;
  toast: ToastApi;
};

export function useTasksTableRowHandlers({
  tasks,
  filteredData,
  editTask,
  setEditTask,
  canCreateTask,
  canEditRow,
  canBulkDeleteRow,
  isAdmin,
  projectFilter,
  extraDataKeys,
  saveTask,
  updateTaskOptimistic,
  createTask,
  createTasksBulk,
  deleteTask,
  deleteTasks,
  setDeletingIds,
  setEditingRow,
  logSensitivePolicyDecision,
  toast,
}: UseTasksTableRowHandlersOptions) {
  const [quickAddFocusId, setQuickAddFocusId] = useState<string | null>(null);
  const [activeEditableCell, setActiveEditableCell] = useState<ActiveEditableCell | null>(null);

  const handleSave = useCallback(
    (taskId: string, patch: Partial<Task>) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !canEditRow(task)) {
        toast.error("Bu satırı düzenleme yetkiniz yok.");
        return;
      }
      updateTaskOptimistic(taskId, patch);
      void saveTask(taskId, patch).then((r) => {
        if (!r.ok) toast.error(r.message ?? "Kaydedilemedi");
      });
    },
    [canEditRow, tasks, updateTaskOptimistic, saveTask, toast]
  );

  const handleNewTask = useCallback(
    async (data: TaskFormData) => {
      const formattedExtraData = normalizeExtraDataBySmartRules(data.extra_data);
      if (formattedExtraData.errors.length > 0) {
        toast.error(formattedExtraData.errors[0].message);
        throw new Error(formattedExtraData.errors[0].message);
      }
      await createTask({
        content: data.content,
        status: data.status,
        assignee: data.assignee || null,
        priority: data.priority ?? null,
        extra_data: formattedExtraData.data,
      });
    },
    [createTask, toast]
  );

  /**
   * "Boş satır" kriteri — kullanıcının doldurmadan bıraktığı hızlı-ekleme satırlarını yakalar.
   * Sadece TÜM kullanıcı alanları boşsa true (yanlışlıkla gerçek görev silmemek için sıkı).
   */
  const isEmptyTaskRow = useCallback((t: Task): boolean => {
    if ((t.content ?? "").trim() !== "") return false;
    if ((t.assignee ?? "").trim() !== "") return false;
    if ((t.priority ?? "").trim() !== "") return false;
    if ((t.due_date ?? "").trim() !== "") return false;
    const ex = t.extra_data;
    if (ex && typeof ex === "object") {
      for (const v of Object.values(ex)) {
        if (String(v ?? "").trim() !== "") return false;
      }
    }
    return true;
  }, []);

  const handleDeleteEmptyRows = useCallback(async () => {
    const emptyTasks = filteredData.filter((task) => isEmptyTaskRow(task) && canBulkDeleteRow(task));
    if (emptyTasks.length === 0) {
      toast.info("Mevcut görünümde silme yetkili boş satır yok.");
      return;
    }
    const ids = emptyTasks.map((t) => t.id);
    const backups = emptyTasks.map((t) => ({ ...t }));
    setDeletingIds((prev) => new Set([...Array.from(prev), ...ids]));
    try {
      await deleteTasks(ids);
      toast.success(`${ids.length} boş satır silindi`, {
        action: {
          label: "Geri al",
          onClick: async () => {
            try {
              await createTasksBulk(
                backups.map((b) => ({
                  content: b.content,
                  status: b.status,
                  assignee: b.assignee,
                  priority: b.priority,
                  project_id: b.project_id,
                  due_date: b.due_date,
                  extra_data: b.extra_data,
                }))
              );
              toast.success(`${backups.length} satır geri yüklendi`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Geri alınamadı");
            }
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Boş satırlar silinemedi");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [filteredData, isEmptyTaskRow, canBulkDeleteRow, deleteTasks, createTasksBulk, toast]);

  /**
   * Hızlı satır ekleme: boş içerikli görev yaratır, content hücresini odakla.
   * Tek proje filtreliyse o projenin altına bağlar; yoksa serbest (project_id=null).
   * Enter ile zincir devam eder.
   */
  const handleQuickAddRow = useCallback(async () => {
    if (!canCreateTask) return;
    try {
      const scopedProject =
        Array.isArray(projectFilter) && projectFilter.length === 1 ? projectFilter[0] : null;
      const newId = await createTask({
        content: "",
        status: "Yapılacak",
        assignee: null,
        priority: null,
        project_id: scopedProject,
      });
      if (newId) {
        setQuickAddFocusId(newId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Satır oluşturulamadı");
    }
  }, [canCreateTask, createTask, projectFilter, toast]);

  const activateEditableCell = useCallback((taskId: string, columnId: string) => {
    setActiveEditableCell((prev) =>
      prev?.taskId === taskId && prev.columnId === columnId ? prev : { taskId, columnId }
    );
    setEditingRow(taskId);
  }, [setEditingRow]);

  const isActiveEditableCell = useCallback(
    (taskId: string, columnId: string) =>
      activeEditableCell?.taskId === taskId && activeEditableCell.columnId === columnId,
    [activeEditableCell]
  );

  const scheduleEditableCellBlur = useCallback((taskId: string, columnId: string) => {
    window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('[data-live-editable-cell="true"]')) return;
      setActiveEditableCell((prev) =>
        prev?.taskId === taskId && prev.columnId === columnId ? null : prev
      );
      setEditingRow(null);
      if (quickAddFocusId === taskId) setQuickAddFocusId(null);
    }, 0);
  }, [quickAddFocusId, setEditingRow]);

  const focusNextEditableCell = useCallback((taskId: string, columnId: string) => {
    requestAnimationFrame(() => {
      if (columnId === "content" && quickAddFocusId === taskId) setQuickAddFocusId(null);
      const rowSelector = cssAttrValue(taskId);
      const columnSelector = cssAttrValue(columnId);
      const current = document.querySelector<HTMLElement>(
        `[data-live-editable-cell="true"][data-row-id="${rowSelector}"][data-col-id="${columnSelector}"]`
      );
      const row = current?.closest("tr");
      if (!row) return;

      const editableCells = Array.from(
        row.querySelectorAll<HTMLElement>('[data-live-editable-cell="true"]:not([data-disabled="true"])')
      );
      const currentIndex = editableCells.findIndex((el) => el.dataset.colId === columnId);
      const next = editableCells.slice(currentIndex + 1).find((el) => el.offsetParent !== null);
      if (!next) return;

      const nextColumnId = next.dataset.colId;
      if (nextColumnId) activateEditableCell(taskId, nextColumnId);
      next.focus();
      if (next instanceof HTMLButtonElement) next.click();
      if (next instanceof HTMLInputElement) next.select();
    });
  }, [activateEditableCell, quickAddFocusId]);

  const handleCSVImport = useCallback(
    async (
      imported: Array<{ content: string; status: string; assignee: string | null; priority?: string | null; extra_data?: Record<string, string> | null }>,
      replaceExisting: boolean
    ) => {
      if (replaceExisting && tasks.length > 0) {
        await deleteTasks(tasks.map((t) => t.id));
      }
      await createTasksBulk(imported);
    },
    [tasks, deleteTasks, createTasksBulk]
  );

  const handleEditSubmit = useCallback(
    async (data: TaskFormData) => {
      if (!editTask) return;
      if (!canEditRow(editTask)) {
        toast.error("Bu satırı düzenleme yetkiniz yok.");
        setEditTask(null);
        return;
      }
      const formattedExtraData = normalizeExtraDataBySmartRules(data.extra_data);
      if (formattedExtraData.errors.length > 0) {
        toast.error(formattedExtraData.errors[0].message);
        throw new Error(formattedExtraData.errors[0].message);
      }
      const patch = {
        content: data.content,
        status: data.status,
        assignee: data.assignee || null,
        priority: data.priority ?? null,
        extra_data: formattedExtraData.data,
      };
      updateTaskOptimistic(editTask.id, patch);
      const r = await saveTask(editTask.id, patch);
      if (!r.ok) {
        toast.error(r.message ?? "Kaydedilemedi");
        return;
      }
      setEditTask(null);
      toast.success("Görev güncellendi");
    },
    [editTask, canEditRow, saveTask, updateTaskOptimistic, toast]
  );

  const handleCopyTask = useCallback(
    async (task: Task) => {
      await createTask({
        content: task.content + " (kopya)",
        status: task.status,
        assignee: task.assignee,
      });
    },
    [createTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      // Undo için önce mevcut görev verisini yakala
      const backup = tasks.find((t) => t.id === taskId);
      setDeletingIds((prev) => new Set(prev).add(taskId));
      try {
        await deleteTask(taskId);
        toast.success("Görev silindi", {
          action: backup
            ? {
                label: "Geri al",
                onClick: async () => {
                  try {
                    await createTask({
                      content: backup.content,
                      status: backup.status,
                      assignee: backup.assignee,
                      priority: backup.priority,
                      project_id: backup.project_id,
                      due_date: backup.due_date,
                      extra_data: backup.extra_data,
                    });
                    toast.success("Görev geri yüklendi");
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Geri alınamadı";
                    toast.error(msg);
                  }
                },
              }
            : undefined,
        });
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "object" && e !== null && "message" in e
              ? String((e as { message: unknown }).message)
              : "Görev silinemedi.";
        toast.error(msg);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [deleteTask, createTask, tasks, toast]
  );

  // Dinamik hücre düzenleme handler'ı
  const handleDynamicCellSave = useCallback((taskId: string, key: string, value: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (isSensitiveExtraColumnKey(key) && !isAdmin) {
      void logSensitivePolicyDecision({
        fieldKey: key,
        action: "edit",
        legacyDecision: "deny",
        task,
        context: { source: "dynamic-cell-save", reason: "non-admin-sensitive-block" },
      });
      toast.warning("Hassas alanlar sadece kopyalanabilir; düzenleme kapalı.");
      return;
    }
    if (isSensitiveExtraColumnKey(key)) {
      void logSensitivePolicyDecision({
        fieldKey: key,
        action: "edit",
        legacyDecision: "allow",
        task,
        context: { source: "dynamic-cell-save" },
      });
    }
    const formattedExtraData = normalizeExtraDataBySmartRules({ [key]: value });
    if (formattedExtraData.errors.length > 0) {
      toast.error(formattedExtraData.errors[0].message);
      return;
    }
    const nextValue = formattedExtraData.data?.[key] ?? "";
    const newExtraData = { ...(task.extra_data ?? {}), [key]: nextValue };
    handleSave(taskId, { extra_data: newExtraData });
  }, [tasks, handleSave, isAdmin, toast, logSensitivePolicyDecision]);

  const handleReferenceCellSave = useCallback(
    (taskId: string, key: string, value: string, column: ProjectColumn | null) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (isSensitiveExtraColumnKey(key) && !isAdmin) {
        void logSensitivePolicyDecision({
          fieldKey: key,
          action: "edit",
          legacyDecision: "deny",
          task,
          context: { source: "reference-cell-save", reason: "non-admin-sensitive-block" },
        });
        toast.warning("Hassas alanlar sadece kopyalanabilir; düzenleme kapalı.");
        return;
      }
      if (isSensitiveExtraColumnKey(key)) {
        void logSensitivePolicyDecision({
          fieldKey: key,
          action: "edit",
          legacyDecision: "allow",
          task,
          context: { source: "reference-cell-save" },
        });
      }
      const formattedExtraData = normalizeExtraDataBySmartRules({ [key]: value });
      if (formattedExtraData.errors.length > 0) {
        toast.error(formattedExtraData.errors[0].message);
        return;
      }

      const nextValue = formattedExtraData.data?.[key] ?? value.trim();
      const nextExtraData: Record<string, string> = { ...(task.extra_data ?? {}), [key]: nextValue };
      delete nextExtraData[REFERENCE_WARNINGS_KEY];
      const reference = column?.config.reference;
      const labelField = reference?.labelField;
      const records = reference?.records ?? [];
      const matchedRecord =
        labelField && nextValue
          ? records.find((record) => String(record[labelField] ?? "").trim() === nextValue)
          : null;

      if (matchedRecord) {
        const availableKeys = Array.from(new Set([...extraDataKeys, ...Object.keys(nextExtraData), key]));
        const warnings = referenceWarningsFromRecord(nextExtraData, matchedRecord, availableKeys, labelField);
        for (const [field, raw] of Object.entries(matchedRecord)) {
          const cellValue = String(raw ?? "").trim();
          if (!cellValue || field === labelField) continue;
          const targetKey = resolveReferenceTargetKey(field, availableKeys);
          if (!targetKey || targetKey === key) continue;
          nextExtraData[targetKey] = cellValue;
        }
        if (warnings.length > 0) {
          nextExtraData[REFERENCE_WARNINGS_KEY] = warnings.join(" | ");
          toast.warning("Referans kaydı bulundu ama satırda çelişen alanlar vardı; sistem değerleri referansa göre güncelledi.");
        }
      } else if (reference && nextValue) {
        toast.info("Seçilen değer için referans satırı bulunamadı. Sadece bu hücre kaydedildi.");
      }

      handleSave(taskId, { extra_data: nextExtraData });
    },
    [extraDataKeys, handleSave, isAdmin, tasks, toast, logSensitivePolicyDecision]
  );

  return {
    handleSave,
    handleNewTask,
    handleDeleteEmptyRows,
    handleQuickAddRow,
    activateEditableCell,
    isActiveEditableCell,
    scheduleEditableCellBlur,
    focusNextEditableCell,
    handleCSVImport,
    handleEditSubmit,
    handleCopyTask,
    handleDeleteTask,
    handleDynamicCellSave,
    handleReferenceCellSave,
    quickAddFocusId,
  };
}
