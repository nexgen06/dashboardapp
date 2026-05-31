"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Table } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";
import { usePermissionGate } from "@/components/ui/permission-gate";
import { SavedViewsControl } from "@/components/SavedViewsControl";
import { ColumnPickerDialog } from "@/components/tasks-table/ColumnPickerDialog";
import type { SavedViewConfig } from "@/lib/savedViews";
import {
  LIVE_TABLE_ACTION_BAR_PRIMARY_BTN_CLASS,
  LIVE_TABLE_TOOLBAR_ICON_BTN_CLASS,
} from "@/components/tasks-table/constants";
import { Download, PlusCircle, RotateCcw, Upload } from "lucide-react";

export type TasksTableActionBarProps = {
  viewTabs?: ReactNode;
  getCurrentViewConfig: () => SavedViewConfig;
  onApplyViewConfig: (config: SavedViewConfig) => void;
  isAdmin: boolean;
  userId: string | null;
  projectFilter: string[];
  syncActiveViewId: string | null;
  canManageColumns: boolean;
  columnPickerOpen: boolean;
  setColumnPickerOpen: Dispatch<SetStateAction<boolean>>;
  openColumnPicker: () => void;
  table: Table<Task>;
  columnPickerSearch: string;
  setColumnPickerSearch: Dispatch<SetStateAction<string>>;
  setManyColumnVisibilityInstant: (ids: string[], visible: boolean) => void;
  toggleColumnVisibilityInstant: (id: string, visible: boolean) => void;
  resetColumnOrderToDefault: () => void;
  canImportCsv: boolean;
  canCreateTask: boolean;
  canExportCsv: boolean;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenNewTask: () => void;
};

export function TasksTableActionBar(props: TasksTableActionBarProps) {
  const {
    viewTabs,
    getCurrentViewConfig,
    onApplyViewConfig,
    isAdmin,
    userId,
    projectFilter,
    syncActiveViewId,
    canManageColumns,
    columnPickerOpen,
    setColumnPickerOpen,
    openColumnPicker,
    table,
    columnPickerSearch,
    setColumnPickerSearch,
    setManyColumnVisibilityInstant,
    toggleColumnVisibilityInstant,
    resetColumnOrderToDefault,
    canImportCsv,
    canCreateTask,
    canExportCsv,
    onOpenImport,
    onOpenExport,
    onOpenNewTask,
  } = props;

  const { gateProps: createTaskGateProps } = usePermissionGate("liveTable.createTask");

  return (
    <div
      className={cn(
        "order-[-2] sticky z-20 flex shrink-0 flex-col gap-0 border-b border-slate-200 bg-white shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-950 supports-[backdrop-filter]:bg-white/90 dark:supports-[backdrop-filter]:bg-slate-950/90",
        "top-0"
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
        {viewTabs && <div className="mr-auto shrink-0">{viewTabs}</div>}
        <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 lg:inline">
          Görünümler
        </span>
        <SavedViewsControl
          getCurrentConfig={getCurrentViewConfig}
          onApplyConfig={onApplyViewConfig}
          isAdmin={isAdmin}
          userId={userId}
          projectId={projectFilter.length === 1 ? projectFilter[0] : null}
          syncActiveViewId={syncActiveViewId}
        />
        {canManageColumns && (
          <>
            <span className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 lg:inline">
              Kolonlar
            </span>
            <ColumnPickerDialog
              open={columnPickerOpen}
              onOpenChange={setColumnPickerOpen}
              onOpen={openColumnPicker}
              table={table}
              columnPickerSearch={columnPickerSearch}
              setColumnPickerSearch={setColumnPickerSearch}
              setManyColumnVisibilityInstant={setManyColumnVisibilityInstant}
              toggleColumnVisibilityInstant={toggleColumnVisibilityInstant}
            />
            <button
              type="button"
              className={LIVE_TABLE_TOOLBAR_ICON_BTN_CLASS}
              onClick={resetColumnOrderToDefault}
              title="Sütun sırasını varsayılan düzene alır (görünürlük / genişlik değişmez)"
              aria-label="Sütun sırasını varsayılana al"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          </>
        )}
        {(canImportCsv || canCreateTask) && (
          <>
            <span className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 lg:inline">
              Veri
            </span>
          </>
        )}
        {canImportCsv && (
          <button
            type="button"
            className={LIVE_TABLE_TOOLBAR_ICON_BTN_CLASS}
            onClick={onOpenImport}
            title="CSV içe aktar"
            aria-label="CSV içe aktar"
          >
            <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </button>
        )}
        {canExportCsv && (
          <>
            <span className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 lg:inline">
              Paylaşım
            </span>
          </>
        )}
        {canExportCsv && (
          <button
            type="button"
            className={LIVE_TABLE_TOOLBAR_ICON_BTN_CLASS}
            onClick={onOpenExport}
            title="Dışa aktar"
            aria-label="Dışa aktar"
          >
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </button>
        )}
        <button
          type="button"
          className={LIVE_TABLE_ACTION_BAR_PRIMARY_BTN_CLASS}
          onClick={(e) => {
            if (createTaskGateProps.disabled) {
              e.preventDefault();
              return;
            }
            onOpenNewTask();
          }}
          disabled={createTaskGateProps.disabled}
          title={createTaskGateProps.title}
          aria-disabled={createTaskGateProps["aria-disabled"]}
          aria-label="Yeni görev"
        >
          <PlusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Yeni görev</span>
        </button>
      </div>
    </div>
  );
}
