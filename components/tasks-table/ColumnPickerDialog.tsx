"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Table } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COLUMN_VISIBILITY_LABELS, LIVE_TABLE_ACTION_BAR_BTN_CLASS } from "@/components/tasks-table/constants";
import { cn } from "@/lib/utils";
import { Check, Circle, Columns3, Search } from "lucide-react";

export type ColumnPickerDialogProps = {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
  onOpen: () => void;
  table: Table<Task>;
  columnPickerSearch: string;
  setColumnPickerSearch: Dispatch<SetStateAction<string>>;
  setManyColumnVisibilityInstant: (ids: string[], visible: boolean) => void;
  toggleColumnVisibilityInstant: (id: string, visible: boolean) => void;
};

export function ColumnPickerDialog({
  open,
  onOpenChange,
  onOpen,
  table,
  columnPickerSearch,
  setColumnPickerSearch,
  setManyColumnVisibilityInstant,
  toggleColumnVisibilityInstant,
}: ColumnPickerDialogProps) {
  return (
            <Dialog open={open} onOpenChange={onOpenChange}>
              <button type="button" className={LIVE_TABLE_ACTION_BAR_BTN_CLASS} onClick={onOpen}>
                <Columns3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Kolonlar
              </button>
              <DialogContent
                className="flex max-h-[min(90dvh,36rem)] max-w-md flex-col gap-0 overflow-hidden rounded-xl border-slate-200/80 p-0 shadow-2xl shadow-slate-900/10 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-100 dark:shadow-black/30 sm:max-w-md"
                showClose
              >
                <div className="shrink-0 space-y-3 border-b border-slate-200/80 bg-slate-50/40 px-5 pb-3 pt-5 dark:border-slate-700/80 dark:bg-slate-900/30">
                  <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 ring-1 ring-blue-600/20 dark:bg-blue-500/15 dark:ring-blue-500/30">
                        <Columns3 className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" aria-hidden />
                      </span>
                      Sütun görünürlüğü
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
                      Bir rozete tıkla; sütun anında gösterilir veya gizlenir. Dolu = görünür, soluk = gizli.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const ids = table
                          .getAllLeafColumns()
                          .filter((c) => c.getCanHide())
                          .map((c) => c.id);
                        setManyColumnVisibilityInstant(ids, true);
                      }}
                    >
                      Tümünü göster
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const ids = table
                          .getAllLeafColumns()
                          .filter((c) => c.getCanHide())
                          .map((c) => c.id);
                        setManyColumnVisibilityInstant(ids, false);
                      }}
                    >
                      Hepsini gizle
                    </Button>
                    <div className="relative ml-auto flex-1 min-w-[140px]">
                      <Search
                        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                        aria-hidden
                      />
                      <input
                        type="search"
                        autoComplete="off"
                        placeholder="Sütun ara…"
                        value={columnPickerSearch}
                        onChange={(e) => setColumnPickerSearch(e.target.value)}
                        className="h-7 w-full rounded-md border border-slate-200 bg-white py-1 pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  {(() => {
                    const q = columnPickerSearch.trim().toLowerCase();
                    const allCols = table.getAllLeafColumns();
                    const matches = allCols.filter((col) => {
                      const label =
                        COLUMN_VISIBILITY_LABELS[col.id] ??
                        (String(col.id).startsWith("extra:")
                          ? String(col.id).replace(/^extra:/, "")
                          : col.id);
                      return q === "" || label.toLowerCase().includes(q);
                    });
                    const baseCols = matches.filter((c) => !c.id.startsWith("extra:"));
                    const extraCols = matches.filter((c) => c.id.startsWith("extra:"));

                    const renderChip = (col: (typeof matches)[number]) => {
                      const label =
                        COLUMN_VISIBILITY_LABELS[col.id] ??
                        (String(col.id).startsWith("extra:")
                          ? String(col.id).replace(/^extra:/, "")
                          : col.id);
                      const canHide = col.getCanHide();
                      const visible = col.getIsVisible();
                      return (
                        <button
                          key={col.id}
                          type="button"
                          disabled={!canHide}
                          onClick={() => {
                            if (!canHide) return;
                            toggleColumnVisibilityInstant(col.id, !visible);
                          }}
                          aria-pressed={visible}
                          title={
                            !canHide
                              ? "Bu sütun zorunlu — gizlenemez"
                              : visible
                                ? "Tıkla: gizle"
                                : "Tıkla: göster"
                          }
                          className={cn(
                            "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                            visible
                              ? "border-blue-300 bg-blue-100 text-blue-800 shadow-sm hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200",
                            !canHide && "cursor-not-allowed opacity-70 hover:bg-white dark:hover:bg-slate-800"
                          )}
                        >
                          {visible ? (
                            <Check className="h-3 w-3 shrink-0" aria-hidden />
                          ) : (
                            <Circle className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                          )}
                          <span className="truncate max-w-[160px]">{label}</span>
                          {!canHide && (
                            <span className="ml-0.5 rounded-sm bg-slate-200 px-1 text-[9px] uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              zorunlu
                            </span>
                          )}
                        </button>
                      );
                    };

                    if (matches.length === 0) {
                      return (
                        <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                          “{columnPickerSearch}” için sütun bulunamadı
                        </div>
                      );
                    }

                    return (
                      <>
                        {baseCols.length > 0 && (
                          <section>
                            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Sabit sütunlar ({baseCols.filter((c) => c.getIsVisible()).length}/{baseCols.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">{baseCols.map(renderChip)}</div>
                          </section>
                        )}
                        {extraCols.length > 0 && (
                          <section>
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Ek sütunlar ({extraCols.filter((c) => c.getIsVisible()).length}/{extraCols.length})
                              </h4>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="text-[10px] font-medium uppercase tracking-wide text-blue-600 hover:underline dark:text-blue-400"
                                  onClick={() =>
                                    setManyColumnVisibilityInstant(
                                      extraCols.map((c) => c.id),
                                      true
                                    )
                                  }
                                >
                                  Tümü
                                </button>
                                <span className="text-[10px] text-slate-400">·</span>
                                <button
                                  type="button"
                                  className="text-[10px] font-medium uppercase tracking-wide text-slate-500 hover:underline dark:text-slate-400"
                                  onClick={() =>
                                    setManyColumnVisibilityInstant(
                                      extraCols.map((c) => c.id),
                                      false
                                    )
                                  }
                                >
                                  Hiçbiri
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">{extraCols.map(renderChip)}</div>
                          </section>
                        )}
                      </>
                    );
                  })()}
                </div>
                <DialogFooter className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex w-full items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {table.getAllLeafColumns().filter((c) => c.getIsVisible()).length} /{" "}
                      {table.getAllLeafColumns().length} sütun görünür
                    </span>
                    <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
                      Kapat
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
  );
}
