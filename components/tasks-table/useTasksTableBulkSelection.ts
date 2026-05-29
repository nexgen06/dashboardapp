"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { RowSelectionState, Table } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";

type ToastApi = {
  error: (msg: string, opts?: { action?: { label: string; onClick: () => void | Promise<void> }; durationMs?: number }) => void;
  success: (msg: string, opts?: { action?: { label: string; onClick: () => void | Promise<void> }; durationMs?: number }) => void;
  info: (msg: string, opts?: { action?: { label: string; onClick: () => void | Promise<void> }; durationMs?: number }) => void;
};

export type UseTasksTableBulkSelectionOptions = {
  table: Table<Task>;
  canBulkUpdate: boolean;
  canBulkDelete: boolean;
  canBulkUpdateRow: (task: Task) => boolean;
  canBulkDeleteRow: (task: Task) => boolean;
  saveTask: (id: string, patch: Partial<Task>) => Promise<{ ok: boolean; message?: string }>;
  updateTaskOptimistic: (id: string, patch: Partial<Task>) => void;
  deleteTasks: (ids: string[]) => Promise<void>;
  createTasksBulk: (
    rows: Array<{
      content: string;
      status: string;
      assignee: string | null;
      priority?: string | null;
      project_id?: string | null;
      due_date?: string | null;
      extra_data?: Record<string, string> | null;
    }>
  ) => Promise<void>;
  setRowSelection: Dispatch<SetStateAction<RowSelectionState>>;
  setDeletingIds: Dispatch<SetStateAction<Set<string>>>;
  toast: ToastApi;
};

