"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useRef, useState, useCallback, useEffect, useMemo, useLayoutEffect, useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { usePresence } from "@/hooks/usePresence";
import { useSettings, getStatusOptions, getPriorityOptions, type DateFormat, type LiveTableDensity } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OnlineUsersPanel } from "@/components/OnlineUsersPanel";
import { presenceEditorLines } from "@/lib/userDisplayName";
import { formatDate } from "@/lib/formatDate";
import { getRelativeTime } from "@/lib/relativeTime";
import { parseCSV } from "@/lib/csvParser";
import { parseJSON } from "@/lib/jsonParser";
import { isSensitiveExtraColumnKey, maskSensitiveExtraValue } from "@/lib/extraColumnSensitiveDisplay";
import { isStatusDone, isStatusInProgress, getStatusKind } from "@/lib/statusKind";
import {
  getDueUrgency,
  URGENCY_ROW_CLASS,
  URGENCY_LEFT_BORDER_CLASS,
  URGENCY_LABEL,
  URGENCY_BADGE_CLASS,
} from "@/lib/dueUrgency";
import {
  loadLiveTablePrefs,
  mergeColumnOrderWithDynamics,
  saveLiveTablePrefs,
  type LiveTablePersistedPrefs,
} from "@/lib/liveTableColumnPersistence";
import {
  ADVANCED_FILTER_OP_OPTIONS,
  advancedFilterRuleIsActive,
  generateAdvancedFilterRuleId,
  taskMatchesAdvancedRule,
  type AdvancedFilterRule,
} from "@/lib/liveTableAdvancedFilters";
import * as XLSX from "xlsx";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { RestrictedButton } from "@/components/ui/permission-gate";
import { TaskCardMobile } from "@/components/TaskCardMobile";
import { TaskDetailSheet } from "@/components/TaskDetailSheet";
import { SavedViewsControl } from "@/components/SavedViewsControl";
import type { SavedViewConfig } from "@/lib/savedViews";
import { urgentPrioritySetFromCsv, isUrgentPriorityValue } from "@/lib/urgentTaskPriority";
import { Plus, PlusCircle, MoreVertical, MoreHorizontal, Trash2, Download, Columns3, Upload, GripVertical, Maximize2, Minimize2, Search, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, User, Loader2, ListTodo, RotateCw, RotateCcw, Filter, Shrink, AlertTriangle, Calendar, Flame, UserCheck, UserX, ChevronDown, Circle, CheckCircle2, SlidersHorizontal, ExternalLink, ClipboardList, FileUp, Rows3, Copy, Check, ListFilter, FolderKanban } from "lucide-react";

const STATUS_OPTIONS = ["Yapılacak", "Devam", "Tamamlandı"] as const;
const STATUS_FILTER_OPTIONS = ["Tümü", "Yapılacak", "Devam ediyor", "Devam", "Tamamlandı"] as const;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

/** Kolon id -> export/visibility etiketi (veri sütunları) */
const COLUMN_LABELS: Record<string, string> = {
  content: "Açıklama",
  status: "Durum",
  assignee: "Atanan",
  priority: "Öncelik",
  project: "Proje",
  updated: "Son güncelleme",
};

/** Kolon id -> görünürlük menüsünde gösterilecek etiket (tüm sütunlar) */
const COLUMN_VISIBILITY_LABELS: Record<string, string> = {
  select: "Seçim",
  status: "Durum",
  content: "Açıklama",
  project: "Proje",
  actions: "İşlemler",
};

const CANLI_TABLO_COLUMN_ORDER: ColumnOrderState = ["select", "status", "assignee", "priority", "updated", "project", "detay", "actions", "presence"];
/** Sabit sütun sırası (dinamik sütun yokken); component dışında referans sabit kalsın diye */
const BASE_COLUMN_ORDER_STABLE: ColumnOrderState = ["select", "status", "content", "project", "actions"];

/** İlk açılışta İşlemler sütunu gizli; «Kolonları göster» ile açılabilir. Daha önce kaydedilmiş tercih varsa o kullanılır. */
const DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY: VisibilityState = { actions: false };

/** Canlı Tablo görünüm yoğunluğu — padding, yazı ve kontrol boyutları */
const LIVE_TABLE_DENSITY_UI: Record<
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
    th: "px-2 py-1",
    td: "px-2 py-0.5",
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
    th: "px-3 py-2",
    td: "px-3 py-1",
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
    th: "px-4 py-3",
    td: "px-4 py-2",
    grip: "h-5 w-5",
    colFilterBtn: "h-8 w-8",
    colMenuBtn: "h-8 w-8",
    sortIcon: "h-5 w-5",
    rowCheckbox: "h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500",
    actionsBtn: "h-9 w-9",
    selectHeaderSpan: "text-sm",
  },
};

/** İçeriğe göre sütun genişliği hesaplamada kullanılan min/max (px) */
const COLUMN_SIZE_BOUNDS: Record<string, { min: number; max: number }> = {
  select: { min: 36, max: 80 },
  status: { min: 100, max: 220 },
  content: { min: 180, max: 480 },
  project: { min: 120, max: 280 },
  actions: { min: 44, max: 80 },
};
const DEFAULT_EXTRA_BOUNDS = { min: 100, max: 400 };

function charPxForDensity(d: LiveTableDensity): number {
  if (d === "compact") return 7;
  if (d === "comfortable") return 9;
  return 8;
}

function paddingForDensity(d: LiveTableDensity): number {
  if (d === "compact") return 28;
  if (d === "comfortable") return 40;
  return 32;
}

function getColumnSizeBounds(columnId: string): { min: number; max: number } | null {
  const b = COLUMN_SIZE_BOUNDS[columnId];
  if (b) return b;
  if (columnId.startsWith("extra:")) return DEFAULT_EXTRA_BOUNDS;
  return null;
}

/** Bir hücrenin metin uzunluğunu (ölçeklendirme için) döndürür */
function getCellTextLength(columnId: string, task: Task): number {
  if (columnId === "select" || columnId === "actions") return 0;
  if (columnId === "status") return String(task.status ?? "").length;
  if (columnId === "content") return String(task.content ?? "—").length;
  if (columnId.startsWith("extra:")) {
    const key = columnId.replace(/^extra:/, "");
    return String(task.extra_data?.[key] ?? "—").length;
  }
  return 0;
}

/** Satırlar için karakter uzunlukları — tek uç değer yerine yüzdelik ile daha dengeli genişlik. */
function effectiveCharLengthForSizing(columnId: string, tasks: Task[], headerLen: number): number {
  if (columnId === "select" || columnId === "actions") {
    return Math.max(headerLen, columnId === "select" ? 4 : 6);
  }
  const lens: number[] = [];
  for (const t of tasks) lens.push(getCellTextLength(columnId, t));
  lens.sort((a, b) => a - b);
  if (lens.length === 0) return Math.max(headerLen, 8);

  const pick = (q: number) => lens[Math.min(lens.length - 1, Math.floor((lens.length - 1) * q))];

  if (columnId === "content") {
    const p90 = pick(0.9);
    const pMax = lens[lens.length - 1];
    const blended = Math.round(p90 * 0.82 + Math.min(pMax, p90 * 2.2) * 0.18);
    return Math.max(headerLen, Math.min(blended, Math.max(headerLen + 12, pMax)));
  }
  if (columnId.startsWith("extra:")) {
    const p85 = pick(0.85);
    return Math.max(headerLen, p85);
  }
  if (columnId === "status") {
    return Math.max(headerLen, lens[lens.length - 1]);
  }
  return headerLen;
}

function measureIntrinsicColumnWidths(
  filteredData: Task[],
  visibleColumnIds: string[],
  density: LiveTableDensity
): ColumnSizingState {
  const charPx = charPxForDensity(density);
  const pad = paddingForDensity(density);
  const next: ColumnSizingState = {};
  for (const id of visibleColumnIds) {
    const bounds = getColumnSizeBounds(id);
    if (!bounds) continue;
    const headerLabel =
      COLUMN_VISIBILITY_LABELS[id] ?? (id.startsWith("extra:") ? id.replace(/^extra:/, "") : id);
    const effLen = effectiveCharLengthForSizing(id, filteredData, headerLabel.length);
    next[id] = Math.min(bounds.max, Math.max(bounds.min, effLen * charPx + pad));
  }
  return next;
}

function growPriorityForBalance(id: string): number {
  if (id === "content") return 4;
  if (id.startsWith("extra:")) return 3;
  if (id === "status") return 2;
  if (id === "actions") return 1;
  return 0;
}

function shrinkPriorityForBalance(id: string): number {
  if (id === "content") return 0;
  if (id.startsWith("extra:")) return 1;
  if (id === "status") return 2;
  if (id === "actions") return 3;
  return 4;
}

function sumSizedColumns(orderedIds: string[], w: Record<string, number>): number {
  return orderedIds.reduce((s, id) => s + (w[id] ?? 0), 0);
}

/** İçerik tabanlı genişlikleri hedef toplam px’e (genelde görünür alan) göre küçültür veya büyütür. */
function balanceColumnWidthsToTarget(
  intrinsic: Record<string, number>,
  orderedIds: string[],
  target: number
): Record<string, number> {
  const w: Record<string, number> = {};
  for (const id of orderedIds) {
    const b = getColumnSizeBounds(id);
    if (!b) continue;
    const x = intrinsic[id] ?? b.min;
    w[id] = Math.min(b.max, Math.max(b.min, x));
  }
  let sum = sumSizedColumns(orderedIds, w);
  if (sum <= 0) return w;

  if (sum > target) {
    const scale = target / sum;
    for (const id of orderedIds) {
      const b = getColumnSizeBounds(id);
      if (!b) continue;
      w[id] = Math.max(b.min, Math.floor(w[id] * scale));
    }
    sum = sumSizedColumns(orderedIds, w);
    let guard = 0;
    while (sum > target && guard++ < 4000) {
      const candidates = orderedIds.filter((id) => {
        const b = getColumnSizeBounds(id);
        return b != null && w[id] > b.min;
      });
      if (candidates.length === 0) break;
      candidates.sort(
        (a, b) => shrinkPriorityForBalance(a) - shrinkPriorityForBalance(b) || w[b] - w[a]
      );
      w[candidates[0]] -= 1;
      sum -= 1;
    }
  } else if (sum < target) {
    const scale = target / sum;
    for (const id of orderedIds) {
      const b = getColumnSizeBounds(id);
      if (!b) continue;
      w[id] = Math.min(b.max, Math.max(b.min, Math.round(w[id] * scale)));
    }
    sum = sumSizedColumns(orderedIds, w);
    let guard = 0;
    while (sum < target && guard++ < 4000) {
      const candidates = orderedIds.filter((id) => {
        const b = getColumnSizeBounds(id);
        return b != null && w[id] < b.max;
      });
      if (candidates.length === 0) break;
      candidates.sort(
        (a, b) => growPriorityForBalance(b) - growPriorityForBalance(a) || w[b] - w[a]
      );
      w[candidates[0]] += 1;
      sum += 1;
    }
  }
  return w;
}

/** Görünür sütunlar + veri + (isteğe bağlı) görünüm genişliği ile dengeli ColumnSizingState. */
function computeBalancedColumnSizing(
  filteredData: Task[],
  visibleColumnIds: string[],
  viewportWidthPx: number,
  density: LiveTableDensity
): ColumnSizingState {
  const intrinsic = measureIntrinsicColumnWidths(filteredData, visibleColumnIds, density);
  const ordered = visibleColumnIds.filter((id) => intrinsic[id] != null);
  if (ordered.length === 0) return {};

  const rawSum = sumSizedColumns(ordered, intrinsic);
  if (viewportWidthPx <= 0 || rawSum <= 0) return intrinsic;

  const target = Math.max(280, Math.floor(viewportWidthPx) - 6);
  if (Math.abs(rawSum - target) <= 2) return intrinsic;

  return balanceColumnWidthsToTarget(intrinsic, ordered, target);
}

/**
 * Export değer çözücü.
 *
 * `unmaskSensitive` parametresi GIZLILIK kontrolünün override'ıdır:
 * - false (varsayılan) → hassas extra sütunlar (TCKN/sicil) maskeli yazılır
 * - true → ham değer yazılır; YALNIZCA admin için ve bilinçli onayla geçilir
 *   (TasksTable export menüsündeki kilit toggle'ı). Non-admin için her zaman false.
 */
function getExportValue(
  columnId: string,
  task: Task,
  dateFormat: DateFormat,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
): string {
  const t = task as Record<string, unknown>;
  switch (columnId) {
    case "content":
      return String(t.content ?? task.content ?? "");
    case "status":
      return String(t.status ?? task.status ?? "");
    case "assignee":
      return String(t.assignee ?? task.assignee ?? "");
    case "priority":
      return String(t.priority ?? task.priority ?? "");
    case "project": {
      const pid = task.project_id != null ? String(task.project_id) : "";
      if (!pid) return "";
      const p = projectById?.get(pid);
      return (p?.name ?? "").trim() || pid;
    }
    case "updated":
    case "updated_at":
      const ut = t.updated_at ?? task.updated_at;
      return ut ? formatDate(new Date(String(ut)), dateFormat) : "";
    case "due_date":
      return String(t.due_date ?? task.due_date ?? "");
    default:
      if (columnId.startsWith("extra:")) {
        const key = columnId.replace(/^extra:/, "");
        const raw = String(task.extra_data?.[key] ?? (t.extra_data as Record<string, string>)?.[key] ?? "");
        // GIZLILIK: TCKN/sicil/personel no gibi hassas sütunlar varsayılan olarak maskeli.
        // `unmaskSensitive` yalnızca admin bilinçli onayla geçerse true olur.
        if (isSensitiveExtraColumnKey(key) && !unmaskSensitive) {
          return maskSensitiveExtraValue(raw);
        }
        return raw;
      }
      if (columnId === "detay") {
        // Hassas alanları maskele (override yoksa) — sonra JSON üret
        if (!task.extra_data) return "";
        const safe: Record<string, string> = {};
        for (const [k, v] of Object.entries(task.extra_data)) {
          const raw = String(v ?? "");
          safe[k] =
            isSensitiveExtraColumnKey(k) && !unmaskSensitive
              ? maskSensitiveExtraValue(raw)
              : raw;
        }
        return JSON.stringify(safe);
      }
      return t[columnId] != null ? String(t[columnId]) : "";
  }
}

const EXPORT_SKIP_IDS = new Set(["select", "actions", "presence"]);
const EXPORT_DEFAULT_COLUMNS = ["status", "content", "assignee", "priority", "updated", "due_date"];

/** CSV ve Excel için ortak: sütun listesi, başlıklar ve satır değerleri (string[][]) */
function getExportData(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
) {
  let dataColumns = visibleColumnIds.filter(
    (id) => !EXPORT_SKIP_IDS.has(id) && (COLUMN_LABELS[id] != null || id.startsWith("extra:") || id === "due_date" || id === "updated" || id === "updated_at" || id === "assignee" || id === "priority" || id === "content" || id === "status" || id === "project" || id === "detay")
  );
  if (dataColumns.length === 0 && rows.length > 0) {
    const first = rows[0];
    const extraKeys = first.extra_data ? Object.keys(first.extra_data) : [];
    dataColumns = [...EXPORT_DEFAULT_COLUMNS, ...extraKeys.map((k) => `extra:${k}`)];
  }
  const headers = dataColumns.map((id) =>
    COLUMN_LABELS[id] ?? (id === "due_date" ? "Son tarih" : id === "updated_at" ? "Son güncelleme" : id.startsWith("extra:") ? id.replace(/^extra:/, "") : id === "detay" ? "Detay" : id)
  );
  const rowArrays = rows.map((task) =>
    dataColumns.map((id) => getExportValue(id, task, dateFormat, projectById, unmaskSensitive))
  );
  return { headers, rowArrays };
}

function downloadCSV(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  filename: string,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const lines = [headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(",")];
  for (const values of rowArrays) {
    lines.push(values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadExcel(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  filename: string,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const sheetData: string[][] = [headers, ...rowArrays];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Görevler");
  const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([xlsxBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const name = filename.replace(/\.xls$/i, ".xlsx");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** CSV/Excel ile aynı veri; Roboto ile Türkçe uyumlu tablo PDF (tarayıcıda üretilir). */
async function downloadPDF(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  filename: string,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const [{ default: pdfMake }, vfsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const vfs = vfsMod.default ?? (vfsMod as unknown as Record<string, string>);
  pdfMake.addVirtualFileSystem(vfs);

  const body: unknown[][] = [
    headers.map((h) => ({ text: String(h), style: "th" })),
    ...rowArrays.map((row) => row.map((cell) => String(cell))),
  ];

  const docDefinition = {
    pageSize: "A4" as const,
    pageOrientation: "landscape" as const,
    pageMargins: [36, 44, 36, 44] as [number, number, number, number],
    content: [
      { text: "Görev listesi", style: "h1", margin: [0, 0, 0, 14] as [number, number, number, number] },
      {
        table: {
          headerRows: 1,
          widths: Array(headers.length).fill("*"),
          dontBreakRows: false,
          body,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#cccccc",
          vLineColor: () => "#cccccc",
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return "#e8eef4";
            return rowIndex % 2 === 0 ? "#f9fafb" : null;
          },
        },
      },
    ],
    styles: {
      h1: { fontSize: 14, bold: true },
      th: { bold: true, fontSize: 9 },
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 8,
    },
  };

  const pdf = pdfMake.createPdf(docDefinition);
  const baseName = filename.replace(/\.pdf$/i, "");
  await pdf.download(`${baseName}.pdf`);
}

const columnHelper = createColumnHelper<Task>();

type EditableCellProps = {
  value: string;
  /** Düzenleme dışında gösterilecek metin (örn. maskeli TCKN); verilmezse value kullanılır */
  displayValue?: string;
  taskId: string;
  field: string;
  onSave: (taskId: string, patch: Record<string, unknown>) => void;
  onFocus: () => void;
  onBlur: () => void;
  density?: LiveTableDensity;
};

function EditableCell({
  value,
  displayValue,
  taskId,
  field,
  onSave,
  onFocus,
  onBlur,
  density = "normal",
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const cellText =
    density === "compact" ? "text-xs" : density === "comfortable" ? "text-base" : "text-sm";
  const cellPad =
    density === "compact"
      ? "px-1.5 py-1"
      : density === "comfortable"
        ? "px-2.5 py-2"
        : "px-2 py-1.5";
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = localValue.trim();
    if (trimmed !== value) {
      onSave(taskId, { [field]: trimmed, last_updated_by: "anon" });
    }
    setIsEditing(false);
    onBlur();
  }, [localValue, value, taskId, field, onSave, onBlur]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setLocalValue(value);
      setIsEditing(false);
      onBlur();
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full min-w-0 rounded border border-blue-300 bg-blue-50/50 text-slate-900 outline-none ring-2 ring-blue-500 focus:border-blue-500 focus:bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20 dark:text-slate-100 dark:focus:bg-blue-900/30",
            cellText,
            cellPad
          )}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">Enter ile kaydet, Esc ile iptal</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onFocus();
        setIsEditing(true);
      }}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
        cellText,
        cellPad
      )}
    >
      <span
        className="min-w-0 flex-1 truncate"
        title={displayValue !== undefined ? undefined : value || undefined}
      >
        {(displayValue !== undefined ? displayValue : value) || "—"}
      </span>
    </button>
  );
}

