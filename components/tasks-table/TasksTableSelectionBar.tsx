"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Activity, Trash2, X } from "lucide-react";

export type TasksTableSelectionBarProps = {
  selectedCount: number;
  selectedCanBulkUpdate: boolean;
  selectedCanBulkDelete: boolean;
  bulkStatusOpen: boolean;
  setBulkStatusOpen: Dispatch<SetStateAction<boolean>>;
  statusOptions: string[];
  onBulkStatusUpdate: (status: string) => void;
  onBulkDeleteRequest: () => void;
  onClearSelection: () => void;
};

export function TasksTableSelectionBar({
  selectedCount,
  selectedCanBulkUpdate,
  selectedCanBulkDelete,
  bulkStatusOpen,
  setBulkStatusOpen,
  statusOptions,
  onBulkStatusUpdate,
  onBulkDeleteRequest,
  onClearSelection,
}: TasksTableSelectionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      role="region"
      aria-label="Toplu işlemler"
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)",
      }}
    >
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-black/30 md:bottom-4 sm:gap-3 sm:px-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-100">
          <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold tabular-nums text-white">
            {selectedCount}
          </span>
          <span className="hidden sm:inline">kayıt seçili</span>
          <span className="sm:hidden">seçili</span>
        </span>
        <span className="mx-1 hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
        {selectedCanBulkUpdate && (
          <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Durumu güncelle</span>
                <span className="sm:hidden">Durum</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" sideOffset={8}>
              {statusOptions.map((s) => (
                <DropdownMenuItem key={s} onClick={() => onBulkStatusUpdate(s)}>
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {selectedCanBulkDelete && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            onClick={onBulkDeleteRequest}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Seçilenleri sil</span>
            <span className="sm:hidden">Sil</span>
          </Button>
        )}
        <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onClick={onClearSelection}
          aria-label="Seçimi temizle"
          title="Seçimi temizle"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Temizle</span>
        </Button>
      </div>
    </div>
  );
}
