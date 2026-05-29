"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  Table,
  VisibilityState,
} from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import type { LiveTableDensity } from "@/contexts/settings-context";
import {
  BASE_COLUMN_ORDER_STABLE,
  DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY,
} from "@/components/tasks-table/constants";
import { computeBalancedColumnSizing, measureIntrinsicColumnWidths } from "@/components/tasks-table/columnSizing";
import type { TasksTableFiltersPersistedSlice } from "@/components/tasks-table/useTasksTableFilters";
import {
  loadLiveTablePrefs,
  mergeColumnOrderWithDynamics,
  saveLiveTablePrefs,
  type LiveTablePersistedPrefs,
} from "@/lib/liveTableColumnPersistence";

export type UseTasksTableColumnPrefsOptions = {
  userId: string | null;
  extraDataKeys: string[];
  sorting: SortingState;
  setSorting: Dispatch<SetStateAction<SortingState>>;
  filtersPersistedSlice: TasksTableFiltersPersistedSlice;
  onHydrateFilters: (filters: TasksTableFiltersPersistedSlice) => void;
  tableRef: MutableRefObject<Table<Task> | null>;
  filteredData: Task[];
  tableDensity: LiveTableDensity;
  isLoading: boolean;
  error: string | null;
  isFullWidth: boolean;
};

