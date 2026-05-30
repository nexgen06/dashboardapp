import type { ColumnOrderState, VisibilityState } from "@tanstack/react-table";
import type { LiveTableDensity, LiveTableTemplate } from "@/contexts/settings-context";
import type { ChipCatalog } from "@/lib/chipSystem";
import type { ReportTemplateId } from "@/lib/liveTableExport";

export const STATUS_OPTIONS = ["Yapılacak", "Devam", "Tamamlandı"] as const;
export const STATUS_FILTER_OPTIONS = ["Tümü", "Yapılacak", "Devam ediyor", "Devam", "Tamamlandı"] as const;
/**
 * Sayfa boyutu opsiyonları — ≥100 değerler için Canlı Tablo otomatik olarak
 * row virtualization moduna geçer (yalnız görünür satırlar render edilir).
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250, 500] as const;

/** Bu satır sayısına ulaşılınca tbody virtualize edilir. */
export const VIRTUALIZE_THRESHOLD = 80;

/** Density'e göre satır yükseklik tahmini (px) — virtualizer estimateSize için. */
export const ROW_HEIGHT_BY_DENSITY: Record<LiveTableDensity, number> = {
  compact: 36,
  normal: 44,
  comfortable: 56,
};
export const REFERENCE_WARNINGS_KEY = "__reference_warnings";
export const INTERNAL_EXTRA_DATA_KEYS = new Set([REFERENCE_WARNINGS_KEY]);
export const EMPTY_CHIP_CATALOG: ChipCatalog = { templates: [], options: [], bindings: [] };

export type ReportTemplateSelection = `builtin:${ReportTemplateId}` | `custom:${string}` | `managed:${string}`;

export function builtinReportTemplateSelection(id: ReportTemplateId): ReportTemplateSelection {
  return `builtin:${id}`;
}

export function customReportTemplateSelection(id: string): ReportTemplateSelection {
  return `custom:${id}`;
}

export function managedReportTemplateSelection(id: string): ReportTemplateSelection {
  return `managed:${id}`;
}

/** Kolon id -> export/visibility etiketi (veri sütunları) */
export const COLUMN_LABELS: Record<string, string> = {
  content: "Açıklama",
  status: "Durum",
  workflow: "Onay",
  assignee: "Atanan",
  priority: "Öncelik",
  project: "Proje",
  updated: "Son güncelleme",
};

/** Kolon id -> görünürlük menüsünde gösterilecek etiket (tüm sütunlar) */
export const COLUMN_VISIBILITY_LABELS: Record<string, string> = {
  select: "Seçim",
  status: "Durum",
  workflow: "Onay",
  content: "Açıklama",
  project: "Proje",
  actions: "İşlemler",
};

export const CANLI_TABLO_COLUMN_ORDER: ColumnOrderState = [
  "select",
  "status",
  "assignee",
  "priority",
  "updated",
  "project",
  "detay",
  "actions",
  "presence",
];

/** Sabit sütun sırası (dinamik sütun yokken) */
export const BASE_COLUMN_ORDER_STABLE: ColumnOrderState = [
  "select",
  "status",
  "workflow",
  "content",
  "project",
  "actions",
];

export const DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY: VisibilityState = {};

export const LIVE_TABLE_DENSITY_UI: Record<
  LiveTableDensity,
  {
    table: string;
    th: string;
    td: string;
    grip: string;
    colFilterBtn: string;
    colMenuBtn: string;
    sortIcon: string;
    rowCheckbox: string;
    actionsBtn: string;
    selectHeaderSpan: string;
  }
> = {
  compact: {
    table: "text-xs",
    th: "px-2 py-1.5",
    td: "px-2 py-1",
    grip: "h-3.5 w-3.5",
    colFilterBtn: "h-6 w-6",
    colMenuBtn: "h-6 w-6",
    sortIcon: "h-3.5 w-3.5",
    rowCheckbox: "h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500",
    actionsBtn: "h-6 w-6",
    selectHeaderSpan: "text-xs",
  },
  normal: {
    table: "text-sm",
    th: "px-3 py-2.5",
    td: "px-3 py-1.5",
    grip: "h-4 w-4",
    colFilterBtn: "h-7 w-7",
    colMenuBtn: "h-7 w-7",
    sortIcon: "h-4 w-4",
    rowCheckbox: "h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500",
    actionsBtn: "h-7 w-7",
    selectHeaderSpan: "text-xs",
  },
  comfortable: {
    table: "text-base",
    th: "px-4 py-3.5",
    td: "px-4 py-2.5",
    grip: "h-5 w-5",
    colFilterBtn: "h-8 w-8",
    colMenuBtn: "h-8 w-8",
    sortIcon: "h-5 w-5",
    rowCheckbox: "h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500",
    actionsBtn: "h-9 w-9",
    selectHeaderSpan: "text-sm",
  },
};