export function useTasksTableBulkSelection({
  table,
  canBulkUpdate,
  canBulkDelete,
  canBulkUpdateRow,
  canBulkDeleteRow,
  saveTask,
  updateTaskOptimistic,
  deleteTasks,
  createTasksBulk,
  setRowSelection,
  setDeletingIds,
  toast,
}: UseTasksTableBulkSelectionOptions) {
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedTasks = selectedRows.map((r) => r.original);
  const selectedIds = selectedTasks.map((t) => t.id);
  const selectedCanBulkUpdate = selectedTasks.some((task) => canBulkUpdateRow(task));
  const selectedCanBulkDelete = selectedTasks.some((task) => canBulkDeleteRow(task));

  const executeBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0 || !canBulkDelete) return;
    const deletableTasks = selectedTasks.filter((task) => canBulkDeleteRow(task));
    if (deletableTasks.length === 0) {
      toast.error("Seçili satırlarda toplu silme yetkiniz yok.");
      return;
    }
    const deletableIds = deletableTasks.map((task) => task.id);
    setBulkDeleteConfirmOpen(false);
    const backups = deletableTasks.map((t) => ({ ...t }));
    setDeletingIds((prev) => new Set([...Array.from(prev), ...deletableIds]));
    try {
      await deleteTasks(deletableIds);
      setRowSelection({});
      toast.success(`${deletableIds.length} görev silindi`, {
        durationMs: 6000, // standart undo süresi (Linear/Notion 6sn)
        action:
          backups.length > 0
            ? {
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
                    toast.success(`${backups.length} görev geri yüklendi`);
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
            : "Toplu silme başarısız.";
      toast.error(msg);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        deletableIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [
    selectedIds.length,
    selectedTasks,
    canBulkDelete,
    canBulkDeleteRow,
    deleteTasks,
    createTasksBulk,
    setRowSelection,
    setDeletingIds,
    toast,
  ]);

  /**
   * Generic bulk field update + undo snapshot.
   * Tek noktada status / assignee / priority gibi tek-alanlı toplu işlemleri yönetir.
   * Snapshot tutar; başarılı toast'a "Geri al" aksiyonu ekler.
   */
  const performBulkUpdate = useCallback(
    async <K extends "status" | "assignee" | "priority">(
      field: K,
      newValue: Task[K],
      labels: {
        success: (n: number) => string;
        undoSuccess: (n: number) => string;
        skipped?: string;
      }
    ) => {
      // Snapshot — geri al için eski değerleri sakla
      type Snap = { id: string; old: Task[K] };
      const snapshots: Snap[] = [];
      let fail = 0;
      let skipped = 0;

      for (const t of selectedTasks) {
        if (!canBulkUpdateRow(t)) {
          skipped += 1;
          continue;
        }
        snapshots.push({ id: t.id, old: t[field] as Task[K] });
        updateTaskOptimistic(t.id, { [field]: newValue, last_updated_by: "anon" } as Partial<Task>);
        const r = await saveTask(t.id, { [field]: newValue, last_updated_by: "anon" } as Partial<Task>);
        if (!r.ok) fail += 1;
      }

      const updated = snapshots.length - fail;

      if (fail > 0) {
        toast.error(
          `${fail} görev güncellenemedi${updated > 0 ? ` (${updated} güncellendi)` : ""}`
        );
      } else if (updated > 0) {
        // Başarılı toast + Geri al aksiyonu (6sn)
        toast.success(labels.success(updated), {
          durationMs: 6000,
          action: {
            label: "Geri al",
            onClick: () => {
              void (async () => {
                let undoFail = 0;
                for (const snap of snapshots) {
                  updateTaskOptimistic(snap.id, { [field]: snap.old, last_updated_by: "anon" } as Partial<Task>);
                  const r = await saveTask(snap.id, { [field]: snap.old, last_updated_by: "anon" } as Partial<Task>);
                  if (!r.ok) undoFail += 1;
                }
                if (undoFail > 0) {
                  toast.error(`${undoFail} görev geri yüklenemedi`);
                } else {
                  toast.info(labels.undoSuccess(snapshots.length));
                }
              })();
            },
          },
        });
      }
      if (skipped > 0) {
        toast.info(labels.skipped ?? `${skipped} görev yetki nedeniyle atlandı.`);
      }
      setRowSelection({});
    },
    [selectedTasks, canBulkUpdateRow, saveTask, updateTaskOptimistic, setRowSelection, toast]
  );

  const handleBulkStatusUpdate = useCallback(
    async (status: string) => {
      if (!canBulkUpdate) {
        setBulkStatusOpen(false);
        toast.error("Toplu durum güncelleme yetkiniz yok.");
        return;
      }
      setBulkStatusOpen(false);
      await performBulkUpdate("status", status, {
        success: (n) => `${n} görevin durumu güncellendi`,
        undoSuccess: (n) => `${n} görev eski durumuna döndürüldü`,
        skipped: undefined,
      });
    },
    [canBulkUpdate, performBulkUpdate, setBulkStatusOpen, toast]
  );

  /** Toplu atama (assignee). null geçilirse atamayı kaldırır. */
  const handleBulkAssign = useCallback(
    async (assignee: string | null) => {
      if (!canBulkUpdate) {
        toast.error("Toplu güncelleme yetkiniz yok.");
        return;
      }
      await performBulkUpdate("assignee", assignee, {
        success: (n) =>
          assignee ? `${n} görev "${assignee}" kullanıcısına atandı` : `${n} görevin ataması kaldırıldı`,
        undoSuccess: (n) => `${n} görevin önceki ataması geri yüklendi`,
      });
    },
    [canBulkUpdate, performBulkUpdate, toast]
  );

  /** Toplu öncelik güncelle. Boş string → temizle. */
  const handleBulkPriorityUpdate = useCallback(
    async (priority: string) => {
      if (!canBulkUpdate) {
        toast.error("Toplu güncelleme yetkiniz yok.");
        return;
      }
      const newPriority = priority.trim() || null;
      await performBulkUpdate("priority", newPriority, {
        success: (n) =>
          newPriority ? `${n} görev "${newPriority}" önceliğine alındı` : `${n} görevin önceliği temizlendi`,
        undoSuccess: (n) => `${n} görevin önceki önceliği geri yüklendi`,
      });
    },
    [canBulkUpdate, performBulkUpdate, toast]
  );

  return {
    bulkStatusOpen,
    setBulkStatusOpen,
    bulkDeleteConfirmOpen,
    setBulkDeleteConfirmOpen,
    selectedIds,
    selectedTasks,
    selectedCanBulkUpdate,
    selectedCanBulkDelete,
    executeBulkDelete,
    handleBulkStatusUpdate,
    handleBulkAssign,
    handleBulkPriorityUpdate,
  };
}
