"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type RowSelectionState,
  type SortingState,
  type PaginationState,
  type Table,
} from "@tanstack/react-table";
import { useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { Task } from "@/types/tasks";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { usePresence } from "@/hooks/usePresence";
import {
  collectProjectAssigneeEmails,
  resolveBulkAssigneeProjectIds,
} from "@/lib/projectAssignees";
import { useTasksTableGrouping } from "@/hooks/useTasksTableGrouping";
import { useConditionalFormatting } from "@/hooks/useConditionalFormatting";
import {
  useSettings,
  getStatusOptions,
  getPriorityOptions,
} from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import {
  LIVE_TABLE_DENSITY_UI,
  LIVE_TABLE_TEMPLATE_UI,
} from "@/components/tasks-table/constants";
import { TasksTableDialogs } from "@/components/tasks-table/TasksTableDialogs";
import { TasksTableLoadingState } from "@/components/tasks-table/TasksTableLoadingState";
import { TasksTableErrorState } from "@/components/tasks-table/TasksTableErrorState";
import { AdvancedFilterDialog } from "@/components/tasks-table/AdvancedFilterDialog";
import { TasksTableFiltersPanel } from "@/components/tasks-table/TasksTableFiltersPanel";
import { PrimaryToolbarModernAdapter } from "@/components/tasks-table/PrimaryToolbarModernAdapter";
import { TasksTableExportDialogs } from "@/components/tasks-table/TasksTableExportDialogs";
import { TasksTableSelectionBar } from "@/components/tasks-table/TasksTableSelectionBar";
import { TasksTableBulkDeleteDialog } from "@/components/tasks-table/TasksTableBulkDeleteDialog";
import { TasksTableDataPanel } from "@/components/tasks-table/TasksTableDataPanel";
import { TasksTableActionBar } from "@/components/tasks-table/TasksTableActionBar";
import { RemoveExtraColumnDialog } from "@/components/tasks-table/RemoveExtraColumnDialog";
import { useTasksTableColumns } from "@/components/tasks-table/useTasksTableColumns";
import { useTasksTableFilters } from "@/components/tasks-table/useTasksTableFilters";
import { useTasksTableBulkSelection } from "@/components/tasks-table/useTasksTableBulkSelection";
import { useTasksTableColumnPrefs } from "@/components/tasks-table/useTasksTableColumnPrefs";
import { useTasksTableExport } from "@/components/tasks-table/useTasksTableExport";
import { useTasksTableDataLayer } from "@/components/tasks-table/useTasksTableDataLayer";
import { useTasksTablePermissions } from "@/components/tasks-table/useTasksTablePermissions";
import { useTasksTableWorkflow } from "@/components/tasks-table/useTasksTableWorkflow";
import { useTasksTableSpotlight } from "@/components/tasks-table/useTasksTableSpotlight";
import { useTasksTableSavedViews } from "@/components/tasks-table/useTasksTableSavedViews";
import { useTasksTableRowHandlers } from "@/components/tasks-table/useTasksTableRowHandlers";
import { useTasksTableKeyboardShortcuts } from "@/components/tasks-table/useTasksTableKeyboardShortcuts";
import { useTasksTableRemoveExtraColumn } from "@/components/tasks-table/useTasksTableRemoveExtraColumn";
import { useTasksTableRenameExtraColumn } from "@/components/tasks-table/useTasksTableRenameExtraColumn";
import { RenameExtraColumnDialog } from "@/components/tasks-table/RenameExtraColumnDialog";
import { TasksTableTopStrip } from "@/components/tasks-table/TasksTableTopStrip";
import type { TasksTableProps } from "@/components/tasks-table/types";
import { useToast } from "@/components/ui/toast";
import { usePrompt } from "@/components/ui/modals";
import { urgentPrioritySetFromCsv } from "@/lib/urgentTaskPriority";

export function TasksTable({
  projectFilter: extProjectFilter,
  onProjectFilterChange,
  viewTabs,
  initialOpenTaskId,
}: TasksTableProps = {}) {
  const {
    tasks,
    updateTaskOptimistic,
    saveTask,
    createTask,
    createTasksBulk,
    deleteTask,
    deleteTasks,
    fetchTasks,
    isLoading,
    error,
    realtimeConnection,
    recentlyUpdatedIds,
  } = useTasksWithRealtime();
  const { projects, updateProject } = useProjects();
  const { user, hasPermission, isAdmin } = useAuth();
  const { editorsByRowId, onlineUsers, setEditingRow } = usePresence({
    userEmail: user?.email ?? undefined,
    userName: user?.displayName ?? user?.email ?? undefined,
    userId: user?.id ?? undefined,
  });
  const [presenceHoverRowId, setPresenceHoverRowId] = useState<string | null>(null);

  const { settings, updateSetting } = useSettings();
  const tableDensity = settings.liveTableDensity;
  const tableTemplate = settings.liveTableTemplate ?? "classic";
  const isModernTemplate = tableTemplate === "modern";
  const tableSkin = LIVE_TABLE_TEMPLATE_UI[tableTemplate];
  const dui = LIVE_TABLE_DENSITY_UI[tableDensity];
  const statusOptions = useMemo(() => getStatusOptions(settings), [settings.customStatusList]);
  const priorityOptions = getPriorityOptions(settings);
  const urgentPrioritySetForTable = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();
  const canCreateTask = hasPermission("liveTable.createTask");
  const canEditTask = hasPermission("liveTable.editTask");
  const canDeleteTask = hasPermission("liveTable.deleteTask");
  const canCommentTask = hasPermission("liveTable.commentTask");
  const canCopyCell = hasPermission("liveTable.copyCell");
  const canBulkUpdate = hasPermission("liveTable.bulkUpdate");
  const canBulkDelete = hasPermission("liveTable.bulkDelete");
  const canImportCsv = hasPermission("liveTable.importCsv");
  const canExportCsv = hasPermission("liveTable.exportCsv");
  const canExportAllRows = hasPermission("liveTable.exportAllRows");
  const canExportSensitiveUnmasked = hasPermission("liveTable.exportSensitiveUnmasked");
  const canManageColumns = hasPermission("liveTable.manageColumns");
  const canAutoSizeColumns = hasPermission("liveTable.autoSizeColumns");
  const canEditProject = hasPermission("projects.edit");
  const canViewSensitiveCells = isAdmin;
  const canManageSensitiveChips =
    hasPermission("sensitiveChips.manage") || user?.roleId === "admin" || user?.roleId === "project_manager";
  const canRunClientAutomations =
    hasPermission("automation.manage") || user?.roleId === "admin" || user?.roleId === "project_manager";
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  /** Hızlı satır ekleme zinciri: id verilirse content sütunundaki EditableCell mount'ta edit moduna geçer. */
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  /** J/K gezinmesi için son odak görev (sheet kapalıyken satır seçimi). */
  const navAnchorTaskIdRef = useRef<string | null>(null);
  const [isFullWidth, setIsFullWidth] = useState(false);

  useEffect(() => {
    if (!initialOpenTaskId || isLoading) return;
    const match = tasks.find((t) => t.id === initialOpenTaskId);
    if (match) setDetailTask(match);
  }, [initialOpenTaskId, isLoading, tasks]);

  useEffect(() => {
    if (detailTask) navAnchorTaskIdRef.current = detailTask.id;
  }, [detailTask]);

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const toast = useToast();
  const promptUser = usePrompt();
  const now = new Date();

  const dataLayer = useTasksTableDataLayer({
    projects,
    tasks,
    userId: user?.id,
    canRunClientAutomations,
  });
  const {
    projectColumnsByProjectId,
    referenceSources,
    projectPermissionsByProjectId,
    projectPermissionsAvailable,
    chipCatalog,
    rowChipValues,
    setRowChipValues,
    automationRules,
    spotlightEnabled,
    spotlightNowMs,
    chipResolver,
    rowAutomationStateByTaskId,
  } = dataLayer;

  const [sorting, setSorting] = useState<SortingState>([{ id: "status", desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const tableFilters = useTasksTableFilters({
    tasks,
    projects,
    extProjectFilter,
    onProjectFilterChange,
    chipResolver,
    rowChipValues,
    chipCatalog,
    currentUserEmail,
    urgentPrioritySetForTable,
    setSorting,
  });
  const {
    quickFiltersOpen,
    setQuickFiltersOpen,
    activeSmartFilter,
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
    statusDropdownOpen,
    setStatusDropdownOpen,
    assigneeDropdownOpen,
    setAssigneeDropdownOpen,
    projectDropdownOpen,
    setProjectDropdownOpen,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    columnFilters,
    setColumnFilters,
    columnFilterOpen,
    setColumnFilterOpen,
    columnFilterSearch,
    setColumnFilterSearch,
    datePreset,
    setDatePreset,
    advancedFilterRules,
    setAdvancedFilterRules,
    advancedFilterOpen,
    setAdvancedFilterOpen,
    projectById,
    projectFilterOptions,
    assigneeFilterOptions,
    requiresSingleProjectSelection,
    projectSelectionTitle,
    projectSelectionDescription,
    scopedProjectIdSet,
    extraDataKeys,
    advancedFilterFieldOptions,
    activeAdvancedFilterRuleCount,
    filteredData,
    activeFilterCount,
    smartFilterCounts,
    clearFilters,
    applySmartFilter,
    applyDatePreset,
    getUniqueValuesForColumn,
    toggleColumnFilterValue,
    clearColumnFilter,
    applyFilterConfigPatch,
    resolveProjectContextFromSavedFilters,
  } = tableFilters;

  const tableRef = useRef<Table<Task> | null>(null);

  const columnPrefs = useTasksTableColumnPrefs({
    userId: user?.id ?? null,
    extraDataKeys,
    sorting,
    setSorting,
    filtersPersistedSlice: tableFilters.filtersPersistedSlice,
    onHydrateFilters: tableFilters.hydrateFiltersFromPrefs,
    tableRef,
    filteredData,
    tableDensity,
    isLoading,
    error,
    isFullWidth,
  });
  const {
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
    openColumnPicker,
    toggleColumnVisibilityInstant,
    setManyColumnVisibilityInstant,
    resetColumnOrderToDefault,
  } = columnPrefs;

  const activeReferenceColumns = useMemo(() => {
    const source =
      Array.isArray(projectFilter) && projectFilter.length === 1
        ? projectColumnsByProjectId[projectFilter[0]] ?? []
        : Object.values(projectColumnsByProjectId).flat();
    return source.filter((col) => (col.config.reference?.records?.length ?? 0) > 0);
  }, [projectColumnsByProjectId, projectFilter]);

  const tableAccess = useTasksTablePermissions({
    projectById,
    projectPermissionsByProjectId,
    rowAutomationStateByTaskId,
    user,
    isAdmin,
    currentUserEmail,
    canEditTask,
    canCommentTask,
    canCopyCell,
    canBulkUpdate,
    canBulkDelete,
    canExportCsv,
    canExportAllRows,
    canExportSensitiveUnmasked,
    canViewSensitiveCells,
  });
  const {
    isRowLockedByApproval,
    canEditRow,
    canCommentRow,
    canCopyRow,
    canBulkUpdateRow,
    canBulkDeleteRow,
    canExportRow,
    canExportUnmaskedRow,
    logSensitivePolicyDecision,
    trackSensitiveViewShadow,
  } = tableAccess;

  const { isProjectWorkflowEnabled, getWorkflowActionsForTask, handleWorkflowAction } =
    useTasksTableWorkflow({
      projectById,
      user,
      isAdmin,
      canEditRow,
      getProjectPermissionForTask: tableAccess.getProjectPermissionForTask,
      saveTask,
      updateTaskOptimistic,
      fetchTasks,
      toast,
      promptUser,
    });

  const {
    spotlightMatchByTaskId,
    spotlightTaskIds,
    spotlightActive,
    spotlightSummary,
    jumpToSpotlightRows,
  } = useTasksTableSpotlight({
    automationRules,
    filteredData,
    chipCatalog,
    rowChipValues,
    spotlightEnabled,
    spotlightNowMs,
    toast,
  });

  const {
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
  } = useTasksTableRowHandlers({
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
  });

  /** Satır güncellemesi `data` referansını değiştirir; TanStack varsayılanında sayfa 0'a sıçrar — kapatıyoruz. */
  const maxPageIndex = useMemo(
    () => Math.max(0, Math.ceil(filteredData.length / pagination.pageSize) - 1),
    [filteredData.length, pagination.pageSize]
  );

  useEffect(() => {
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
    }
  }, [maxPageIndex, pagination.pageIndex]);

  /**
   * Sayfa değişiminde liste konteynerini başa sar — kullanıcı yeni sayfayı en üstten
   * okur (önceki sayfanın son satırına yapışık kalmasın). Hem mobil hem desktop.
   * pageSize değişiminde de baş döndürür çünkü görünür satırlar değişir.
   */
  useEffect(() => {
    const opts: ScrollToOptions = { top: 0, behavior: "smooth" };
    liveTableScrollRef.current?.scrollTo(opts);
    mobileListScrollRef.current?.scrollTo(opts);
  }, [pagination.pageIndex, pagination.pageSize]);


  const columns = useTasksTableColumns({
    handleSave,
    statusOptions,
    tableDensity,
    tableTemplate,
    dui,
    extraDataKeys,
    handleDynamicCellSave,
    handleReferenceCellSave,
    activateEditableCell,
    isActiveEditableCell,
    scheduleEditableCellBlur,
    focusNextEditableCell,
    handleQuickAddRow,
    quickAddFocusId,
    deletingIds,
    editorsByRowId,
    canEditRow,
    getWorkflowActionsForTask,
    handleWorkflowAction,
    isProjectWorkflowEnabled,
    isRowLockedByApproval,
    canCopyRow,
    canCreateTask,
    canEditTask,
    canDeleteTask,
    handleCopyTask,
    handleDeleteTask,
    setEditingRow,
    setEditTask,
    setDetailTask,
    settings,
    projectById,
    projectColumnsByProjectId,
    projectFilter,
    chipCatalog,
    rowChipValues,
    setRowChipValues,
    canManageSensitiveChips,
    canViewSensitiveCells,
    toast,
    user,
    spotlightMatchByTaskId,
    spotlightActive,
    spotlightTaskIds,
    trackSensitiveViewShadow,
    referenceSources,
  });

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: handleColumnSizingChange,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: { rowSelection, columnVisibility, columnOrder, columnPinning, columnSizing, sorting, pagination },
    enableRowSelection: true,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enablePinning: true,
    enableSorting: true,
    autoResetPageIndex: false,
    manualPagination: false,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
  });

  tableRef.current = table;

  // Group by — kullanıcı tablo'yu status/assignee/priority/proje/due bucket bazında grupla
  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    projectById.forEach((p, id) => {
      m.set(String(id), p.name);
    });
    return m;
  }, [projectById]);
  const grouping = useTasksTableGrouping({
    rows: table.getRowModel().rows,
    projectNameById,
  });

  const { getCurrentViewConfig, applyViewConfig, syncActiveViewId, setSyncActiveViewId } =
    useTasksTableSavedViews({
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
      groupingField: grouping.groupingField,
      setGroupingField: grouping.setGroupingField,
      resolveProjectContextFromSavedFilters,
      canCreateTask,
      setNewTaskOpen,
      clearFilters,
      toast,
    });

  // Koşullu biçimlendirme (Excel pattern) — satır kurallara göre renklenir
  const conditionalFormatting = useConditionalFormatting();


  const bulkSelection = useTasksTableBulkSelection({
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
  });
  const {
    bulkStatusOpen,
    setBulkStatusOpen,
    bulkDeleteConfirmOpen,
    setBulkDeleteConfirmOpen,
    selectedIds,
    selectedCanBulkUpdate,
    selectedCanBulkDelete,
    executeBulkDelete,
    handleBulkStatusUpdate,
    handleBulkAssign,
    handleBulkPriorityUpdate,
  } = bulkSelection;

  const bulkAssigneeOptions = useMemo(() => {
    const selectedProjectIds = tasks
      .filter((task) => selectedIds.includes(task.id) && task.project_id)
      .map((task) => String(task.project_id));
    const scopeIds = resolveBulkAssigneeProjectIds({
      selectedProjectIds,
      projectFilter,
    });
    return collectProjectAssigneeEmails(projects, scopeIds);
  }, [tasks, selectedIds, projectFilter, projects]);

  const tableExport = useTasksTableExport({
    table,
    tasks,
    filteredData,
    canExportRow,
    canExportUnmaskedRow,
    canExportSensitiveUnmasked,
    canExportAllRows,
    projectPermissionsAvailable,
    currentUserEmail,
    user,
    isAdmin,
    projectById,
    projectFilter,
    dateFormat: settings.dateFormat,
    chipResolver,
    logSensitivePolicyDecision,
    toast,
    promptUser,
    projectLinkedFilter,
    globalSearch,
    statusFilter,
    assigneeFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
    applyViewConfig,
    applyFilterConfigPatch,
    setColumnVisibility,
  });
  const {
    exportDialogOpen,
    setExportDialogOpen,
    pdfDialogOpen,
    handlePdfDialogOpenChange,
    emailDialogOpen,
    setEmailDialogOpen,
    pdfDialogScope,
    exportScopeLabel,
    exportSensitivityLabel,
    exportCurrentRows,
    exportAllRows,
    exportUnmaskSensitive,
    setExportUnmaskSensitive,
    exportIncludeAutoRowNumber,
    setExportIncludeAutoRowNumber,
    handleExportCSV,
    handleExportExcel,
    openPdfDialog,
    openEmailDialog,
    reportTemplateSelection,
    applyReportTemplate,
    savedReportTemplates,
    availableManagedReportTemplates,
    selectedReportTemplate,
    selectedManagedReportTemplate,
    selectedCustomReportTemplate,
    saveCurrentReportTemplate,
    deleteSelectedReportTemplate,
    selectedPdfRows,
    selectedPdfTitle,
    pdfTitleInput,
    setPdfTitleInput,
    pdfPreviewUrl,
    setPdfPreviewUrl,
    pdfPreviewIframeRef,
    previewExportPDF,
    confirmExportPDF,
    printPdfPreview,
    pdfPreviewLoading,
    pdfDownloadLoading,
    emailSubjectInput,
    setEmailSubjectInput,
    emailTemplateMode,
    setEmailTemplateMode,
    emailTemplate,
    emailCopied,
    setEmailCopied,
    copyEmailTemplate,
    printEmailTemplate,
  } = tableExport;

  useTasksTableKeyboardShortcuts({
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
  });

  const {
    removeExtraColumnKey,
    setRemoveExtraColumnKey,
    removingExtraColumn,
    removeExtraColumnImpact,
    executeRemoveExtraColumn,
  } = useTasksTableRemoveExtraColumn({
    projects,
    tasks,
    scopedProjectIdSet,
    updateProject,
    saveTask,
    updateTaskOptimistic,
    fetchTasks,
    toast,
  });

  const {
    renameExtraColumnDraft,
    setRenameExtraColumnDraft,
    renamingExtraColumn,
    renameExtraColumnImpact,
    executeRenameExtraColumn,
  } = useTasksTableRenameExtraColumn({
    projects,
    tasks,
    scopedProjectIdSet,
    updateProject,
    updateTaskOptimistic,
    fetchTasks,
    toast,
  });

  if (isLoading) {
    return <TasksTableLoadingState />;
  }

  if (error) {
    return <TasksTableErrorState error={error} onRetry={() => fetchTasks()} />;
  }

  const liveTableHeaderGroup = table.getHeaderGroups()[0];
  const liveTableSumPx =
    liveTableHeaderGroup?.headers.reduce((s, h) => s + Math.max(h.getSize(), 40), 0) ?? 0;
  const liveTableNeedsHorizontalScroll =
    liveTableViewportWidth > 0 && liveTableSumPx > liveTableViewportWidth + 2;

  const liveTableBody = (
    <>
      <AdvancedFilterDialog
        open={advancedFilterOpen}
        onOpenChange={setAdvancedFilterOpen}
        rules={advancedFilterRules}
        onRulesChange={setAdvancedFilterRules}
        fieldOptions={advancedFilterFieldOptions}
      />
      <TasksTableDialogs
        table={table}
        canCreateTask={canCreateTask}
        canImportCsv={canImportCsv}
        newTaskOpen={newTaskOpen}
        setNewTaskOpen={setNewTaskOpen}
        editTask={editTask}
        setEditTask={setEditTask}
        importOpen={importOpen}
        setImportOpen={setImportOpen}
        detailTask={detailTask}
        setDetailTask={setDetailTask}
        handleNewTask={handleNewTask}
        handleEditSubmit={handleEditSubmit}
        handleCSVImport={handleCSVImport}
        canEditRow={canEditRow}
        canCommentRow={canCommentRow}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        defaultStatus={settings.defaultTaskStatus}
        defaultPriority={settings.defaultTaskPriority}
        projectById={projectById}
        projectFilter={projectFilter}
        dateFormat={settings.dateFormat}
        urgentPrioritySetForTable={urgentPrioritySetForTable}
        activeReferenceColumns={activeReferenceColumns}
        extraDataKeys={extraDataKeys}
      />
      {settings.toolbarStyle === "modern" ? (
        <PrimaryToolbarModernAdapter
          table={table}
          tasks={tasks}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          projectLinkedFilter={projectLinkedFilter}
          setProjectLinkedFilter={setProjectLinkedFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusOptions={statusOptions}
          assigneeFilter={assigneeFilter}
          setAssigneeFilter={setAssigneeFilter}
          assigneeFilterOptions={assigneeFilterOptions}
          projectFilter={projectFilter}
          setProjectFilter={setProjectFilter}
          projectFilterOptions={projectFilterOptions}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          activeFilterCount={activeFilterCount}
          clearFilters={clearFilters}
          activeSmartFilter={activeSmartFilter as string | null}
          applySmartFilter={(id: string | null) => {
            if (id === null) {
              // Modern: clear via toggling to same active
              if (activeSmartFilter) applySmartFilter(activeSmartFilter);
            } else {
              applySmartFilter(id as Parameters<typeof applySmartFilter>[0]);
            }
          }}
          smartFilterCounts={smartFilterCounts}
          groupingField={grouping.groupingField}
          setGroupingField={grouping.setGroupingField}
          cfRules={conditionalFormatting.rules}
          cfEnabledCount={conditionalFormatting.enabledCount}
          onEditCf={() => window.dispatchEvent(new Event("tasksTable:openCf"))}
          updateSetting={updateSetting}
          savedViewsProps={{
            // SavedViews mevcut yapıda ayrı component (SavedViewsControl) — modern v1'de
            // basit no-op; ileride hook'tan liste alıp wire edilecek.
            views: [],
            activeViewId: syncActiveViewId,
            isModified: false,
            onSelect: setSyncActiveViewId,
            onSaveAs: () => { /* TODO: integrate */ },
            onUpdate: () => { /* TODO: integrate */ },
          }}
          onAddRow={() => setNewTaskOpen(true)}
          onImport={() => setImportOpen(true)}
          onExportCsv={() => handleExportCSV("current")}
          onExportXlsx={() => handleExportExcel("current")}
          onPrint={() => openPdfDialog("current")}
          fullscreen={isFullWidth}
          onFullscreen={() => setIsFullWidth((f) => !f)}
          onReset={resetColumnOrderToDefault}
          onOpenTask={(id) => {
            const t = tasks.find((x) => x.id === id);
            if (t) setDetailTask(t);
          }}
        />
      ) : (
      <TasksTableFiltersPanel
        isModernTemplate={isModernTemplate}
        quickFiltersOpen={quickFiltersOpen}
        setQuickFiltersOpen={setQuickFiltersOpen}
        smartFilterCounts={smartFilterCounts}
        activeSmartFilter={activeSmartFilter}
        applySmartFilter={applySmartFilter}
        clearFilters={clearFilters}
        currentUserEmail={currentUserEmail}
        globalSearch={globalSearch}
        setGlobalSearch={setGlobalSearch}
        projectLinkedFilter={projectLinkedFilter}
        setProjectLinkedFilter={setProjectLinkedFilter}
        activeAdvancedFilterRuleCount={activeAdvancedFilterRuleCount}
        setAdvancedFilterOpen={setAdvancedFilterOpen}
        statusDropdownOpen={statusDropdownOpen}
        setStatusDropdownOpen={setStatusDropdownOpen}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusOptions={statusOptions}
        assigneeDropdownOpen={assigneeDropdownOpen}
        setAssigneeDropdownOpen={setAssigneeDropdownOpen}
        assigneeFilter={assigneeFilter}
        setAssigneeFilter={setAssigneeFilter}
        assigneeFilterOptions={assigneeFilterOptions}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        applyDatePreset={applyDatePreset}
        canAutoSizeColumns={canAutoSizeColumns}
        fitToContent={fitToContent}
        handleAutoSizeColumns={handleAutoSizeColumns}
        tableDensity={tableDensity}
        tableTemplate={tableTemplate}
        updateSetting={updateSetting}
        isFullWidth={isFullWidth}
        setIsFullWidth={setIsFullWidth}
        table={table}
        tasks={tasks}
        activeFilterCount={activeFilterCount}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        projectDropdownOpen={projectDropdownOpen}
        setProjectDropdownOpen={setProjectDropdownOpen}
        projectFilterOptions={projectFilterOptions}
        projectById={projectById}
        setAdvancedFilterRules={setAdvancedFilterRules}
        columnFilters={columnFilters}
        clearColumnFilter={clearColumnFilter}
      />
      )}
      <TasksTableActionBar
        viewTabs={viewTabs}
        getCurrentViewConfig={getCurrentViewConfig}
        onApplyViewConfig={applyViewConfig}
        isAdmin={isAdmin}
        userId={user?.id ?? null}
        projectFilter={projectFilter}
        syncActiveViewId={syncActiveViewId}
        canManageColumns={canManageColumns}
        columnPickerOpen={columnPickerOpen}
        setColumnPickerOpen={setColumnPickerOpen}
        openColumnPicker={openColumnPicker}
        table={table}
        columnPickerSearch={columnPickerSearch}
        setColumnPickerSearch={setColumnPickerSearch}
        setManyColumnVisibilityInstant={setManyColumnVisibilityInstant}
        toggleColumnVisibilityInstant={toggleColumnVisibilityInstant}
        resetColumnOrderToDefault={resetColumnOrderToDefault}
        canImportCsv={canImportCsv}
        canCreateTask={canCreateTask}
        canExportCsv={canExportCsv}
        onOpenImport={() => setImportOpen(true)}
        onOpenExport={() => setExportDialogOpen(true)}
        onOpenNewTask={() => setNewTaskOpen(true)}
      />
      {/* ─── SelectionBar — fixed slide-up panel ───
          Önceden satır arası inline'dı; artık alt orta noktada sabit kart olarak çıkar.
          Mobil için MobileBottomNav (≈4rem) üzerinde, safe-area uyumlu.
          Çoklu eylem: sayım + Durumu güncelle + Sil + Kapat (X).
          animate-in slide-in-from-bottom-2 ile yumuşak giriş. */}
      <TasksTableSelectionBar
        selectedCount={selectedIds.length}
        selectedCanBulkUpdate={selectedCanBulkUpdate}
        selectedCanBulkDelete={selectedCanBulkDelete}
        bulkStatusOpen={bulkStatusOpen}
        setBulkStatusOpen={setBulkStatusOpen}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        assigneeOptions={bulkAssigneeOptions}
        onBulkStatusUpdate={handleBulkStatusUpdate}
        onBulkPriorityUpdate={handleBulkPriorityUpdate}
        onBulkAssign={handleBulkAssign}
        onBulkDeleteRequest={() => setBulkDeleteConfirmOpen(true)}
        onClearSelection={() => setRowSelection({})}
      />
      <TasksTableExportDialogs
        exportDialogOpen={exportDialogOpen}
        setExportDialogOpen={setExportDialogOpen}
        pdfDialogOpen={pdfDialogOpen}
        handlePdfDialogOpenChange={handlePdfDialogOpenChange}
        emailDialogOpen={emailDialogOpen}
        setEmailDialogOpen={setEmailDialogOpen}
        pdfDialogScope={pdfDialogScope}
        exportScopeLabel={exportScopeLabel}
        exportSensitivityLabel={exportSensitivityLabel}
        exportCurrentRows={exportCurrentRows}
        exportAllRows={exportAllRows}
        canExportSensitiveUnmasked={canExportSensitiveUnmasked}
        exportUnmaskSensitive={exportUnmaskSensitive}
        setExportUnmaskSensitive={setExportUnmaskSensitive}
        canExportAllRows={canExportAllRows}
        exportIncludeAutoRowNumber={exportIncludeAutoRowNumber}
        setExportIncludeAutoRowNumber={setExportIncludeAutoRowNumber}
        handleExportCSV={handleExportCSV}
        handleExportExcel={handleExportExcel}
        openPdfDialog={openPdfDialog}
        openEmailDialog={openEmailDialog}
        reportTemplateSelection={reportTemplateSelection}
        applyReportTemplate={applyReportTemplate}
        savedReportTemplates={savedReportTemplates}
        availableManagedReportTemplates={availableManagedReportTemplates}
        selectedReportTemplate={selectedReportTemplate}
        selectedManagedReportTemplate={selectedManagedReportTemplate}
        selectedCustomReportTemplate={selectedCustomReportTemplate}
        saveCurrentReportTemplate={saveCurrentReportTemplate}
        deleteSelectedReportTemplate={deleteSelectedReportTemplate}
        selectedPdfRows={selectedPdfRows}
        selectedPdfTitle={selectedPdfTitle}
        pdfTitleInput={pdfTitleInput}
        setPdfTitleInput={setPdfTitleInput}
        pdfPreviewUrl={pdfPreviewUrl}
        setPdfPreviewUrl={setPdfPreviewUrl}
        pdfPreviewIframeRef={pdfPreviewIframeRef}
        previewExportPDF={previewExportPDF}
        confirmExportPDF={confirmExportPDF}
        printPdfPreview={printPdfPreview}
        pdfPreviewLoading={pdfPreviewLoading}
        pdfDownloadLoading={pdfDownloadLoading}
        emailSubjectInput={emailSubjectInput}
        setEmailSubjectInput={setEmailSubjectInput}
        emailTemplateMode={emailTemplateMode}
        setEmailTemplateMode={setEmailTemplateMode}
        emailTemplate={emailTemplate}
        emailCopied={emailCopied}
        setEmailCopied={setEmailCopied}
        copyEmailTemplate={copyEmailTemplate}
        printEmailTemplate={printEmailTemplate}
      />
      <TasksTableBulkDeleteDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        selectedCount={selectedIds.length}
        onConfirm={executeBulkDelete}
      />
      <RemoveExtraColumnDialog
        columnKey={removeExtraColumnKey}
        onColumnKeyChange={setRemoveExtraColumnKey}
        removing={removingExtraColumn}
        impact={removeExtraColumnImpact}
        onConfirm={executeRemoveExtraColumn}
      />
      <RenameExtraColumnDialog
        draft={renameExtraColumnDraft}
        onDraftChange={setRenameExtraColumnDraft}
        renaming={renamingExtraColumn}
        impact={renameExtraColumnImpact}
        onConfirm={executeRenameExtraColumn}
      />
      <TasksTableDataPanel
        table={table}
        mobileListScrollRef={mobileListScrollRef}
        liveTableScrollRef={liveTableScrollRef}
        isFullWidth={isFullWidth}
        extraDataKeys={extraDataKeys}
        projectById={projectById}
        canEditRow={canEditRow}
        canDeleteTask={canDeleteTask}
        canCreateTask={canCreateTask}
        canCopyRow={canCopyRow}
        settings={settings}
        urgentPrioritySetForTable={urgentPrioritySetForTable}
        now={now}
        setEditTask={setEditTask}
        handleCopyTask={handleCopyTask}
        handleDeleteTask={handleDeleteTask}
        setDetailTask={setDetailTask}
        deletingIds={deletingIds}
        toast={toast}
        tableSkin={tableSkin}
        dui={dui}
        requiresSingleProjectSelection={requiresSingleProjectSelection}
        liveTableSumPx={liveTableSumPx}
        liveTableViewportWidth={liveTableViewportWidth}
        liveTableNeedsHorizontalScroll={liveTableNeedsHorizontalScroll}
        tasks={tasks}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        handleDragStart={handleDragStart}
        handleDragEnd={handleDragEnd}
        draggedColumnId={draggedColumnId}
        isModernTemplate={isModernTemplate}
        tableDensity={tableDensity}
        columnFilters={columnFilters}
        columnFilterOpen={columnFilterOpen}
        setColumnFilterOpen={setColumnFilterOpen}
        columnFilterSearch={columnFilterSearch}
        setColumnFilterSearch={setColumnFilterSearch}
        clearColumnFilter={clearColumnFilter}
        toggleColumnFilterValue={toggleColumnFilterValue}
        getUniqueValuesForColumn={getUniqueValuesForColumn}
        canEditProject={canEditProject}
        setRemoveExtraColumnKey={setRemoveExtraColumnKey}
        setRenameExtraColumnDraft={setRenameExtraColumnDraft}
        recentlyUpdatedIds={recentlyUpdatedIds}
        editorsByRowId={editorsByRowId}
        rowAutomationStateByTaskId={rowAutomationStateByTaskId}
        spotlightActive={spotlightActive}
        spotlightTaskIds={spotlightTaskIds}
        presenceHoverRowId={presenceHoverRowId}
        setPresenceHoverRowId={setPresenceHoverRowId}
        setEditingRow={setEditingRow}
        filteredData={filteredData}
        canBulkDelete={canBulkDelete}
        handleQuickAddRow={handleQuickAddRow}
        handleDeleteEmptyRows={handleDeleteEmptyRows}
        updateSetting={updateSetting}
        projectFilterOptions={projectFilterOptions}
        projectSelectionTitle={projectSelectionTitle}
        projectSelectionDescription={projectSelectionDescription}
        setProjectFilter={setProjectFilter}
        projectFilter={projectFilter}
        canImportCsv={canImportCsv}
        setNewTaskOpen={setNewTaskOpen}
        setImportOpen={setImportOpen}
        activeFilterCount={activeFilterCount}
        clearFilters={clearFilters}
        groupingField={grouping.groupingField}
        setGroupingField={grouping.setGroupingField}
        groupedItems={grouping.groupedItems}
        toggleGroup={grouping.toggleGroup}
        setAllExpanded={grouping.setAllExpanded}
        setAllCollapsed={grouping.setAllCollapsed}
        cfRules={conditionalFormatting.rules}
        cfEnabledCount={conditionalFormatting.enabledCount}
        cfGetRuleForTask={conditionalFormatting.getRuleForTask}
        cfToggleRule={conditionalFormatting.toggleRule}
        cfAddRule={conditionalFormatting.addRule}
        cfDeleteRule={conditionalFormatting.deleteRule}
        cfUpdateRule={conditionalFormatting.updateRule}
        cfResetToPresets={conditionalFormatting.resetToPresets}
        onColumnReorder={setColumnOrder}
      />
    </>
  );


  const topStrip = (
    <TasksTableTopStrip
      tasks={tasks}
      filteredData={filteredData}
      projects={projects}
      projectFilter={projectFilter}
      realtimeConnection={realtimeConnection}
      onlineUsers={onlineUsers}
      editorsByRowId={editorsByRowId}
      currentUserEmail={currentUserEmail}
      spotlightSummary={spotlightSummary}
      onJumpToSpotlightRows={jumpToSpotlightRows}
    />
  );

  if (isFullWidth && typeof document !== "undefined") {
    return createPortal(
      <>
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" aria-hidden />
        <div className="fixed inset-6 z-50 flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border-2 border-slate-300 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-800">
          {topStrip}
          {liveTableBody}
        </div>
      </>,
      document.body
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg border-0 bg-transparent shadow-none">
      {topStrip}
      {liveTableBody}
    </div>
  );
}
