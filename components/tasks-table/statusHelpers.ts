import type { Task } from "@/types/tasks";
import { STATUS_OPTIONS } from "@/components/tasks-table/constants";

export { STATUS_OPTIONS };

/**
 * Görsel status kind — overdue (otomatik) ve cancelled (kullanıcı) dahil.
 *
 * Kurumsal renk skalası:
 *   - todo     → slate (nötr)
 *   - in_progress → blue (aktif iş)
 *   - done     → emerald (başarı)
 *   - overdue  → red (uyarı, otomatik tespit edilir)
 *   - cancelled → slate + strikethrough (iptal edilmiş)
 *   - waiting   → slate (beklemede)
 *   - other     → slate (özel statüler için fallback)
 */
export type StatusVisualKind =
  | "todo"
  | "in_progress"
  | "done"
  | "overdue"
  | "cancelled"
  | "waiting"
  | "other";

const CANCELLED_TOKENS = /iptal|cancelled|canceled|geri çek|geri cek/i;
const WAITING_TOKENS = /beklemede|waiting|hold|pause/i;

/** Status değerinden temel kind (overdue HARİÇ; o due_date ile hesaplanır). */
export function getStatusVisualKindFromStatus(status: string | null | undefined): Exclude<StatusVisualKind, "overdue"> {
  const s = (status ?? "").trim().toLocaleLowerCase("tr");
  if (!s) return "todo";
  if (/tamamlandı|tamamlandi|yapıldı|yapildi|done|completed|bitti/i.test(s)) return "done";
  if (/devam|sürüyor|suruyor|progress/i.test(s)) return "in_progress";
  if (CANCELLED_TOKENS.test(s)) return "cancelled";
  if (WAITING_TOKENS.test(s)) return "waiting";
  if (/yapılacak|yapilacak|todo|to.do|open|açık|acik/i.test(s)) return "todo";
  return "other";
}

/**
 * Task'ın görsel kind'ı — overdue otomatik tespit edilir.
 * Overdue koşulu: due_date geçmiş AND done/cancelled değil.
 */
export function getTaskVisualKind(task: Pick<Task, "status" | "due_date">, now: Date = new Date()): StatusVisualKind {
  const baseKind = getStatusVisualKindFromStatus(task.status);
  if (baseKind === "done" || baseKind === "cancelled") return baseKind;
  if (task.due_date) {
    try {
      const due = new Date(task.due_date);
      due.setHours(23, 59, 59, 999); // gün sonu kadar grace
      if (due.getTime() < now.getTime()) return "overdue";
    } catch {
      /* parse hatası — overdue değil */
    }
  }
  return baseKind;
}

/** Görsel kind → badge stil sınıfları (kurumsal renk sistemi). */
export const STATUS_VISUAL_STYLES: Record<StatusVisualKind, string> = {
  todo: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  overdue: "border-red-200 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500 line-through decoration-slate-400 decoration-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500",
  waiting: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  other: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

/** Modern template versiyonu — biraz daha yumuşak shadow ve transparency. */
export const STATUS_VISUAL_STYLES_MODERN: Record<StatusVisualKind, string> = {
  todo: "border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300",
  in_progress: "border-blue-200/90 bg-blue-50/85 text-blue-700 shadow-[0_1px_2px_rgba(29,78,216,0.08)] dark:border-blue-700 dark:bg-blue-900/35 dark:text-blue-300",
  done: "border-emerald-200/90 bg-emerald-50/85 text-emerald-700 shadow-[0_1px_2px_rgba(6,95,70,0.08)] dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300",
  overdue: "border-red-200/90 bg-red-50/85 text-red-700 shadow-[0_1px_2px_rgba(185,28,28,0.10)] dark:border-red-700 dark:bg-red-900/35 dark:text-red-300",
  cancelled: "border-slate-200 bg-white/85 text-slate-500 line-through decoration-slate-400 decoration-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500",
  waiting: "border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300",
  other: "border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300",
};

/** Dot rengi (badge yanında küçük renkli daire). */
export const STATUS_VISUAL_DOT: Record<StatusVisualKind, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
  overdue: "bg-red-500",
  cancelled: "bg-slate-400",
  waiting: "bg-slate-400",
  other: "bg-slate-400",
};

/** Geri uyumluluk — eski kullanımlar için statik harita (label bazlı). */
export const STATUS_DOT_CLASS: Record<string, string> = {
  Tamamlandı: STATUS_VISUAL_DOT.done,
  Devam: STATUS_VISUAL_DOT.in_progress,
  "Devam ediyor": STATUS_VISUAL_DOT.in_progress,
  Yapılacak: STATUS_VISUAL_DOT.todo,
  Beklemede: STATUS_VISUAL_DOT.waiting,
  İptal: STATUS_VISUAL_DOT.cancelled,
  Gecikti: STATUS_VISUAL_DOT.overdue,
};

/** Geri uyumluluk — label bazlı eski API (yeni kullanımlar getTaskVisualKind kullansın). */
export const STATUS_BADGE_STYLES: Record<string, string> = {
  Yapılacak: STATUS_VISUAL_STYLES.todo,
  Beklemede: STATUS_VISUAL_STYLES.waiting,
  Devam: STATUS_VISUAL_STYLES.in_progress,
  "Devam ediyor": STATUS_VISUAL_STYLES.in_progress,
  Tamamlandı: STATUS_VISUAL_STYLES.done,
  İptal: STATUS_VISUAL_STYLES.cancelled,
  Gecikti: STATUS_VISUAL_STYLES.overdue,
};

export const STATUS_BADGE_STYLES_MODERN: Record<string, string> = {
  Yapılacak: STATUS_VISUAL_STYLES_MODERN.todo,
  Beklemede: STATUS_VISUAL_STYLES_MODERN.waiting,
  Devam: STATUS_VISUAL_STYLES_MODERN.in_progress,
  "Devam ediyor": STATUS_VISUAL_STYLES_MODERN.in_progress,
  Tamamlandı: STATUS_VISUAL_STYLES_MODERN.done,
  İptal: STATUS_VISUAL_STYLES_MODERN.cancelled,
  Gecikti: STATUS_VISUAL_STYLES_MODERN.overdue,
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
  if (CANCELLED_TOKENS.test(value)) return "İptal";
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