export const LIVE_TABLE_TEMPLATE_UI: Record<
  LiveTableTemplate,
  {
    shell: string;
    table: string;
    headCell: string;
    row: string;
    bodyCell: string;
    pinnedCell: string;
  }
> = {
  classic: {
    shell:
      "rounded-lg border border-slate-200 bg-slate-50/80 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/40 dark:shadow-[0_18px_42px_-32px_rgba(0,0,0,0.8)]",
    table: "bg-white dark:bg-slate-900",
    headCell:
      "border-b border-slate-200/90 font-medium uppercase tracking-wider text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400",
    row: "border-b border-slate-100 dark:border-slate-800",
    bodyCell: "border-b border-slate-100 dark:border-slate-800",
    pinnedCell: "bg-white dark:bg-slate-900",
  },
  modern: {
    shell:
      "live-table-modern-shell rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_44px_-30px_rgba(16,24,40,0.38)] dark:border-slate-700/80 dark:bg-slate-900/80 dark:shadow-[0_24px_52px_-30px_rgba(0,0,0,0.82)]",
    table: "live-table-modern table-modern-skin bg-white dark:bg-slate-900",
    headCell:
      "border-b border-slate-200 font-medium uppercase tracking-wider text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400",
    row: "border-b border-slate-100/90 dark:border-slate-800/90",
    bodyCell: "border-b border-slate-100/90 dark:border-slate-800/90",
    pinnedCell: "bg-white dark:bg-slate-900",
  },
};

/** Sticky thead — scroll'da buzlu cam + net alt çizgi (Faz 2). */
export const LIVE_TABLE_THEAD_CELL_CLASS =
  "sticky top-0 z-[15] select-none bg-slate-50/95 backdrop-blur-md dark:bg-slate-900/95 supports-[backdrop-filter]:bg-slate-50/90 dark:supports-[backdrop-filter]:bg-slate-900/90";

/** Tablo gövdesi scroll kabuğu — scrollbar-themed ile birlikte kullanılır. */
export const LIVE_TABLE_SCROLL_SHELL_CLASS = "live-table-scroll-shell scrollbar-themed";

/** Grup başlığı sticky offset (thead yüksekliği, px). */
export const LIVE_TABLE_THEAD_HEIGHT_BY_DENSITY: Record<LiveTableDensity, number> = {
  compact: 36,
  normal: 44,
  comfortable: 52,
};

/** Sıralama yokken sort ikonu — sütun hover'ında görünür. */
export const LIVE_TABLE_SORT_IDLE_ICON_CLASS =
  "shrink-0 text-slate-300 opacity-0 transition-opacity duration-150 group-hover/th:opacity-100 focus-visible:opacity-100 dark:text-slate-600";

/** Sol/sağ pin gölgesi */
export const LIVE_TABLE_PIN_SHADOW_LEFT =
  "shadow-[4px_0_10px_-5px_rgba(15,23,42,0.18)] dark:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.75)]";
export const LIVE_TABLE_PIN_SHADOW_RIGHT =
  "shadow-[-4px_0_10px_-5px_rgba(15,23,42,0.18)] dark:shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.75)]";

export const MODERN_DENSITY_UI: Record<LiveTableDensity, { th: string; td: string }> = {
  compact: { th: "px-3 py-2", td: "px-3 py-1.5" },
  normal: { th: "px-4 py-3", td: "px-4 py-2.5" },
  comfortable: { th: "px-5 py-4", td: "px-5 py-3" },
};

export const COLUMN_SIZE_BOUNDS: Record<string, { min: number; max: number }> = {
  select: { min: 36, max: 52 },
  status: { min: 100, max: 220 },
  content: { min: 180, max: 480 },
  project: { min: 120, max: 280 },
  actions: { min: 44, max: 80 },
};

export const DEFAULT_EXTRA_BOUNDS = { min: 100, max: 400 };

/** Canlı tablo seçim sütunu varsayılan genişliği (px). */
export const LIVE_TABLE_SELECT_COLUMN_WIDTH = 44;