/** Dinamik (extra) sütunlarda: hover ile panoya — hassas sütunlarda tam değer kopyalanır */
function ExtraCellCopyButton({ text, density }: { text: string; density: LiveTableDensity }) {
  const [copied, setCopied] = useState(false);
  const iconClass = density === "comfortable" ? "h-4 w-4" : "h-3.5 w-3.5";

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const t = text.trim();
      if (!t || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
      try {
        await navigator.clipboard.writeText(t);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        setCopied(false);
      }
    },
    [text]
  );

  return (
    <button
      type="button"
      onClick={(e) => void handleCopy(e)}
      title={copied ? "Kopyalandı" : "Panoya kopyala"}
      aria-label={copied ? "Kopyalandı" : "Panoya kopyala"}
      className={cn(
        "shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity group-hover/extra-cell:opacity-100 hover:bg-slate-200 hover:text-slate-800 focus:opacity-100 dark:text-slate-500 dark:hover:bg-slate-600 dark:hover:text-slate-100",
        copied && "text-emerald-600 opacity-100 hover:text-emerald-600 dark:text-emerald-400"
      )}
    >
      {copied ? <Check className={iconClass} strokeWidth={2.5} /> : <Copy className={iconClass} />}
    </button>
  );
}

type TaskFormData = { content: string; status: string; assignee: string; priority?: string | null; extra_data?: Record<string, string> | null };

const EXTRA_DATA_LINK_KEY = "link";

function toExtraDataRows(extra_data: Record<string, string> | null | undefined, excludeKeys: string[] = []): Array<{ key: string; value: string }> {
  if (!extra_data || Object.keys(extra_data).length === 0) return [{ key: "", value: "" }];
  const set = new Set(excludeKeys);
  const entries = Object.entries(extra_data).filter(([k]) => !set.has(k)).map(([key, value]) => ({ key, value: String(value ?? "") }));
  return entries.length > 0 ? entries : [{ key: "", value: "" }];
}

function isSafeUrl(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://");
}

const DEFAULT_PRIORITY_OPTIONS = ["High", "Medium", "Low"];

