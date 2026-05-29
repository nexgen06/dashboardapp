"use client";

import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DateFilterKind } from "@/lib/projectDetailPageHelpers";

export type ProjectTasksFilterBarProps = {
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  dateFilter: DateFilterKind;
  onDateFilterChange: (value: DateFilterKind) => void;
  assigneeOptions: string[];
  statusOptions: string[];
  formatAssignee: (assignee: string) => string;
  filteredCount: number;
  totalCount: number;
  className?: string;
};

const DATE_FILTER_OPTIONS: Array<{ value: DateFilterKind; label: string }> = [
  { value: "all", label: "Tüm tarihler" },
  { value: "overdue", label: "Gecikmiş" },
  { value: "week", label: "Bu hafta" },
  { value: "month", label: "Bu ay" },
];

export function ProjectTasksFilterBar({
  assigneeFilter,
  onAssigneeFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  assigneeOptions,
  statusOptions,
  formatAssignee,
  filteredCount,
  totalCount,
  className,
}: ProjectTasksFilterBarProps) {
  const hasActiveFilters =
    assigneeFilter !== "all" || statusFilter !== "all" || dateFilter !== "all";

  const clearFilters = () => {
    onAssigneeFilterChange("all");
    onStatusFilterChange("all");
    onDateFilterChange("all");
  };

  return (
    <div
      className={cn(
        "mb-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/30 sm:flex-row sm:flex-wrap sm:items-end",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[10rem] sm:max-w-[14rem]">
        <label htmlFor="project-tasks-filter-assignee" className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Atanan
        </label>
        <select
          id="project-tasks-filter-assignee"
          value={assigneeFilter}
          onChange={(e) => onAssigneeFilterChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="all">Tümü</option>
          <option value="__unassigned__">Atanmamış</option>
          {assigneeOptions.map((email) => (
            <option key={email} value={email}>
              {formatAssignee(email)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[10rem] sm:max-w-[14rem]">
        <label htmlFor="project-tasks-filter-status" className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Durum
        </label>
        <select
          id="project-tasks-filter-status"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="all">Tümü</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[10rem] sm:max-w-[14rem]">
        <label htmlFor="project-tasks-filter-date" className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Son tarih
        </label>
        <select
          id="project-tasks-filter-date"
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value as DateFilterKind)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {DATE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          {hasActiveFilters ? (
            <>
              <span className="font-medium text-slate-700 dark:text-slate-200">{filteredCount}</span>
              <span>/ {totalCount} görev</span>
            </>
          ) : (
            <span>{totalCount} görev</span>
          )}
        </span>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-xs">
            <X className="h-3.5 w-3.5" />
            Temizle
          </Button>
        )}
      </div>
    </div>
  );
}