export function useTasksTableColumnPrefs({
  userId,
  extraDataKeys,
  sorting,
  setSorting,
  filtersPersistedSlice,
  onHydrateFilters,
  tableRef,
  filteredData,
  tableDensity,
  isLoading,
  error,
  isFullWidth,
}: UseTasksTableColumnPrefsOptions) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(BASE_COLUMN_ORDER_STABLE);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({
    select: 56,
    status: 140,
    content: 260,
    actions: 52,
  });
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [columnPickerSearch, setColumnPickerSearch] = useState("");
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [liveTableViewportWidth, setLiveTableViewportWidth] = useState(0);
  const [fitToContent, setFitToContent] = useState(false);

  const skipNextLiveTablePersistRef = useRef(false);
  const liveTableHydratedUserRef = useRef<string | null>(null);
  const userSizedColumnsRef = useRef<Set<string>>(new Set());
  const liveTableScrollRef = useRef<HTMLDivElement>(null);
  const mobileListScrollRef = useRef<HTMLDivElement>(null);
  const pendingPrefsSaveRef = useRef<{ userId: string; payload: LiveTablePersistedPrefs } | null>(null);

  useEffect(() => {
    const dynamicIds = extraDataKeys.map((k) => `extra:${k}`);

    if (!userId) {
      liveTableHydratedUserRef.current = null;
      userSizedColumnsRef.current.clear();
      setColumnOrder((prev) => mergeColumnOrderWithDynamics(prev, dynamicIds));
      return;
    }

    if (liveTableHydratedUserRef.current !== userId) {
      liveTableHydratedUserRef.current = userId;
      userSizedColumnsRef.current.clear();
      skipNextLiveTablePersistRef.current = true;
      const saved = loadLiveTablePrefs(userId);
      setColumnOrder(mergeColumnOrderWithDynamics(saved?.columnOrder, dynamicIds));
      setColumnVisibility(
        saved != null ? (saved.columnVisibility ?? {}) : DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY
      );
      setColumnPinning(saved?.columnPinning ?? { left: [], right: [] });
      if (saved?.columnSizing && Object.keys(saved.columnSizing).length > 0) {
        for (const id of Object.keys(saved.columnSizing)) {
          userSizedColumnsRef.current.add(id);
        }
        setColumnSizing((prev) => ({ ...prev, ...saved.columnSizing }));
      }
      if (saved?.sorting && saved.sorting.length > 0) {
        setSorting(saved.sorting);
      }
      const f = saved?.filters;
      if (f) onHydrateFilters(f);
      return;
    }

    setColumnOrder((prev) => mergeColumnOrderWithDynamics(prev, dynamicIds));
  }, [userId, extraDataKeys, onHydrateFilters, setSorting]);

  const buildCurrentPrefs = useCallback((): LiveTablePersistedPrefs => ({
    columnVisibility,
    columnOrder,
    columnPinning,
    columnSizing,
    sorting,
    filters: filtersPersistedSlice,
  }), [columnVisibility, columnOrder, columnPinning, columnSizing, sorting, filtersPersistedSlice]);

  useEffect(() => {
    if (!userId) return;
    if (skipNextLiveTablePersistRef.current) {
      skipNextLiveTablePersistRef.current = false;
      return;
    }
    saveLiveTablePrefs(userId, buildCurrentPrefs());
  }, [userId, filtersPersistedSlice, buildCurrentPrefs]);

  useEffect(() => {
    if (!userId) return;
    if (skipNextLiveTablePersistRef.current) return;
    const payload = buildCurrentPrefs();
    pendingPrefsSaveRef.current = { userId, payload };
    const t = window.setTimeout(() => {
      saveLiveTablePrefs(userId, payload);
      pendingPrefsSaveRef.current = null;
    }, 250);
    return () => window.clearTimeout(t);
  }, [userId, columnVisibility, columnOrder, columnPinning, columnSizing, sorting, buildCurrentPrefs]);

  useEffect(() => {
    const flush = () => {
      const pending = pendingPrefsSaveRef.current;
      if (pending) {
        saveLiveTablePrefs(pending.userId, pending.payload);
        pendingPrefsSaveRef.current = null;
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", flush);
      window.addEventListener("pagehide", flush);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", flush);
        window.removeEventListener("pagehide", flush);
      }
      flush();
    };
  }, []);

  const liveTableVisibleKey = useMemo(() => {
    const vis = Object.keys(columnVisibility)
      .sort()
      .map((k) => `${k}:${columnVisibility[k] === false ? "0" : "1"}`)
      .join(",");
    return `${columnOrder.join(",")}|${vis}|${extraDataKeys.join(",")}`;
  }, [columnOrder, columnVisibility, extraDataKeys]);

  useLayoutEffect(() => {
    if (isLoading || error) return;
    const el = liveTableScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect.width ?? 0;
      setLiveTableViewportWidth(Math.floor(cr));
    });
    ro.observe(el);
    setLiveTableViewportWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [isLoading, error, isFullWidth]);

  const handleAutoSizeColumns = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
    if (!fitToContent) {
      const intrinsic = measureIntrinsicColumnWidths(filteredData, visibleIds, tableDensity);
      for (const id of visibleIds) userSizedColumnsRef.current.add(id);
      setColumnSizing((prev) => ({ ...prev, ...intrinsic }));
      setFitToContent(true);
      return;
    }
    userSizedColumnsRef.current.clear();
    const vw =
      liveTableScrollRef.current?.clientWidth ??
      liveTableViewportWidth ??
      (typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.88) : 1200);
    const next = computeBalancedColumnSizing(
      filteredData,
      visibleIds,
      Math.max(0, Math.floor(vw)),
      tableDensity
    );
    setColumnSizing((prev) => ({ ...prev, ...next }));
    setFitToContent(false);
  }, [tableRef, filteredData, tableDensity, liveTableViewportWidth, fitToContent]);

  useEffect(() => {
    if (isLoading || error) return;
    const table = tableRef.current;
    if (!table) return;
    const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
    const vw =
      liveTableViewportWidth > 0
        ? liveTableViewportWidth
        : typeof window !== "undefined"
          ? Math.floor(window.innerWidth * 0.85)
          : 0;
    const sized = computeBalancedColumnSizing(filteredData, visibleIds, vw, tableDensity);
    setColumnSizing((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(sized)) {
        if (userSizedColumnsRef.current.has(id)) continue;
        const v = sized[id];
        if (v !== undefined && next[id] !== v) {
          next[id] = v;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tableRef, filteredData, liveTableVisibleKey, liveTableViewportWidth, tableDensity, isLoading, error]);

  const handleColumnSizingChange = useCallback(
    (updater: ColumnSizingState | ((old: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((old) => {
        const next = typeof updater === "function" ? updater(old) : updater;
        for (const key of Object.keys(next)) {
          if (next[key] !== old[key]) userSizedColumnsRef.current.add(key);
        }
        return next;
      });
    },
    []
  );

  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedColumnId(columnId);
    e.dataTransfer.setData("text/plain", columnId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedColumnId || draggedColumnId === targetId) return;
      setColumnOrder((prev) => {
        const order = [...prev];
        const from = order.indexOf(draggedColumnId);
        const to = order.indexOf(targetId);
        if (from === -1 || to === -1) return prev;
        order.splice(from, 1);
        order.splice(to, 0, draggedColumnId);
        return order;
      });
      setDraggedColumnId(null);
    },
    [draggedColumnId]
  );

  const handleDragEnd = useCallback(() => setDraggedColumnId(null), []);

  const pinColumn = useCallback((columnId: string, side: "left" | "right" | "unpin") => {
    setColumnPinning((prev) => {
      const left = (prev.left ?? []).filter((id) => id !== columnId);
      const right = (prev.right ?? []).filter((id) => id !== columnId);
      if (side === "left") return { left: [...left, columnId], right };
      if (side === "right") return { left, right: [...right, columnId] };
      return { left, right };
    });
  }, []);

  const openColumnPicker = useCallback(() => {
    setColumnPickerSearch("");
    setColumnPickerOpen(true);
  }, []);

  const toggleColumnVisibilityInstant = useCallback((columnId: string, show: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev };
      if (show) delete next[columnId];
      else next[columnId] = false;
      return next;
    });
  }, []);

  const setManyColumnVisibilityInstant = useCallback((columnIds: string[], show: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev };
      for (const id of columnIds) {
        if (show) delete next[id];
        else next[id] = false;
      }
      return next;
    });
  }, []);

  const resetColumnOrderToDefault = useCallback(() => {
    const dynamicIds = extraDataKeys.map((k) => `extra:${k}`);
    setColumnOrder(mergeColumnOrderWithDynamics(undefined, dynamicIds));
    setColumnPinning({ left: [], right: [] });
  }, [extraDataKeys]);

  return {
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    columnPinning,
    setColumnPinning,
    columnSizing,
    setColumnSizing,
    columnPickerOpen,
    setColumnPickerOpen,
    columnPickerSearch,
    setColumnPickerSearch,
    draggedColumnId,
    liveTableViewportWidth,
    liveTableScrollRef,
    mobileListScrollRef,
    fitToContent,
    handleAutoSizeColumns,
    handleColumnSizingChange,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    pinColumn,
    openColumnPicker,
    toggleColumnVisibilityInstant,
    setManyColumnVisibilityInstant,
    resetColumnOrderToDefault,
    userSizedColumnsRef,
  };
}
