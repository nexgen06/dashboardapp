import type { ProjectStatus, ProjectPriority } from "@/types/project";

export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ["Aktif", "Tamamlandı", "Beklemede"];

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  Aktif: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  Tamamlandı: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
  Beklemede: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
};

export const PROJECT_PRIORITY_STYLES: Record<ProjectPriority, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};
