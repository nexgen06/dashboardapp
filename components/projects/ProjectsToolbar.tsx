"use client";

import { Search, PlusCircle, UserPlus, Archive, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RestrictedButton } from "@/components/ui/permission-gate";
import {
  PROJECT_STATUS_OPTIONS,
} from "@/components/projects/projectSectionStyles";
import { cn } from "@/lib/utils";

export type ProjectsToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  assignedToMeOnly: boolean;
  onAssignedToMeOnlyChange: (value: boolean) => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  currentUserEmail?: string;
  canCreateProject: boolean;
  onOpenTemplates: () => void;
  onNewProject: () => void;
};

export function ProjectsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  assignedToMeOnly,
  onAssignedToMeOnlyChange,
  showArchived,
  onShowArchivedChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  currentUserEmail,
  canCreateProject,
  onOpenTemplates,
  onNewProject,
}: ProjectsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="text"
          placeholder="Projede ara"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      >
        <option value="Tümü">Durum: Tümü</option>
        {PROJECT_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {currentUserEmail && (
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={assignedToMeOnly}
            onChange={(e) => onAssignedToMeOnlyChange(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <UserPlus className="h-4 w-4 text-slate-500" />
          Bana atananlar
        </label>
      )}
      <label
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
          showArchived
            ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200"
            : "border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        )}
        title="Arşivlenmiş projeleri de listele"
      >
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => onShowArchivedChange(e.target.checked)}
          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
        />
        <Archive className="h-4 w-4" />
        Arşivlenenleri göster
      </label>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        placeholder="Başlangıç"
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      />
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        placeholder="Bitiş"
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      />
      {canCreateProject && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenTemplates}
          className="shrink-0 gap-1.5"
          title="Şablondan yeni proje oluştur veya kayıtlı şablonları yönet"
        >
          <Bookmark className="h-4 w-4" />
          Şablonlar
        </Button>
      )}
      <RestrictedButton
        permission="projects.create"
        type="button"
        size="sm"
        onClick={onNewProject}
        className="bg-blue-600 hover:bg-blue-700 shrink-0"
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Yeni proje
      </RestrictedButton>
    </div>
  );
}
