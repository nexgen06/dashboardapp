import { parseDateFlexible } from "@/lib/parseDate";
import { isStatusDone } from "@/lib/statusKind";

type TaskShape = {
  due_date?: string | null;
  extra_data?: Record<string, string> | null;
  status?: string | null;
};

export type DueUrgency = "overdue" | "today" | "soon" | "upcoming" | "none";

const DATE_KEY_RE = /(bitiş|bitis|deadline|son\s*tarih|son\s*g[uü]n|due|tamamlanma|teslim)/i;

function findDueFromExtra(task: Pick<TaskShape, "extra_data">): string | null {
  if (!task.extra_data || typeof task.extra_data !== "object") return null;
  for (const [k, v] of Object.entries(task.extra_data)) {
    if (!DATE_KEY_RE.test(k)) continue;
    const raw = String(v ?? "").trim();
    if (!raw) continue;
    if (parseDateFlexible(raw)) return raw;
  }
  return null;
}

export function getTaskDueDate(
  task: Pick<TaskShape, "due_date" | "extra_data">
): Date | null {
  const raw = task.due_date ?? findDueFromExtra(task);
  if (!raw) return null;
  return parseDateFlexible(raw);
}

/**
 * Görevin bitiş tarihine göre aciliyet seviyesi.
 *  - overdue: tarih geçti, görev tamamlanmadı
 *  - today  : bugün son gün
 *  - soon   : 1-3 gün kaldı
 *  - upcoming: 4-7 gün kaldı
 *  - none   : 7+ gün, tarih yok ya da görev tamamlandı
 *
 * Tamamlanmış görevler hiçbir zaman uyarı durumuna girmez (gürültüyü azaltır).
 */
export function getDueUrgency(
  task: TaskShape,
  now: Date = new Date()
): DueUrgency {
  if (isStatusDone(task.status)) return "none";
  const due = getTaskDueDate(task);
  if (!due) return "none";

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const today0 = startOfDay(now).getTime();
  const due0 = startOfDay(due).getTime();
  const diffDays = Math.round((due0 - today0) / 86_400_000);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 3) return "soon";
  if (diffDays <= 7) return "upcoming";
  return "none";
}

/** Tailwind class'ları — satır/kart arkaplan + opsiyonel breathe animasyonu.
 * Not: "breathe-*" 4s yumuşak nefes alma efekti (eski "pulse-*" 2s keskin
 * efektten daha az dikkat dağıtıcı). Kullanıcı isterse pulse'a geri dönebiliriz. */
export const URGENCY_ROW_CLASS: Record<DueUrgency, string> = {
  overdue:
    "bg-red-50/70 hover:bg-red-50 dark:bg-red-950/30 dark:hover:bg-red-950/40 breathe-overdue",
  today:
    "bg-amber-50/70 hover:bg-amber-50 dark:bg-amber-950/30 dark:hover:bg-amber-950/40 breathe-today",
  soon: "bg-yellow-50/40 hover:bg-yellow-50/70 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/30",
  upcoming: "",
  none: "",
};

/** Satırın sol kenarındaki şerit — daha güçlü görsel sinyal. */
export const URGENCY_LEFT_BORDER_CLASS: Record<DueUrgency, string> = {
  overdue: "border-l-4 border-l-red-500 dark:border-l-red-400",
  today: "border-l-4 border-l-amber-500 dark:border-l-amber-400",
  soon: "border-l-4 border-l-yellow-400 dark:border-l-yellow-500",
  upcoming: "",
  none: "",
};

export const URGENCY_LABEL: Record<DueUrgency, string> = {
  overdue: "Gecikmiş",
  today: "Bugün son gün",
  soon: "Yaklaşıyor",
  upcoming: "Bu hafta",
  none: "",
};

export const URGENCY_BADGE_CLASS: Record<DueUrgency, string> = {
  overdue:
    "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-200 dark:border-red-800",
  today:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-200 dark:border-amber-800",
  soon:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800",
  upcoming:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  none: "",
};
