"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ColumnOrderState, ColumnPinningState, SortingState, VisibilityState } from "@tanstack/react-table";
import type { AdvancedFilterRule } from "@/lib/liveTableAdvancedFilters";
import { getProjectDefaultSavedView, type SavedViewConfig } from "@/lib/savedViews";

type ToastApi = { info: (msg: string) => void };

export type UseTasksTableSavedViewsOptions = {
  globalSearch: string;
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  projectLinkedFilter: "proje" | "tümü";
  setProjectLinkedFilter: Dispatch<SetStateAction<"proje" | "tümü">>;
  statusFilter: string[];
  setStatusFilter: Dispatch<SetStateAction<string[]>>;
  assigneeFilter: string[];
  setAssigneeFilter: Dispatch<SetStateAction<string[]>>;
  projectFilter: string[];
  setProjectFilter: Dispatch<SetStateAction<string[]>>;
  dateFrom: string;
  setDateFrom: Dispatch<SetStateAction<string>>;
  dateTo: string;
  setDateTo: Dispatch<SetStateAction<string>>;
  datePreset: string;
  setDatePreset: Dispatch<SetStateAction<string>>;
  columnFilters: Record<string, string[]>;
  setColumnFilters: Dispatch<SetStateAction<Record<string, string[]>>>;
  advancedFilterRules: AdvancedFilterRule[];
  setAdvancedFilterRules: Dispatch<SetStateAction<AdvancedFilterRule[]>>;
  sorting: SortingState;
  setSorting: Dispatch<SetStateAction<SortingState>>;
  columnVisibility: VisibilityState;
  setColumnVisibility: Dispatch<SetStateAction<VisibilityState>>;
  columnOrder: ColumnOrderState;
  setColumnOrder: Dispatch<SetStateAction<ColumnOrderState>>;
  columnPinning: ColumnPinningState;
  setColumnPinning: Dispatch<SetStateAction<ColumnPinningState>>;
  resolveProjectContextFromSavedFilters: (projectFilter: unknown) => string[];
  canCreateTask: boolean;
  setNewTaskOpen: Dispatch<SetStateAction<boolean>>;
  clearFilters: () => void;
  toast: ToastApi;
};

export function useTasksTableSavedViews(options: UseTasksTableSavedViewsOptions) {
  const {
    globalSearch,
    setGlobalSearch,
    projectLinkedFilter,
    setProjectLinkedFilter,
    statusFilter,
    setStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    projectFilter,
    setProjectFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    datePreset,
    setDatePreset,
    columnFilters,
    setColumnFilters,
    advancedFilterRules,
    setAdvancedFilterRules,
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    columnPinning,
    setColumnPinning,
    resolveProjectContextFromSavedFilters,
    canCreateTask,
    setNewTaskOpen,
    clearFilters,
    toast,
  } = options;

  const getCurrentViewConfig = useCallback((): SavedViewConfig => {
    return {
      version: 1,
      filters: {
        globalSearch,
        projectLinkedFilter,
        statusFilter,
        assigneeFilter,
        projectFilter,
        dateFrom,
        dateTo,
        datePreset,
        columnFilters,
        advancedFilterRules,
      },
      sort: sorting.map((s) => ({ id: s.id, desc: s.desc })),
      columns: {
        visibility: { ...columnVisibility } as Record<string, boolean>,
        order: [...columnOrder],
        pinning: {
          left: columnPinning.left ?? [],
          right: columnPinning.right ?? [],
        },
      },
    };
  }, [
    globalSearch,
    projectLinkedFilter,
    statusFilter,
    assigneeFilter,
    projectFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
    sorting,
    columnVisibility,
    columnOrder,
    columnPinning,
  ]);

  const applyViewConfig = useCallback((config: SavedViewConfig) => {
    const f = config.filters ?? {};
    setGlobalSearch(typeof f.globalSearch === "string" ? f.globalSearch : "");
    setProjectLinkedFilter(f.projectLinkedFilter === "proje" ? "proje" : "tümü");
    setStatusFilter(Array.isArray(f.statusFilter) ? f.statusFilter : []);
    setAssigneeFilter(Array.isArray(f.assigneeFilter) ? f.assigneeFilter : []);
    setProjectFilter(resolveProjectContextFromSavedFilters(f.projectFilter));
    setDateFrom(typeof f.dateFrom === "string" ? f.dateFrom : "");
    setDateTo(typeof f.dateTo === "string" ? f.dateTo : "");
    setDatePreset(typeof f.datePreset === "string" ? f.datePreset : "custom");
    setColumnFilters(f.columnFilters && typeof f.columnFilters === "object" ? f.columnFilters : {});
    setAdvancedFilterRules(Array.isArray(f.advancedFilterRules) ? (f.advancedFilterRules as AdvancedFilterRule[]) : []);
    if (Array.isArray(config.sort) && config.sort.length > 0) {
      setSorting(config.sort);
    }
    const c = config.columns;
    if (c?.visibility) setColumnVisibility(c.visibility);
    if (Array.isArray(c?.order) && c.order.length > 0) setColumnOrder(c.order);
    if (c?.pinning) {
      setColumnPinning({
        left: c.pinning.left ?? [],
        right: c.pinning.right ?? [],
      });
    }
  }, [resolveProjectContextFromSavedFilters, setProjectFilter]);

  const lastAppliedProjectDefaultRef = useRef<string | null>(null);
  const [syncActiveViewId, setSyncActiveViewId] = useState<string | null>(null);

  /** Tek proje seçildiğinde proje varsayılan görünümünü otomatik uygula. */
  useEffect(() => {
    const projectId = projectFilter.length === 1 ? projectFilter[0] : null;
    if (!projectId) {
      lastAppliedProjectDefaultRef.current = null;
      return;
    }
    if (lastAppliedProjectDefaultRef.current === projectId) return;

    let cancelled = false;
    void getProjectDefaultSavedView(projectId).then((view) => {
      if (cancelled) return;
      lastAppliedProjectDefaultRef.current = projectId;
      if (!view) return;
      applyViewConfig(view.config);
      setSyncActiveViewId(view.id);
      toast.info(`"${view.name}" proje varsayılan görünümü uygulandı`);
    });
    return () => {
      cancelled = true;
    };
  }, [projectFilter, applyViewConfig, toast]);


  /** Komut paleti eylemlerini dinle */
  useEffect(() => {
    const openNew = () => {
      if (canCreateTask) setNewTaskOpen(true);
    };
    const clear = () => clearFilters();
    window.addEventListener("commandpalette:newTask", openNew);
    window.addEventListener("commandpalette:clearFilters", clear);
    return () => {
      window.removeEventListener("commandpalette:newTask", openNew);
      window.removeEventListener("commandpalette:clearFilters", clear);
    };
  }, [canCreateTask, clearFilters]);

  return {
    getCurrentViewConfig,
    applyViewConfig,
    syncActiveViewId,
    setSyncActiveViewId,
  };
}
