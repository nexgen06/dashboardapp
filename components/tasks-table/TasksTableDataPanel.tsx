"use client";

import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { flexRender, type Table } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import type { Settings } from "@/contexts/settings-context";
import type { LiveTableDensity } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";
import { getRelativeTime } from "@/lib/relativeTime";
import { presenceEditorLines } from "@/lib/userDisplayName";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  OnboardingEmpty,
  NoCreatePermissionEmpty,
  FilteredEmpty,
} from "@/components/tasks-table/SmartTasksEmptyState";
import { ConditionalFormattingDialog } from "@/components/tasks-table/ConditionalFormattingDialog";
import { CF_STYLES } from "@/hooks/useConditionalFormatting";
import { TaskCardMobile } from "@/components/TaskCardMobile";
import { MODERN_DENSITY_UI, PAGE_SIZE_OPTIONS, ROW_HEIGHT_BY_DENSITY, VIRTUALIZE_THRESHOLD } from "@/components/tasks-table/constants";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { EditingUser } from "@/hooks/usePresence";
import type { TaskAutomationState } from "@/lib/taskAutomationState";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  GripVertical,
  ListTodo,
  MoreVertical,
  PlusCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

export type TasksTableDataPanelProps = {
  table: Table<Task>;
  mobileListScrollRef: RefObject<HTMLDivElement>;
  liveTableScrollRef: RefObject<HTMLDivElement>;
  isFullWidth: boolean;
  extraDataKeys: string[];
  projectById: Map<string, Project>;
  canEditRow: (task: Task) => boolean;
  canDeleteTask: boolean;
  canCreateTask: boolean;
  canCopyRow: (task: Task) => boolean;
  settings: Settings;
  urgentPrioritySetForTable: Set<string>;
  now: Date;
  setEditTask: Dispatch<SetStateAction<Task | null>>;
  handleCopyTask: (task: Task) => void | Promise<void>;
  handleDeleteTask: (id: string) => void | Promise<void>;
  setDetailTask: Dispatch<SetStateAction<Task | null>>;
  deletingIds: Set<string>;
  toast: { info: (msg: string) => void };
  tableSkin: {
    shell: string;
    table: string;
    headCell: string;
    bodyCell: string;
    row: string;
    pinnedCell: string;
  };
  dui: Record<string, string>;
  requiresSingleProjectSelection: boolean;
  liveTableSumPx: number;
  liveTableNeedsHorizontalScroll: boolean;
  tasks: Task[];
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, columnId: string) => void;
  handleDragStart: (e: React.DragEvent, columnId: string) => void;
  handleDragEnd: () => void;
  draggedColumnId: string | null;
  isModernTemplate: boolean;
  tableDensity: LiveTableDensity;
  columnFilters: Record<string, string[]>;
  columnFilterOpen: string | null;
  setColumnFilterOpen: Dispatch<SetStateAction<string | null>>;
  columnFilterSearch: string;
  setColumnFilterSearch: Dispatch<SetStateAction<string>>;
  clearColumnFilter: (columnId: string) => void;
  toggleColumnFilterValue: (columnId: string, value: string) => void;
  getUniqueValuesForColumn: (columnId: string) => string[];
  pinColumn: (columnId: string, side: "left" | "right" | "unpin") => void;
  canEditProject: boolean;
  setRemoveExtraColumnKey: Dispatch<SetStateAction<string | null>>;
  recentlyUpdatedIds: Set<string>;
  editorsByRowId: Map<string, EditingUser[]>;
  rowAutomationStateByTaskId: Map<string, TaskAutomationState>;
  spotlightActive: boolean;
  spotlightTaskIds: Set<string>;
  presenceHoverRowId: string | null;
  setPresenceHoverRowId: Dispatch<SetStateAction<string | null>>;
  setEditingRow: (rowId: string | null) => void;
  filteredData: Task[];
  canBulkDelete: boolean;
  handleQuickAddRow: () => void | Promise<void>;
  handleDeleteEmptyRows: () => void | Promise<void>;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  projectFilterOptions: { id: string; name: string }[];
  projectSelectionTitle: string;
  projectSelectionDescription: string;
  setProjectFilter: Dispatch<SetStateAction<string[]>>;
  projectFilter: string[];
  canImportCsv: boolean;
  setNewTaskOpen: Dispatch<SetStateAction<boolean>>;
  setImportOpen: Dispatch<SetStateAction<boolean>>;
  activeFilterCount: number;
  clearFilters: () => void;
  /* Group by props (custom grouping — useTasksTableGrouping) */
  groupingField: import("@/hooks/useTasksTableGrouping").GroupingField;
  setGroupingField: (f: import("@/hooks/useTasksTableGrouping").GroupingField) => void;
  groupedItems: import("@/hooks/useTasksTableGrouping").GroupRowItem[];
  toggleGroup: (key: string) => void;
  setAllExpanded: () => void;
  setAllCollapsed: () => void;
  /* Conditional formatting (useConditionalFormatting) */
  cfRules: import("@/hooks/useConditionalFormatting").CfRule[];
  cfEnabledCount: number;
  cfGetRuleForTask: (task: Task) => import("@/hooks/useConditionalFormatting").CfRule | null;
  cfToggleRule: (id: string) => void;
  cfAddRule: (rule: Omit<import("@/hooks/useConditionalFormatting").CfRule, "id">) => void;
  cfDeleteRule: (id: string) => void;
  cfUpdateRule: (id: string, patch: Partial<import("@/hooks/useConditionalFormatting").CfRule>) => void;
  cfResetToPresets: () => void;
};

