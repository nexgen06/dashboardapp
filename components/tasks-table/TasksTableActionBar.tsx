"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Table } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RestrictedButton } from "@/components/ui/permission-gate";
import { SavedViewsControl } from "@/components/SavedViewsControl";
import { ColumnPickerDialog } from "@/components/tasks-table/ColumnPickerDialog";
import type { SavedViewConfig } from "@/lib/savedViews";
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

  return (
      <div
        className={cn(
          "order-[-2] sticky z-20 flex shrink-0 flex-col gap-0 border-b border-slate-200 bg-white shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-950 supports-[backdrop-filter]:bg-white/90 dark:supports-[backdrop-filter]:bg-slate-950/90",
          "top-0"
        )}
      >
        {/* Eski "internal title row" — Sprint X3a TopStrip eklendiğinde duplikasyon
            oluşturuyordu. Tüm içerik (Canlı Tablo + realtime chip + TaskStats +
            Proje odaklı pill + OnlineUsersPanel) artık TopStrip'te. Burası kalmaz. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          {viewTabs && <div className="mr-auto shrink-0">{viewTabs}</div>}
          <span className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 lg:inline">
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
            <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 lg:inline">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-slate-700 dark:text-slate-300"
              onClick={resetColumnOrderToDefault}
              title="Sütun sırasını ve sabitlemeleri varsayılan düzene alır (görünürlük / genişlik değişmez)"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">Sütun sırasını varsayılana al</span>
            </Button>
            </>
          )}
          {(canImportCsv || canCreateTask) && (
            <>
              <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 lg:inline">
                Veri
              </span>
            </>
          )}
          {canImportCsv && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenImport}
              className="text-slate-700 dark:text-slate-300"
              title="CSV içe aktar"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">CSV içe aktar</span>
            </Button>
          )}
          {canExportCsv && (
            <>
              <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 lg:inline">
                Paylaşım
              </span>
            </>
          )}
          {canExportCsv && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-slate-700 dark:text-slate-300"
              onClick={onOpenExport}
            >
              <Download className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Dışa aktar
            </Button>
          </>
          )}
          <RestrictedButton
            permission="liveTable.createTask"
            type="button"
            size="sm"
            onClick={onOpenNewTask}
            aria-label="Yeni görev"
            className="bg-orange-500 text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 focus-visible:ring-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400 dark:focus-visible:ring-orange-400"
          >
            <PlusCircle className="h-4 w-4 shrink-0 sm:mr-2" aria-hidden />
            <span className="hidden sm:inline">Yeni görev</span>
          </RestrictedButton>
        </div>
      </div>
  );
}
