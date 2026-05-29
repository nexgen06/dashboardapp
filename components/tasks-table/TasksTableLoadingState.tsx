"use client";

import { Loader2 } from "lucide-react";

export function TasksTableLoadingState() {
  const skeletonRows = 5;
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 min-h-[280px]">
      <div className="flex flex-col items-center justify-center gap-4 py-12 px-4" aria-busy="true">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400 dark:text-slate-500" aria-hidden />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Veriler yükleniyor…</p>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="space-y-2">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-4 w-12 shrink-0 rounded bg-slate-200 dark:bg-slate-600 animate-pulse" />
              <div className="h-4 flex-1 max-w-[60%] rounded bg-slate-200 dark:bg-slate-600 animate-pulse" />
              <div className="h-4 w-24 shrink-0 rounded bg-slate-200 dark:bg-slate-600 animate-pulse" />
              <div className="h-4 w-20 shrink-0 rounded bg-slate-200 dark:bg-slate-600 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