export function TasksTableDataPanel(props: TasksTableDataPanelProps) {
  const {
    table,
    mobileListScrollRef,
    liveTableScrollRef,
    isFullWidth,
    extraDataKeys,
    projectById,
    canEditRow,
    canDeleteTask,
    canCreateTask,
    canCopyRow,
    settings,
    urgentPrioritySetForTable,
    now,
    setEditTask,
    handleCopyTask,
    handleDeleteTask,
    setDetailTask,
    deletingIds,
    toast,
    tableSkin,
    dui,
    requiresSingleProjectSelection,
    liveTableSumPx,
    liveTableNeedsHorizontalScroll,
    tasks,
    handleDragOver,
    handleDrop,
    handleDragStart,
    handleDragEnd,
    draggedColumnId,
    isModernTemplate,
    tableDensity,
    columnFilters,
    columnFilterOpen,
    setColumnFilterOpen,
    columnFilterSearch,
    setColumnFilterSearch,
    clearColumnFilter,
    toggleColumnFilterValue,
    getUniqueValuesForColumn,
    pinColumn,
    canEditProject,
    setRemoveExtraColumnKey,
    recentlyUpdatedIds,
    editorsByRowId,
    rowAutomationStateByTaskId,
    spotlightActive,
    spotlightTaskIds,
    presenceHoverRowId,
    setPresenceHoverRowId,
    setEditingRow,
    filteredData,
    canBulkDelete,
    handleQuickAddRow,
    handleDeleteEmptyRows,
    updateSetting,
    projectFilterOptions,
    projectSelectionTitle,
    projectSelectionDescription,
    setProjectFilter,
    projectFilter,
    canImportCsv,
    setNewTaskOpen,
    setImportOpen,
    activeFilterCount,
    clearFilters,
    groupingField,
    setGroupingField,
    groupedItems,
    toggleGroup,
    setAllExpanded,
    setAllCollapsed,
    cfRules,
    cfEnabledCount,
    cfGetRuleForTask,
    cfToggleRule,
    cfAddRule,
    cfDeleteRule,
    cfUpdateRule,
    cfResetToPresets,
  } = props;
  const [cfDialogOpen, setCfDialogOpen] = useState(false);

  return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TooltipProvider delayDuration={200} skipDelayDuration={120}>
      {/* MOBİL — kart listesi (md altı). Boşsa hiç render etme; EmptyState aşağıda zaten gösterilir. */}
      {table.getRowModel().rows.length > 0 && (
      <div
        ref={mobileListScrollRef}
        className={cn(
          "flex-1 min-h-0 w-full overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-900/30 md:hidden",
          !isFullWidth && "max-h-[calc(100dvh-22rem)] sm:max-h-[calc(100dvh-20rem)]"
        )}
      >
        <ul className="flex flex-col gap-2" aria-label="Görev listesi">
            {table.getRowModel().rows.map((row) => {
              const t = row.original;
              const pName = t.project_id ? projectById.get(String(t.project_id))?.name ?? null : null;
              const rowCanEdit = canEditRow(t);
              return (
                <li key={row.id}>
                  <TaskCardMobile
                    task={t}
                    projectId={t.project_id ?? null}
                    projectName={pName}
                    extraKeys={extraDataKeys}
                    selected={row.getIsSelected()}
                    onToggleSelect={() => row.toggleSelected(!row.getIsSelected())}
                    dateFormat={settings.dateFormat}
                    urgentPrioritySet={urgentPrioritySetForTable}
                    now={now}
                    canEdit={rowCanEdit}
                    canDelete={rowCanEdit && canDeleteTask}
                    canCreate={rowCanEdit && canCreateTask && canCopyRow(t)}
                    onEdit={() => rowCanEdit && setEditTask(t)}
                    onCopy={() => canCopyRow(t) && handleCopyTask(t)}
                    onDelete={() => rowCanEdit && handleDeleteTask(t.id)}
                    onOpenDetail={() => {
                      if (!rowCanEdit) {
                        toast.info("Bu satır sana atanmadığı için detay ve yorum kapalı.");
                        return;
                      }
                      setDetailTask(t);
                    }}
                    isDeleting={deletingIds.has(t.id)}
                  />
                </li>
              );
            })}
          </ul>
      </div>
      )}
      {/* Grouping kontrol bar (masaüstü, tablonun üstünde) */}
      <div className="hidden md:flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/30">
        <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Grupla:
        </label>
        <select
          value={groupingField ?? ""}
          onChange={(e) => setGroupingField((e.target.value || null) as typeof groupingField)}
          className="h-7 rounded-md border border-slate-200 bg-white px-2 pr-6 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          aria-label="Gruplama alanı"
        >
          <option value="">Yok</option>
          <option value="status">Durum</option>
          <option value="assignee">Atanan</option>
          <option value="priority">Öncelik</option>
          <option value="project">Proje</option>
          <option value="dueBucket">Son tarih</option>
        </select>
        {groupingField && (
          <>
            <button
              type="button"
              onClick={setAllExpanded}
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              title="Tüm grupları aç"
            >
              Tümünü aç
            </button>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              onClick={setAllCollapsed}
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              title="Tüm grupları kapat"
            >
              Tümünü kapat
            </button>
          </>
        )}
        {/* Koşullu biçim butonu */}
        <button
          type="button"
          onClick={() => setCfDialogOpen(true)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors",
            cfEnabledCount > 0
              ? "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          )}
          title="Satırları koşula göre renklendir (Excel pattern)"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          Koşullu Biçim
          {cfEnabledCount > 0 && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-200 px-1 text-[9px] font-bold leading-none text-violet-800 dark:bg-violet-800 dark:text-violet-100">
              {cfEnabledCount}
            </span>
          )}
        </button>
        {/* Sıralama göstergesi + temizle */}
        {table.getState().sorting.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Sıralama: <strong className="text-slate-700 dark:text-slate-200">{table.getState().sorting.length} kolon</strong>
            </span>
            <button
              type="button"
              onClick={() => table.resetSorting()}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              title="Tüm kolon sıralamalarını temizle"
            >
              Temizle
            </button>
          </div>
        )}
      </div>
      {/* CF dialog */}
      <ConditionalFormattingDialog
        open={cfDialogOpen}
        onOpenChange={setCfDialogOpen}
        rules={cfRules}
        onToggle={cfToggleRule}
        onAdd={cfAddRule}
        onDelete={cfDeleteRule}
        onUpdate={cfUpdateRule}
        onReset={cfResetToPresets}
      />

      {/* MASAÜSTÜ — tablo (md ve üstü) */}
      <div
        ref={liveTableScrollRef}
        className={cn(
          "hidden md:flex flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-auto isolate [overflow-anchor:none]",
          tableSkin.shell,
          requiresSingleProjectSelection && "!hidden",
          /* Sayfa düzeni flex’te bazen yükseklik sınırlanmıyor; viewport tavanı iç scroll + thead sticky’yi garanti eder (genişlet modunda portal zaten sınırlı). */
          !isFullWidth &&
            "md:max-h-[calc(100dvh-20rem)] lg:max-h-[calc(100dvh-18rem)] xl:max-h-[calc(100dvh-16rem)]",
          isFullWidth && "min-h-0 max-h-none flex-1",
          tasks.length > 0 && "min-h-[200px]"
        )}
      >
        <table
          className={cn("border-separate border-spacing-0 min-w-full", tableSkin.table, dui.table)}
          aria-describedby="live-table-caption"
          style={{
            tableLayout: "fixed",
            width:
              liveTableSumPx > 0 ? (liveTableNeedsHorizontalScroll ? `${liveTableSumPx}px` : "100%") : "100%",
            minWidth:
              liveTableSumPx > 0 ? (liveTableNeedsHorizontalScroll ? `${liveTableSumPx}px` : "100%") : "100%",
          }}
        >
          <caption id="live-table-caption" className="sr-only">
            Canlı görev tablosu. Sütun başlıklarını sürükleyerek sırayı değiştirebilir, kenardan genişletebilirsiniz. Sütun menüsü ile sabitleme ve sıfırlama yapılabilir.
          </caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => {
              const headers = headerGroup.headers;
              return (
              <tr key={headerGroup.id}>
                {headers.map((header) => {
                  const col = header.column;
                  const isPinnedLeft = col.getIsPinned() === "left";
                  const isPinnedRight = col.getIsPinned() === "right";
                  const resizeHandler = typeof header.getResizeHandler === "function" ? header.getResizeHandler() : undefined;
                  const wPx = Math.max(header.getSize(), 40);
                  return (
                    <th
                      key={header.id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.id)}
                      aria-sort={
                        col.getCanSort?.() && col.getIsSorted() === "asc"
                          ? "ascending"
                          : col.getCanSort?.() && col.getIsSorted() === "desc"
                            ? "descending"
                            : col.getCanSort?.()
                              ? "none"
                              : undefined
                      }
                      className={cn(
                        "relative sticky top-0 z-[15] select-none text-left backdrop-blur",
                        tableSkin.headCell,
                        dui.th,
                        isModernTemplate && MODERN_DENSITY_UI[tableDensity].th,
                        draggedColumnId === col.id && "opacity-50",
                        isPinnedLeft &&
                          "left-0 z-[25] shadow-[4px_0_10px_-4px_rgba(15,23,42,0.22),0_2px_8px_-5px_rgba(15,23,42,0.35)] dark:shadow-[4px_0_12px_-5px_rgba(0,0,0,0.75),0_2px_10px_-6px_rgba(0,0,0,0.8)]",
                        isPinnedRight &&
                          "right-0 z-[25] shadow-[-4px_0_10px_-4px_rgba(15,23,42,0.22),0_2px_8px_-5px_rgba(15,23,42,0.35)] dark:shadow-[-4px_0_12px_-5px_rgba(0,0,0,0.75),0_2px_10px_-6px_rgba(0,0,0,0.8)]",
                        (isPinnedLeft || isPinnedRight) && tableSkin.pinnedCell
                      )}
                      style={{
                        width: wPx,
                        minWidth: wPx,
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <span
                          draggable
                          onDragStart={(e) => handleDragStart(e, col.id)}
                          onDragEnd={handleDragEnd}
                          className="inline-flex shrink-0 cursor-grab items-center active:cursor-grabbing"
                          title="Sütunu sürükleyerek taşı"
                          aria-label="Sütunu sürükle"
                        >
                          <GripVertical className={cn(dui.grip, "text-slate-400/80 dark:text-slate-500")} aria-hidden />
                        </span>
                        {col.getCanSort?.() ? (
                          <button
                            type="button"
                            onClick={col.getToggleSortingHandler()}
                            title="Tıkla: sırala · Shift+tıkla: çoklu sıralamaya ekle"
                            className="flex min-w-0 flex-1 items-center gap-1 truncate text-left hover:text-slate-950 dark:hover:text-white"
                          >
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {col.getIsSorted() === "asc" ? (
                              <ArrowUp className={cn(dui.sortIcon, "shrink-0 text-blue-600")} />
                            ) : col.getIsSorted() === "desc" ? (
                              <ArrowDown className={cn(dui.sortIcon, "shrink-0 text-blue-600")} />
                            ) : (
                              <ArrowUpDown className={cn(dui.sortIcon, "shrink-0 text-slate-400")} />
                            )}
                            {/* Multi-sort sıra göstergesi (yalnız 2+ kolon sıralandığında) */}
                            {col.getIsSorted() && table.getState().sorting.length > 1 && (
                              <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-100 px-1 text-[9px] font-bold leading-none text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                {col.getSortIndex() + 1}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-left">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        )}
                        {/* Excel tarzı sütun filtresi */}
                        {col.id !== "actions" && col.id !== "select" && (
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                dui.colFilterBtn,
                                "shrink-0",
                                columnFilters[col.id]?.length > 0
                                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                                  : "text-slate-400 hover:text-slate-600"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setColumnFilterOpen(columnFilterOpen === col.id ? null : col.id);
                                setColumnFilterSearch("");
                              }}
                              aria-label="Sütun filtresi"
                              title={columnFilters[col.id]?.length > 0 ? `${columnFilters[col.id].length} filtre aktif` : "Filtrele"}
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              {columnFilters[col.id]?.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                                  {columnFilters[col.id].length}
                                </span>
                              )}
                            </Button>
                            {columnFilterOpen === col.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setColumnFilterOpen(null)} />
                                <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] max-h-[350px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                                  <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-2">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                      </span>
                                      {columnFilters[col.id]?.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => clearColumnFilter(col.id)}
                                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                          Temizle
                                        </button>
                                      )}
                                    </div>
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                      <input
                                        type="text"
                                        placeholder="Ara..."
                                        value={columnFilterSearch}
                                        onChange={(e) => setColumnFilterSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full rounded border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-[250px] overflow-y-auto p-2">
                                    {/* Özel seçenekler */}
                                    <div className="mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={columnFilters[col.id]?.includes("__empty__") || false}
                                          onChange={() => toggleColumnFilterValue(col.id, "__empty__")}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                        />
                                        <span className="text-slate-500 dark:text-slate-400 italic">(Boş)</span>
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={columnFilters[col.id]?.includes("__filled__") || false}
                                          onChange={() => toggleColumnFilterValue(col.id, "__filled__")}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                        />
                                        <span className="text-slate-500 dark:text-slate-400 italic">(Dolu)</span>
                                      </label>
                                    </div>
                                    {/* Benzersiz değerler */}
                                    {getUniqueValuesForColumn(col.id)
                                      .filter((v) => !columnFilterSearch || v.toLowerCase().includes(columnFilterSearch.toLowerCase()))
                                      .map((value) => (
                                        <label
                                          key={value}
                                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={columnFilters[col.id]?.includes(value) || false}
                                            onChange={() => toggleColumnFilterValue(col.id, value)}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                          />
                                          <span className="text-slate-700 dark:text-slate-300 truncate" title={value}>
                                            {value.length > 30 ? value.slice(0, 30) + "..." : value}
                                          </span>
                                        </label>
                                      ))}
                                    {getUniqueValuesForColumn(col.id).filter((v) => !columnFilterSearch || v.toLowerCase().includes(columnFilterSearch.toLowerCase())).length === 0 && (
                                      <div className="px-2 py-3 text-xs text-slate-400 text-center">
                                        {columnFilterSearch ? "Sonuç bulunamadı" : "Değer yok"}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className={cn(dui.colMenuBtn, "shrink-0 text-slate-500")} aria-label="Sütun menüsü">
                              <MoreVertical className={cn(dui.sortIcon)} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "left")}>Sol tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "right")}>Sağ tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "unpin")}>Sabitlemeyi kaldır</DropdownMenuItem>
                            {col.id.startsWith("extra:") && canEditProject && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                  onClick={() => setRemoveExtraColumnKey(col.id.slice("extra:".length))}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                                  Bu sütunu projeden kaldır…
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {col.getCanResize?.() && resizeHandler && (
                        <div
                          onMouseDown={resizeHandler}
                          onTouchStart={resizeHandler}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none",
                            "hover:bg-blue-400 hover:w-0.5 hover:right-[-1px]",
                            col.getIsResizing?.() && "bg-blue-500 w-0.5"
                          )}
                          title="Genişliği değiştirmek için sürükleyin"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
              );
            })}
          </thead>
          <VirtualizedTbody
            scrollRef={liveTableScrollRef}
            items={groupedItems}
            colSpan={table.getVisibleLeafColumns().length}
            rowHeight={ROW_HEIGHT_BY_DENSITY[tableDensity]}
            groupHeaderHeight={Math.max(32, ROW_HEIGHT_BY_DENSITY[tableDensity] - 6)}
            renderGroupHeader={(item) => (
              <tr
                key={`grp-${item.key}`}
                className="sticky top-9 z-[5] bg-slate-100/95 backdrop-blur dark:bg-slate-800/95"
              >
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="border-b border-slate-200 px-3 py-1.5 dark:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.key)}
                    className="group/grp flex w-full items-center gap-2 text-left text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                    aria-expanded={!item.collapsed}
                  >
                    <span className={cn("inline-flex shrink-0 text-slate-400 transition-transform duration-150", item.collapsed && "-rotate-90")}>▼</span>
                    <span className="truncate">{item.label}</span>
                    <span className="inline-flex h-5 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-bold leading-none text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {item.count}
                    </span>
                    {item.completedCount > 0 && item.completedCount < item.count && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                        ✓ {item.completedCount}
                      </span>
                    )}
                    {item.completedCount === item.count && item.count > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        ✓ Hepsi tamam
                      </span>
                    )}
                  </button>
                </td>
              </tr>
            )}
            renderRow={(row) => {
              const rowEditors = editorsByRowId.get(row.original.id) ?? [];
              const rowCanEdit = canEditRow(row.original);
              const isEditedByOthers = rowEditors.length > 0;
              const isSelected = row.getIsSelected();
              const isSpotlightHit = spotlightActive && spotlightTaskIds.has(row.original.id);
              const automationState = rowAutomationStateByTaskId.get(row.original.id);
              const visibleCells = row.getVisibleCells();
              let rowTooltipBody: ReactNode | undefined;
              if (isEditedByOthers) {
                if (rowEditors.length === 1) {
                  const { primary, emailLine } = presenceEditorLines(rowEditors[0]);
                  rowTooltipBody = (
                    <>
                      <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                        Bu satırda düzenleme
                      </span>
                      <span className="mt-1.5 block text-base font-semibold leading-snug">{primary}</span>
                      {emailLine && (
                        <span className="mt-1 block break-all text-xs font-medium leading-snug opacity-90">
                          {emailLine}
                        </span>
                      )}
                    </>
                  );
                } else {
                  rowTooltipBody = (
                    <>
                      <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                        Bu satırda düzenleme ({rowEditors.length})
                      </span>
                      <ul className="mt-2 max-h-40 list-none space-y-2 overflow-y-auto text-left text-sm font-semibold">
                        {rowEditors.map((e, i) => {
                          const { primary, emailLine } = presenceEditorLines(e);
                          return (
                            <li
                              key={i}
                              className="border-b border-violet-200/60 pb-2 last:border-0 last:pb-0 dark:border-violet-600/50"
                            >
                              <span className="block">{primary}</span>
                              {emailLine && (
                                <span className="mt-0.5 block break-all text-xs font-normal opacity-90">
                                  {emailLine}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  );
                }
              }
              const rowLockedByOthersBg = "";
              const pinnedDefaultBg = "bg-white dark:bg-slate-900";
              const pinnedBg = isEditedByOthers
                ? rowLockedByOthersBg
                : pinnedDefaultBg;
              const isRecentlyUpdated = recentlyUpdatedIds.has(row.original.id);
              /** Satır hover'ında "Son güncelleyen: X · Y önce" göstergesi (native tooltip) */
              const lastEditorTitle = (() => {
                const who = row.original.last_updated_by;
                const when = row.original.updated_at;
                if (!who && !when) return undefined;
                const whoLabel = who ? `Son güncelleyen: ${who}` : "";
                let whenLabel = "";
                if (when) {
                  try {
                    whenLabel = `${getRelativeTime(new Date(when))}`;
                  } catch {
                    whenLabel = "";
                  }
                }
                const lockLabel = automationState?.locked
                  ? `Otomasyon kilidi${automationState.lockedReason ? `: ${automationState.lockedReason}` : ""}`
                  : "";
                return [lockLabel, whoLabel, whenLabel].filter(Boolean).join(" · ");
              })();
              // Koşullu biçim: eşleşen ilk kuralın stili (selection/presence/automation öncelikli)
              const cfRule = cfGetRuleForTask(row.original);
              const cfStyle = cfRule ? CF_STYLES[cfRule.style] : null;
              const rowClassName = cn(
                "group/row transition-[background-color,box-shadow,border-color] duration-150",
                tableSkin.row,
                isModernTemplate && "live-table-modern-row",
                rowCanEdit ? "cursor-default" : "cursor-default select-none",
                isRecentlyUpdated && "animate-[pulse_1.5s_ease-in-out_2]",
                // CF bg sadece presence/selection yokken (öbürleri öncelikli, üst üste bindirme yapmasın)
                cfStyle && !isEditedByOthers && !isSelected && !automationState?.locked && cfStyle.rowClass,
                cfRule?.bold && "font-semibold",
                automationState?.locked &&
                  !isEditedByOthers &&
                  "border-l-4 border-l-slate-500 shadow-[inset_0_0_0_1px_rgba(100,116,139,0.18)] dark:border-l-slate-400 dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]",
                isSelected && !isEditedByOthers && "border-l-4 border-l-blue-500 dark:border-l-blue-400",
                isEditedByOthers &&
                  "relative z-[1] cursor-default border-l-4 border-l-violet-500 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.16)] dark:border-l-violet-400 dark:shadow-[inset_0_0_0_1px_rgba(167,139,250,0.2)]",
                // CF accent border (sadece diğer accent yoksa)
                cfStyle && !isEditedByOthers && !isSelected && !automationState?.locked && "border-l-4",
                cfStyle && !isEditedByOthers && !isSelected && !automationState?.locked && cfStyle.accentClass,
                isSpotlightHit && ""
              );
              const rowTooltipClass =
                "z-[400] max-w-[min(22rem,calc(100vw-2rem))] border-2 border-violet-500 bg-violet-100 px-3 py-2.5 text-sm font-semibold leading-snug text-violet-950 shadow-[0_8px_32px_rgba(0,0,0,0.18)] animate-in fade-in-0 zoom-in-95 dark:border-violet-400 dark:bg-violet-900/95 dark:text-violet-50 md:text-base";
              const rowCells = visibleCells.map((cell) => {
                const isPinnedLeft = cell.column.getIsPinned() === "left";
                const isPinnedRight = cell.column.getIsPinned() === "right";
                const wPx = Math.max(cell.column.getSize(), 40);
                return (
                  <td
                    key={cell.id}
                    className={cn(
                      "align-middle transition-colors",
                      tableSkin.bodyCell,
                      dui.td,
                      isModernTemplate && MODERN_DENSITY_UI[tableDensity].td,
                      !rowCanEdit && "select-none",
                      isEditedByOthers && rowLockedByOthersBg,
                      isPinnedLeft && "sticky left-0 z-10 shadow-[4px_0_10px_-5px_rgba(15,23,42,0.18)] dark:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.75)]",
                      isPinnedRight && "sticky right-0 z-10 shadow-[-4px_0_10px_-5px_rgba(15,23,42,0.18)] dark:shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.75)]",
                      (isPinnedLeft || isPinnedRight) && cn(pinnedBg, tableSkin.pinnedCell)
                    )}
                    style={{
                      width: wPx,
                      minWidth: wPx,
                    }}
                  >
                    <div className="min-w-0 overflow-hidden text-slate-700 dark:text-slate-200">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </td>
                );
              });

              const claimRowPresence = () => setEditingRow(row.original.id);
              const rowPointerHandlers = {
                onPointerDown: claimRowPresence,
                title: lastEditorTitle,
              };

              if (rowTooltipBody != null && isEditedByOthers) {
                return (
                  <Tooltip
                    key={row.id}
                    delayDuration={80}
                    disableHoverableContent
                    open={presenceHoverRowId === row.id}
                    onOpenChange={(open) => {
                      if (!open) setPresenceHoverRowId((cur) => (cur === row.id ? null : cur));
                    }}
                  >
                    <TooltipTrigger asChild>
                      <tr
                        className={rowClassName}
                        data-selected={isSelected ? "true" : undefined}
                        data-spotlight-row={isSpotlightHit ? "true" : undefined}
                        {...rowPointerHandlers}
                        onPointerEnter={() => setPresenceHoverRowId(row.id)}
                        onPointerLeave={() =>
                          setPresenceHoverRowId((cur) => (cur === row.id ? null : cur))
                        }
                      >
                        {rowCells}
                      </tr>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10} className={rowTooltipClass}>
                      {rowTooltipBody}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return (
                <tr
                  key={row.id}
                  className={rowClassName}
                  data-selected={isSelected ? "true" : undefined}
                  data-spotlight-row={isSpotlightHit ? "true" : undefined}
                  {...rowPointerHandlers}
                >
                  {rowCells}
                </tr>
              );
            }}
            footerRow={canCreateTask && !requiresSingleProjectSelection ? (
              <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80">
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="p-0"
                >
                  <div className="flex w-full items-stretch">
                    <button
                      type="button"
                      onClick={handleQuickAddRow}
                      className="group flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-blue-50/80 hover:text-blue-700 focus:bg-blue-50/80 focus:text-blue-700 focus:outline-none dark:text-slate-400 dark:hover:bg-blue-950/35 dark:hover:text-blue-200 dark:focus:bg-blue-950/35 dark:focus:text-blue-200"
                      aria-label="Yeni satır ekle (Enter ile zincirleme)"
                    >
                      <PlusCircle className="h-4 w-4 shrink-0 opacity-75 group-hover:opacity-100" aria-hidden />
                      <span>Yeni satır</span>
                      <span className="ml-2 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Enter ile zincirle
                      </span>
                    </button>
                    {canBulkDelete && (
                      <button
                        type="button"
                        onClick={handleDeleteEmptyRows}
                        className="flex shrink-0 items-center gap-1.5 border-l border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-red-50/80 hover:text-red-700 focus:bg-red-50/80 focus:text-red-700 focus:outline-none dark:border-slate-700 dark:text-slate-400 dark:hover:bg-red-950/35 dark:hover:text-red-300 dark:focus:bg-red-950/35 dark:focus:text-red-300"
                        title="Mevcut görünümdeki içeriksiz/boş satırları sil — geri alınabilir"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="hidden sm:inline">Boş satırları sil</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : null}
          />
        </table>
      </div>
      </TooltipProvider>
      {filteredData.length > 0 && (
        /* Minimalist footer — Claude Design referans:
           Satır N ▼ | SIK ORTA GENİŞ | 32 kayıt · sayfa 1/1 ◀ ▶
           Tek satır, küçük font, soft border, inline metin pagination. */
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t px-4 py-1.5 text-[11px] backdrop-blur",
            isModernTemplate
              ? "live-table-modern-footer border-slate-200 bg-slate-50/80 text-slate-600 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-300"
              : "border-slate-200/80 bg-white/60 text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-400"
          )}
        >
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5">
              <span>Satır</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className={cn(
                  "h-6 rounded-md border px-1.5 pr-5 text-[11px] focus:outline-none",
                  isModernTemplate
                    ? "border-slate-300 bg-white text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-500 dark:focus:ring-slate-600/40"
                    : "border-slate-200 bg-white text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                )}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <span className="hidden h-3 w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />
            {/* Density inline pill toggle — SIK / ORTA / GENİŞ */}
            <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 dark:bg-slate-800/80" role="radiogroup" aria-label="Tablo yoğunluğu">
              {(["compact", "normal", "comfortable"] as const).map((d) => {
                const label = d === "compact" ? "Sık" : d === "normal" ? "Orta" : "Geniş";
                const active = settings.liveTableDensity === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateSetting("liveTableDensity", d)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-all",
                      active
                        ? isModernTemplate
                          ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
                          : "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              <span
                className={cn(
                  "font-semibold text-slate-700 dark:text-slate-200",
                  isModernTemplate && "live-table-modern-metric-primary"
                )}
              >
                {filteredData.length}
              </span>{" "}
              <span className={cn(isModernTemplate && "live-table-modern-metric-label")}>kayıt</span>
              <span className="mx-1.5 opacity-50">·</span>
              <span className={cn(isModernTemplate && "live-table-modern-metric-label")}>sayfa</span>{" "}
              <span
                className={cn(
                  "font-semibold text-slate-700 dark:text-slate-200",
                  isModernTemplate && "live-table-modern-metric-primary"
                )}
              >
                {table.getState().pagination.pageIndex + 1}
              </span>
              <span className={cn("opacity-60", isModernTemplate && "live-table-modern-metric-secondary")}>
                {" "}
                / {table.getPageCount() || 1}
              </span>
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-30",
                  isModernTemplate
                    ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
                aria-label="Önceki sayfa"
                title="Önceki sayfa ( [ veya , )"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-30",
                  isModernTemplate
                    ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
                aria-label="Sonraki sayfa"
                title="Sonraki sayfa ( ] veya . )"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}
      {filteredData.length === 0 && (
        requiresSingleProjectSelection ? (
          <div className="flex min-h-[18rem] flex-1 items-center justify-center px-4 py-8">
            <EmptyState
              icon={<FolderKanban className="h-10 w-10" />}
              title={projectSelectionTitle}
              description={projectSelectionDescription}
              action={
                projectFilterOptions.length > 0 ? (
                  <div className="flex max-w-3xl flex-wrap items-center justify-center gap-2">
                    {projectFilterOptions.slice(0, 8).map((project) => (
                      <Button
                        key={project.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setProjectFilter([project.id])}
                        className="max-w-[14rem] justify-start"
                        title={project.name}
                      >
                        <FolderKanban className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{project.name}</span>
                      </Button>
                    ))}
                    {projectFilterOptions.length > 8 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        +{projectFilterOptions.length - 8} proje daha; üstteki Proje filtresinden seçebilirsiniz.
                      </span>
                    )}
                  </div>
                ) : undefined
              }
              secondaryAction={
                projectFilter.length > 1 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setProjectFilter([])}>
                    Çoklu seçimi temizle
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : tasks.length === 0 ? (
          canCreateTask || canImportCsv ? (
            <OnboardingEmpty
              canCreateTask={canCreateTask}
              canImportCsv={canImportCsv}
              onCreateTask={() => setNewTaskOpen(true)}
              onImportCsv={() => setImportOpen(true)}
            />
          ) : (
            <NoCreatePermissionEmpty />
          )
        ) : (
          <FilteredEmpty
            columnFilters={columnFilters}
            projectFilter={projectFilter}
            projectFilterOptions={projectFilterOptions}
            onClearAll={clearFilters}
          />
        )
      )}
      </div>
  );
}

/**
 * Sanal tbody — item sayısı VIRTUALIZE_THRESHOLD'u aşınca yalnız görünür
 * (viewport içindeki) öğeleri render eder. Items hem normal satır hem grup
 * başlığı olabilir (useTasksTableGrouping).
 *
 * Pinned sütunlar, presence border'ları, selection state, hover quick
 * actions, group başlık collapse — hepsi callback'lerle parent'ta tanımlandığı
 * için doğal şekilde çalışır.
 */
function VirtualizedTbody({
  scrollRef,
  items,
  colSpan,
  rowHeight,
  groupHeaderHeight,
  renderRow,
  renderGroupHeader,
  footerRow,
}: {
  scrollRef: RefObject<HTMLDivElement>;
  items: import("@/hooks/useTasksTableGrouping").GroupRowItem[];
  colSpan: number;
  rowHeight: number;
  groupHeaderHeight: number;
  renderRow: (row: import("@tanstack/react-table").Row<Task>) => ReactNode;
  renderGroupHeader: (
    item: Extract<import("@/hooks/useTasksTableGrouping").GroupRowItem, { type: "header" }>
  ) => ReactNode;
  footerRow?: ReactNode;
}) {
  const shouldVirtualize = items.length >= VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? items.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (items[i]?.type === "header" ? groupHeaderHeight : rowHeight),
    overscan: 10,
  });

  const renderItem = (item: import("@/hooks/useTasksTableGrouping").GroupRowItem) =>
    item.type === "header" ? renderGroupHeader(item) : renderRow(item.row);

  if (!shouldVirtualize) {
    return (
      <tbody>
        {items.map((it) => renderItem(it))}
        {footerRow}
      </tbody>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <tbody>
      {paddingTop > 0 && (
        <tr aria-hidden>
          <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
        </tr>
      )}
      {virtualRows.map((vi) => {
        const item = items[vi.index];
        if (!item) return null;
        return renderItem(item);
      })}
      {paddingBottom > 0 && (
        <tr aria-hidden>
          <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
        </tr>
      )}
      {footerRow}
    </tbody>
  );
}
