"use client";

import { isStatusDone, isStatusInProgress } from "@/lib/statusKind";
import type { Task } from "@/types/tasks";

export function TaskStats({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  const tamamlandi = tasks.filter((t) => isStatusDone(t.status)).length;
  const devamEden = tasks.filter((t) => isStatusInProgress(t.status)).length;
  const diger = total - tamamlandi - devamEden;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
      <span className="font-semibold text-slate-700 dark:text-slate-200">{total} görev</span>
      <span className="text-slate-300 dark:text-slate-600">·</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        <span>{tamamlandi} tamamlandı</span>
      </span>
      <span className="text-slate-300 dark:text-slate-600">·</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
        <span>{devamEden} devam ediyor</span>
      </span>
      {diger > 0 && (
        <>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>{diger} diğer</span>
        </>
      )}
    </div>
  );
}
