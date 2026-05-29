"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Table } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";

export type UseTasksTableKeyboardShortcutsOptions = {
  table: Table<Task>;
  isFullWidth: boolean;
  setIsFullWidth: Dispatch<SetStateAction<boolean>>;
  exportDialogOpen: boolean;
  pdfDialogOpen: boolean;
  emailDialogOpen: boolean;
  importOpen: boolean;
  newTaskOpen: boolean;
  editTask: Task | null;
  advancedFilterOpen: boolean;
  bulkDeleteConfirmOpen: boolean;
  canExportCsv: boolean;
  detailTask: Task | null;
  setExportDialogOpen: Dispatch<SetStateAction<boolean>>;
  setQuickFiltersOpen: Dispatch<SetStateAction<boolean>>;
  setDetailTask: Dispatch<SetStateAction<Task | null>>;
  navAnchorTaskIdRef: MutableRefObject<string | null>;
};

export function useTasksTableKeyboardShortcuts(options: UseTasksTableKeyboardShortcutsOptions) {
  const {
    table,
    isFullWidth,
    setIsFullWidth,
    exportDialogOpen,
    pdfDialogOpen,
    emailDialogOpen,
    importOpen,
    newTaskOpen,
    editTask,
    advancedFilterOpen,
    bulkDeleteConfirmOpen,
    canExportCsv,
    detailTask,
    setExportDialogOpen,
    setQuickFiltersOpen,
    setDetailTask,
    navAnchorTaskIdRef,
  } = options;

  // Klavye sayfa navigasyonu — global event'leri dinleyip table API'sini çağır
  useEffect(() => {
    const prev = () => {
      if (table.getCanPreviousPage()) table.previousPage();
    };
    const next = () => {
      if (table.getCanNextPage()) table.nextPage();
    };
    const first = () => table.setPageIndex(0);
    const last = () => table.setPageIndex(Math.max(0, table.getPageCount() - 1));
    window.addEventListener("taskstable:prevPage", prev);
    window.addEventListener("taskstable:nextPage", next);
    window.addEventListener("taskstable:firstPage", first);
    window.addEventListener("taskstable:lastPage", last);
    return () => {
      window.removeEventListener("taskstable:prevPage", prev);
      window.removeEventListener("taskstable:nextPage", next);
      window.removeEventListener("taskstable:firstPage", first);
      window.removeEventListener("taskstable:lastPage", last);
    };
  }, [table]);

  /**
   * Canlı Tablo klavye kısayolları (Sprint 3.3):
   *  E → dışa aktar · F → hızlı filtre paneli · Shift+F → genişlet/daralt
   *  J/K → sonraki/önceki görev (sheet kapalıyken; açıkken TaskDetailSheet devralır)
   *  [ ] Home End → sayfa gezinmesi · Esc (genişletilmişken) → daralt
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t?.isContentEditable === true;
      const noMod = !e.metaKey && !e.ctrlKey && !e.altKey;

      if (e.key === "Escape" && isFullWidth) {
        e.preventDefault();
        setIsFullWidth(false);
        return;
      }

      const modalOpen =
        exportDialogOpen ||
        pdfDialogOpen ||
        emailDialogOpen ||
        importOpen ||
        newTaskOpen ||
        !!editTask ||
        advancedFilterOpen ||
        bulkDeleteConfirmOpen;
      if (modalOpen) return;
      if (isTyping) return;

      if (noMod && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setIsFullWidth((p) => !p);
        return;
      }

      if (noMod && !e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setQuickFiltersOpen((p) => !p);
        return;
      }

      if (noMod && !e.shiftKey && (e.key === "e" || e.key === "E") && canExportCsv) {
        e.preventDefault();
        setExportDialogOpen(true);
        return;
      }

      if (noMod && !e.shiftKey && !detailTask && (e.key === "j" || e.key === "J" || e.key === "k" || e.key === "K")) {
        const orderedTasks = table.getSortedRowModel().rows.map((r) => r.original);
        if (orderedTasks.length === 0) return;
        const selectedIds = table.getSelectedRowModel().rows.map((r) => r.id);
        const anchorId =
          navAnchorTaskIdRef.current ??
          (selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null);
        const idx = anchorId ? orderedTasks.findIndex((task) => task.id === anchorId) : -1;
        const isNext = e.key === "j" || e.key === "J";
        const nextIdx =
          idx < 0
            ? isNext
              ? 0
              : orderedTasks.length - 1
            : isNext
              ? Math.min(idx + 1, orderedTasks.length - 1)
              : Math.max(idx - 1, 0);
        if (nextIdx === idx && idx >= 0) return;
        const target = orderedTasks[nextIdx];
        if (!target) return;
        e.preventDefault();
        navAnchorTaskIdRef.current = target.id;
        setDetailTask(target);
        return;
      }

      if (noMod) {
        if (e.key === "[" || e.key === ",") {
          e.preventDefault();
          window.dispatchEvent(new Event("taskstable:prevPage"));
          return;
        }
        if (e.key === "]" || e.key === ".") {
          e.preventDefault();
          window.dispatchEvent(new Event("taskstable:nextPage"));
          return;
        }
        if (e.key === "Home") {
          e.preventDefault();
          window.dispatchEvent(new Event("taskstable:firstPage"));
          return;
        }
        if (e.key === "End") {
          e.preventDefault();
          window.dispatchEvent(new Event("taskstable:lastPage"));
          return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    table,
    isFullWidth,
    exportDialogOpen,
    pdfDialogOpen,
    emailDialogOpen,
    importOpen,
    newTaskOpen,
    editTask,
    advancedFilterOpen,
    bulkDeleteConfirmOpen,
    canExportCsv,
    detailTask,
  ]);
}