function TaskFormDialog({
  open,
  onOpenChange,
  initialTask,
  onSubmit,
  submitLabel,
  title,
  statusOptions = STATUS_OPTIONS.slice(),
  priorityOptions = DEFAULT_PRIORITY_OPTIONS,
  defaultStatus = "Yapılacak",
  defaultPriority = "Medium",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTask?: Task | null;
  onSubmit: (data: TaskFormData) => void | Promise<void>;
  submitLabel: string;
  title: string;
  statusOptions?: string[];
  priorityOptions?: string[];
  defaultStatus?: string;
  defaultPriority?: string;
}) {
  const [content, setContent] = useState(initialTask?.content ?? "");
  const [status, setStatus] = useState(initialTask?.status ?? defaultStatus);
  const [assignee, setAssignee] = useState(initialTask?.assignee ?? "");
  const [priority, setPriority] = useState(initialTask?.priority ?? defaultPriority);
  const [linkUrl, setLinkUrl] = useState(initialTask?.extra_data?.[EXTRA_DATA_LINK_KEY] ?? "");
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>(() => toExtraDataRows(initialTask?.extra_data ?? undefined, [EXTRA_DATA_LINK_KEY]));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(initialTask?.content ?? "");
    setStatus(initialTask?.status ?? defaultStatus);
    setAssignee(initialTask?.assignee ?? "");
    setPriority(initialTask?.priority ?? defaultPriority);
    setLinkUrl(initialTask?.extra_data?.[EXTRA_DATA_LINK_KEY] ?? "");
    setCustomFields(toExtraDataRows(initialTask?.extra_data ?? undefined, [EXTRA_DATA_LINK_KEY]));
  }, [initialTask, open, defaultStatus, defaultPriority]);

  const addCustomField = () => setCustomFields((prev) => [...prev, { key: "", value: "" }]);
  const removeCustomField = (index: number) =>
    setCustomFields((prev) => (prev.length <= 1 ? [{ key: "", value: "" }] : prev.filter((_, i) => i !== index)));
  const updateCustomField = (index: number, field: "key" | "value", value: string) =>
    setCustomFields((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const extra_data = customFields
      .filter((r) => r.key.trim() !== "")
      .reduce((acc, { key, value }) => ({ ...acc, [key.trim()]: value.trim() }), {} as Record<string, string>);
    if (linkUrl.trim() !== "") extra_data[EXTRA_DATA_LINK_KEY] = linkUrl.trim();
    setSaving(true);
    try {
      await onSubmit({
        content: content.trim(),
        status: status || defaultStatus,
        assignee: assignee.trim() || "",
        priority: priority && priorityOptions.includes(priority) ? priority : defaultPriority,
        extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label htmlFor="task-content" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              İçerik
            </label>
            <textarea
              id="task-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Görev açıklaması (çok satır yazabilirsiniz)"
              rows={3}
              className="w-full min-h-[4.5rem] resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-link" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Link (URL, opsiyonel)
            </label>
            <input
              id="task-link"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-status" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Durum
            </label>
            <select
              id="task-status"
              value={statusOptions.includes(status) ? status : statusOptions[0]}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-priority" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Öncelik
            </label>
            <select
              id="task-priority"
              value={priorityOptions.includes(priority) ? priority : priorityOptions[0]}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {priorityOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-assignee" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Atanan
            </label>
            <input
              id="task-assignee"
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="İsim (opsiyonel)"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Özel alanlar (opsiyonel)</label>
              <Button type="button" variant="ghost" size="sm" onClick={addCustomField} className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Alan ekle
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Referans no, müşteri adı, etiket vb. Alan adı + değer olarak saklanır.</p>
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-600 dark:bg-slate-800/50">
              {customFields.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => updateCustomField(index, "key", e.target.value)}
                    placeholder="Alan adı"
                    className="flex-1 min-w-0 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateCustomField(index, "value", e.target.value)}
                    placeholder="Değer"
                    className="flex-1 min-w-0 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-500 hover:text-red-600"
                    onClick={() => removeCustomField(index)}
                    aria-label="Alanı kaldır"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ColumnMapKey = "content" | "status" | "assignee" | "priority";
const COLUMN_MAP_LABELS: Record<ColumnMapKey, string> = {
  content: "İçerik",
  status: "Durum",
  assignee: "Atanan",
  priority: "Öncelik",
};

function CSVImportDialog({
  open,
  onOpenChange,
  onImport,
  defaultStatus = "Yapılacak",
  defaultPriority = "Medium",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (tasks: Array<{ content: string; status: string; assignee: string | null; priority?: string | null; extra_data?: Record<string, string> | null }>, replaceExisting: boolean) => Promise<void>;
  defaultStatus?: string;
  defaultPriority?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<ColumnMapKey, number | null>>({
    content: null,
    status: null,
    assignee: null,
    priority: null,
  });
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const reset = useCallback(() => {
    setHeaders([]);
    setRows([]);
    setColumnMap({ content: null, status: null, assignee: null, priority: null });
    setReplaceExisting(false);
    setError(null);
    setPasteText("");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const autoMapHeaders = useCallback((h: string[]) => {
    const map: Record<ColumnMapKey, number | null> = { content: null, status: null, assignee: null, priority: null };
    const lower = (s: string) => s.trim().toLowerCase();
    // Açıklama (content) kaynaktan hiç doldurulmaz; tabloda kullanıcı notu için ayrıldığından eşleme yapılmaz
    h.forEach((header, i) => {
      const l = lower(header);
      if (l === "durum" || l === "status") map.status = i;
      else if (l === "atanan" || l === "assignee" || l === "atanan kişi" || l === "ünvan" || l === "unvan" || l === "aktif_unvan_ad" || l === "adı" || l === "adi") map.assignee = i;
      else if (l === "öncelik" || l === "priority") map.priority = i;
    });
    setColumnMap(map);
  }, []);

  const processFileContent = useCallback(
    (text: string, fileName: string) => {
      setError(null);
      const lower = (fileName ?? "").toLowerCase();
      try {
        if (lower.endsWith(".json")) {
          const { headers: h, rows: jsonRows } = parseJSON(text);
          if (h.length === 0) {
            setError("JSON dosyası boş veya geçersiz (nesne dizisi beklenir).");
            return;
          }
          const r = jsonRows.map((row) => h.map((key) => row[key] ?? ""));
          setHeaders(h);
          setRows(r);
          autoMapHeaders(h);
        } else {
          const { headers: h, rows: r } = parseCSV(text);
          if (h.length === 0) {
            setError("CSV dosyası boş veya geçersiz.");
            return;
          }
          setHeaders(h);
          setRows(r);
          autoMapHeaders(h);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Dosya okunamadı.");
      }
    },
    [autoMapHeaders]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => processFileContent(String(reader.result ?? ""), file.name);
      reader.readAsText(file, "UTF-8");
    },
    [processFileContent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const name = (file.name ?? "").toLowerCase();
      if (!name.endsWith(".csv") && !name.endsWith(".json")) {
        setError("Sadece CSV veya JSON dosyası bırakın.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => processFileContent(String(reader.result ?? ""), file.name);
      reader.readAsText(file, "UTF-8");
    },
    [processFileContent]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const buildTasks = useCallback(() => {
    if (rows.length === 0) return [];
    return rows.map((row) => {
      const get = (i: number) => (row[i] != null ? String(row[i]).trim() : "");
      const extra_data: Record<string, string> = {};
      headers.forEach((h, i) => {
        const key = h?.trim() || `Sütun ${i + 1}`;
        extra_data[key] = get(i);
      });
      // Açıklama (content) kaynak dosyadan hiç doldurulmaz; tabloda kullanıcının ek notu için ayrıldı
      const content = "";
      const status = columnMap.status != null ? get(columnMap.status) || "Yapılacak" : "Yapılacak";
      const assignee = columnMap.assignee != null ? get(columnMap.assignee) || null : null;
      const priority = columnMap.priority != null ? get(columnMap.priority) || null : null;
      const hasAnyData = Object.values(extra_data).some((v) => v !== "");
      if (!hasAnyData) return null;
      return {
        content,
        status,
        assignee,
        priority: priority ?? null,
        extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
      };
    }).filter((t): t is NonNullable<typeof t> => t !== null);
  }, [rows, headers, columnMap]);

  const pasteLines = useMemo(() => {
    if (!pasteText.trim()) return [];
    return pasteText.split(/\n/).map((s) => s.trim()).filter(Boolean);
  }, [pasteText]);

  const buildTasksFromPaste = useCallback(() => {
    // Açıklama (content) boş bırakılır; yapıştırılan metin extra_data.Görev ile saklanır
    return pasteLines.map((line) => ({
      content: "",
      status: defaultStatus,
      assignee: null as string | null,
      priority: defaultPriority as string | null,
      extra_data: line ? { Görev: line } : null,
    }));
  }, [pasteLines, defaultStatus, defaultPriority]);

  const handleImport = useCallback(async () => {
    const tasks = importMode === "paste" ? buildTasksFromPaste() : buildTasks();
    if (tasks.length === 0) {
      setError(importMode === "paste" ? "En az bir satır metin girin (boş satırlar yok sayılır)." : "Dosyada geçerli veri bulunamadı (en az bir satırda veri olmalı).");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      await onImport(tasks, replaceExisting);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err != null && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : err instanceof Error
            ? err.message
            : "İçe aktarma başarısız.";
      setError(msg);
    } finally {
      setImporting(false);
    }
  }, [importMode, buildTasksFromPaste, buildTasks, replaceExisting, onImport, onOpenChange]);

  const canImport = importMode === "paste" ? pasteLines.length > 0 : rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Toplu görev ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
            <button
              type="button"
              onClick={() => setImportMode("file")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                importMode === "file"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              )}
            >
              <FileUp className="h-4 w-4" />
              Dosya (CSV/JSON)
            </button>
            <button
              type="button"
              onClick={() => setImportMode("paste")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                importMode === "paste"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              )}
            >
              <ClipboardList className="h-4 w-4" />
              Metin yapıştır
            </button>
          </div>
          {importMode === "paste" ? (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Her satır bir görev olacak şekilde metin yapıştırın. Boş satırlar yok sayılır. Tüm görevlere varsayılan durum ve öncelik uygulanır.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Her satır bir görev\nGörev 1\nGörev 2\nGörev 3"}
                rows={8}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 font-mono"
              />
              {pasteLines.length > 0 && (
                <div className="rounded border border-emerald-200 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 p-3">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    {pasteLines.length} görev eklenecek
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    Durum: {defaultStatus} · Öncelik: {defaultPriority}
                  </p>
                  <div className="mt-2 max-h-32 overflow-y-auto rounded border border-slate-200 bg-white/80 dark:border-slate-600 dark:bg-slate-800/80 p-2 text-xs text-slate-700 dark:text-slate-300">
                    {pasteLines.slice(0, 15).map((line, i) => (
                      <div key={i} className="truncate py-0.5" title={line}>{i + 1}. {line}</div>
                    ))}
                    {pasteLines.length > 15 && <div className="py-0.5 text-slate-500">… +{pasteLines.length - 15} satır daha</div>}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Mevcut veriyi sil ve yeni görevlerle değiştir
              </label>
            </>
          ) : (
            <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            CSV veya JSON dosyası yükleyin veya bu alana sürükleyip bırakın. CSV’de ilk satır başlık kabul edilir. <strong>Tüm sütunlar olduğu gibi tabloya yansır.</strong> Tablodaki <strong>Açıklama</strong> sütunu kaynak dosyadan hiç doldurulmaz; tablo üzerinde çalışırken ek not girmek için ayrılmıştır.
          </p>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "rounded-lg border-2 border-dashed p-4 transition-colors",
              isDragOver
                ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20"
                : "border-slate-200 bg-slate-50/30 dark:border-slate-600 dark:bg-slate-800/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-hidden
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Dosya seç veya sürükleyip bırak
            </Button>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">CSV veya JSON</p>
          </div>
          {headers.length > 0 && (
            <>
              <div className="rounded border border-emerald-200 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 p-3 mb-3">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  ✓ {headers.length} sütun, {rows.length} satır tespit edildi
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Tüm sütunlar tabloya eklenecek: {headers.slice(0, 5).join(", ")}{headers.length > 5 ? ` +${headers.length - 5} daha` : ""}
                </p>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-2 bg-slate-50 dark:bg-slate-800">
                  Önizleme (ilk 5 satır)
                </p>
                <div className="overflow-x-auto max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        {(Object.keys(COLUMN_MAP_LABELS) as ColumnMapKey[]).map((k) => (
                          <th key={k} className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400">
                            {COLUMN_MAP_LABELS[k]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, ri) => (
                        <tr key={ri} className="border-b border-slate-100 dark:border-slate-700">
                          {(Object.keys(COLUMN_MAP_LABELS) as ColumnMapKey[]).map((k) => (
                            <td key={k} className="px-2 py-1 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                              {columnMap[k] != null ? row[columnMap[k]!] ?? "—" : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Mevcut veriyi sil ve CSV ile değiştir
              </label>
            </>
          )}
            </>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button type="button" onClick={handleImport} disabled={!canImport || importing}>
            {importing ? "Aktarılıyor…" : importMode === "paste" ? `${pasteLines.length} görev ekle` : `${rows.length} satır içe aktar`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Nokta rengi: Yeşil Tamamlandı, Sarı Devam, Gri Yapılacak */
const STATUS_DOT_CLASS: Record<string, string> = {
  Tamamlandı: "bg-emerald-500",
  Devam: "bg-amber-500",
  "Devam ediyor": "bg-amber-500",
  Yapılacak: "bg-slate-400",
  Beklemede: "bg-slate-400",
};
/** Badge container + metin rengi: nokta + metin tek Badge içinde */
const STATUS_BADGE_STYLES: Record<string, string> = {
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

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  className,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={className}
      aria-label="Tümünü seç"
    />
  );
}

function getStatusDisplay(value: string): string {
  if (/tamamlandı|tamamlandi|done|completed/i.test(value)) return "Tamamlandı";
  if (/devam|sürüyor|progress/i.test(value)) return "Devam ediyor";
  if (/beklemede|waiting/i.test(value)) return "Beklemede";
  if (/yapılacak|yapilacak|todo/i.test(value)) return "Yapılacak";
  return value || "Yapılacak";
}

/**
 * Görevin tamamlandı olarak işaretlenip işaretlenmediğini döndürür.
 * Canlı tabloda tamamlanan satırlar tüm kullanıcılar için vurgulanır:
 * - Yeşilimsi arka plan (emerald-50/950)
 * - Sol kenarda yeşil çizgi (border-l-emerald)
 * - Hover’da biraz daha koyu ton
 */
function isTaskCompleted(task: Task): boolean {
  const s = (task.status ?? "").trim();
  return (
    /tamamlandı|tamamlandi|done|completed/i.test(s) ||
    /^tamam$/i.test(s) ||
    /^bitti$/i.test(s)
  );
}

/** Toolbar “Durum” filtresindeki bir seçimin görev durumuyla eşleşmesi (filteredData ile aynı mantık). */
function taskStatusMatchesToolbarChip(taskStatus: string, filterLabel: string): boolean {
  const s = taskStatus.trim();
  const f = filterLabel.trim();
  if (f === "Devam ediyor" || f === "Devam") return /devam|sürüyor/i.test(s);
  if (f === "Yapılacak") return /yapılacak|yapilacak/i.test(s);
  if (f === "Tamamlandı") return /tamamlandı|tamamlandi|done|completed/i.test(s);
  return s === f;
}

function rawStatusIsCompleted(status: string): boolean {
  const s = (status ?? "").trim();
  return (
    /tamamlandı|tamamlandi|done|completed/i.test(s) ||
    /^tamam$/i.test(s) ||
    /^bitti$/i.test(s)
  );
}

/** Tek tıkla tamamlandıdan çıkarken: ayarlardaki varsayılan veya listedeki uygun “yapılacak” / ilk tamamlanmamış. */
function resolveRestoreStatus(statusOptions: string[], defaultTaskStatus: string): string {
  const d = (defaultTaskStatus ?? "").trim();
  if (d && statusOptions.includes(d)) return d;
  const todo = statusOptions.find((s) => /yapılacak|yapilacak|todo/i.test(s));
  if (todo) return todo;
  const nonDone = statusOptions.find((s) => !rawStatusIsCompleted(s));
  return nonDone ?? statusOptions[0] ?? "Yapılacak";
}

function StatusCell({
  value,
  taskId,
  onSave,
  onFocus,
  onBlur,
  statusOptions = STATUS_OPTIONS.slice(),
  defaultTaskStatus = "Yapılacak",
  density = "normal",
}: {
  value: string;
  taskId: string;
  onSave: (taskId: string, patch: Partial<Task>) => void;
  onFocus: () => void;
  onBlur: () => void;
  statusOptions?: string[];
  defaultTaskStatus?: string;
  density?: LiveTableDensity;
}) {
  const display = getStatusDisplay(value);
  const badgeStyle = STATUS_BADGE_STYLES[display] ?? STATUS_BADGE_STYLES.Yapılacak;
  const dotClass = STATUS_DOT_CLASS[display] ?? STATUS_DOT_CLASS.Yapılacak;
  const [menuOpen, setMenuOpen] = useState(false);
  const statusListboxId = useId();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSingleSaveRef = useRef<{
    taskId: string;
    onSave: (taskId: string, patch: Partial<Task>) => void;
    status: string;
  } | null>(null);

  const completedLabel = statusOptions.find((s) => /tamamlandı|tamamlandi|done|completed/i.test(s)) ?? "Tamamlandı";

  const clearPendingSingleClick = useCallback(() => {
    if (singleClickTimerRef.current) {
      clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
    pendingSingleSaveRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
        singleClickTimerRef.current = null;
      }
      const p = pendingSingleSaveRef.current;
      if (p) {
        pendingSingleSaveRef.current = null;
        p.onSave(p.taskId, { status: p.status, last_updated_by: "anon" });
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const node = e.target as Node;
      if (anchorRef.current?.contains(node)) return;
      if (menuRef.current?.contains(node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen]);

  const openPicker = useCallback(() => {
    clearPendingSingleClick();
    setMenuOpen(true);
  }, [clearPendingSingleClick]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.button === 2) return;

      if (menuOpen) {
        clearPendingSingleClick();
        setMenuOpen(false);
        return;
      }

      if (e.detail >= 2) {
        openPicker();
        return;
      }

      clearPendingSingleClick();
      const nextStatus = rawStatusIsCompleted(value)
        ? resolveRestoreStatus(statusOptions, defaultTaskStatus)
        : completedLabel;
      pendingSingleSaveRef.current = { taskId, onSave, status: nextStatus };
      singleClickTimerRef.current = setTimeout(() => {
        singleClickTimerRef.current = null;
        pendingSingleSaveRef.current = null;
        onSave(taskId, { status: nextStatus, last_updated_by: "anon" });
      }, 280);
    },
    [taskId, onSave, completedLabel, clearPendingSingleClick, openPicker, menuOpen, value, statusOptions, defaultTaskStatus]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker();
    },
    [openPicker]
  );

  const badgePad =
    density === "compact"
      ? "px-2 py-0.5 text-xs gap-1.5"
      : density === "comfortable"
        ? "px-3 py-1.5 text-base gap-2"
        : "px-2.5 py-1 text-sm gap-2";
  const dotHw =
    density === "compact" ? "h-1.5 w-1.5" : density === "comfortable" ? "h-2.5 w-2.5" : "h-2 w-2";

  const portal =
    menuOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={statusListboxId}
            role="listbox"
            aria-label="Durum seçin"
            className="fixed z-[300] min-w-[10rem] overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {statusOptions.map((s) => (
              <button
                key={s}
                type="button"
                role="option"
                className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
                aria-selected={s === value}
                onClick={() => {
                  onSave(taskId, { status: s, last_updated_by: "anon" });
                  setMenuOpen(false);
                }}
              >
                {s}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title="Tek tık: Tamamlandı / varsayılana dön · Çift tık: tüm durumlar"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? statusListboxId : undefined}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          "inline-flex select-none items-center rounded-md border font-medium transition-colors hover:opacity-90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
          badgePad,
          badgeStyle
        )}
      >
        <span className={cn("shrink-0 rounded-full", dotClass, dotHw)} aria-hidden />
        <span>{display || "—"}</span>
      </button>
      {portal}
    </>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

function TaskStats({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  const tamamlandi = tasks.filter((t) => isStatusDone(t.status)).length;
  const devamEden = tasks.filter((t) => isStatusInProgress(t.status)).length;
  const diger = total - tamamlandi - devamEden;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-300">
      <span className="text-slate-800 dark:text-slate-100">Toplam {total} görev</span>
      <span className="text-slate-400 dark:text-slate-500">·</span>
      <span className="font-normal text-slate-600 dark:text-slate-400">{tamamlandi} tamamlandı</span>
      <span className="text-slate-400 dark:text-slate-500">·</span>
      <span className="font-normal text-slate-600 dark:text-slate-400">{devamEden} devam ediyor</span>
      {diger > 0 && (
        <>
          <span className="text-slate-400 dark:text-slate-500">·</span>
          <span className="font-normal text-slate-600 dark:text-slate-400">{diger} diğer</span>
        </>
      )}
    </div>
  );
}

type TasksTableProps = {
  /** Üst seviyeden kontrol edilen proje filtresi. Verilmezse internal state kullanılır. */
  projectFilter?: string[];
  onProjectFilterChange?: (next: string[]) => void;
};

export function TasksTable({ projectFilter: extProjectFilter, onProjectFilterChange }: TasksTableProps = {}) {
  const {
    tasks,
    updateTaskOptimistic,
    saveTask,
    createTask,
    createTasksBulk,
    deleteTask,
    deleteTasks,
    fetchTasks,
    isLoading,
    error,
    realtimeConnection,
    recentlyUpdatedIds,
  } = useTasksWithRealtime();
  const { projects, updateProject } = useProjects();
  const { user, hasPermission, isAdmin } = useAuth();
  const { editorsByRowId, onlineUsers, setEditingRow } = usePresence({
    userEmail: user?.email ?? undefined,
    userName: user?.displayName ?? user?.email ?? undefined,
    userId: user?.id ?? undefined,
  });
  const [presenceHoverRowId, setPresenceHoverRowId] = useState<string | null>(null);

  const { settings, updateSetting } = useSettings();
  const tableDensity = settings.liveTableDensity;
  const dui = LIVE_TABLE_DENSITY_UI[tableDensity];
  const statusOptions = useMemo(() => getStatusOptions(settings), [settings.customStatusList]);
  const priorityOptions = getPriorityOptions(settings);
  const urgentPrioritySetForTable = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();
  const canCreateTask = hasPermission("liveTable.createTask");
  const canEditTask = hasPermission("liveTable.editTask");
  const canDeleteTask = hasPermission("liveTable.deleteTask");
  const canBulkDelete = hasPermission("liveTable.bulkDelete");
  const canImportCsv = hasPermission("liveTable.importCsv");
  const canExportCsv = hasPermission("liveTable.exportCsv");
  const canManageColumns = hasPermission("liveTable.manageColumns");
  const canAutoSizeColumns = hasPermission("liveTable.autoSizeColumns");
  const canEditProject = hasPermission("projects.edit");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(BASE_COLUMN_ORDER_STABLE);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({
    select: 56,
    status: 140,
    content: 260,
    actions: 52,
  });
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [isFullWidth, setIsFullWidth] = useState(false);
  /** Dar ekranda hızlı filtre satırı varsayılan kapalı */
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(false);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  /** SÜPERADMIN-only: hassas sütunları (TCKN/sicil) export'ta ham mı yazsın?
   *  Varsayılan false (maskeli) — admin bilinçli onayla aktif eder. */
  const [exportUnmaskSensitive, setExportUnmaskSensitive] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  /** Ek sütun silme onay diyaloğu: hedef anahtar adı (extra:KEY -> KEY) veya null */
  const [removeExtraColumnKey, setRemoveExtraColumnKey] = useState<string | null>(null);
  const [removingExtraColumn, setRemovingExtraColumn] = useState(false);
  const toast = useToast();
  const [globalSearch, setGlobalSearch] = useState("");
  /** Varsayılan: sadece projeye bağlı görevler (standart tablo verisi gösterilmez) */
  const [projectLinkedFilter, setProjectLinkedFilter] = useState<"proje" | "tümü">("proje");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  /** Çoklu proje filtresi (görev hangi projeye bağlı): proje id listesi.
   *  Controlled: dışarıdan prop verilirse onu kullan, değilse internal state. */
  const [internalProjectFilter, setInternalProjectFilter] = useState<string[]>([]);
  const projectFilter = extProjectFilter ?? internalProjectFilter;
  const setProjectFilter = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      const value = typeof next === "function" ? next(projectFilter) : next;
      if (onProjectFilterChange) onProjectFilterChange(value);
      else setInternalProjectFilter(value);
    },
    [projectFilter, onProjectFilterChange]
  );
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Excel tarzı sütun filtreleri
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnFilterOpen, setColumnFilterOpen] = useState<string | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  const [datePreset, setDatePreset] = useState<string>("custom");
  // Default sort: status (Yapılacak/Devam/Tamamlandı gruplaması).
  // Eskiden "updated" idi ama o kolon kaldırıldı; kayıtlı kullanıcılar için
  // hydration aşamasında geçersiz sort id'leri normalleştiriliyor.
  const [sorting, setSorting] = useState<SortingState>([{ id: "status", desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  /** Sütun görünürlüğü — çoklu seçim ve tek seferde uygulama için taslak */
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [columnPickerSearch, setColumnPickerSearch] = useState("");
  const [advancedFilterRules, setAdvancedFilterRules] = useState<AdvancedFilterRule[]>([]);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const now = new Date();

  /**
   * `projects` ve `tasks` artık Supabase RLS tarafından sunucu tarafında filtrelenmiş geliyor
   * (scripts/supabase-rls-policies.sql). Bu yüzden burada ek istemci filtresi gerekmez.
   * Aşağıdaki memo'lar doğrudan tüm fetch sonucu üzerinde çalışır.
   */

  /** Proje id -> proje (Proje sütununda isim göstermek ve filtre etiketleri için). */
  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  /** Proje filtresi seçenekleri: RLS'ten gelen tüm görünür projeler, ada göre sıralı. */
  const projectFilterOptions = useMemo(() => {
    return projects
      .map((p) => ({ id: p.id, name: (p.name ?? "").trim() || "(adsız proje)" }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [projects]);

  /** Görünmez olan projelerin filtre seçimini temizle (proje silinirse vb.).
   *  ÖNEMLİ: projects henüz yüklenmediyse (projectFilterOptions boş) bu
   *  cleanup'ı ÇALIŞTIRMA — yoksa localStorage'tan hydrate edilen filtre,
   *  proje listesi gelmeden "geçersiz" sayılıp silinir ve kalıcılık bozulur. */
  useEffect(() => {
    if (projectFilter.length === 0) return;
    if (projectFilterOptions.length === 0) return; // projeler hâlâ yükleniyor olabilir
    const validIds = new Set(projectFilterOptions.map((p) => p.id));
    const valid = projectFilter.filter((id) => validIds.has(id));
    if (valid.length !== projectFilter.length) setProjectFilter(valid);
  }, [projectFilter, projectFilterOptions]);

  /** Atanan dropdown: tüm görünür projelerdeki atananlar. */
  const assigneeFilterOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      (p.assigned_emails ?? []).forEach((e) => {
        const v = String(e).trim();
        if (v) set.add(v);
      });
    });
    return Array.from(set).sort();
  }, [projects]);

  useEffect(() => {
    if (Array.isArray(assigneeFilter) && assigneeFilter.length > 0 && assigneeFilterOptions.length > 0) {
      const valid = assigneeFilter.filter((a) => assigneeFilterOptions.includes(a));
      if (valid.length !== assigneeFilter.length) {
        setAssigneeFilter(valid);
      }
    }
  }, [assigneeFilter, assigneeFilterOptions]);

  /**
   * Extra (dinamik) sütun kapsamı — Canlı Tablo karmaşası fix'i:
   *
   *  - Proje filtresi aktifse, sütun seti seçili projelerin görev verilerinden
   *    + seçili projelerin schema'larından (extra_column_keys) oluşur:
   *    kullanıcı bilinçli olarak o projeye odaklanmıştır, schema'sını proaktif
   *    görmek faydalıdır (Öneri 1 + #4).
   *  - Filtre yokken: yalnızca en az bir görevde değeri olan anahtarlar
   *    görünür (Öneri 2: schema-only kalabalık küresel tabloyu kirletmesin).
   *
   *  Sonuç: yeni bir projenin schema tanımı diğer projeleri kirletmez, ama
   *  o projeyi filtreleyince schema'sı görünür.
   */
  const scopedProjectIdSet = useMemo(
    () => (projectFilter.length > 0 ? new Set(projectFilter) : null),
    [projectFilter]
  );

  const scopedTasksForSchema = useMemo(() => {
    if (scopedProjectIdSet == null) return tasks;
    return tasks.filter(
      (t) => t.project_id != null && scopedProjectIdSet.has(String(t.project_id))
    );
  }, [tasks, scopedProjectIdSet]);

  /** Filtre aktifken seçili projelerin schema'sı (proje formundaki "Canlı tablo ek sütunları"). */
  const scopedProjectSchemaKeys = useMemo(() => {
    if (scopedProjectIdSet == null) return new Set<string>();
    const out = new Set<string>();
    projects.forEach((p) => {
      if (!scopedProjectIdSet.has(p.id)) return;
      for (const k of p.extra_column_keys ?? []) {
        const key = String(k ?? "").trim();
        if (key) out.add(key);
      }
    });
    return out;
  }, [projects, scopedProjectIdSet]);

  const extraDataKeys = useMemo(() => {
    const keys = new Set<string>(scopedProjectSchemaKeys);
    scopedTasksForSchema.forEach((t) => {
      if (t.extra_data && typeof t.extra_data === "object") {
        for (const [k, v] of Object.entries(t.extra_data)) {
          if (k == null || String(k).trim() === "") continue;
          // Filtre yoksa: sadece değer içeren anahtarlar (küresel tablo temizliği)
          // Filtre varsa: tüm anahtarlar dahil (kullanıcı projeye odaklı)
          if (scopedProjectIdSet != null || String(v ?? "").trim() !== "") {
            keys.add(k);
          }
        }
      }
    });
    return Array.from(keys).sort();
  }, [scopedTasksForSchema, scopedProjectSchemaKeys, scopedProjectIdSet]);

  const advancedFilterFieldOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [
      { id: "content", label: COLUMN_VISIBILITY_LABELS.content ?? "Açıklama" },
      { id: "status", label: COLUMN_VISIBILITY_LABELS.status ?? "Durum" },
      { id: "assignee", label: "Atanan" },
      { id: "priority", label: "Öncelik" },
      { id: "due_date", label: "Son tarih" },
    ];
    for (const k of extraDataKeys) {
      opts.push({ id: `extra:${k}`, label: k });
    }
    return opts;
  }, [extraDataKeys]);

  const activeAdvancedFilterRuleCount = useMemo(
    () => advancedFilterRules.filter(advancedFilterRuleIsActive).length,
    [advancedFilterRules]
  );

  /**
   * Gelişmiş filtrede tek bir aktif kural varsa, o alana göre otomatik A-Z sırala.
   * Aynı değere sahip satırlar yan yana gelir (ör. İl başlar A → Adana, Adana, Ankara…).
   * Kullanıcı manuel sort yaparsa veya farklı bir alana geçerse buradaki ref takip eder
   * ve aynı alanı tekrar tekrar uygulamaz; başka alan seçildiğinde ya da rule eklenince
   * yeniden uygulanır.
   */
  const autoSortedFieldRef = useRef<string | null>(null);
  useEffect(() => {
    const active = advancedFilterRules.filter(advancedFilterRuleIsActive);
    if (active.length === 1) {
      const field = active[0].field;
      if (field !== autoSortedFieldRef.current) {
        autoSortedFieldRef.current = field;
        setSorting([{ id: field, desc: false }]);
      }
    } else {
      autoSortedFieldRef.current = null;
    }
  }, [advancedFilterRules]);

  /** Aynı commit içinde önce varsayılan state ile kayıt tetiklenmesin (localStorage'ı silmesin). */
  const skipNextLiveTablePersistRef = useRef(false);
  const liveTableHydratedUserRef = useRef<string | null>(null);
  /** Sürükleyerek genişletilen sütunlar: bunlar veri değişince otomatik ölçeklenmez */
  const userSizedColumnsRef = useRef<Set<string>>(new Set());
  const liveTableScrollRef = useRef<HTMLDivElement>(null);
  const [liveTableViewportWidth, setLiveTableViewportWidth] = useState(0);
  const userIdForPrefs = user?.id ?? null;

  useEffect(() => {
    const dynamicIds = extraDataKeys.map((k) => `extra:${k}`);

    if (!userIdForPrefs) {
      liveTableHydratedUserRef.current = null;
      userSizedColumnsRef.current.clear();
      setColumnOrder((prev) => mergeColumnOrderWithDynamics(prev, dynamicIds));
      return;
    }

    if (liveTableHydratedUserRef.current !== userIdForPrefs) {
      liveTableHydratedUserRef.current = userIdForPrefs;
      userSizedColumnsRef.current.clear();
      skipNextLiveTablePersistRef.current = true;
      const saved = loadLiveTablePrefs(userIdForPrefs);
      setColumnOrder(mergeColumnOrderWithDynamics(saved?.columnOrder, dynamicIds));
      setColumnVisibility(
        saved != null ? (saved.columnVisibility ?? {}) : DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY
      );
      setColumnPinning(saved?.columnPinning ?? { left: [], right: [] });
      if (saved?.columnSizing && Object.keys(saved.columnSizing).length > 0) {
        for (const id of Object.keys(saved.columnSizing)) {
          userSizedColumnsRef.current.add(id);
        }
        setColumnSizing((prev) => ({ ...prev, ...saved.columnSizing }));
      }
      if (saved?.sorting && saved.sorting.length > 0) {
        setSorting(saved.sorting);
      }
      // Filtre state'lerini hydrate et (sayfa yenileme sonrası korunsun).
      // projectFilter parent component tarafından ayrı bir localStorage
      // anahtarıyla yönetiliyor; buradan dokunmuyoruz.
      const f = saved?.filters;
      if (f) {
        setGlobalSearch(f.globalSearch);
        setProjectLinkedFilter(f.projectLinkedFilter);
        setStatusFilter(f.statusFilter);
        setAssigneeFilter(f.assigneeFilter);
        setDateFrom(f.dateFrom);
        setDateTo(f.dateTo);
        setDatePreset(f.datePreset);
        setColumnFilters(f.columnFilters);
        setAdvancedFilterRules(f.advancedFilterRules as AdvancedFilterRule[]);
      }
      return;
    }

    setColumnOrder((prev) => mergeColumnOrderWithDynamics(prev, dynamicIds));
  }, [userIdForPrefs, extraDataKeys]);

  /**
   * Tüm prefs'i tek dosyada tutmak için ortak helper: mevcut bütünsel
   * snapshot'ı döndür. NOT: projectFilter parent component tarafından
   * ayrı bir localStorage anahtarıyla yönetiliyor; burada yer almaz.
   */
  const buildCurrentPrefs = useCallback((): LiveTablePersistedPrefs => ({
    columnVisibility,
    columnOrder,
    columnPinning,
    columnSizing,
    sorting,
    filters: {
      globalSearch,
      projectLinkedFilter,
      statusFilter,
      assigneeFilter,
      projectFilter: [],
      dateFrom,
      dateTo,
      datePreset,
      columnFilters,
      advancedFilterRules,
    },
  }), [
    columnVisibility,
    columnOrder,
    columnPinning,
    columnSizing,
    sorting,
    globalSearch,
    projectLinkedFilter,
    statusFilter,
    assigneeFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
  ]);

  /**
   * Filtre değişiklikleri ANINDA yazılır (debounce yok).
   */
  useEffect(() => {
    if (!userIdForPrefs) return;
    if (skipNextLiveTablePersistRef.current) {
      skipNextLiveTablePersistRef.current = false;
      return;
    }
    saveLiveTablePrefs(userIdForPrefs, buildCurrentPrefs());
  }, [
    userIdForPrefs,
    globalSearch,
    projectLinkedFilter,
    statusFilter,
    assigneeFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
    buildCurrentPrefs,
  ]);

  /**
   * Kolon yerleşim/sıralama gibi rapid-fire (resize sırasında onlarca event)
   * değişiklikler 250ms debounce ile yazılır. Bekleyen kayıt unmount'ta flush
   * edilir (aşağıdaki useEffect).
   */
  const pendingPrefsSaveRef = useRef<{ userId: string; payload: LiveTablePersistedPrefs } | null>(null);
  useEffect(() => {
    if (!userIdForPrefs) return;
    if (skipNextLiveTablePersistRef.current) return;
    const payload = buildCurrentPrefs();
    pendingPrefsSaveRef.current = { userId: userIdForPrefs, payload };
    const t = window.setTimeout(() => {
      saveLiveTablePrefs(userIdForPrefs, payload);
      pendingPrefsSaveRef.current = null;
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    userIdForPrefs,
    columnVisibility,
    columnOrder,
    columnPinning,
    columnSizing,
    sorting,
    buildCurrentPrefs,
  ]);

  /**
   * Bileşen unmount edildiğinde veya tarayıcı sekmesi kapatılırken bekleyen
   * debounced kayıt iptal edilirdi; bunun yerine son hesaplanan paketi
   * senkron olarak localStorage'a yaz. Böylece "filtre seç → hızlıca sayfayı
   * değiştir / yenile" senaryosunda da kayıt kaybolmaz.
   */
  useEffect(() => {
    const flush = () => {
      const pending = pendingPrefsSaveRef.current;
      if (pending) {
        saveLiveTablePrefs(pending.userId, pending.payload);
        pendingPrefsSaveRef.current = null;
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", flush);
      window.addEventListener("pagehide", flush);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", flush);
        window.removeEventListener("pagehide", flush);
      }
      flush();
    };
  }, []);

  const filteredData = useMemo(() => {
    let result = tasks;
    if (projectLinkedFilter === "proje") {
      result = result.filter((t) => t.project_id != null && String(t.project_id).trim() !== "");
    }
    // Çoklu proje seçimi
    const projectArr = Array.isArray(projectFilter) ? projectFilter : [];
    if (projectArr.length > 0) {
      const selected = new Set(projectArr);
      result = result.filter((t) => t.project_id != null && selected.has(String(t.project_id)));
    }
    const q = globalSearch.trim().toLowerCase();
    if (q) {
      result = result.filter((t) => {
        if ((t.content ?? "").toLowerCase().includes(q) || (t.assignee ?? "").toLowerCase().includes(q)) return true;
        if (t.extra_data) {
          for (const v of Object.values(t.extra_data)) {
            if (String(v ?? "").toLowerCase().includes(q)) return true;
          }
        }
        return false;
      });
    }
    // Çoklu durum filtresi
    const statusArr = Array.isArray(statusFilter) ? statusFilter : [];
    if (statusArr.length > 0) {
      result = result.filter((t) => {
        const s = (t.status ?? "").trim();
        return statusArr.some((filter) => taskStatusMatchesToolbarChip(s, filter));
      });
    }
    // Çoklu atanan filtresi
    const assigneeArr = Array.isArray(assigneeFilter) ? assigneeFilter : [];
    if (assigneeArr.length > 0) {
      result = result.filter((t) => {
        const assignee = (t.assignee ?? "").trim();
        return assigneeArr.some((filter) => {
          // Özel durum: boş assignee için
          if (filter === "__unassigned__") return !assignee;
          return assignee === filter || assignee.toLowerCase().includes(filter.toLowerCase());
        });
      });
    }
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom).getTime() : 0;
      const to = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
      result = result.filter((t) => {
        const ts = t.due_date ? new Date(t.due_date).getTime() : 0;
        // Eğer tarih filtresi aktifse ve due_date yoksa gösterme
        if (!t.due_date && (dateFrom || dateTo)) return false;
        return ts >= from && ts <= to;
      });
    }
    // Excel tarzı sütun filtreleri
    const activeColumnFilters = Object.entries(columnFilters).filter(([, values]) => values.length > 0);
    if (activeColumnFilters.length > 0) {
      result = result.filter((t) => {
        return activeColumnFilters.every(([colId, selectedValues]) => {
          // Sütun değerini al
          let cellValue: string = "";
          if (colId === "content") cellValue = t.content ?? "";
          else if (colId === "status") cellValue = t.status ?? "";
          else if (colId === "assignee") cellValue = t.assignee ?? "";
          else if (colId === "priority") cellValue = t.priority ?? "";
          else if (colId === "due_date") cellValue = t.due_date ?? "";
          else if (colId.startsWith("extra:") && t.extra_data) {
            const extraKey = colId.replace("extra:", "");
            cellValue = String(t.extra_data[extraKey] ?? "");
          }
          
          // Boş değer kontrolü
          const isEmpty = !cellValue || cellValue.trim() === "";
          if (selectedValues.includes("__empty__") && isEmpty) return true;
          if (selectedValues.includes("__filled__") && !isEmpty) return true;
          
          // Normal değer eşleşmesi
          return selectedValues.some(v => {
            if (v === "__empty__" || v === "__filled__") return false;
            return cellValue.toLowerCase() === v.toLowerCase();
          });
        });
      });
    }
    const activeAdv = advancedFilterRules.filter(advancedFilterRuleIsActive);
    if (activeAdv.length > 0) {
      result = result.filter((t) => activeAdv.every((r) => taskMatchesAdvancedRule(t, r)));
    }
    return result;
  }, [
    tasks,
    projectLinkedFilter,
    projectFilter,
    globalSearch,
    statusFilter,
    assigneeFilter,
    dateFrom,
    dateTo,
    columnFilters,
    advancedFilterRules,
  ]);

  /** Satır güncellemesi `data` referansını değiştirir; TanStack varsayılanında sayfa 0'a sıçrar — kapatıyoruz. */
  const maxPageIndex = useMemo(
    () => Math.max(0, Math.ceil(filteredData.length / pagination.pageSize) - 1),
    [filteredData.length, pagination.pageSize]
  );

  useEffect(() => {
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
    }
  }, [maxPageIndex, pagination.pageIndex]);

  /** Kullanıcının açıkça seçtiği filtre sayısı (varsayılan "projeye bağlı göster" sayılmaz) */
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (globalSearch.trim()) n++;
    if (Array.isArray(statusFilter) && statusFilter.length > 0) n++;
    if (Array.isArray(assigneeFilter) && assigneeFilter.length > 0) n++;
    if (Array.isArray(projectFilter) && projectFilter.length > 0) n++;
    if (dateFrom || dateTo || datePreset !== "custom") n++;
    // Sütun filtreleri
    const columnFilterCount = Object.values(columnFilters).filter((arr) => arr.length > 0).length;
    n += columnFilterCount;
    n += activeAdvancedFilterRuleCount;
    return n;
  }, [
    globalSearch,
    statusFilter,
    assigneeFilter,
    projectFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    activeAdvancedFilterRuleCount,
  ]);

  const clearFilters = useCallback(() => {
    setProjectLinkedFilter("tümü");
    setGlobalSearch("");
    setStatusFilter([]);
    setAssigneeFilter([]);
    setProjectFilter([]);
    setDateFrom("");
    setDateTo("");
    setDatePreset("custom");
    setColumnFilters({});
    setAdvancedFilterRules([]);
  }, []);

  /**
   * SavedViews entegrasyonu:
   * - getCurrentViewConfig: mevcut filtre+sıralama+kolon görünümünü snapshot olarak ver
   * - applyViewConfig: kaydedilmiş bir görünümü uygula (state setter'larını çağırır)
   */
  const getCurrentViewConfig = useCallback((): SavedViewConfig => {
    return {
      version: 1,
      filters: {
        globalSearch,
        projectLinkedFilter,
        statusFilter,
        assigneeFilter,
        projectFilter,
        dateFrom,
        dateTo,
        datePreset,
        columnFilters,
        advancedFilterRules,
      },
      sort: sorting.map((s) => ({ id: s.id, desc: s.desc })),
      columns: {
        visibility: { ...columnVisibility } as Record<string, boolean>,
        order: [...columnOrder],
        pinning: {
          left: columnPinning.left ?? [],
          right: columnPinning.right ?? [],
        },
      },
    };
  }, [
    globalSearch,
    projectLinkedFilter,
    statusFilter,
    assigneeFilter,
    projectFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
    sorting,
    columnVisibility,
    columnOrder,
    columnPinning,
  ]);

  const applyViewConfig = useCallback((config: SavedViewConfig) => {
    const f = config.filters ?? {};
    setGlobalSearch(typeof f.globalSearch === "string" ? f.globalSearch : "");
    setProjectLinkedFilter(f.projectLinkedFilter === "proje" ? "proje" : "tümü");
    setStatusFilter(Array.isArray(f.statusFilter) ? f.statusFilter : []);
    setAssigneeFilter(Array.isArray(f.assigneeFilter) ? f.assigneeFilter : []);
    setProjectFilter(Array.isArray(f.projectFilter) ? f.projectFilter : []);
    setDateFrom(typeof f.dateFrom === "string" ? f.dateFrom : "");
    setDateTo(typeof f.dateTo === "string" ? f.dateTo : "");
    setDatePreset(typeof f.datePreset === "string" ? f.datePreset : "custom");
    setColumnFilters(f.columnFilters && typeof f.columnFilters === "object" ? f.columnFilters : {});
    setAdvancedFilterRules(Array.isArray(f.advancedFilterRules) ? (f.advancedFilterRules as AdvancedFilterRule[]) : []);
    if (Array.isArray(config.sort) && config.sort.length > 0) {
      setSorting(config.sort);
    }
    const c = config.columns;
    if (c?.visibility) setColumnVisibility(c.visibility);
    if (Array.isArray(c?.order) && c.order.length > 0) setColumnOrder(c.order);
    if (c?.pinning) {
      setColumnPinning({
        left: c.pinning.left ?? [],
        right: c.pinning.right ?? [],
      });
    }
  }, []);

  /** Komut paleti eylemlerini dinle */
  useEffect(() => {
    const openNew = () => {
      if (canCreateTask) setNewTaskOpen(true);
    };
    const clear = () => clearFilters();
    window.addEventListener("commandpalette:newTask", openNew);
    window.addEventListener("commandpalette:clearFilters", clear);
    return () => {
      window.removeEventListener("commandpalette:newTask", openNew);
      window.removeEventListener("commandpalette:clearFilters", clear);
    };
  }, [canCreateTask, clearFilters]);

  // Sütun için benzersiz değerleri hesapla
  const getUniqueValuesForColumn = useCallback((columnId: string): string[] => {
    const values = new Set<string>();
    tasks.forEach((t) => {
      let cellValue: string = "";
      if (columnId === "content") cellValue = t.content ?? "";
      else if (columnId === "status") cellValue = t.status ?? "";
      else if (columnId === "assignee") cellValue = t.assignee ?? "";
      else if (columnId === "priority") cellValue = t.priority ?? "";
      else if (columnId === "due_date") cellValue = t.due_date ?? "";
      else if (columnId.startsWith("extra:") && t.extra_data) {
        const extraKey = columnId.replace("extra:", "");
        cellValue = String(t.extra_data[extraKey] ?? "");
      }
      if (cellValue && cellValue.trim()) {
        values.add(cellValue.trim());
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "tr"));
  }, [tasks]);

  // Sütun filtresi toggle
  const toggleColumnFilterValue = useCallback((columnId: string, value: string) => {
    setColumnFilters((prev) => {
      const current = prev[columnId] || [];
      if (current.includes(value)) {
        return { ...prev, [columnId]: current.filter((v) => v !== value) };
      } else {
        return { ...prev, [columnId]: [...current, value] };
      }
    });
  }, []);

  // Sütun filtresini temizle
  const clearColumnFilter = useCallback((columnId: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  }, []);

  // Gelişmiş Tarih Filtreleri
  const applyDatePreset = useCallback((preset: string) => {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    
    setDatePreset(preset);
    
    switch (preset) {
      case "today":
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "tomorrow":
        const yarin = new Date(bugun);
        yarin.setDate(yarin.getDate() + 1);
        setDateFrom(yarin.toISOString().split("T")[0]);
        setDateTo(yarin.toISOString().split("T")[0]);
        break;
      case "thisWeek":
        const haftaSonu = new Date(bugun);
        haftaSonu.setDate(bugun.getDate() + 7);
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(haftaSonu.toISOString().split("T")[0]);
        break;
      case "nextWeek":
        const gelecekHaftaBas = new Date(bugun);
        gelecekHaftaBas.setDate(bugun.getDate() + 7);
        const gelecekHaftaSon = new Date(bugun);
        gelecekHaftaSon.setDate(bugun.getDate() + 14);
        setDateFrom(gelecekHaftaBas.toISOString().split("T")[0]);
        setDateTo(gelecekHaftaSon.toISOString().split("T")[0]);
        break;
      case "thisMonth":
        const ayBas = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
        const aySon = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0);
        setDateFrom(ayBas.toISOString().split("T")[0]);
        setDateTo(aySon.toISOString().split("T")[0]);
        break;
      case "nextMonth":
        const gelecekAyBas = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 1);
        const gelecekAySon = new Date(bugun.getFullYear(), bugun.getMonth() + 2, 0);
        setDateFrom(gelecekAyBas.toISOString().split("T")[0]);
        setDateTo(gelecekAySon.toISOString().split("T")[0]);
        break;
      case "last7days":
        const yediGunOnce = new Date(bugun);
        yediGunOnce.setDate(bugun.getDate() - 7);
        setDateFrom(yediGunOnce.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "last30days":
        const otuzGunOnce = new Date(bugun);
        otuzGunOnce.setDate(bugun.getDate() - 30);
        setDateFrom(otuzGunOnce.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "custom":
        // Manuel tarih seçimi için boş bırak
        setDateFrom("");
        setDateTo("");
        break;
      default:
        setDateFrom("");
        setDateTo("");
    }
  }, []);

  // Akıllı Filtreler
  const applySmartFilter = useCallback((filterType: "overdue" | "thisWeek" | "priority" | "mine" | "unassigned") => {
    clearFilters();
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const haftaSonu = new Date(bugun);
    haftaSonu.setDate(bugun.getDate() + 7);

    switch (filterType) {
      case "overdue":
        // Gecikmiş: bitiş tarihi bugünden önce
        const dun = new Date(bugun);
        dun.setDate(dun.getDate() - 1);
        setDateTo(dun.toISOString().split("T")[0]);
        break;
      case "thisWeek":
        // Bu hafta bitenler
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(haftaSonu.toISOString().split("T")[0]);
        break;
      case "priority": {
        // Öncelikli = projenin önceliği acil set'inde olan projeleri filtrele
        // (Görev Özeti'ndeki "Acil öncelik" KPI'ı ile aynı kural).
        const urgentProjectIds = projects
          .filter((p) => isUrgentPriorityValue(p.priority, urgentPrioritySetForTable))
          .map((p) => p.id);
        if (urgentProjectIds.length > 0) {
          setProjectFilter(urgentProjectIds);
        }
        break;
      }
      case "mine":
        // Bana atanan
        if (currentUserEmail) {
          setAssigneeFilter([currentUserEmail]);
        }
        break;
      case "unassigned":
        // Atanmamış (boş assignee) - özel değer
        setAssigneeFilter(["__unassigned__"]);
        break;
    }
  }, [clearFilters, currentUserEmail, projects, urgentPrioritySetForTable, setProjectFilter]);

  // Akıllı filtre sayıları
  // Kapsam: Görev Özeti ile aynı sabit kural — projesi olmayan ("orphan") görevler
  // HER ZAMAN hariç + aktif proje filtresi. Toolbar'daki `projectLinkedFilter` ("Tümü")
  // moduna bağlanmaz; aksi halde Görev Özeti ile sayılar tutmaz (kullanıcı toolbar'da
  // "Tümü"ye geçtiğinde orphan görevler özette görünmez ama hızlı filtrelerde sayılırdı).
  const smartFilterCounts = useMemo(() => {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const haftaSonu = new Date(bugun);
    haftaSonu.setDate(bugun.getDate() + 7);
    haftaSonu.setHours(23, 59, 59, 999);

    let scoped = tasks.filter(
      (t) => t.project_id != null && String(t.project_id).trim() !== ""
    );
    const projectArr = Array.isArray(projectFilter) ? projectFilter : [];
    if (projectArr.length > 0) {
      const selected = new Set(projectArr);
      scoped = scoped.filter((t) => t.project_id != null && selected.has(String(t.project_id)));
    }

    const overdue = scoped.filter((t) => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      const isCompleted = /tamamlandı|tamamlandi|done|completed/i.test(t.status ?? "");
      return dueDate < bugun && !isCompleted;
    }).length;

    const thisWeek = scoped.filter((t) => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= bugun && dueDate <= haftaSonu;
    }).length;

    // Öncelikli = projenin önceliği acil set'inde (Görev Özeti'ndeki "Acil öncelik" KPI'ı ile aynı kural).
    // Görevin kendi priority alanı sayılmaz; aksi halde proje önceliği Low/boş olsa bile sayım kabarır.
    const priority = scoped.filter((t) => {
      if (!t.project_id) return false;
      const proj = projectById.get(String(t.project_id));
      const projPriority = proj?.priority ?? null;
      if (!isUrgentPriorityValue(projPriority, urgentPrioritySetForTable)) return false;
      const isCompleted = /tamamlandı|tamamlandi|done|completed/i.test(t.status ?? "");
      return !isCompleted;
    }).length;

    const mine = scoped.filter((t) =>
      (t.assignee ?? "").toLowerCase().includes(currentUserEmail.toLowerCase())
    ).length;

    const unassigned = scoped.filter((t) =>
      !t.assignee || t.assignee.trim() === ""
    ).length;

    return { overdue, thisWeek, priority, mine, unassigned };
  }, [tasks, currentUserEmail, projectById, urgentPrioritySetForTable, projectFilter]);

  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedColumnId(columnId);
    e.dataTransfer.setData("text/plain", columnId);
    e.dataTransfer.effectAllowed = "move";
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === targetId) return;
    setColumnOrder((prev) => {
      const order = [...prev];
      const from = order.indexOf(draggedColumnId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      order.splice(from, 1);
      order.splice(to, 0, draggedColumnId);
      return order;
    });
    setDraggedColumnId(null);
  }, [draggedColumnId]);
  const handleDragEnd = useCallback(() => setDraggedColumnId(null), []);
  const pinColumn = useCallback((columnId: string, side: "left" | "right" | "unpin") => {
    setColumnPinning((prev) => {
      const left = (prev.left ?? []).filter((id) => id !== columnId);
      const right = (prev.right ?? []).filter((id) => id !== columnId);
      if (side === "left") return { left: [...left, columnId], right };
      if (side === "right") return { left, right: [...right, columnId] };
      return { left, right };
    });
  }, []);

  const handleSave = useCallback(
    (taskId: string, patch: Partial<Task>) => {
      updateTaskOptimistic(taskId, patch);
      void saveTask(taskId, patch).then((r) => {
        if (!r.ok) toast.error(r.message);
      });
    },
    [updateTaskOptimistic, saveTask, toast]
  );

  const handleNewTask = useCallback(
    async (data: TaskFormData) => {
      await createTask({
        content: data.content,
        status: data.status,
        assignee: data.assignee || null,
        priority: data.priority ?? null,
        extra_data: data.extra_data ?? null,
      });
    },
    [createTask]
  );

  const handleCSVImport = useCallback(
    async (
      imported: Array<{ content: string; status: string; assignee: string | null; priority?: string | null; extra_data?: Record<string, string> | null }>,
      replaceExisting: boolean
    ) => {
      if (replaceExisting && tasks.length > 0) {
        await deleteTasks(tasks.map((t) => t.id));
      }
      await createTasksBulk(imported);
    },
    [tasks, deleteTasks, createTasksBulk]
  );

  const handleEditSubmit = useCallback(
    async (data: TaskFormData) => {
      if (!editTask) return;
      const patch = {
        content: data.content,
        status: data.status,
        assignee: data.assignee || null,
        priority: data.priority ?? null,
        extra_data: data.extra_data ?? null,
      };
      updateTaskOptimistic(editTask.id, patch);
      const r = await saveTask(editTask.id, patch);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setEditTask(null);
      toast.success("Görev güncellendi");
    },
    [editTask, saveTask, updateTaskOptimistic, toast]
  );

  const handleCopyTask = useCallback(
    async (task: Task) => {
      await createTask({
        content: task.content + " (kopya)",
        status: task.status,
        assignee: task.assignee,
      });
    },
    [createTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      // Undo için önce mevcut görev verisini yakala
      const backup = tasks.find((t) => t.id === taskId);
      setDeletingIds((prev) => new Set(prev).add(taskId));
      try {
        await deleteTask(taskId);
        toast.success("Görev silindi", {
          action: backup
            ? {
                label: "Geri al",
                onClick: async () => {
                  try {
                    await createTask({
                      content: backup.content,
                      status: backup.status,
                      assignee: backup.assignee,
                      priority: backup.priority,
                      project_id: backup.project_id,
                      due_date: backup.due_date,
                      extra_data: backup.extra_data,
                    });
                    toast.success("Görev geri yüklendi");
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Geri alınamadı";
                    toast.error(msg);
                  }
                },
              }
            : undefined,
        });
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "object" && e !== null && "message" in e
              ? String((e as { message: unknown }).message)
              : "Görev silinemedi.";
        toast.error(msg);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [deleteTask, createTask, tasks, toast]
  );

  // Dinamik hücre düzenleme handler'ı
  const handleDynamicCellSave = useCallback((taskId: string, key: string, value: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newExtraData = { ...(task.extra_data ?? {}), [key]: value };
    handleSave(taskId, { extra_data: newExtraData });
  }, [tasks, handleSave]);

  const columns: ColumnDef<Task, string | null>[] = useMemo(
    () => [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <span className="flex items-center gap-1.5">
          <SelectAllCheckbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className={dui.rowCheckbox}
          />
          <span className={cn("font-medium text-slate-600 dark:text-slate-400", dui.selectHeaderSpan)}>Seçim</span>
        </span>
      ),
      cell: ({ row }) => {
        const editors = editorsByRowId.get(row.original.id) ?? [];
        const first = editors[0];
        const line =
          editors.length === 0
            ? null
            : editors.length === 1
              ? presenceEditorLines(first).primary
              : `${presenceEditorLines(first).primary} +${editors.length - 1}`;
        const editorsTooltip =
          editors.length === 0
            ? ""
            : editors
                .map((e) => {
                  const { primary, emailLine } = presenceEditorLines(e);
                  return emailLine ? `${primary} — ${emailLine}` : primary;
                })
                .join("\n");
        return (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
              className={dui.rowCheckbox}
              aria-label="Satırı seç"
            />
            {line != null && (
              <Tooltip delayDuration={160}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex max-w-full cursor-default items-center gap-0.5 rounded px-0.5 text-left text-[10px] font-medium leading-tight text-violet-700 outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-violet-400 dark:text-violet-300"
                    aria-label={`Düzenleyen: ${editors.map((e) => presenceEditorLines(e).primary).join(", ")}`}
                  >
                    <User className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                    <span className="min-w-0 truncate">{line}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="z-[400] max-w-[min(20rem,calc(100vw-2rem))] border-2 border-violet-500 bg-violet-100 px-3 py-2.5 text-sm font-semibold text-violet-950 shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:border-violet-400 dark:bg-violet-900/95 dark:text-violet-50 md:text-base"
                >
                  <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                    Bu satırda düzenleme
                  </span>
                  <span className="mt-1.5 block whitespace-pre-line break-words text-[13px] font-semibold leading-snug md:text-sm">
                    {editorsTooltip}
                  </span>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
      size: 56,
      minSize: 48,
      maxSize: 140,
      enableResizing: false,
      enableHiding: false,
    }),
    columnHelper.display({
      id: "status",
      header: "Durum",
      sortingFn: (a, b) =>
        String(a.original.status ?? "").localeCompare(String(b.original.status ?? ""), "tr", {
          sensitivity: "base",
        }),
      cell: ({ row }) => (
        <StatusCell
          value={row.original.status ?? ""}
          taskId={row.original.id}
          onSave={handleSave}
          onFocus={() => setEditingRow(row.original.id)}
          onBlur={() => setEditingRow(null)}
          statusOptions={statusOptions}
          defaultTaskStatus={settings.defaultTaskStatus}
          density={tableDensity}
        />
      ),
      size: 140,
      minSize: 100,
      maxSize: 220,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "content",
      header: "Açıklama",
      sortingFn: (a, b) =>
        String(a.original.content ?? "").localeCompare(String(b.original.content ?? ""), "tr", {
          sensitivity: "base",
          numeric: true,
        }),
      cell: ({ row }) => {
        const task = row.original;
        const value = task.content ?? "";
        const link = task.extra_data?.[EXTRA_DATA_LINK_KEY];
        const showLink = link && isSafeUrl(link);
        return (
          <div className="min-w-0 flex items-center gap-1.5" title={value || undefined}>
            <span className="min-w-0 flex-1">
              <EditableCell
                value={value}
                taskId={task.id}
                field="content"
                onSave={(id, patch) => {
                  if ("content" in patch) handleSave(id, patch);
                }}
                onFocus={() => setEditingRow(task.id)}
                onBlur={() => setEditingRow(null)}
                density={tableDensity}
              />
            </span>
            {showLink && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                title={link}
                aria-label="Linki aç"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        );
      },
      size: 260,
      minSize: 180,
      maxSize: 480,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "project",
      header: "Proje",
      sortingFn: (a, b) => {
        const an = (projectById.get(String(a.original.project_id ?? ""))?.name ?? "").trim();
        const bn = (projectById.get(String(b.original.project_id ?? ""))?.name ?? "").trim();
        if (!an && !bn) return 0;
        if (!an) return 1;
        if (!bn) return -1;
        return an.localeCompare(bn, "tr", { sensitivity: "base" });
      },
      cell: ({ row }) => {
        const pid = row.original.project_id;
        if (!pid) {
          return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
        }
        const p = projectById.get(String(pid));
        const name = (p?.name ?? "").trim() || "(adsız proje)";
        return (
          <Link
            href={`/projeler/${pid}`}
            className="inline-flex max-w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 hover:underline dark:text-blue-300 dark:hover:bg-blue-900/30"
            title={name}
          >
            <ListTodo className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{name}</span>
          </Link>
        );
      },
      size: 160,
      minSize: 120,
      maxSize: 280,
      enableResizing: true,
      enableSorting: true,
    }),
    ...extraDataKeys.map((key) =>
      columnHelper.display({
        id: `extra:${key}`,
        header: key,
        /**
         * Display sütunları varsayılan olarak sıralanamaz; extra_data[key]
         * değerine bakan Türkçe-aware sortingFn ekliyoruz.
         * Adana, Adıyaman, Ağrı, Ankara, Antalya... gibi doğru alfabetik sıra.
         */
        sortingFn: (rowA, rowB) => {
          const a = String(rowA.original.extra_data?.[key] ?? "").trim();
          const b = String(rowB.original.extra_data?.[key] ?? "").trim();
          // Boşlar her zaman en sonda
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b, "tr", { sensitivity: "base", numeric: true });
        },
        cell: ({ row }) => {
          const value = row.original.extra_data?.[key] ?? "";
          const taskId = row.original.id;
          // Checkbox için: "yapıldı", "tamamlandı", "done", "completed", "ok", "✓"
          const isCheckbox = /^(yapıldı|yapildi|tamamlandı|tamamlandi|done|completed|ok|✓|x|check)$/i.test(key);
          if (isCheckbox) {
            const checked = /^(1|true|yes|evet|✓|x)$/i.test(value);
            return (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => handleDynamicCellSave(taskId, key, e.target.checked ? "✓" : "")}
                  className={dui.rowCheckbox}
                />
              </label>
            );
          }
          // Dropdown için: "durum", "status", "öncelik", "priority"
          const isDropdown = /^(durum|status|öncelik|oncelik|priority)$/i.test(key);
          if (isDropdown) {
            const options = /öncelik|priority/i.test(key) 
              ? ["High", "Medium", "Low"] 
              : ["Yapılacak", "Devam ediyor", "Tamamlandı"];
            return (
              <select
                value={value}
                onChange={(e) => handleDynamicCellSave(taskId, key, e.target.value)}
                className={cn(
                  "w-full rounded border border-slate-200 bg-white px-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100",
                  tableDensity === "compact" && "py-0.5 text-xs",
                  tableDensity === "normal" && "py-1 text-sm",
                  tableDensity === "comfortable" && "py-2 text-base"
                )}
              >
                <option value="">—</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            );
          }
          // Inline editable text + hover ile kopyala (TCKN/sicil: maskeli gösterim)
          const raw = String(value ?? "");
          const sensitive = isSensitiveExtraColumnKey(key);
          const masked = sensitive ? maskSensitiveExtraValue(raw) : raw;
          const showCopy = raw.trim() !== "";

          return (
            <div className="group/extra-cell flex min-w-0 items-center gap-0.5">
              <div className="min-w-0 flex-1">
                <EditableCell
                  value={raw}
                  displayValue={sensitive ? masked : undefined}
                  taskId={taskId}
                  field={key}
                  onSave={(id, patch) => {
                    if (key in patch) {
                      handleDynamicCellSave(id, key, String(patch[key] ?? ""));
                    }
                  }}
                  onFocus={() => setEditingRow(taskId)}
                  onBlur={() => setEditingRow(null)}
                  density={tableDensity}
                />
              </div>
              {showCopy && <ExtraCellCopyButton text={raw} density={tableDensity} />}
            </div>
          );
        },
        size: 150,
        minSize: 80,
        maxSize: 400,
        enableResizing: true,
        enableSorting: true,
      })
    ),
    columnHelper.display({
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const task = row.original;
        const isDeleting = deletingIds.has(task.id);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={cn(dui.actionsBtn, "shrink-0")} aria-label="Menü">
                <MoreHorizontal className={cn(dui.sortIcon, "shrink-0")} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEditTask && (
                <DropdownMenuItem onClick={() => setEditTask(task)}>Düzenle</DropdownMenuItem>
              )}
              {canCreateTask && (
                <DropdownMenuItem onClick={() => handleCopyTask(task)}>Kopyala</DropdownMenuItem>
              )}
              {(canEditTask || canCreateTask) && canDeleteTask && <DropdownMenuSeparator />}
              {canDeleteTask && (
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => handleDeleteTask(task.id)}
                  disabled={isDeleting}
                >
                  Sil
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 52,
      minSize: 44,
      maxSize: 80,
      enableResizing: false,
    }),
    ],
    [
      handleSave,
      statusOptions,
      tableDensity,
      dui,
      extraDataKeys,
      handleDynamicCellSave,
      deletingIds,
      editorsByRowId,
      canEditTask,
      canCreateTask,
      canDeleteTask,
      handleCopyTask,
      handleDeleteTask,
      setEditingRow,
      setEditTask,
      settings.defaultTaskStatus,
      projectById,
    ]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: (updater) => {
      setColumnSizing((old) => {
        const next = typeof updater === "function" ? updater(old) : updater;
        for (const key of Object.keys(next)) {
          if (next[key] !== old[key]) userSizedColumnsRef.current.add(key);
        }
        return next;
      });
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: { rowSelection, columnVisibility, columnOrder, columnPinning, columnSizing, sorting, pagination },
    enableRowSelection: true,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enablePinning: true,
    enableSorting: true,
    autoResetPageIndex: false,
    manualPagination: false,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
  });

  const liveTableVisibleKey = useMemo(() => {
    const vis = Object.keys(columnVisibility)
      .sort()
      .map((k) => `${k}:${columnVisibility[k] === false ? "0" : "1"}`)
      .join(",");
    return `${columnOrder.join(",")}|${vis}|${extraDataKeys.join(",")}`;
  }, [columnOrder, columnVisibility, extraDataKeys]);

  useLayoutEffect(() => {
    if (isLoading || error) return;
    const el = liveTableScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect.width ?? 0;
      setLiveTableViewportWidth(Math.floor(cr));
    });
    ro.observe(el);
    setLiveTableViewportWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [isLoading, error, isFullWidth]);

  /** Sütunları görünür alana ve veriye göre orantılar; elle genişletilen sütunları sıfırlayıp tümünü yeniden ölçer */
  const handleAutoSizeColumns = useCallback(() => {
    userSizedColumnsRef.current.clear();
    const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
    const vw =
      liveTableScrollRef.current?.clientWidth ??
      liveTableViewportWidth ??
      (typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.88) : 1200);
    const next = computeBalancedColumnSizing(
      filteredData,
      visibleIds,
      Math.max(0, Math.floor(vw)),
      tableDensity
    );
    setColumnSizing((prev) => ({ ...prev, ...next }));
  }, [table, filteredData, tableDensity, liveTableViewportWidth]);

  /** Veri, sütun görünümü veya genişlik değişince otomatik orantı (elle boyutlanan sütunlar hariç) */
  useEffect(() => {
    if (isLoading || error) return;
    const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
    const vw =
      liveTableViewportWidth > 0
        ? liveTableViewportWidth
        : typeof window !== "undefined"
          ? Math.floor(window.innerWidth * 0.85)
          : 0;
    const sized = computeBalancedColumnSizing(filteredData, visibleIds, vw, tableDensity);
    setColumnSizing((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(sized)) {
        if (userSizedColumnsRef.current.has(id)) continue;
        const v = sized[id];
        if (v !== undefined && next[id] !== v) {
          next[id] = v;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [filteredData, liveTableVisibleKey, liveTableViewportWidth, tableDensity, isLoading, error, table]);

  const visibleColumnIds = table.getVisibleLeafColumns().map((c) => (c.id ?? (c as { accessorKey?: string }).accessorKey ?? "").toString()).filter(Boolean);
  /** Export sırasında hassas sütunların ham olarak yazılıp yazılmayacağı.
   *  Non-admin için her zaman false; UI toggle'ı admin olmadığında render edilmez,
   *  ama bir sızıntı senaryosunda da yine sunucu/UI iki katmanda korunur. */
  const effectiveUnmaskSensitive = isAdmin && exportUnmaskSensitive;

  const handleExportCSV = useCallback(
    (scope: "current" | "all") => {
      const rows = scope === "all" ? tasks : filteredData;
      downloadCSV(
        rows,
        visibleColumnIds,
        settings.dateFormat,
        `gorevler-${scope === "all" ? "tum" : "gorunum"}${effectiveUnmaskSensitive ? "-ham" : ""}-${Date.now()}.csv`,
        projectById,
        effectiveUnmaskSensitive
      );
      if (effectiveUnmaskSensitive) {
        toast.success("Hassas veriler AÇIK olarak indirildi (admin onayı)");
      }
    },
    [tasks, filteredData, visibleColumnIds, settings.dateFormat, projectById, effectiveUnmaskSensitive, toast]
  );
  const handleExportExcel = useCallback(
    (scope: "current" | "all") => {
      const rows = scope === "all" ? tasks : filteredData;
      downloadExcel(
        rows,
        visibleColumnIds,
        settings.dateFormat,
        `gorevler-${scope === "all" ? "tum" : "gorunum"}${effectiveUnmaskSensitive ? "-ham" : ""}-${Date.now()}.xlsx`,
        projectById,
        effectiveUnmaskSensitive
      );
      if (effectiveUnmaskSensitive) {
        toast.success("Hassas veriler AÇIK olarak indirildi (admin onayı)");
      }
    },
    [tasks, filteredData, visibleColumnIds, settings.dateFormat, projectById, effectiveUnmaskSensitive, toast]
  );
  const handleExportPDF = useCallback(
    async (scope: "current" | "all") => {
      const rows = scope === "all" ? tasks : filteredData;
      try {
        await downloadPDF(
          rows,
          visibleColumnIds,
          settings.dateFormat,
          `gorevler-${scope === "all" ? "tum" : "gorunum"}${effectiveUnmaskSensitive ? "-ham" : ""}-${Date.now()}.pdf`,
          projectById,
          effectiveUnmaskSensitive
        );
        if (effectiveUnmaskSensitive) {
          toast.success("Hassas veriler AÇIK olarak indirildi (admin onayı)");
        }
      } catch (e) {
        console.error("[Export] PDF oluşturulamadı:", e);
      }
    },
    [tasks, filteredData, visibleColumnIds, settings.dateFormat, projectById, effectiveUnmaskSensitive, toast]
  );

  const openColumnPicker = useCallback(() => {
    setColumnPickerSearch("");
    setColumnPickerOpen(true);
  }, []);

  /** Tek sütunun görünürlüğünü anında değiştir (draft yok, Uygula yok). */
  const toggleColumnVisibilityInstant = useCallback((columnId: string, show: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev };
      if (show) delete next[columnId];
      else next[columnId] = false;
      return next;
    });
  }, []);

  /** Birden fazla sütunu birlikte göster veya gizle. */
  const setManyColumnVisibilityInstant = useCallback(
    (columnIds: string[], show: boolean) => {
      setColumnVisibility((prev) => {
        const next = { ...prev };
        for (const id of columnIds) {
          if (show) delete next[id];
          else next[id] = false;
        }
        return next;
      });
    },
    []
  );

  /** Sürüklenen sütun sırası ve sol/sağ sabitlemeleri varsayılana döner (görünürlük ve genişlik aynı kalır). */
  const resetColumnOrderToDefault = useCallback(() => {
    const dynamicIds = extraDataKeys.map((k) => `extra:${k}`);
    setColumnOrder(mergeColumnOrderWithDynamics(undefined, dynamicIds));
    setColumnPinning({ left: [], right: [] });
  }, [extraDataKeys]);

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedTasks = selectedRows.map((r) => r.original);
  const selectedIds = selectedTasks.map((t) => t.id);

  const executeBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteConfirmOpen(false);
    // Undo için seçili görevlerin tamamını yakala
    const backups = selectedTasks.map((t) => ({ ...t }));
    setDeletingIds((prev) => new Set([...Array.from(prev), ...selectedIds]));
    try {
      await deleteTasks(selectedIds);
      setRowSelection({});
      toast.success(`${selectedIds.length} görev silindi`, {
        action:
          backups.length > 0
            ? {
                label: "Geri al",
                onClick: async () => {
                  try {
                    await createTasksBulk(
                      backups.map((b) => ({
                        content: b.content,
                        status: b.status,
                        assignee: b.assignee,
                        priority: b.priority,
                        project_id: b.project_id,
                        due_date: b.due_date,
                        extra_data: b.extra_data,
                      }))
                    );
                    toast.success(`${backups.length} görev geri yüklendi`);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Geri alınamadı";
                    toast.error(msg);
                  }
                },
              }
            : undefined,
      });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Toplu silme başarısız.";
      toast.error(msg);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        selectedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [selectedIds, selectedTasks, deleteTasks, createTasksBulk, toast]);

  /**
   * Ek sütun silme etkisi: kaç projenin şeması ve kaç görevin verisi etkilenecek.
   * Kapsam: proje filtresi aktifse o projeler; değilse anahtarın bulunduğu tüm projeler.
   */
  const removeExtraColumnImpact = useMemo(() => {
    if (!removeExtraColumnKey) return { projects: [] as typeof projects, taskCount: 0 };
    const key = removeExtraColumnKey;
    const scopeProjectIds = scopedProjectIdSet;
    const affectedProjects = projects.filter((p) => {
      if (scopeProjectIds != null && !scopeProjectIds.has(p.id)) return false;
      return (p.extra_column_keys ?? []).some((k) => String(k ?? "").trim() === key);
    });
    const affectedProjectIdSet = new Set(affectedProjects.map((p) => p.id));
    const taskCount = tasks.reduce((acc, t) => {
      if (t.extra_data == null || typeof t.extra_data !== "object") return acc;
      if (!(key in t.extra_data)) return acc;
      // Görev kapsamı: filtre varsa sadece filtredeki projeler;
      // filtre yoksa: etkilenen projelerden birine bağlı veya projesiz görevler dahil
      if (scopeProjectIds != null) {
        if (t.project_id == null) return acc;
        if (!scopeProjectIds.has(String(t.project_id))) return acc;
      } else {
        if (t.project_id != null && !affectedProjectIdSet.has(String(t.project_id))) return acc;
      }
      return acc + 1;
    }, 0);
    return { projects: affectedProjects, taskCount };
  }, [removeExtraColumnKey, projects, tasks, scopedProjectIdSet]);

  const executeRemoveExtraColumn = useCallback(async () => {
    if (!removeExtraColumnKey) return;
    const key = removeExtraColumnKey;
    const { projects: affectedProjects, taskCount } = removeExtraColumnImpact;
    setRemovingExtraColumn(true);
    try {
      // 1) Projelerin extra_column_keys şemasından anahtarı çıkar
      for (const p of affectedProjects) {
        const next = (p.extra_column_keys ?? []).filter((k) => String(k ?? "").trim() !== key);
        await updateProject(p.id, { extra_column_keys: next });
      }
      // 2) Kapsamdaki görevlerin extra_data'sından anahtarı temizle
      const affectedProjectIdSet = new Set(affectedProjects.map((p) => p.id));
      const scopeProjectIds = scopedProjectIdSet;
      const tasksToClear = tasks.filter((t) => {
        if (t.extra_data == null || typeof t.extra_data !== "object") return false;
        if (!(key in t.extra_data)) return false;
        if (scopeProjectIds != null) {
          return t.project_id != null && scopeProjectIds.has(String(t.project_id));
        }
        return t.project_id == null || affectedProjectIdSet.has(String(t.project_id));
      });
      for (const t of tasksToClear) {
        const nextExtra = { ...(t.extra_data ?? {}) };
        delete nextExtra[key];
        const nextValue = Object.keys(nextExtra).length > 0 ? nextExtra : null;
        await saveTask(t.id, { extra_data: nextValue });
        updateTaskOptimistic(t.id, { extra_data: nextValue });
      }
      setRemoveExtraColumnKey(null);
      const projCount = affectedProjects.length;
      toast.success(
        `“${key}” sütunu kaldırıldı` +
          (projCount > 0 || taskCount > 0
            ? ` (${projCount} proje şeması, ${taskCount} görev verisi)`
            : "")
      );
      await fetchTasks();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Sütun kaldırılamadı.";
      toast.error(msg);
    } finally {
      setRemovingExtraColumn(false);
    }
  }, [
    removeExtraColumnKey,
    removeExtraColumnImpact,
    tasks,
    scopedProjectIdSet,
    updateProject,
    saveTask,
    updateTaskOptimistic,
    fetchTasks,
    toast,
  ]);

  const handleBulkStatusUpdate = useCallback(
    async (status: string) => {
      setBulkStatusOpen(false);
      let fail = 0;
      for (const t of selectedTasks) {
        updateTaskOptimistic(t.id, { status, last_updated_by: "anon" });
        const r = await saveTask(t.id, { status, last_updated_by: "anon" });
        if (!r.ok) fail += 1;
      }
      if (fail > 0) {
        toast.error(
          `${fail} görev güncellenemedi${fail < selectedTasks.length ? ` (${selectedTasks.length - fail} güncellendi)` : ""}`
        );
      } else if (selectedTasks.length > 0) {
        toast.success(`${selectedTasks.length} görevin durumu güncellendi`);
      }
      setRowSelection({});
    },
    [selectedTasks, saveTask, updateTaskOptimistic, toast]
  );

  if (isLoading) {
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

  if (error) {
    return (
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-600 dark:bg-red-950/50 dark:text-red-200">
        <p className="font-medium">{error}</p>
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">
          Supabase bağlantısını ve <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">tasks</code> tablosunu kontrol edin.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fetchTasks()}
          className="mt-4 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          <RotateCw className="mr-2 h-4 w-4" />
          Yeniden dene
        </Button>
      </div>
    );
  }

  const liveTableHeaderGroup = table.getHeaderGroups()[0];
  const liveTableSumPx =
    liveTableHeaderGroup?.headers.reduce((s, h) => s + Math.max(h.getSize(), 40), 0) ?? 0;
  const liveTableNeedsHorizontalScroll =
    liveTableViewportWidth > 0 && liveTableSumPx > liveTableViewportWidth + 2;

  const liveTableBody = (
    <>
      <Dialog open={advancedFilterOpen} onOpenChange={setAdvancedFilterOpen}>
        <DialogContent className="max-h-[min(92vh,40rem)] max-w-lg overflow-y-auto border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>Gelişmiş filtre</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Kuralların hepsi birlikte uygulanır (hepsi doğru olmalı — VE). Tablo yapısı değişse de aynı pencereden ek sütunları seçebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-ui-caption text-blue-900 dark:border-blue-700/60 dark:bg-blue-950/40 dark:text-blue-100">
            <strong>İpucu:</strong> Tek bir kural eklediğinizde tablo o alana göre <em>otomatik A-Z</em> sıralanır; aynı değere sahip satırlar yan yana gelir. Manuel değiştirmek için sütun başlığına tıklayabilirsiniz.
          </div>
          <div className="space-y-3 py-1">
            {advancedFilterRules.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Henüz kural yok. Aşağıdan «Kural ekle» ile koşul ekleyin.</p>
            )}
            {advancedFilterRules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Alan</span>
                    <select
                      value={rule.field}
                      onChange={(e) =>
                        setAdvancedFilterRules((prev) =>
                          prev.map((r) => (r.id === rule.id ? { ...r, field: e.target.value } : r))
                        )
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {advancedFilterFieldOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Koşul</span>
                    <select
                      value={rule.op}
                      onChange={(e) =>
                        setAdvancedFilterRules((prev) =>
                          prev.map((r) =>
                            r.id === rule.id ? { ...r, op: e.target.value as AdvancedFilterRule["op"] } : r
                          )
                        )
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {ADVANCED_FILTER_OP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className={cn(
                      "min-w-0 sm:col-span-2",
                      (rule.op === "is_empty" || rule.op === "is_not_empty") && "opacity-60"
                    )}
                  >
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Değer</span>
                    <input
                      type="text"
                      disabled={rule.op === "is_empty" || rule.op === "is_not_empty"}
                      value={rule.value}
                      onChange={(e) =>
                        setAdvancedFilterRules((prev) =>
                          prev.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r))
                        )
                      }
                      placeholder="Metin (büyük/küçük harf duyarsız)"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                  onClick={() => setAdvancedFilterRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  aria-label="Kuralı sil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setAdvancedFilterRules((prev) => [
                  ...prev,
                  {
                    id: generateAdvancedFilterRuleId(),
                    field: advancedFilterFieldOptions[0]?.id ?? "content",
                    op: "contains",
                    value: "",
                  },
                ])
              }
            >
              <Plus className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
              Kural ekle
            </Button>
            {advancedFilterRules.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => setAdvancedFilterRules([])}
              >
                Tüm kuralları sil
              </Button>
            )}
          </div>
          <DialogFooter className="sm:justify-end">
            <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700" onClick={() => setAdvancedFilterOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {canCreateTask && (
        <TaskFormDialog
          open={newTaskOpen}
          onOpenChange={setNewTaskOpen}
          initialTask={null}
          onSubmit={handleNewTask}
          submitLabel="Oluştur"
          title="Yeni görev"
          statusOptions={statusOptions}
          priorityOptions={priorityOptions}
          defaultStatus={settings.defaultTaskStatus}
          defaultPriority={settings.defaultTaskPriority}
        />
      )}
      {canEditTask && (
        <TaskFormDialog
          open={!!editTask}
          onOpenChange={(open) => !open && setEditTask(null)}
          initialTask={editTask ?? undefined}
          onSubmit={handleEditSubmit}
          submitLabel="Kaydet"
          title="Görevi düzenle"
          statusOptions={statusOptions}
          priorityOptions={priorityOptions}
          defaultStatus={settings.defaultTaskStatus}
          defaultPriority={settings.defaultTaskPriority}
        />
      )}
      {canImportCsv && (
        <CSVImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImport={handleCSVImport}
          defaultStatus={settings.defaultTaskStatus}
          defaultPriority={settings.defaultTaskPriority}
        />
      )}
      {(() => {
        if (!detailTask) return null;
        // Sıralı + filtreli (paginate ÖNCESI) görev sırası — j/k tüm sayfalar arası gezer.
        const orderedTasks = table.getSortedRowModel().rows.map((r) => r.original);
        const idx = orderedTasks.findIndex((t) => t.id === detailTask.id);
        const prevTask = idx > 0 ? orderedTasks[idx - 1] : null;
        const nextTask = idx >= 0 && idx < orderedTasks.length - 1 ? orderedTasks[idx + 1] : null;
        const positionLabel =
          idx >= 0 ? `${idx + 1} / ${orderedTasks.length}` : undefined;
        const proj = detailTask.project_id ? projectById.get(String(detailTask.project_id)) : null;
        return (
          <TaskDetailSheet
            task={detailTask}
            onClose={() => setDetailTask(null)}
            onPrev={prevTask ? () => setDetailTask(prevTask) : undefined}
            onNext={nextTask ? () => setDetailTask(nextTask) : undefined}
            canPrev={!!prevTask}
            canNext={!!nextTask}
            positionLabel={positionLabel}
            projectName={proj?.name ?? null}
            dateFormat={settings.dateFormat}
            urgentPrioritySet={urgentPrioritySetForTable}
            canEdit={canEditTask}
            onEdit={() => {
              setEditTask(detailTask);
              setDetailTask(null);
            }}
          />
        );
      })()}
      {/* Mutation feedback artık <Toaster /> üzerinden sağ-altta gösteriliyor. */}
      <div className="flex shrink-0 flex-col gap-3 px-2 py-3 sm:px-4">
        {/* Katman 1 — Hızlı filtreler (mobilde daraltılabilir) */}
        <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-2 py-2 dark:border-slate-600/80 dark:bg-slate-800/45 sm:px-3 sm:py-2.5">
          <button
            type="button"
            aria-expanded={quickFiltersOpen}
            onClick={() => setQuickFiltersOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-700/50 md:hidden"
          >
            <span>Hızlı filtreler</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400", quickFiltersOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          <div className={cn("flex flex-wrap items-center gap-2", !quickFiltersOpen && "hidden md:flex")}>
            <span className="hidden text-xs font-medium text-slate-600 dark:text-slate-400 md:mr-1 md:inline">
              Hızlı filtreler:
            </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applySmartFilter("overdue")}
            disabled={smartFilterCounts.overdue === 0}
            className={cn(
              "h-7 text-xs",
              smartFilterCounts.overdue > 0 
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
                : "opacity-50"
            )}
          >
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            Gecikmiş
            {smartFilterCounts.overdue > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-red-500">
                {smartFilterCounts.overdue}
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applySmartFilter("thisWeek")}
            disabled={smartFilterCounts.thisWeek === 0}
            className={cn(
              "h-7 text-xs",
              smartFilterCounts.thisWeek > 0
                ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
                : "opacity-50"
            )}
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Bu hafta
            {smartFilterCounts.thisWeek > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-blue-500">
                {smartFilterCounts.thisWeek}
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applySmartFilter("priority")}
            disabled={smartFilterCounts.priority === 0}
            className={cn(
              "h-7 text-xs",
              smartFilterCounts.priority > 0
                ? "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-400 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40"
                : "opacity-50"
            )}
          >
            <Flame className="mr-1.5 h-3.5 w-3.5" />
            Öncelikli
            {smartFilterCounts.priority > 0 && (
              <span className="ml-1.5 rounded-full bg-purple-600 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-purple-500">
                {smartFilterCounts.priority}
              </span>
            )}
          </Button>
          {currentUserEmail && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applySmartFilter("mine")}
              disabled={smartFilterCounts.mine === 0}
              className={cn(
                "h-7 text-xs",
                smartFilterCounts.mine > 0
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                  : "opacity-50"
              )}
            >
              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
              Bana atanan
              {smartFilterCounts.mine > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-emerald-500">
                  {smartFilterCounts.mine}
                </span>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applySmartFilter("unassigned")}
            disabled={smartFilterCounts.unassigned === 0}
            className={cn(
              "h-7 text-xs",
              smartFilterCounts.unassigned > 0
                ? "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-700/30 dark:text-slate-300 dark:hover:bg-slate-700/50"
                : "opacity-50"
            )}
          >
            <UserX className="mr-1.5 h-3.5 w-3.5" />
            Atanmamış
            {smartFilterCounts.unassigned > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-600 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-slate-500">
                {smartFilterCounts.unassigned}
              </span>
            )}
          </Button>
        </div>
        </div>

        {/* Katman 2 — Arama ve ayrıntılı filtreler */}
        <div className="rounded-lg border border-slate-200/90 bg-white px-3 py-3 dark:border-slate-600/80 dark:bg-slate-900/25 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-3">
          {/* Grup A — Arama */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              placeholder="Görev veya atanan kişide ara"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-ui-body text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Filtre satırı: Grup B (kapsam) ve Grup C (hızlı filtreler) */}
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">

          {/* Grup B — Kapsam ve gelişmiş */}
          <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex items-center gap-1.5 text-ui-caption font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
            title="Görüntüleme kapsamı"
          >
            <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Kapsam
          </span>
          <select
            value={projectLinkedFilter}
            onChange={(e) => setProjectLinkedFilter(e.target.value as "proje" | "tümü")}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            title="Canlı tabloda varsayılan olarak sadece projeye bağlı görevler gösterilir"
          >
            <option value="proje">Sadece proje görevleri</option>
            <option value="tümü">Tüm görevler</option>
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-[38px] text-sm shrink-0",
              activeAdvancedFilterRuleCount > 0
                ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200"
                : "text-slate-700 dark:text-slate-300"
            )}
            onClick={() => setAdvancedFilterOpen(true)}
            title="Tüm alanlarda metin koşulları (VE ile birleşir)"
          >
            <ListFilter className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
            Gelişmiş filtre
            {activeAdvancedFilterRuleCount > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-blue-500">
                {activeAdvancedFilterRuleCount}
              </span>
            )}
          </Button>
          </div>
          {/* /Grup B */}

          {/* Grup C — Hızlı filtreler */}
          <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex items-center gap-1.5 text-ui-caption font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
            title="Hızlı filtreler"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Hızlı filtre
          </span>
          {/* Çoklu Durum Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                Array.isArray(statusFilter) && statusFilter.length > 0
                  ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <ListTodo className="h-4 w-4" />
              {!Array.isArray(statusFilter) || statusFilter.length === 0 ? "Durum" : `Durum (${statusFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {statusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setStatusDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Durum seç</span>
                    {Array.isArray(statusFilter) && statusFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {statusOptions.map((status) => (
                    <label
                      key={status}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Array.isArray(statusFilter) && statusFilter.includes(status)}
                        onChange={(e) => {
                          const current = Array.isArray(statusFilter) ? statusFilter : [];
                          if (e.target.checked) {
                            setStatusFilter([...current, status]);
                          } else {
                            setStatusFilter(current.filter((s) => s !== status));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={cn(
                        "flex items-center gap-1.5",
                        /yapılacak|yapilacak|todo/i.test(status) && "text-slate-600 dark:text-slate-300",
                        /devam|sürüyor|progress/i.test(status) && "text-blue-600 dark:text-blue-400",
                        /tamamlandı|tamamlandi|done|completed/i.test(status) && "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {/yapılacak|yapilacak|todo/i.test(status) && <Circle className="h-3.5 w-3.5" />}
                        {/devam|sürüyor|progress/i.test(status) && <Loader2 className="h-3.5 w-3.5" />}
                        {/tamamlandı|tamamlandi|done|completed/i.test(status) && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {status}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Çoklu Atanan Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                Array.isArray(assigneeFilter) && assigneeFilter.length > 0
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <User className="h-4 w-4" />
              {!Array.isArray(assigneeFilter) || assigneeFilter.length === 0 ? "Atanan" : `Atanan (${assigneeFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {assigneeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAssigneeDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-[300px] min-w-[220px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Kişi seç</span>
                    {Array.isArray(assigneeFilter) && assigneeFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAssigneeFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {/* Atanmamış seçeneği */}
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={Array.isArray(assigneeFilter) && assigneeFilter.includes("__unassigned__")}
                      onChange={(e) => {
                        const current = Array.isArray(assigneeFilter) ? assigneeFilter : [];
                        if (e.target.checked) {
                          setAssigneeFilter([...current, "__unassigned__"]);
                        } else {
                          setAssigneeFilter(current.filter((a) => a !== "__unassigned__"));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <UserX className="h-3.5 w-3.5" />
                      Atanmamış
                    </span>
                  </label>
                  {/* Kişiler */}
                  {assigneeFilterOptions.map((assignee) => (
                    <label
                      key={assignee}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Array.isArray(assigneeFilter) && assigneeFilter.includes(assignee)}
                        onChange={(e) => {
                          const current = Array.isArray(assigneeFilter) ? assigneeFilter : [];
                          if (e.target.checked) {
                            setAssigneeFilter([...current, assignee]);
                          } else {
                            setAssigneeFilter(current.filter((a) => a !== assignee));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <User className="h-3.5 w-3.5" />
                        {assignee.length > 25 ? assignee.slice(0, 25) + "..." : assignee}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Çoklu Proje Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                Array.isArray(projectFilter) && projectFilter.length > 0
                  ? "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-900/30 dark:text-sky-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
              title="Görevleri ait oldukları projeye göre filtrele"
            >
              <FolderKanban className="h-4 w-4" />
              {!Array.isArray(projectFilter) || projectFilter.length === 0 ? "Proje" : `Proje (${projectFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {projectDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProjectDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-[320px] min-w-[240px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Proje seç</span>
                    {Array.isArray(projectFilter) && projectFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProjectFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {projectFilterOptions.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                      Görüntülenebilir proje yok.
                    </div>
                  ) : (
                    projectFilterOptions.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={Array.isArray(projectFilter) && projectFilter.includes(p.id)}
                          onChange={(e) => {
                            const current = Array.isArray(projectFilter) ? projectFilter : [];
                            if (e.target.checked) {
                              setProjectFilter([...current, p.id]);
                            } else {
                              setProjectFilter(current.filter((id) => id !== p.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <FolderKanban className="h-3.5 w-3.5" />
                          {p.name.length > 28 ? p.name.slice(0, 28) + "..." : p.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <select
            value={datePreset}
            onChange={(e) => applyDatePreset(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="custom">📅 Tarih aralığı</option>
            <optgroup label="Gelecek">
              <option value="today">🔵 Bugün</option>
              <option value="tomorrow">➡️ Yarın</option>
              <option value="thisWeek">📆 Bu hafta (7 gün)</option>
              <option value="nextWeek">⏭️ Gelecek hafta</option>
              <option value="thisMonth">📊 Bu ay</option>
              <option value="nextMonth">⏩ Gelecek ay</option>
            </optgroup>
            <optgroup label="Geçmiş">
              <option value="last7days">⏪ Son 7 gün</option>
              <option value="last30days">⏮️ Son 30 gün</option>
            </optgroup>
          </select>
          {datePreset === "custom" && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePreset("custom");
                }}
                placeholder="Başlangıç"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDatePreset("custom");
                }}
                placeholder="Bitiş"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            </>
          )}
          {datePreset !== "custom" && (dateFrom || dateTo) && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {dateFrom} → {dateTo}
            </span>
          )}
          </div>
          {/* /Grup C */}

          </div>
          {/* /Filtre satırı */}
        </div>
        </div>
        {/* Filtre Özeti Çubuğu - Aktif Filtre Badge'leri */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2 dark:border-slate-600/90 dark:bg-slate-800/55">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Aktif filtreler:
            </span>
            
            {/* Arama Filtresi */}
            {globalSearch.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                <Search className="h-3 w-3" />
                &quot;{globalSearch.length > 15 ? globalSearch.slice(0, 15) + "..." : globalSearch}&quot;
                <button
                  type="button"
                  onClick={() => setGlobalSearch("")}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-violet-200 dark:hover:bg-violet-800"
                  title="Aramayı temizle"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Durum Filtreleri - Çoklu */}
            {(Array.isArray(statusFilter) ? statusFilter : []).map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              >
                {status === "Yapılacak" && <Circle className="h-3 w-3" />}
                {status === "Devam ediyor" && <Loader2 className="h-3 w-3" />}
                {status === "Tamamlandı" && <CheckCircle2 className="h-3 w-3" />}
                {status}
                <button
                  type="button"
                  onClick={() => setStatusFilter((Array.isArray(statusFilter) ? statusFilter : []).filter((s) => s !== status))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800"
                  title={`"${status}" filtresini kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* Atanan Filtreleri - Çoklu */}
            {(Array.isArray(assigneeFilter) ? assigneeFilter : []).map((assignee) => (
              <span
                key={assignee}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                {assignee === "__unassigned__" ? <UserX className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {assignee === "__unassigned__" ? "Atanmamış" : (assignee.length > 15 ? assignee.slice(0, 15) + "..." : assignee)}
                <button
                  type="button"
                  onClick={() => setAssigneeFilter((Array.isArray(assigneeFilter) ? assigneeFilter : []).filter((a) => a !== assignee))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800"
                  title={`"${assignee === "__unassigned__" ? "Atanmamış" : assignee}" filtresini kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* Proje Filtreleri - Çoklu */}
            {(Array.isArray(projectFilter) ? projectFilter : []).map((pid) => {
              const p = projectById.get(pid);
              const name = (p?.name ?? "").trim() || "(adsız proje)";
              return (
                <span
                  key={pid}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                >
                  <FolderKanban className="h-3 w-3" />
                  {name.length > 18 ? name.slice(0, 18) + "..." : name}
                  <button
                    type="button"
                    onClick={() => setProjectFilter((Array.isArray(projectFilter) ? projectFilter : []).filter((id) => id !== pid))}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-sky-200 dark:hover:bg-sky-800"
                    title={`"${name}" projesini filtre dışı bırak`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}

            {/* Tarih Filtresi */}
            {(dateFrom || dateTo || datePreset !== "custom") && (
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                <Calendar className="h-3 w-3" />
                {datePreset === "today" && "Bugün"}
                {datePreset === "tomorrow" && "Yarın"}
                {datePreset === "thisWeek" && "Bu hafta"}
                {datePreset === "nextWeek" && "Gelecek hafta"}
                {datePreset === "thisMonth" && "Bu ay"}
                {datePreset === "nextMonth" && "Gelecek ay"}
                {datePreset === "last7days" && "Son 7 gün"}
                {datePreset === "last30days" && "Son 30 gün"}
                {datePreset === "custom" && dateFrom && dateTo && `${dateFrom} → ${dateTo}`}
                {datePreset === "custom" && dateFrom && !dateTo && `${dateFrom}'den itibaren`}
                {datePreset === "custom" && !dateFrom && dateTo && `${dateTo}'e kadar`}
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setDatePreset("custom");
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800"
                  title="Tarih filtresini kaldır"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Gelişmiş filtre özeti */}
            {activeAdvancedFilterRuleCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-200">
                <ListFilter className="h-3 w-3 shrink-0" aria-hidden />
                Gelişmiş ({activeAdvancedFilterRuleCount} kural)
                <button
                  type="button"
                  onClick={() => setAdvancedFilterRules([])}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                  title="Gelişmiş kuralları kaldır"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Sütun Filtreleri - Excel tarzı */}
            {Object.entries(columnFilters).filter(([, values]) => values.length > 0).map(([colId, values]) => {
              const colLabel = colId.startsWith("extra:") 
                ? colId.replace("extra:", "") 
                : colId === "content" ? "Görev" 
                : colId === "status" ? "Durum" 
                : colId === "assignee" ? "Atanan" 
                : colId === "priority" ? "Öncelik"
                : colId === "due_date" ? "Bitiş"
                : colId;
              const displayValues = values.map(v => 
                v === "__empty__" ? "(Boş)" : v === "__filled__" ? "(Dolu)" : v
              ).join(", ");
              return (
                <span
                  key={colId}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800 dark:border-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  <span className="font-semibold">{colLabel}:</span>
                  <span className="max-w-[150px] truncate" title={displayValues}>
                    {displayValues.length > 25 ? displayValues.slice(0, 25) + "..." : displayValues}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter(colId)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-cyan-200 dark:hover:bg-cyan-800"
                    title={`"${colLabel}" filtresini kaldır`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}

            {/* Ayırıcı ve Tümünü Temizle */}
            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
              title="Tüm filtreleri temizle"
            >
              <X className="h-3.5 w-3.5" />
              Tümünü temizle
            </button>
          </div>
        )}
      </div>
      <div className="shrink-0 rounded-lg border border-slate-200/70 bg-slate-50/50 px-2 py-2 dark:border-slate-700/80 dark:bg-slate-800/35 sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Sütunları sürükleyerek sıralayın, kenardan genişletin; menü ile sabitleyin.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {canAutoSizeColumns && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoSizeColumns}
                className="text-slate-700 dark:text-slate-300"
                title="Sütunları görünür alana ve içeriğe göre orantılı ölçeklendir"
              >
                <Shrink className="mr-2 h-4 w-4" />
                İçeriğe göre ölçeklendir
              </Button>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              <label htmlFor="live-table-density" className="sr-only">
                Görünüm yoğunluğu
              </label>
              <Rows3 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
              <select
                id="live-table-density"
                value={tableDensity}
                onChange={(e) => updateSetting("liveTableDensity", e.target.value as LiveTableDensity)}
                title="Satır aralığı ve yazı boyutu"
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="compact">Yoğun</option>
                <option value="normal">Normal</option>
                <option value="comfortable">Büyük</option>
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFullWidth((p) => !p)}
              className="text-slate-700 dark:text-slate-300"
            >
              {isFullWidth ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
              {isFullWidth ? "Daralt" : "Tablo genişlet"}
            </Button>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "sticky z-20 -mx-2 flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white/90 px-2 py-3 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90 sm:-mx-4 sm:px-4 sm:flex-row sm:items-center sm:justify-between supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/85",
          isFullWidth ? "top-0" : "top-14"
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <TaskStats tasks={tasks} />
          {realtimeConnection === "live" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" title="Realtime kanalı bağlı">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
              Canlı
            </span>
          )}
          {realtimeConnection === "connecting" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="Realtime aboneliği bekleniyor">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-600" aria-hidden />
              Bağlanıyor…
            </span>
          )}
          {realtimeConnection === "disconnected" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" title="Anlık güncelleme doğrulanamadı veya kapalı; sekmeyi yenileyebilir veya Publication ayarını kontrol edebilirsiniz">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
              Anlık senkron yok
            </span>
          )}
          {onlineUsers.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only sm:not-sr-only">Şu an çevrimiçi:</span>
              <OnlineUsersPanel
                onlineUsers={onlineUsers}
                editorsByRowId={editorsByRowId}
                currentUserEmail={currentUserEmail}
                tasks={tasks}
              />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <SavedViewsControl
            getCurrentConfig={getCurrentViewConfig}
            onApplyConfig={applyViewConfig}
            isAdmin={isAdmin}
            userId={user?.id ?? null}
          />
          {canManageColumns && (
            <>
            <Dialog open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-slate-700 dark:text-slate-300"
                onClick={openColumnPicker}
              >
                <Columns3 className="mr-2 h-4 w-4" />
                Kolonları göster
              </Button>
              <DialogContent
                className="flex max-h-[min(90dvh,36rem)] max-w-lg flex-col gap-0 overflow-hidden border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:max-w-lg"
                showClose
              >
                <div className="shrink-0 space-y-3 border-b border-slate-200 px-5 pb-3 pt-5 dark:border-slate-700">
                  <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="text-base">Sütun görünürlüğü</DialogTitle>
                    <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
                      Bir rozete tıkla; sütun anında gösterilir veya gizlenir. Dolu = görünür, soluk = gizli.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const ids = table
                          .getAllLeafColumns()
                          .filter((c) => c.getCanHide())
                          .map((c) => c.id);
                        setManyColumnVisibilityInstant(ids, true);
                      }}
                    >
                      Tümünü göster
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const ids = table
                          .getAllLeafColumns()
                          .filter((c) => c.getCanHide())
                          .map((c) => c.id);
                        setManyColumnVisibilityInstant(ids, false);
                      }}
                    >
                      Hepsini gizle
                    </Button>
                    <div className="relative ml-auto flex-1 min-w-[140px]">
                      <Search
                        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                        aria-hidden
                      />
                      <input
                        type="search"
                        autoComplete="off"
                        placeholder="Sütun ara…"
                        value={columnPickerSearch}
                        onChange={(e) => setColumnPickerSearch(e.target.value)}
                        className="h-7 w-full rounded-md border border-slate-200 bg-white py-1 pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  {(() => {
                    const q = columnPickerSearch.trim().toLowerCase();
                    const allCols = table.getAllLeafColumns();
                    const matches = allCols.filter((col) => {
                      const label =
                        COLUMN_VISIBILITY_LABELS[col.id] ??
                        (String(col.id).startsWith("extra:")
                          ? String(col.id).replace(/^extra:/, "")
                          : col.id);
                      return q === "" || label.toLowerCase().includes(q);
                    });
                    const baseCols = matches.filter((c) => !c.id.startsWith("extra:"));
                    const extraCols = matches.filter((c) => c.id.startsWith("extra:"));

                    const renderChip = (col: (typeof matches)[number]) => {
                      const label =
                        COLUMN_VISIBILITY_LABELS[col.id] ??
                        (String(col.id).startsWith("extra:")
                          ? String(col.id).replace(/^extra:/, "")
                          : col.id);
                      const canHide = col.getCanHide();
                      const visible = col.getIsVisible();
                      return (
                        <button
                          key={col.id}
                          type="button"
                          disabled={!canHide}
                          onClick={() => {
                            if (!canHide) return;
                            toggleColumnVisibilityInstant(col.id, !visible);
                          }}
                          aria-pressed={visible}
                          title={
                            !canHide
                              ? "Bu sütun zorunlu — gizlenemez"
                              : visible
                                ? "Tıkla: gizle"
                                : "Tıkla: göster"
                          }
                          className={cn(
                            "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                            visible
                              ? "border-blue-300 bg-blue-100 text-blue-800 shadow-sm hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200",
                            !canHide && "cursor-not-allowed opacity-70 hover:bg-white dark:hover:bg-slate-800"
                          )}
                        >
                          {visible ? (
                            <Check className="h-3 w-3 shrink-0" aria-hidden />
                          ) : (
                            <Circle className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                          )}
                          <span className="truncate max-w-[160px]">{label}</span>
                          {!canHide && (
                            <span className="ml-0.5 rounded-sm bg-slate-200 px-1 text-[9px] uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              zorunlu
                            </span>
                          )}
                        </button>
                      );
                    };

                    if (matches.length === 0) {
                      return (
                        <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                          “{columnPickerSearch}” için sütun bulunamadı
                        </div>
                      );
                    }

                    return (
                      <>
                        {baseCols.length > 0 && (
                          <section>
                            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Sabit sütunlar ({baseCols.filter((c) => c.getIsVisible()).length}/{baseCols.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">{baseCols.map(renderChip)}</div>
                          </section>
                        )}
                        {extraCols.length > 0 && (
                          <section>
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Ek sütunlar ({extraCols.filter((c) => c.getIsVisible()).length}/{extraCols.length})
                              </h4>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="text-[10px] font-medium uppercase tracking-wide text-blue-600 hover:underline dark:text-blue-400"
                                  onClick={() =>
                                    setManyColumnVisibilityInstant(
                                      extraCols.map((c) => c.id),
                                      true
                                    )
                                  }
                                >
                                  Tümü
                                </button>
                                <span className="text-[10px] text-slate-400">·</span>
                                <button
                                  type="button"
                                  className="text-[10px] font-medium uppercase tracking-wide text-slate-500 hover:underline dark:text-slate-400"
                                  onClick={() =>
                                    setManyColumnVisibilityInstant(
                                      extraCols.map((c) => c.id),
                                      false
                                    )
                                  }
                                >
                                  Hiçbiri
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">{extraCols.map(renderChip)}</div>
                          </section>
                        )}
                      </>
                    );
                  })()}
                </div>
                <DialogFooter className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex w-full items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {table.getAllLeafColumns().filter((c) => c.getIsVisible()).length} /{" "}
                      {table.getAllLeafColumns().length} sütun görünür
                    </span>
                    <Button type="button" size="sm" onClick={() => setColumnPickerOpen(false)}>
                      Kapat
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-slate-700 dark:text-slate-300"
              onClick={resetColumnOrderToDefault}
              title="Sütun sırasını ve sabitlemeleri varsayılan düzene alır (görünürlük / genişlik değişmez)"
            >
              <RotateCcw className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Varsayılan sıra</span>
              <span className="sm:hidden">Sıra</span>
            </Button>
            </>
          )}
          {canImportCsv && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="text-slate-700 dark:text-slate-300"
            >
              <Upload className="mr-2 h-4 w-4" />
              CSV içe aktar
            </Button>
          )}
          {canExportCsv && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="text-slate-700 dark:text-slate-300">
                <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                Dışa aktar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {isAdmin && (
                <>
                  <div
                    className={cn(
                      "flex items-start gap-2 border-b px-2 py-2",
                      exportUnmaskSensitive
                        ? "border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30"
                        : "border-slate-100 dark:border-slate-700"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      id="export-unmask-toggle"
                      type="checkbox"
                      checked={exportUnmaskSensitive}
                      onChange={(e) => setExportUnmaskSensitive(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-slate-500"
                    />
                    <label
                      htmlFor="export-unmask-toggle"
                      className="cursor-pointer text-xs leading-snug text-slate-700 dark:text-slate-200"
                    >
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        🔓 Hassas verileri AÇIK indir
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                        TCKN/sicil/personel no maskeli yerine ham yazılır.
                        <strong className="ml-0.5 text-amber-700 dark:text-amber-400">Süperadmin yetkisi.</strong>
                      </span>
                    </label>
                  </div>
                </>
              )}
              <DropdownMenuItem onClick={() => handleExportCSV("current")}>CSV indir (mevcut görünüm)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel("current")}>Excel indir (mevcut görünüm)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportPDF("current")}>PDF indir (mevcut görünüm)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportCSV("all")}>CSV indir (tüm veri)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel("all")}>Excel indir (tüm veri)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportPDF("all")}>PDF indir (tüm veri)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          <RestrictedButton
            permission="liveTable.createTask"
            type="button"
            size="sm"
            onClick={() => setNewTaskOpen(true)}
            aria-label="Yeni görev"
            className="bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus-visible:ring-blue-400"
          >
            <PlusCircle className="h-4 w-4 shrink-0 sm:mr-2" aria-hidden />
            <span className="hidden sm:inline">Yeni görev</span>
          </RestrictedButton>
        </div>
      </div>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50 shrink-0">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            <strong>{selectedIds.length}</strong> görev seçildi
          </span>
          <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Durumu güncelle
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {statusOptions.map((s) => (
                <DropdownMenuItem key={s} onClick={() => handleBulkStatusUpdate(s)}>
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {canBulkDelete && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => setBulkDeleteConfirmOpen(true)}
          >
            Seçilenleri sil
          </Button>
          )}
        </div>
      )}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md" showClose>
          <DialogHeader>
            <DialogTitle>Seçilen görevleri sil</DialogTitle>
            <DialogDescription>
              <strong>{selectedIds.length}</strong> görev kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setBulkDeleteConfirmOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void executeBulkDelete()}
              disabled={selectedIds.length === 0}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removeExtraColumnKey != null}
        onOpenChange={(open) => {
          if (!open && !removingExtraColumn) setRemoveExtraColumnKey(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showClose>
          <DialogHeader>
            <DialogTitle>Sütunu kaldır: “{removeExtraColumnKey}”</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                {removeExtraColumnImpact.projects.length === 0 && removeExtraColumnImpact.taskCount === 0 ? (
                  <p>Bu sütun aktif kapsamda görünmüyor; kaldıracak bir şey yok.</p>
                ) : (
                  <>
                    <p>
                      Aşağıdaki değişiklikler uygulanacak. <strong>Bu işlem geri alınamaz.</strong>
                    </p>
                    <ul className="ml-4 list-disc space-y-1">
                      <li>
                        <strong>{removeExtraColumnImpact.projects.length}</strong> projenin şemasından
                        (“Canlı tablo ek sütunları”) kaldırılacak.
                      </li>
                      <li>
                        <strong>{removeExtraColumnImpact.taskCount}</strong> görevdeki bu alanın verisi
                        silinecek.
                      </li>
                    </ul>
                    {removeExtraColumnImpact.projects.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Etkilenen projeler:{" "}
                        {removeExtraColumnImpact.projects
                          .slice(0, 3)
                          .map((p) => p.name)
                          .join(", ")}
                        {removeExtraColumnImpact.projects.length > 3
                          ? ` +${removeExtraColumnImpact.projects.length - 3} daha`
                          : ""}
                      </p>
                    )}
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveExtraColumnKey(null)}
              disabled={removingExtraColumn}
            >
              İptal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void executeRemoveExtraColumn()}
              disabled={
                removingExtraColumn ||
                (removeExtraColumnImpact.projects.length === 0 &&
                  removeExtraColumnImpact.taskCount === 0)
              }
            >
              {removingExtraColumn ? "Kaldırılıyor…" : "Sütunu kaldır"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TooltipProvider delayDuration={200} skipDelayDuration={120}>
      {/* MOBİL — kart listesi (md altı). Boşsa hiç render etme; EmptyState aşağıda zaten gösterilir. */}
      {table.getRowModel().rows.length > 0 && (
      <div
        className={cn(
          "flex-1 min-h-0 w-full overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-900/30 md:hidden",
          !isFullWidth && "max-h-[calc(100dvh-22rem)] sm:max-h-[calc(100dvh-20rem)]"
        )}
      >
        <ul className="flex flex-col gap-2" aria-label="Görev listesi">
            {table.getRowModel().rows.map((row) => {
              const t = row.original;
              const pName = t.project_id ? projectById.get(String(t.project_id))?.name ?? null : null;
              return (
                <li key={row.id}>
                  <TaskCardMobile
                    task={t}
                    projectId={t.project_id ?? null}
                    projectName={pName}
                    extraKeys={extraDataKeys}
                    selected={row.getIsSelected()}
                    onToggleSelect={() => row.toggleSelected(!row.getIsSelected())}
                    dateFormat={settings.dateFormat}
                    urgentPrioritySet={urgentPrioritySetForTable}
                    now={now}
                    canEdit={canEditTask}
                    canDelete={canDeleteTask}
                    canCreate={canCreateTask}
                    onEdit={() => setEditTask(t)}
                    onCopy={() => handleCopyTask(t)}
                    onDelete={() => handleDeleteTask(t.id)}
                    onOpenDetail={() => setDetailTask(t)}
                    isDeleting={deletingIds.has(t.id)}
                  />
                </li>
              );
            })}
          </ul>
      </div>
      )}
      {/* MASAÜSTÜ — tablo (md ve üstü) */}
      <div
        ref={liveTableScrollRef}
        className={cn(
          "hidden md:flex flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-auto rounded-lg border border-slate-200 bg-white isolate [overflow-anchor:none] dark:border-slate-700 dark:bg-slate-800",
          /* Sayfa düzeni flex’te bazen yükseklik sınırlanmıyor; viewport tavanı iç scroll + thead sticky’yi garanti eder (genişlet modunda portal zaten sınırlı). */
          !isFullWidth &&
            "md:max-h-[calc(100dvh-20rem)] lg:max-h-[calc(100dvh-18rem)] xl:max-h-[calc(100dvh-16rem)]",
          isFullWidth && "min-h-0 max-h-none flex-1",
          tasks.length > 0 && "min-h-[200px]"
        )}
      >
        <table
          className={cn("border-separate border-spacing-0 min-w-full", dui.table)}
          aria-describedby="live-table-caption"
          style={{
            tableLayout: "fixed",
            width:
              liveTableSumPx > 0 ? (liveTableNeedsHorizontalScroll ? `${liveTableSumPx}px` : "100%") : "100%",
            minWidth:
              liveTableSumPx > 0 ? (liveTableNeedsHorizontalScroll ? `${liveTableSumPx}px` : "100%") : "100%",
          }}
        >
          <caption id="live-table-caption" className="sr-only">
            Canlı görev tablosu. Sütun başlıklarını sürükleyerek sırayı değiştirebilir, kenardan genişletebilirsiniz. Sütun menüsü ile sabitleme ve sıfırlama yapılabilir.
          </caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => {
              const headers = headerGroup.headers;
              return (
              <tr key={headerGroup.id}>
                {headers.map((header) => {
                  const col = header.column;
                  const isPinnedLeft = col.getIsPinned() === "left";
                  const isPinnedRight = col.getIsPinned() === "right";
                  const resizeHandler = typeof header.getResizeHandler === "function" ? header.getResizeHandler() : undefined;
                  const wPx = Math.max(header.getSize(), 40);
                  return (
                    <th
                      key={header.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={handleDragEnd}
                      aria-sort={
                        col.getCanSort?.() && col.getIsSorted() === "asc"
                          ? "ascending"
                          : col.getCanSort?.() && col.getIsSorted() === "desc"
                            ? "descending"
                            : col.getCanSort?.()
                              ? "none"
                              : undefined
                      }
                      className={cn(
                        "relative sticky top-0 z-[15] select-none border-r border-b-2 border-slate-200 bg-slate-100 text-left font-medium text-slate-700 shadow-[0_2px_6px_-3px_rgba(15,23,42,0.12)] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:shadow-[0_2px_6px_-3px_rgba(0,0,0,0.35)]",
                        dui.th,
                        draggedColumnId === col.id && "opacity-50",
                        isPinnedLeft &&
                          "left-0 z-[25] bg-slate-100 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08),0_2px_6px_-3px_rgba(15,23,42,0.12)] dark:bg-slate-700 dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3),0_2px_6px_-3px_rgba(0,0,0,0.35)]",
                        isPinnedRight &&
                          "right-0 z-[25] bg-slate-100 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08),0_2px_6px_-3px_rgba(15,23,42,0.12)] dark:bg-slate-700 dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3),0_2px_6px_-3px_rgba(0,0,0,0.35)]"
                      )}
                      style={{
                        width: wPx,
                        minWidth: wPx,
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <GripVertical className={cn(dui.grip, "shrink-0 cursor-grab text-slate-400 active:cursor-grabbing")} aria-hidden />
                        {col.getCanSort?.() ? (
                          <button
                            type="button"
                            onClick={col.getToggleSortingHandler()}
                            className="flex min-w-0 flex-1 items-center gap-1 truncate text-left hover:text-slate-900 dark:hover:text-slate-100"
                          >
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {col.getIsSorted() === "asc" ? (
                              <ArrowUp className={cn(dui.sortIcon, "shrink-0 text-blue-600")} />
                            ) : col.getIsSorted() === "desc" ? (
                              <ArrowDown className={cn(dui.sortIcon, "shrink-0 text-blue-600")} />
                            ) : (
                              <ArrowUpDown className={cn(dui.sortIcon, "shrink-0 text-slate-400")} />
                            )}
                          </button>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-left">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        )}
                        {/* Excel tarzı sütun filtresi */}
                        {col.id !== "actions" && col.id !== "select" && (
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                dui.colFilterBtn,
                                "shrink-0",
                                columnFilters[col.id]?.length > 0
                                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                                  : "text-slate-400 hover:text-slate-600"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setColumnFilterOpen(columnFilterOpen === col.id ? null : col.id);
                                setColumnFilterSearch("");
                              }}
                              aria-label="Sütun filtresi"
                              title={columnFilters[col.id]?.length > 0 ? `${columnFilters[col.id].length} filtre aktif` : "Filtrele"}
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              {columnFilters[col.id]?.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                                  {columnFilters[col.id].length}
                                </span>
                              )}
                            </Button>
                            {columnFilterOpen === col.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setColumnFilterOpen(null)} />
                                <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] max-h-[350px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                                  <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-2">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                      </span>
                                      {columnFilters[col.id]?.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => clearColumnFilter(col.id)}
                                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                          Temizle
                                        </button>
                                      )}
                                    </div>
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                      <input
                                        type="text"
                                        placeholder="Ara..."
                                        value={columnFilterSearch}
                                        onChange={(e) => setColumnFilterSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full rounded border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-[250px] overflow-y-auto p-2">
                                    {/* Özel seçenekler */}
                                    <div className="mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={columnFilters[col.id]?.includes("__empty__") || false}
                                          onChange={() => toggleColumnFilterValue(col.id, "__empty__")}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                        />
                                        <span className="text-slate-500 dark:text-slate-400 italic">(Boş)</span>
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={columnFilters[col.id]?.includes("__filled__") || false}
                                          onChange={() => toggleColumnFilterValue(col.id, "__filled__")}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                        />
                                        <span className="text-slate-500 dark:text-slate-400 italic">(Dolu)</span>
                                      </label>
                                    </div>
                                    {/* Benzersiz değerler */}
                                    {getUniqueValuesForColumn(col.id)
                                      .filter((v) => !columnFilterSearch || v.toLowerCase().includes(columnFilterSearch.toLowerCase()))
                                      .map((value) => (
                                        <label
                                          key={value}
                                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={columnFilters[col.id]?.includes(value) || false}
                                            onChange={() => toggleColumnFilterValue(col.id, value)}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                          />
                                          <span className="text-slate-700 dark:text-slate-300 truncate" title={value}>
                                            {value.length > 30 ? value.slice(0, 30) + "..." : value}
                                          </span>
                                        </label>
                                      ))}
                                    {getUniqueValuesForColumn(col.id).filter((v) => !columnFilterSearch || v.toLowerCase().includes(columnFilterSearch.toLowerCase())).length === 0 && (
                                      <div className="px-2 py-3 text-xs text-slate-400 text-center">
                                        {columnFilterSearch ? "Sonuç bulunamadı" : "Değer yok"}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className={cn(dui.colMenuBtn, "shrink-0 text-slate-500")} aria-label="Sütun menüsü">
                              <MoreVertical className={cn(dui.sortIcon)} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "left")}>Sol tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "right")}>Sağ tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "unpin")}>Sabitlemeyi kaldır</DropdownMenuItem>
                            {col.id.startsWith("extra:") && canEditProject && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                  onClick={() => setRemoveExtraColumnKey(col.id.slice("extra:".length))}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                                  Bu sütunu projeden kaldır…
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {col.getCanResize?.() && resizeHandler && (
                        <div
                          onMouseDown={resizeHandler}
                          onTouchStart={resizeHandler}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none",
                            "hover:bg-blue-400 hover:w-0.5 hover:right-[-1px]",
                            col.getIsResizing?.() && "bg-blue-500 w-0.5"
                          )}
                          title="Genişliği değiştirmek için sürükleyin"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
              );
            })}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const rowEditors = editorsByRowId.get(row.original.id) ?? [];
              const isEditedByOthers = rowEditors.length > 0;
              const isSelected = row.getIsSelected();
              const isCompleted = isTaskCompleted(row.original);
              const urgency = getDueUrgency(row.original);
              const showUrgency = !isCompleted && !isEditedByOthers && !isSelected;
              const visibleCells = row.getVisibleCells();
              let rowTooltipBody: ReactNode | undefined;
              if (isEditedByOthers) {
                if (rowEditors.length === 1) {
                  const { primary, emailLine } = presenceEditorLines(rowEditors[0]);
                  rowTooltipBody = (
                    <>
                      <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                        Bu satırda düzenleme
                      </span>
                      <span className="mt-1.5 block text-base font-semibold leading-snug">{primary}</span>
                      {emailLine && (
                        <span className="mt-1 block break-all text-xs font-medium leading-snug opacity-90">
                          {emailLine}
                        </span>
                      )}
                    </>
                  );
                } else {
                  rowTooltipBody = (
                    <>
                      <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                        Bu satırda düzenleme ({rowEditors.length})
                      </span>
                      <ul className="mt-2 max-h-40 list-none space-y-2 overflow-y-auto text-left text-sm font-semibold">
                        {rowEditors.map((e, i) => {
                          const { primary, emailLine } = presenceEditorLines(e);
                          return (
                            <li
                              key={i}
                              className="border-b border-violet-200/60 pb-2 last:border-0 last:pb-0 dark:border-violet-600/50"
                            >
                              <span className="block">{primary}</span>
                              {emailLine && (
                                <span className="mt-0.5 block break-all text-xs font-normal opacity-90">
                                  {emailLine}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  );
                }
              }
              const rowLockedByOthersBg = "bg-violet-50/65 dark:bg-violet-950/35";
              const completedCellBg = "bg-emerald-50/80 dark:bg-emerald-950/25";
              const pinnedDefaultBg = "bg-white dark:bg-slate-800";
              const pinnedBg = isEditedByOthers
                ? rowLockedByOthersBg
                : isCompleted
                  ? completedCellBg
                  : pinnedDefaultBg;
              const isRecentlyUpdated = recentlyUpdatedIds.has(row.original.id);
              /** Satır hover'ında "Son güncelleyen: X · Y önce" göstergesi (native tooltip) */
              const lastEditorTitle = (() => {
                const who = row.original.last_updated_by;
                const when = row.original.updated_at;
                if (!who && !when) return undefined;
                const whoLabel = who ? `Son güncelleyen: ${who}` : "";
                let whenLabel = "";
                if (when) {
                  try {
                    whenLabel = `${getRelativeTime(new Date(when))}`;
                  } catch {
                    whenLabel = "";
                  }
                }
                return [whoLabel, whenLabel].filter(Boolean).join(" · ");
              })();
              const rowClassName = cn(
                "border-b border-slate-100 transition-colors dark:border-slate-700",
                "cursor-pointer",
                // Realtime ile az önce gelen UPDATE: 3 sn'lik amber flash
                isRecentlyUpdated &&
                  "animate-[pulse_1.5s_ease-in-out_2] bg-amber-50/70 dark:bg-amber-950/30",
                !isEditedByOthers && "hover:bg-slate-50/50 dark:hover:bg-slate-700/30",
                !isEditedByOthers &&
                  isCompleted &&
                  "bg-emerald-50/80 dark:bg-emerald-950/25 hover:bg-emerald-50/90 dark:hover:bg-emerald-950/35",
                !isEditedByOthers &&
                  isCompleted &&
                  !isSelected &&
                  "border-l-4 border-l-emerald-400 dark:border-l-emerald-500",
                isSelected && !isCompleted && !isEditedByOthers && "bg-blue-50/60 dark:bg-blue-900/20 hover:bg-blue-50/80 dark:hover:bg-blue-900/30",
                isSelected && !isCompleted && !isEditedByOthers && "border-l-4 border-l-blue-500 dark:border-l-blue-400",
                isSelected &&
                  isCompleted &&
                  !isEditedByOthers &&
                  "bg-emerald-50/85 ring-2 ring-inset ring-blue-400/50 dark:bg-emerald-950/30 dark:ring-blue-500/45",
                isEditedByOthers &&
                  "relative z-[1] cursor-default border-l-4 border-l-violet-500 bg-violet-50/65 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.14)] dark:border-l-violet-400 dark:bg-violet-950/35 dark:shadow-[inset_0_0_0_1px_rgba(167,139,250,0.2)] hover:bg-violet-50/90 dark:hover:bg-violet-950/45",
                showUrgency && URGENCY_ROW_CLASS[urgency],
                showUrgency && URGENCY_LEFT_BORDER_CLASS[urgency]
              );
              const rowTooltipClass =
                "z-[400] max-w-[min(22rem,calc(100vw-2rem))] border-2 border-violet-500 bg-violet-100 px-3 py-2.5 text-sm font-semibold leading-snug text-violet-950 shadow-[0_8px_32px_rgba(0,0,0,0.18)] animate-in fade-in-0 zoom-in-95 dark:border-violet-400 dark:bg-violet-900/95 dark:text-violet-50 md:text-base";
              const rowCells = visibleCells.map((cell) => {
                const isPinnedLeft = cell.column.getIsPinned() === "left";
                const isPinnedRight = cell.column.getIsPinned() === "right";
                const wPx = Math.max(cell.column.getSize(), 40);
                return (
                  <td
                    key={cell.id}
                    className={cn(
                      "border-r border-slate-100 dark:border-slate-700 align-top",
                      dui.td,
                      isEditedByOthers && rowLockedByOthersBg,
                      isCompleted && !isEditedByOthers && completedCellBg,
                      isPinnedLeft && "sticky left-0 z-10 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)]",
                      isPinnedRight && "sticky right-0 z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.2)]",
                      (isPinnedLeft || isPinnedRight) && pinnedBg
                    )}
                    style={{
                      width: wPx,
                      minWidth: wPx,
                    }}
                  >
                    <div className="min-w-0 overflow-hidden text-slate-700 dark:text-slate-200">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </td>
                );
              });

              const claimRowPresence = () => setEditingRow(row.original.id);
              /**
               * Satır tıklamasıyla detay panelini aç.
               * Etkileşimli kontrollere (buton, input, checkbox, link, select,
               * editable cell) tıklamada açılmamalı — bunlar kendi davranışlarını yapar.
               */
              const handleRowClick = (e: React.MouseEvent) => {
                const target = e.target as HTMLElement | null;
                if (!target) return;
                if (target.closest("button,input,select,textarea,a,[role='button'],[contenteditable='true']")) {
                  return;
                }
                setDetailTask(row.original);
              };
              const rowPointerHandlers = {
                onPointerDown: claimRowPresence,
                onClick: handleRowClick,
                title: lastEditorTitle,
              };

              if (rowTooltipBody != null && isEditedByOthers) {
                return (
                  <Tooltip
                    key={row.id}
                    delayDuration={80}
                    disableHoverableContent
                    open={presenceHoverRowId === row.id}
                    onOpenChange={(open) => {
                      if (!open) setPresenceHoverRowId((cur) => (cur === row.id ? null : cur));
                    }}
                  >
                    <TooltipTrigger asChild>
                      <tr
                        className={rowClassName}
                        {...rowPointerHandlers}
                        onPointerEnter={() => setPresenceHoverRowId(row.id)}
                        onPointerLeave={() =>
                          setPresenceHoverRowId((cur) => (cur === row.id ? null : cur))
                        }
                      >
                        {rowCells}
                      </tr>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10} className={rowTooltipClass}>
                      {rowTooltipBody}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return (
                <tr key={row.id} className={rowClassName} {...rowPointerHandlers}>
                  {rowCells}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </TooltipProvider>
      {filteredData.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Satır:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {filteredData.length} görev (sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, table.getPageCount() || 1) }, (_, i) => {
              const total = table.getPageCount() || 1;
              const current = table.getState().pagination.pageIndex;
              let page: number;
              if (total <= 5) page = i;
              else if (current <= 2) page = i;
              else if (current >= total - 3) page = total - 5 + i;
              else page = current - 2 + i;
              return (
                <Button
                  key={page}
                  type="button"
                  variant={current === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => table.setPageIndex(page)}
                  className="h-8 w-8 p-0"
                >
                  {page + 1}
                </Button>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {filteredData.length === 0 && (
        tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="h-10 w-10" />}
            title="Henüz görev yok"
            description="İlk görevinizi ekleyerek ya da CSV ile toplu içe aktararak başlayın."
            action={
              canCreateTask ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setNewTaskOpen(true)}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <PlusCircle className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                  Yeni görev ekle
                </Button>
              ) : undefined
            }
            secondaryAction={
              canImportCsv ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  CSV içe aktar
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            variant="compact"
            icon={<Search className="h-8 w-8" />}
            title="Filtreye uyan görev yok"
            description="Arama, durum veya proje filtrelerinizi değiştirerek tekrar deneyin."
            action={
              activeFilterCount > 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Filtreleri temizle
                </Button>
              ) : undefined
            }
          />
        )
      )}
      </div>
    </>
  );

  if (isFullWidth && typeof document !== "undefined") {
    return createPortal(
      <>
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" aria-hidden />
        <div className="fixed inset-6 z-50 flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border-2 border-slate-300 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-800">
          {liveTableBody}
        </div>
      </>,
      document.body
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg border-0 bg-transparent shadow-none">
      {liveTableBody}
    </div>
  );
}
