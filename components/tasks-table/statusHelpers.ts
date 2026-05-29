import type { Task } from "@/types/tasks";
import { STATUS_OPTIONS } from "@/components/tasks-table/constants";

export { STATUS_OPTIONS };

export const STATUS_DOT_CLASS: Record<string, string> = {
  Tamamlandı: "bg-emerald-500",
  Devam: "bg-amber-500",
  "Devam ediyor": "bg-amber-500",
  Yapılacak: "bg-slate-400",
  Beklemede: "bg-slate-400",
};

export const STATUS_BADGE_STYLES: Record<string, string> = {
  Yapılacak:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Beklemede:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Devam:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Devam ediyor":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Tamamlandı:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export const STATUS_BADGE_STYLES_MODERN: Record<string, string> = {
  Yapılacak:
    "border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300",
  Beklemede:
    "border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300",
  Devam:
    "border-amber-200/90 bg-amber-50/85 text-amber-700 shadow-[0_1px_2px_rgba(146,64,14,0.08)] dark:border-amber-700 dark:bg-amber-900/35 dark:text-amber-300",
  "Devam ediyor":
    "border-amber-200/90 bg-amber-50/85 text-amber-700 shadow-[0_1px_2px_rgba(146,64,14,0.08)] dark:border-amber-700 dark:bg-amber-900/35 dark:text-amber-300",
  Tamamlandı:
    "border-emerald-200/90 bg-emerald-50/85 text-emerald-700 shadow-[0_1px_2px_rgba(6,95,70,0.08)] dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300",
};

export const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

export function getStatusDisplay(value: string): string {
  if (/tamamlandı|tamamlandi|done|completed/i.test(value)) return "Tamamlandı";
  if (/devam|sürüyor|progress/i.test(value)) return "Devam ediyor";
  if (/beklemede|waiting/i.test(value)) return "Beklemede";
  if (/yapılacak|yapilacak|todo/i.test(value)) return "Yapılacak";
  return value || "Yapılacak";
}

export function isTaskCompleted(task: Task): boolean {
  const s = (task.status ?? "").trim();
  return (
    /tamamlandı|tamamlandi|done|completed/i.test(s) ||
    /^tamam$/i.test(s) ||
    /^bitti$/i.test(s)
  );
}

export function rawStatusIsCompleted(status: string): boolean {
  const s = (status ?? "").trim();
  return (
    /tamamlandı|tamamlandi|done|completed/i.test(s) ||
    /^tamam$/i.test(s) ||
    /^bitti$/i.test(s)
  );
}

export function resolveRestoreStatus(statusOptions: string[], defaultTaskStatus: string): string {
  const d = (defaultTaskStatus ?? "").trim();
  if (d && statusOptions.includes(d)) return d;
  const todo = statusOptions.find((s) => /yapılacak|yapilacak|todo/i.test(s));
  if (todo) return todo;
  const nonDone = statusOptions.find((s) => !rawStatusIsCompleted(s));
  return nonDone ?? statusOptions[0] ?? "Yapılacak";
}
