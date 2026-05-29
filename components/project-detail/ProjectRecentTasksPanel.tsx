"use client";

import Link from "next/link";
import { ArrowRight, ListTodo, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";

const STATUS_STYLES: Record<string, string> = {
  Yapılacak: "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300",
  "Devam ediyor": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Tamamlandı: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export type ProjectRecentTasksPanelProps = {
  projectId: string;
  tasks: Task[];
  totalCount: number;
  loading?: boolean;
  limit?: number;
  title?: string;
  showViewAll?: boolean;
  getTaskDisplay: (task: Task) => { label: string; subtitle: string };
  formatAssignee: (assignee: string | null | undefined) => string;
  isOverdue?: (task: Task) => boolean;
  className?: string;
  compact?: boolean;
};

export function ProjectRecentTasksPanel({
  projectId,
  tasks,
  totalCount,
  loading = false,
  limit,
  title = "Son güncellenen görevler",
  showViewAll = true,
  getTaskDisplay,
  formatAssignee,
  isOverdue,
  className,
  compact = false,
}: ProjectRecentTasksPanelProps) {
  const visibleTasks = limit ? tasks.slice(0, limit) : tasks;
  const liveTableHref = `/canli-tablo?project=${encodeURIComponent(projectId)}`;

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/40",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        {visibleTasks.length > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {visibleTasks.length}/{totalCount}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Yükleniyor…
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
          <ListTodo className="h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Henüz görev yok.</p>
          <Button asChild size="sm" className="mt-3 bg-orange-600 hover:bg-orange-700 text-white">
            <Link href={liveTableHref}>Görev ekle</Link>
          </Button>
        </div>
      ) : (
        <ul
          className={cn(
            "min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain dark:divide-slate-700",
            compact ? "max-h-[22rem]" : ""
          )}
        >
          {visibleTasks.map((task) => {
            const { label, subtitle } = getTaskDisplay(task);
            const overdueFlag = isOverdue?.(task);
            return (
              <li key={task.id} className="px-3 py-2.5">
                <Link
                  href={`${liveTableHref}&task=${encodeURIComponent(task.id)}`}
                  className="group block min-w-0 rounded-md px-1 py-0.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  title={subtitle ? `${label} — ${subtitle}` : label}
                >
                  <p className="truncate text-sm font-medium text-slate-800 group-hover:text-orange-700 dark:text-slate-100">
                    {label}
                  </p>
                  {subtitle && (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] font-normal", STATUS_STYLES[task.status] ?? "")}
                    >
                      {task.status}
                    </Badge>
                    {overdueFlag && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium border-red-200 bg-red-50 text-red-700"
                      >
                        Gecikmiş
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-400">{formatAssignee(task.assignee)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {showViewAll && visibleTasks.length > 0 && (
        <div className="shrink-0 border-t border-slate-100 p-2 dark:border-slate-700">
          <Button variant="ghost" size="sm" asChild className="h-8 w-full text-xs text-slate-600">
            <Link href={liveTableHref}>
              Tümünü gör
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </aside>
  );
}
