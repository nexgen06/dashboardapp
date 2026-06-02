"use client";

import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { RenameExtraColumnDraft } from "@/components/tasks-table/useTasksTableRenameExtraColumn";
import { useEffect, useMemo, useState } from "react";
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
// NOT: Cell-level yorum UI (sağ tık + popover + badge) geçici devre dışı —
// realtime subscribe parent re-render → EditableCell input focus kaybı →
// onBlur autosave → yazılan metin DB değerine sıfırlanıyordu (tüm sütunlar).
// Faz 1 (DB + lib + hook) korunuyor; UI fresh tasarımla yeniden gelecek.
import { CF_STYLES } from "@/hooks/useConditionalFormatting";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCardMobile } from "@/components/TaskCardMobile";
import { MODERN_DENSITY_UI, PAGE_SIZE_OPTIONS, ROW_HEIGHT_BY_DENSITY, VIRTUALIZE_THRESHOLD, LIVE_TABLE_THEAD_CELL_CLASS, LIVE_TABLE_SORT_IDLE_ICON_CLASS, LIVE_TABLE_SCROLL_SHELL_CLASS, LIVE_TABLE_THEAD_HEIGHT_BY_DENSITY, LIVE_TABLE_SIMPLIFIED_GRID_CLASS, LIVE_TABLE_GHOST_ACTIONS_RAIL_WIDTH, LIVE_TABLE_SELECT_COLUMN_WIDTH } from "@/components/tasks-table/constants";
import { liveTablePinCellBg } from "@/components/tasks-table/LiveTableRowRail";
import {
  isLiveTableStickyLeft,
  isLiveTableStickyRight,
  liveTableStickyCellStyle,
} from "@/lib/liveTableColumnPinning";
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
  Pencil,
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
  liveTableViewportWidth: number;
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
  canEditProject: boolean;
  setRemoveExtraColumnKey: Dispatch<SetStateAction<string | null>>;
  setRenameExtraColumnDraft: Dispatch<SetStateAction<RenameExtraColumnDraft | null>>;
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
  /** dnd-kit ile kolon sıralama — drag bittiğinde mevcut sırayı verir, yeni dizisini bekler */
  onColumnReorder?: (newOrder: string[]) => void;
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
    liveTableViewportWidth,
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
    canEditProject,
    setRemoveExtraColumnKey,
    setRenameExtraColumnDraft,
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
    onColumnReorder,
  } = props;
  const [cfDialogOpen, setCfDialogOpen] = useState(false);

  // Modern toolbar'dan CF dialog açma — window event ile cross-component trigger
  // (PrimaryToolbarModernAdapter "cf:open" dispatch eder, burası listener)
  useEffect(() => {
    const onOpen = () => setCfDialogOpen(true);
    window.addEventListener("tasksTable:openCf", onOpen);
    return () => window.removeEventListener("tasksTable:openCf", onOpen);
  }, []);

  const [dragActiveColumnId, setDragActiveColumnId] = useState<string | null>(null);

  // dnd-kit sensors — pointer (mouse+touch) + klavye (a11y)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleColumnDragStart = (e: DragStartEvent) => {
    setDragActiveColumnId(String(e.active.id));
  };
  const handleColumnDragEnd = (e: DragEndEvent) => {
    setDragActiveColumnId(null);
    const { active, over } = e;
    if (!over || active.id === over.id || !onColumnReorder) return;
    const currentOrder = table.getAllLeafColumns().map((c) => c.id);
    const from = currentOrder.indexOf(String(active.id));
    const to = currentOrder.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onColumnReorder(arrayMove(currentOrder, from, to));
  };

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
        {/* Sıralama göstergesi + temizle — yalnızca klasik toolbar'da.
            Modern toolbar ViewMenu (Görünüm) → Sıralama bölümünde aynı bilgiyi
            (count badge + "Temizle") zaten gösteriyor; modern modda burayı
            render edersek duplicate olur. */}
        {settings.toolbarStyle !== "modern" && table.getState().sorting.length > 0 && (
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

      {/* Cell-level yorum UI geçici devre dışı (yukarıdaki not'a bak) */}

      {/* MASAÜSTÜ — tablo (md ve üstü) */}
      <div
        ref={liveTableScrollRef}
        className={cn(
          LIVE_TABLE_SCROLL_SHELL_CLASS,
          "hidden md:flex flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-auto [overflow-anchor:none]",
          tableSkin.shell,
          requiresSingleProjectSelection && "!hidden",
          /* Sayfa düzeni flex’te bazen yükseklik sınırlanmıyor; viewport tavanı iç scroll + thead sticky’yi garanti eder (genişlet modunda portal zaten sınırlı). */
          !isFullWidth &&
            "md:max-h-[calc(100dvh-20rem)] lg:max-h-[calc(100dvh-18rem)] xl:max-h-[calc(100dvh-16rem)]",
          isFullWidth && "min-h-0 max-h-none flex-1",
          tasks.length > 0 && "min-h-[200px]"
        )}
        style={{
          ["--live-table-thead-height" as string]: `${LIVE_TABLE_THEAD_HEIGHT_BY_DENSITY[tableDensity]}px`,
        }}
      >
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragStart={handleColumnDragStart}
          onDragEnd={handleColumnDragEnd}
          onDragCancel={() => setDragActiveColumnId(null)}
        >
        <table
          className={cn("group/live-table border-separate border-spacing-0 min-w-full", LIVE_TABLE_SIMPLIFIED_GRID_CLASS, tableSkin.table, dui.table)}
          aria-describedby="live-table-caption"
          style={{
            tableLayout: "fixed",
            width:
              liveTableSumPx > 0
                ? `${Math.max(liveTableSumPx, liveTableViewportWidth > 0 ? liveTableViewportWidth : liveTableSumPx)}px`
                : "100%",
            minWidth: liveTableViewportWidth > 0 ? `${liveTableViewportWidth}px` : "100%",
          }}
        >
          <caption id="live-table-caption" className="sr-only">
            Canlı görev tablosu. Sütun başlıklarını sürükleyerek sırayı değiştirebilir, kenardan genişletebilirsiniz.
          </caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => {
              const headers = headerGroup.headers;
              // Sortable kolonlar: select/actions hariç (sürüklenemez)
              const sortableIds = headers
                .filter((h) => h.column.id !== "select" && h.column.id !== "actions")
                .map((h) => h.column.id);
              return (
              <tr key={headerGroup.id}>
                <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
                {headers.map((header) => {
                  const col = header.column;
                  const resizeHandler = typeof header.getResizeHandler === "function" ? header.getResizeHandler() : undefined;
                  const isSelectCol = col.id === "select";
                  const isActionsCol = col.id === "actions";
                  const stickyLeft = isLiveTableStickyLeft(col);
                  const stickyRight = isLiveTableStickyRight(col);
                  const wPx = isSelectCol
                    ? LIVE_TABLE_SELECT_COLUMN_WIDTH
                    : isActionsCol
                      ? LIVE_TABLE_GHOST_ACTIONS_RAIL_WIDTH
                      : Math.max(header.getSize(), 40);
                  return (
                    <SortableHeaderCell
                      key={header.id}
                      columnId={col.id}
                      dataCol={isSelectCol ? "select" : isActionsCol ? "actions" : undefined}
                      isSortable={col.id !== "select" && col.id !== "actions"}
                      ariaSort={
                        col.getCanSort?.() && col.getIsSorted() === "asc"
                          ? "ascending"
                          : col.getCanSort?.() && col.getIsSorted() === "desc"
                            ? "descending"
                            : col.getCanSort?.()
                              ? "none"
                              : undefined
                      }
                      className={cn(
                        LIVE_TABLE_THEAD_CELL_CLASS,
                        // DİKKAT: "relative" YAZMA — twMerge sticky'yi siler!
                        // LIVE_TABLE_THEAD_CELL_CLASS zaten "sticky top-0" içeriyor,
                        // sticky position context kendisi oluşturur (relative gerekmez).
                        "text-left",
                        tableSkin.headCell,
                        dui.th,
                        isModernTemplate && MODERN_DENSITY_UI[tableDensity].th,
                        // Pin'li hücreler için z-index'i artır + yatay sticky offset
                        // (top zaten LIVE_TABLE_THEAD_CELL_CLASS'tan gelir, sticky burada
                        // override edilmemeli)
                        isSelectCol && "z-[25] px-0 py-0 text-center",
                        isActionsCol && "z-[25] px-0 text-right",
                        stickyLeft && !isSelectCol && "z-[30]",
                        stickyRight && !isActionsCol && "z-[30]",
                      )}
                      style={{
                        width: wPx,
                        minWidth: wPx,
                        ...liveTableStickyCellStyle(col),
                      }}
                      gripClassName={cn(dui.grip, "text-slate-400/80 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
                    >
                      <div className="flex min-w-0 items-center gap-1">
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
                              <ArrowUpDown className={cn(dui.sortIcon, LIVE_TABLE_SORT_IDLE_ICON_CLASS)} />
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
                                "shrink-0 transition-opacity duration-150",
                                columnFilters[col.id]?.length > 0
                                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                                  : cn(
                                      "text-slate-400 hover:text-slate-600",
                                      "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/th:opacity-100 focus-visible:opacity-100"
                                    )
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
                        {col.id.startsWith("extra:") && canEditProject && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className={cn(dui.colMenuBtn, "shrink-0 text-slate-500")} aria-label="Sütun menüsü">
                              <MoreVertical className={cn(dui.sortIcon)} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRenameExtraColumnDraft({
                                      oldKey: col.id.slice("extra:".length),
                                      newKey: col.id.slice("extra:".length),
                                    })
                                  }
                                >
                                  <Pencil className="mr-2 h-4 w-4" aria-hidden />
                                  Sütunu yeniden adlandır…
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                  onClick={() => setRemoveExtraColumnKey(col.id.slice("extra:".length))}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                                  Bu sütunu projeden kaldır…
                                </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        )}
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
                    </SortableHeaderCell>
                  );
                })}
                </SortableContext>
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
                className="live-table-group-header sticky z-[5]"
                style={{ top: "var(--live-table-thead-height, 44px)" }}
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
                "group/row",
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
                const isSelectCol = cell.column.id === "select";
                const isActionsCol = cell.column.id === "actions";
                const stickyLeft = isLiveTableStickyLeft(cell.column);
                const stickyRight = isLiveTableStickyRight(cell.column);
                const wPx = isSelectCol
                  ? LIVE_TABLE_SELECT_COLUMN_WIDTH
                  : isActionsCol
                    ? LIVE_TABLE_GHOST_ACTIONS_RAIL_WIDTH
                    : Math.max(cell.column.getSize(), 40);
                const pinBg = liveTablePinCellBg(isSelected, isEditedByOthers);
                return (
                  <td
                    key={cell.id}
                    data-col={isSelectCol ? "select" : isActionsCol ? "actions" : undefined}
                    className={cn(
                      "align-middle transition-colors",
                      tableSkin.bodyCell,
                      dui.td,
                      isModernTemplate && MODERN_DENSITY_UI[tableDensity].td,
                      !rowCanEdit && "select-none",
                      isEditedByOthers && rowLockedByOthersBg,
                      isSelectCol &&
                        cn("relative sticky z-[10] px-0 py-0", pinBg),
                      isActionsCol &&
                        cn("relative sticky z-[10] px-0 py-0 text-right", pinBg),
                      stickyLeft &&
                        !isSelectCol &&
                        cn("sticky z-10", pinBg),
                      stickyRight &&
                        !isActionsCol &&
                        cn("sticky z-10", pinBg)
                    )}
                    style={{
                      width: wPx,
                      minWidth: wPx,
                      ...liveTableStickyCellStyle(cell.column),
                    }}
                  >
                    <div
                      className={cn(
                        "min-w-0 text-slate-700 dark:text-slate-200",
                        isSelectCol || isActionsCol ? "overflow-visible" : "overflow-hidden"
                      )}
                    >
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

              // SABIT DOM ağacı: Tooltip wrapper her zaman render edilir.
              // Önceki kod conditional render ile (Tooltip yes/no) ağaç tipini
              // değiştiriyordu → presence titremesinde tüm <tr> ve içindeki
              // EditableCell'ler UNMOUNT/REMOUNT → kullanıcının yazdığı kayboluyordu.
              // Şimdi: open + content görünürlüğü koşullu, ağaç sabit.
              const showRowTooltip = rowTooltipBody != null && isEditedByOthers;
              return (
                <Tooltip
                  key={row.id}
                  delayDuration={80}
                  disableHoverableContent
                  open={showRowTooltip && presenceHoverRowId === row.id}
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
                      onPointerEnter={
                        showRowTooltip ? () => setPresenceHoverRowId(row.id) : undefined
                      }
                      onPointerLeave={
                        showRowTooltip
                          ? () => setPresenceHoverRowId((cur) => (cur === row.id ? null : cur))
                          : undefined
                      }
                    >
                      {rowCells}
                    </tr>
                  </TooltipTrigger>
                  {showRowTooltip && (
                    <TooltipContent side="top" sideOffset={10} className={rowTooltipClass}>
                      {rowTooltipBody}
                    </TooltipContent>
                  )}
                </Tooltip>
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
        <DragOverlay dropAnimation={null}>
          {dragActiveColumnId && (
            <div className="rounded-md border-2 border-indigo-400 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-xl dark:bg-slate-800 dark:text-slate-100">
              {(() => {
                const col = table.getAllLeafColumns().find((c) => c.id === dragActiveColumnId);
                const header = col?.columnDef.header;
                return typeof header === "string" ? header : dragActiveColumnId;
              })()}
            </div>
          )}
        </DragOverlay>
        </DndContext>
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
/**
 * Sortable <th> wrapper — dnd-kit useSortable hook.
 *
 * Grip handle (GripVertical) ile sürüklenir; sortable olmayan kolonlarda
 * (select, actions) handle render edilmez ve listeners atanmaz. Drop hedefiyken
 * sol kenarında 3px mavi indikatör görünür (Notion/Linear pattern).
 *
 * Children: th'nin iç içeriği (mevcut başlık + filtre dropdown + resize handle)
 */
function SortableHeaderCell({
  columnId,
  dataCol,
  isSortable,
  ariaSort,
  className,
  style,
  gripClassName,
  children,
}: {
  columnId: string;
  dataCol?: string;
  isSortable: boolean;
  ariaSort?: "ascending" | "descending" | "none";
  className?: string;
  style?: React.CSSProperties;
  gripClassName?: string;
  children: ReactNode;
}) {
  // Sortable olmayan kolonlar useSortable çağırılır ama listeners disabled
  const sortable = useSortable({ id: columnId, disabled: !isSortable });
  const { setNodeRef, attributes, listeners, transform, transition, isDragging, isOver, active } = sortable;
  const isOverFromOther = isOver && active?.id !== columnId;
  // KRİTİK: dnd-kit transform sadece gerçek drag/animate sırasında uygulanır.
  // `transform === null` iken set etmek (boş translate3d) sticky positioning'i
  // tarayıcılarda kırar — thead "yapışkan" özelliğini kaybeder. Bu yüzden
  // transform/transition yalnız truthy iken inline style'a girer.
  const combinedStyle: React.CSSProperties = {
    ...(style || {}),
    ...(isSortable && transform ? { transform: CSS.Transform.toString(transform) } : {}),
    ...(isSortable && transition ? { transition } : {}),
    ...(isSortable && isDragging ? { opacity: 0.4 } : {}),
  };
  // Sortable kolonlarda küçük grip butonu — listeners SADECE grip'e bağlı
  // (sort/filter butonları tıklanabilir kalsın). Activation distance 6px ile
  // accidental drag engellenir.
  const gripSlot = isSortable ? (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className={cn(
        "absolute left-0.5 top-1/2 z-[1] -translate-y-1/2 inline-flex h-5 w-3 cursor-grab items-center justify-center rounded opacity-0 transition-opacity active:cursor-grabbing",
        "group-hover/th:opacity-100 focus-visible:opacity-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60",
        gripClassName
      )}
      title="Sürükle (mouse / touch / klavye: Tab + Space + ←→)"
      aria-label={`${columnId} sütununu sürükle`}
    >
      <GripVertical className="h-3 w-3" aria-hidden />
    </button>
  ) : null;

  return (
    <th
      ref={setNodeRef}
      aria-sort={ariaSort}
      data-col={dataCol}
      className={cn(
        "group/th",
        className,
        // Drop hedefi indikatörü — Notion/Linear pattern
        isOverFromOther && "ring-2 ring-inset ring-indigo-400 dark:ring-indigo-500"
      )}
      style={combinedStyle}
    >
      {gripSlot}
      <div className={cn(isSortable && "pl-3")}>{children}</div>
    </th>
  );
}

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
