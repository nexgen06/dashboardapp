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
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { usePresence } from "@/hooks/usePresence";
import { useSettings } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { OnlineUsersPanel } from "@/components/OnlineUsersPanel";
import { getRelativeTime } from "@/lib/relativeTime";
import { formatDate } from "@/lib/formatDate";
import { parseCSV } from "@/lib/csvParser";
import * as XLSX from "xlsx";
import { Pencil, PlusCircle, MoreVertical, MoreHorizontal, Trash2, Download, Columns3, Upload, GripVertical, Maximize2, Minimize2, Search, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, User, Loader2, ListTodo, RotateCw, Filter, Shrink, AlertTriangle, Calendar, Flame, UserCheck, UserX, ChevronDown, Circle, CheckCircle2, SlidersHorizontal } from "lucide-react";

const STATUS_OPTIONS = ["Yapılacak", "Devam", "Tamamlandı"] as const;
const STATUS_FILTER_OPTIONS = ["Tümü", "Yapılacak", "Devam ediyor", "Devam", "Tamamlandı"] as const;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

/** Kolon id -> export/visibility etiketi (veri sütunları) */
const COLUMN_LABELS: Record<string, string> = {
  content: "Açıklama",
  status: "Durum",
  assignee: "Atanan",
  priority: "Öncelik",
  updated: "Son güncelleme",
};

/** Kolon id -> görünürlük menüsünde gösterilecek etiket (tüm sütunlar) */
const COLUMN_VISIBILITY_LABELS: Record<string, string> = {
  select: "Seçim",
  status: "Durum",
  content: "Açıklama",
  actions: "İşlemler",
};

const CANLI_TABLO_COLUMN_ORDER: ColumnOrderState = ["select", "status", "assignee", "priority", "updated", "detay", "actions", "presence"];
/** Sabit sütun sırası (dinamik sütun yokken); component dışında referans sabit kalsın diye */
const BASE_COLUMN_ORDER_STABLE: ColumnOrderState = ["select", "status", "content", "actions"];

/** İçeriğe göre sütun genişliği hesaplamada kullanılan min/max (px) */
const COLUMN_SIZE_BOUNDS: Record<string, { min: number; max: number }> = {
  select: { min: 36, max: 80 },
  status: { min: 100, max: 220 },
  content: { min: 180, max: 480 },
  actions: { min: 44, max: 80 },
};
const DEFAULT_EXTRA_BOUNDS = { min: 100, max: 400 };
const AUTO_SIZE_CHAR_PX = 8;
const AUTO_SIZE_PADDING = 32;

/** Bir hücrenin metin uzunluğunu (ölçeklendirme için) döndürür */
function getCellTextLength(columnId: string, task: Task): number {
  if (columnId === "select" || columnId === "actions") return 0;
  if (columnId === "content") return String(task.content ?? "—").length;
  if (columnId.startsWith("extra:")) {
    const key = columnId.replace(/^extra:/, "");
    return String(task.extra_data?.[key] ?? "—").length;
  }
  return 0;
}

function getExportValue(columnId: string, task: Task, dateFormat: string): string {
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
    case "updated":
    case "updated_at":
      const ut = t.updated_at ?? task.updated_at;
      return ut ? formatDate(new Date(String(ut)), dateFormat) : "";
    case "due_date":
      return String(t.due_date ?? task.due_date ?? "");
    default:
      if (columnId.startsWith("extra:")) {
        const key = columnId.replace(/^extra:/, "");
        return String(task.extra_data?.[key] ?? (t.extra_data as Record<string, string>)?.[key] ?? "");
      }
      if (columnId === "detay") {
        return task.extra_data ? JSON.stringify(task.extra_data) : "";
      }
      return t[columnId] != null ? String(t[columnId]) : "";
  }
}

const EXPORT_SKIP_IDS = new Set(["select", "actions", "presence"]);
const EXPORT_DEFAULT_COLUMNS = ["status", "content", "assignee", "priority", "updated", "due_date"];

/** CSV ve Excel için ortak: sütun listesi, başlıklar ve satır değerleri (string[][]) */
function getExportData(rows: Task[], visibleColumnIds: string[], dateFormat: string) {
  let dataColumns = visibleColumnIds.filter(
    (id) => !EXPORT_SKIP_IDS.has(id) && (COLUMN_LABELS[id] != null || id.startsWith("extra:") || id === "due_date" || id === "updated" || id === "updated_at" || id === "assignee" || id === "priority" || id === "content" || id === "status" || id === "detay")
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
    dataColumns.map((id) => getExportValue(id, task, dateFormat))
  );
  return { headers, rowArrays };
}

function downloadCSV(rows: Task[], visibleColumnIds: string[], dateFormat: string, filename: string) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat);
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

function downloadExcel(rows: Task[], visibleColumnIds: string[], dateFormat: string, filename: string) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat);
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

const columnHelper = createColumnHelper<Task>();

type EditableCellProps = {
  value: string;
  taskId: string;
  field: string;
  onSave: (taskId: string, patch: Record<string, unknown>) => void;
  onFocus: () => void;
  onBlur: () => void;
};

function EditableCell({ value, taskId, field, onSave, onFocus, onBlur }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
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
          className="w-full min-w-0 rounded border border-blue-300 bg-blue-50/50 px-2 py-1.5 text-sm text-slate-900 outline-none ring-2 ring-blue-500 focus:border-blue-500 focus:bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20 dark:text-slate-100 dark:focus:bg-blue-900/30"
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
      className="flex w-full min-w-0 items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <span className="min-w-0 flex-1 truncate">{value || "—"}</span>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    </button>
  );
}

type TaskFormData = { content: string; status: string; assignee: string };

function TaskFormDialog({
  open,
  onOpenChange,
  initialTask,
  onSubmit,
  submitLabel,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTask?: Task | null;
  onSubmit: (data: TaskFormData) => void | Promise<void>;
  submitLabel: string;
  title: string;
}) {
  const [content, setContent] = useState(initialTask?.content ?? "");
  const [status, setStatus] = useState(initialTask?.status ?? "Yapılacak");
  const [assignee, setAssignee] = useState(initialTask?.assignee ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(initialTask?.content ?? "");
    setStatus(initialTask?.status ?? "Yapılacak");
    setAssignee(initialTask?.assignee ?? "");
  }, [initialTask, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ content: content.trim(), status: status || "Yapılacak", assignee: assignee.trim() || "" });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label htmlFor="task-content" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              İçerik
            </label>
            <input
              id="task-content"
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Görev açıklaması"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-status" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Durum
            </label>
            <select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (tasks: Array<{ content: string; status: string; assignee: string | null; priority?: string | null; extra_data?: Record<string, string> | null }>, replaceExisting: boolean) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const reset = useCallback(() => {
    setHeaders([]);
    setRows([]);
    setColumnMap({ content: null, status: null, assignee: null, priority: null });
    setReplaceExisting(false);
    setError(null);
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

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? "");
          const { headers: h, rows: r } = parseCSV(text);
          if (h.length === 0) {
            setError("CSV dosyası boş veya geçersiz.");
            return;
          }
          setHeaders(h);
          setRows(r);
          autoMapHeaders(h);
        } catch (err) {
          setError(err instanceof Error ? err.message : "CSV okunamadı.");
        }
      };
      reader.readAsText(file, "UTF-8");
    },
    [autoMapHeaders]
  );

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

  const handleImport = useCallback(async () => {
    const tasks = buildTasks();
    if (tasks.length === 0) {
      setError("Dosyada geçerli veri bulunamadı (en az bir satırda veri olmalı).");
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
  }, [buildTasks, replaceExisting, onImport, onOpenChange]);

  const canImport = rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>CSV içe aktar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            CSV dosyası yükleyin. İlk satır başlık kabul edilir. <strong>Tüm sütunlar olduğu gibi tabloya yansır.</strong> Tablodaki <strong>Açıklama</strong> sütunu kaynak dosyadan hiç doldurulmaz; tablo üzerinde çalışırken ek not girmek için ayrılmıştır. Her hücre düzenlenebilir; değişiklikler Realtime ile tüm kullanıcılara yansır.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Dosya seç
          </Button>
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
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button type="button" onClick={handleImport} disabled={!canImport || importing}>
            {importing ? "Aktarılıyor…" : `${rows.length} satır içe aktar`}
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
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
  return /tamamlandı|tamamlandi|done|completed/i.test(s);
}

function StatusCell({
  value,
  taskId,
  onSave,
  onFocus,
  onBlur,
}: {
  value: string;
  taskId: string;
  onSave: (taskId: string, patch: Partial<Task>) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const display = getStatusDisplay(value);
  const badgeStyle = STATUS_BADGE_STYLES[display] ?? STATUS_BADGE_STYLES.Yapılacak;
  const dotClass = STATUS_DOT_CLASS[display] ?? STATUS_DOT_CLASS.Yapılacak;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isCompleted = display === "Tamamlandı";

  const handleBadgeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.button === 2) return; // sağ tık → onContextMenu
      if (e.detail === 2) {
        setDropdownOpen(true);
        return;
      }
      if (isCompleted) {
        setDropdownOpen(true);
        return;
      }
      onSave(taskId, { status: "Tamamlandı", last_updated_by: "anon" });
    },
    [taskId, isCompleted, onSave]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDropdownOpen(true);
  }, []);

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <div className="relative inline-flex">
        <Badge
          variant="outline"
          role="button"
          tabIndex={0}
          title="Tek tık: Tamamlandı · Çift tık veya sağ tık: Tüm seçenekler"
          onClick={handleBadgeClick}
          onContextMenu={handleContextMenu}
          onFocus={onFocus}
          onBlur={onBlur}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm font-medium transition-colors hover:opacity-90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
            badgeStyle
          )}
        >
          <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} aria-hidden />
          <span>{display || "—"}</span>
        </Badge>
        {/* Radix dropdown konumu için görünmez tetikleyici; tıklanmaz, menü sadece Badge tıklamasıyla açılıyor */}
        <DropdownMenuTrigger asChild>
          <span
            className="absolute inset-0 pointer-events-none w-full h-full"
            aria-hidden
            tabIndex={-1}
          />
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="start">
        {STATUS_OPTIONS.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => onSave(taskId, { status: s, last_updated_by: "anon" })}
          >
            {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

function TaskStats({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  const tamamlandi = tasks.filter((t) => /tamamlandı|tamamlandi|done|completed/i.test(t.status)).length;
  const devamEden = tasks.filter((t) => /devam|sürüyor|in progress|progress/i.test(t.status)).length;
  const diger = total - tamamlandi - devamEden;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">Toplam {total} görev</span>
      <span className="text-slate-400 dark:text-slate-500">·</span>
      <span className="text-slate-600 dark:text-slate-400">{tamamlandi} tamamlandı</span>
      <span className="text-slate-400 dark:text-slate-500">·</span>
      <span className="text-slate-600 dark:text-slate-400">{devamEden} devam ediyor</span>
      {diger > 0 && (
        <>
          <span className="text-slate-400 dark:text-slate-500">·</span>
          <span className="text-slate-600 dark:text-slate-400">{diger} diğer</span>
        </>
      )}
    </div>
  );
}

/** Projeyi kullanıcı görebilir mi: admin her zaman; atama varsa sadece atananlar, atama yoksa sadece admin. */
function canViewProject(p: Project, isAdmin: boolean, currentUserEmail: string): boolean {
  const email = currentUserEmail.trim().toLowerCase();
  if (!email) return isAdmin;
  return (
    isAdmin ||
    ((p.assigned_emails?.length ?? 0) > 0 &&
      (p.assigned_emails ?? []).some((e) => String(e).trim().toLowerCase() === email))
  );
}

export function TasksTable() {
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
    isRealtimeConnected,
  } = useTasksWithRealtime();
  const { projects } = useProjects();
  const { user, hasPermission, isAdmin } = useAuth();
  const { editingByOthers, editingByUser, onlineUsers, setEditingRow } = usePresence({
    userEmail: user?.email ?? undefined,
    userName: user?.displayName ?? user?.email ?? undefined,
    userId: user?.id ?? undefined,
  });
  const { settings } = useSettings();
  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();
  const canCreateTask = hasPermission("liveTable.createTask");
  const canEditTask = hasPermission("liveTable.editTask");
  const canDeleteTask = hasPermission("liveTable.deleteTask");
  const canBulkDelete = hasPermission("liveTable.bulkDelete");
  const canImportCsv = hasPermission("liveTable.importCsv");
  const canExportCsv = hasPermission("liveTable.exportCsv");
  const canManageColumns = hasPermission("liveTable.manageColumns");
  const canAutoSizeColumns = hasPermission("liveTable.autoSizeColumns");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(BASE_COLUMN_ORDER_STABLE);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({
    select: 44,
    status: 140,
    content: 260,
    actions: 52,
  });
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [globalSearch, setGlobalSearch] = useState("");
  /** Varsayılan: sadece projeye bağlı görevler (standart tablo verisi gösterilmez) */
  const [projectLinkedFilter, setProjectLinkedFilter] = useState<"proje" | "tümü">("proje");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Excel tarzı sütun filtreleri
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnFilterOpen, setColumnFilterOpen] = useState<string | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  const [datePreset, setDatePreset] = useState<string>("custom");
  const [sorting, setSorting] = useState<SortingState>([{ id: "updated", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const now = new Date();

  /** Atanmamış projeler sadece admin görür; üye sadece kendisine atanmış projelerin görevlerini görür. */
  const visibleProjectIds = useMemo(
    () =>
      new Set(
        projects
          .filter((p) => canViewProject(p, isAdmin, currentUserEmail))
          .map((p) => p.id)
      ),
    [projects, isAdmin, currentUserEmail]
  );

  /** Proje görünürlüğüne göre görünen görevler (istatistik ve tablo için temel). */
  const tasksVisibleByProject = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.project_id ||
          String(t.project_id).trim() === "" ||
          visibleProjectIds.has(t.project_id)
      ),
    [tasks, visibleProjectIds]
  );

  /** Atanan dropdown: sadece yöneticinin projeye atadığı kullanıcılar (assigned_emails); tablo hücrelerindeki Ünvan vb. değil. */
  const assigneeFilterOptions = useMemo(() => {
    const set = new Set<string>();
    projects
      .filter((p) => visibleProjectIds.has(p.id))
      .forEach((p) => {
        (p.assigned_emails ?? []).forEach((e) => {
          const v = String(e).trim();
          if (v) set.add(v);
        });
      });
    return Array.from(set).sort();
  }, [projects, visibleProjectIds]);

  useEffect(() => {
    if (assigneeFilter !== "Tümü" && assigneeFilterOptions.length > 0 && !assigneeFilterOptions.includes(assigneeFilter)) {
      setAssigneeFilter("Tümü");
    }
  }, [assigneeFilter, assigneeFilterOptions]);

  const extraDataKeys = useMemo(() => {
    const set = new Set<string>();
    tasksVisibleByProject.forEach((t) => {
      if (t.extra_data && typeof t.extra_data === "object") {
        Object.keys(t.extra_data).forEach((k) => {
          if (k != null && String(k).trim() !== "") set.add(k);
        });
      }
    });
    return Array.from(set).sort();
  }, [tasksVisibleByProject]);

  useEffect(() => {
    const dynamicIds = extraDataKeys.map((k) => `extra:${k}`);
    if (dynamicIds.length === 0) {
      setColumnOrder(BASE_COLUMN_ORDER_STABLE);
      return;
    }
    setColumnOrder((prev) => {
      const existingDynamic = prev.filter((id) => String(id).startsWith("extra:"));
      const newDynamic = dynamicIds.filter((id) => !existingDynamic.includes(id));
      return ["select", "status", "content", ...existingDynamic, ...newDynamic, "actions"];
    });
  }, [extraDataKeys]);

  const filteredData = useMemo(() => {
    let result = tasksVisibleByProject;
    if (projectLinkedFilter === "proje") {
      result = result.filter((t) => t.project_id != null && String(t.project_id).trim() !== "");
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
        return statusArr.some((filter) => {
          if (filter === "Devam ediyor" || filter === "Devam") return /devam|sürüyor/i.test(s);
          if (filter === "Yapılacak") return /yapılacak|yapilacak/i.test(s);
          if (filter === "Tamamlandı") return /tamamlandı|tamamlandi|done|completed/i.test(s);
          return s === filter;
        });
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
    return result;
  }, [tasksVisibleByProject, projectLinkedFilter, globalSearch, statusFilter, assigneeFilter, dateFrom, dateTo, columnFilters]);

  /** Kullanıcının açıkça seçtiği filtre sayısı (varsayılan "projeye bağlı göster" sayılmaz) */
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (globalSearch.trim()) n++;
    if (Array.isArray(statusFilter) && statusFilter.length > 0) n++;
    if (Array.isArray(assigneeFilter) && assigneeFilter.length > 0) n++;
    if (dateFrom || dateTo || datePreset !== "custom") n++;
    // Sütun filtreleri
    const columnFilterCount = Object.values(columnFilters).filter(arr => arr.length > 0).length;
    n += columnFilterCount;
    return n;
  }, [globalSearch, statusFilter, assigneeFilter, dateFrom, dateTo, datePreset, columnFilters]);

  const clearFilters = useCallback(() => {
    setProjectLinkedFilter("tümü");
    setGlobalSearch("");
    setStatusFilter([]);
    setAssigneeFilter([]);
    setDateFrom("");
    setDateTo("");
    setDatePreset("custom");
    setColumnFilters({});
  }, []);

  // Sütun için benzersiz değerleri hesapla
  const getUniqueValuesForColumn = useCallback((columnId: string): string[] => {
    const values = new Set<string>();
    tasksVisibleByProject.forEach((t) => {
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
  }, [tasksVisibleByProject]);

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
      case "priority":
        // Yüksek öncelikli - globalSearch ile "high" ara
        setGlobalSearch("high");
        break;
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
  }, [clearFilters, currentUserEmail]);

  // Akıllı filtre sayıları
  const smartFilterCounts = useMemo(() => {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const haftaSonu = new Date(bugun);
    haftaSonu.setDate(bugun.getDate() + 7);
    haftaSonu.setHours(23, 59, 59, 999);

    const overdue = tasksVisibleByProject.filter((t) => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      const isCompleted = /tamamlandı|tamamlandi|done|completed/i.test(t.status ?? "");
      return dueDate < bugun && !isCompleted;
    }).length;

    const thisWeek = tasksVisibleByProject.filter((t) => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= bugun && dueDate <= haftaSonu;
    }).length;

    const priority = tasksVisibleByProject.filter((t) => {
      const isHigh = (t.priority ?? "").toLowerCase() === "high";
      const isCompleted = /tamamlandı|tamamlandi|done|completed/i.test(t.status ?? "");
      return isHigh && !isCompleted;
    }).length;

    const mine = tasksVisibleByProject.filter((t) => 
      (t.assignee ?? "").toLowerCase().includes(currentUserEmail.toLowerCase())
    ).length;

    const unassigned = tasksVisibleByProject.filter((t) => 
      !t.assignee || t.assignee.trim() === ""
    ).length;

    return { overdue, thisWeek, priority, mine, unassigned };
  }, [tasksVisibleByProject, currentUserEmail]);

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
      const left = prev.left.filter((id) => id !== columnId);
      const right = prev.right.filter((id) => id !== columnId);
      if (side === "left") return { left: [...left, columnId], right };
      if (side === "right") return { left, right: [...right, columnId] };
      return { left, right };
    });
  }, []);

  /** Sütun genişliklerini mevcut veri ve başlık metinlerine göre otomatik ayarlar */
  const handleAutoSizeColumns = useCallback(() => {
    const baseIds = ["select", "status", "content", "actions"];
    const extraIds = extraDataKeys.map((k) => `extra:${k}`);
    const columnIds = [...baseIds, ...extraIds];
    const next: ColumnSizingState = {};
    for (const id of columnIds) {
      const bounds = COLUMN_SIZE_BOUNDS[id] ?? (id.startsWith("extra:") ? DEFAULT_EXTRA_BOUNDS : null);
      if (!bounds) continue;
      const headerLabel = COLUMN_VISIBILITY_LABELS[id] ?? (id.startsWith("extra:") ? id.replace(/^extra:/, "") : id);
      let maxLen = headerLabel.length;
      for (const task of filteredData) {
        const len = getCellTextLength(id, task);
        if (len > maxLen) maxLen = len;
      }
      const width = Math.min(bounds.max, Math.max(bounds.min, maxLen * AUTO_SIZE_CHAR_PX + AUTO_SIZE_PADDING));
      next[id] = width;
    }
    setColumnSizing((prev) => ({ ...prev, ...next }));
  }, [filteredData, extraDataKeys]);

  const handleSave = useCallback(
    (taskId: string, patch: Partial<Task>) => {
      updateTaskOptimistic(taskId, patch);
      saveTask(taskId, patch);
    },
    [updateTaskOptimistic, saveTask]
  );

  const handleNewTask = useCallback(
    async (data: TaskFormData) => {
      await createTask({ content: data.content, status: data.status, assignee: data.assignee || null });
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
      const patch = { content: data.content, status: data.status, assignee: data.assignee || null };
      handleSave(editTask.id, patch);
      await saveTask(editTask.id, patch);
      setEditTask(null);
    },
    [editTask, handleSave, saveTask]
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
      setDeletingIds((prev) => new Set(prev).add(taskId));
      try {
        await deleteTask(taskId);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [deleteTask]
  );

  // Dinamik hücre düzenleme handler'ı
  const handleDynamicCellSave = useCallback((taskId: string, key: string, value: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newExtraData = { ...(task.extra_data ?? {}), [key]: value };
    handleSave(taskId, { extra_data: newExtraData });
    saveTask(taskId, { extra_data: newExtraData });
  }, [tasks, handleSave, saveTask]);

  const columns: ColumnDef<Task, string | null>[] = [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <span className="flex items-center gap-1.5">
          <SelectAllCheckbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Seçim</span>
        </span>
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          aria-label="Satırı seç"
        />
      ),
      size: 44,
      minSize: 36,
      maxSize: 80,
      enableResizing: false,
    }),
    columnHelper.display({
      id: "status",
      header: "Durum",
      cell: ({ row }) => (
        <StatusCell
          value={row.original.status ?? ""}
          taskId={row.original.id}
          onSave={handleSave}
          onFocus={() => setEditingRow(row.original.id)}
          onBlur={() => setEditingRow(null)}
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
      cell: ({ row }) => {
        const task = row.original;
        const value = task.content ?? "";
        return (
          <div className="min-w-0" title={value || undefined}>
            <EditableCell
              value={value}
              taskId={task.id}
              field="content"
              onSave={(id, patch) => {
                if ("content" in patch) handleSave(id, patch);
              }}
              onFocus={() => setEditingRow(task.id)}
              onBlur={() => setEditingRow(null)}
            />
          </div>
        );
      },
      size: 260,
      minSize: 180,
      maxSize: 480,
      enableResizing: true,
    }),
    ...extraDataKeys.map((key) =>
      columnHelper.display({
        id: `extra:${key}`,
        header: key,
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
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="">—</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            );
          }
          // Inline editable text
          return (
            <EditableCell
              value={value}
              taskId={taskId}
              field={key}
              onSave={(id, patch) => {
                if (key in patch) {
                  handleDynamicCellSave(id, key, String(patch[key] ?? ""));
                }
              }}
              onFocus={() => setEditingRow(taskId)}
              onBlur={() => setEditingRow(null)}
            />
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
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Menü">
                <MoreHorizontal className="h-4 w-4" />
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
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: { rowSelection, columnVisibility, columnOrder, columnPinning, columnSizing, sorting, pagination },
    enableRowSelection: true,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enablePinning: true,
    enableSorting: true,
    manualPagination: false,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
  });

  const visibleColumnIds = table.getVisibleLeafColumns().map((c) => (c.id ?? (c as { accessorKey?: string }).accessorKey ?? "").toString()).filter(Boolean);
  const handleExportCSV = useCallback(
    (scope: "current" | "all") => {
      const rows = scope === "all" ? tasksVisibleByProject : filteredData;
      downloadCSV(rows, visibleColumnIds, settings.dateFormat, `gorevler-${scope === "all" ? "tum" : "gorunum"}-${Date.now()}.csv`);
    },
    [tasksVisibleByProject, filteredData, visibleColumnIds, settings.dateFormat]
  );
  const handleExportExcel = useCallback(
    (scope: "current" | "all") => {
      const rows = scope === "all" ? tasksVisibleByProject : filteredData;
      downloadExcel(rows, visibleColumnIds, settings.dateFormat, `gorevler-${scope === "all" ? "tum" : "gorunum"}-${Date.now()}.xlsx`);
    },
    [tasksVisibleByProject, filteredData, visibleColumnIds, settings.dateFormat]
  );

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedTasks = selectedRows.map((r) => r.original);
  const selectedIds = selectedTasks.map((t) => t.id);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setDeletingIds((prev) => new Set([...prev, ...selectedIds]));
    try {
      await deleteTasks(selectedIds);
      setRowSelection({});
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        selectedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [selectedIds, deleteTasks]);

  const handleBulkStatusUpdate = useCallback(
    async (status: string) => {
      setBulkStatusOpen(false);
      for (const t of selectedTasks) {
        handleSave(t.id, { status, last_updated_by: "anon" });
        saveTask(t.id, { status, last_updated_by: "anon" });
      }
      setRowSelection({});
    },
    [selectedTasks, handleSave, saveTask]
  );

  if (isLoading) {
    const skeletonRows = 5;
    return (
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 min-h-[280px]">
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
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

  return (
    <>
      {isFullWidth && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" aria-hidden />
      )}
      <div
        className={cn(
          "flex flex-col min-h-0 flex-1 rounded-lg border-0 bg-transparent shadow-none",
          isFullWidth && "fixed inset-6 z-50 flex flex-col rounded-xl border-2 border-slate-300 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        )}
      >
      {canCreateTask && (
        <TaskFormDialog
          open={newTaskOpen}
          onOpenChange={setNewTaskOpen}
          initialTask={null}
          onSubmit={handleNewTask}
          submitLabel="Oluştur"
          title="Yeni görev"
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
        />
      )}
      {canImportCsv && (
        <CSVImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleCSVImport} />
      )}
      <Dialog open={!!detailTask} onOpenChange={(open) => !open && setDetailTask(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>CSV sütunları (olduğu gibi)</DialogTitle>
          </DialogHeader>
          {detailTask?.extra_data && Object.keys(detailTask.extra_data).length > 0 ? (
            <div className="rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Sütun</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Değer</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(detailTask.extra_data).map(([key, value]) => (
                    <tr key={key} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 align-top">{key}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 break-words">{value || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Bu satırda CSV sütunu yok.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailTask(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        {/* Akıllı Filtreler */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mr-1">Hızlı filtreler:</span>
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              placeholder="Görev veya atanan kişide ara"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400" title="Filtreler">
            <Filter className="h-4 w-4 shrink-0" aria-hidden />
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
                  {["Yapılacak", "Devam ediyor", "Tamamlandı"].map((status) => (
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
                        status === "Yapılacak" && "text-slate-600 dark:text-slate-300",
                        status === "Devam ediyor" && "text-blue-600 dark:text-blue-400",
                        status === "Tamamlandı" && "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {status === "Yapılacak" && <Circle className="h-3.5 w-3.5" />}
                        {status === "Devam ediyor" && <Loader2 className="h-3.5 w-3.5" />}
                        {status === "Tamamlandı" && <CheckCircle2 className="h-3.5 w-3.5" />}
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
        {/* Filtre Özeti Çubuğu - Aktif Filtre Badge'leri */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
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
      <div className="flex shrink-0 flex-col gap-2 px-1 pb-2">
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
                title="Sütun genişliklerini başlık ve hücre içeriğine göre otomatik ayarla"
              >
                <Shrink className="mr-2 h-4 w-4" />
                İçeriğe göre ölçeklendir
              </Button>
            )}
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
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <TaskStats tasks={tasksVisibleByProject} />
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500">|</span>
          {isRealtimeConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" title="Realtime bağlı">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
              Canlı
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="Bağlantı bekleniyor">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
              Yeniden bağlanıyor
            </span>
          )}
          {onlineUsers.length > 0 && (
            <OnlineUsersPanel
              onlineUsers={onlineUsers}
              editingByUser={editingByUser}
              currentUserEmail={currentUserEmail}
              tasks={tasksVisibleByProject}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canManageColumns && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="text-slate-700 dark:text-slate-300">
                <Columns3 className="mr-2 h-4 w-4" />
                Kolonları göster
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              {table.getAllLeafColumns().map((column) => {
                const label = COLUMN_VISIBILITY_LABELS[column.id] ?? (String(column.id).startsWith("extra:") ? String(column.id).replace(/^extra:/, "") : column.id);
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportCSV("current")}>CSV indir (mevcut görünüm)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel("current")}>Excel indir (mevcut görünüm)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportCSV("all")}>CSV indir (tüm veri)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel("all")}>Excel indir (tüm veri)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          {canCreateTask && (
          <Button
            type="button"
            size="sm"
            onClick={() => setNewTaskOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus-visible:ring-blue-400"
          >
            <PlusCircle className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Yeni görev
          </Button>
          )}
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
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem key={s} onClick={() => handleBulkStatusUpdate(s)}>
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {canBulkDelete && (
          <Button type="button" variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleBulkDelete}>
            Seçilenleri sil
          </Button>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex-1 min-h-0 w-full overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
          isFullWidth && "min-h-0 flex-1",
          tasks.length > 0 && "min-h-[200px]"
        )}
      >
        <table
          className="w-full min-w-full text-sm border-collapse table-fixed"
          style={{
            width: "100%",
            minWidth: "100%",
            tableLayout: "fixed",
          }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => {
              const headers = headerGroup.headers;
              const totalSize = headers.reduce((sum, h) => sum + Math.max(h.getSize(), 40), 0) || 1;
              return (
              <tr key={headerGroup.id} className="border-b-2 border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700/70">
                {headers.map((header) => {
                  const col = header.column;
                  const isPinnedLeft = col.getIsPinned() === "left";
                  const isPinnedRight = col.getIsPinned() === "right";
                  const resizeHandler = typeof header.getResizeHandler === "function" ? header.getResizeHandler() : undefined;
                  const baseSize = Math.max(header.getSize(), 40);
                  const widthPct = Math.max((baseSize / totalSize) * 100, 2);
                  return (
                    <th
                      key={header.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "relative select-none border-r border-slate-200 px-4 py-3 text-left font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300",
                        draggedColumnId === col.id && "opacity-50",
                        isPinnedLeft && "sticky left-0 z-10 bg-slate-100 dark:bg-slate-700/80 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]",
                        isPinnedRight && "sticky right-0 z-10 bg-slate-100 dark:bg-slate-700/80 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]"
                      )}
                      style={{
                        width: `${widthPct}%`,
                        minWidth: `${widthPct}%`,
                        maxWidth: `${widthPct}%`,
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400 active:cursor-grabbing" aria-hidden />
                        {col.getCanSort?.() ? (
                          <button
                            type="button"
                            onClick={col.getToggleSortingHandler()}
                            className="flex min-w-0 flex-1 items-center gap-1 truncate text-left hover:text-slate-900 dark:hover:text-slate-100"
                          >
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {col.getIsSorted() === "asc" ? (
                              <ArrowUp className="h-4 w-4 shrink-0 text-blue-600" />
                            ) : col.getIsSorted() === "desc" ? (
                              <ArrowDown className="h-4 w-4 shrink-0 text-blue-600" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 shrink-0 text-slate-400" />
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
                                "h-7 w-7 shrink-0",
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
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-500" aria-label="Sütun menüsü">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "left")}>Sol tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "right")}>Sağ tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "unpin")}>Sabitlemeyi kaldır</DropdownMenuItem>
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
              const isEditedByOthers = editingByOthers.has(row.original.id);
              const editingUser = editingByUser.get(row.original.id);
              const isSelected = row.getIsSelected();
              const isCompleted = isTaskCompleted(row.original);
              const visibleCells = row.getVisibleCells();
              const totalSize = visibleCells.reduce((sum, c) => sum + Math.max(c.column.getSize(), 40), 0) || 1;
              const rowTitle = isEditedByOthers && editingUser
                ? `${editingUser.name || editingUser.email || "Bir kullanıcı"} düzenliyor`
                : isCompleted
                  ? "Bu görev tamamlandı olarak işaretlendi"
                  : undefined;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-slate-700 dark:hover:bg-slate-700/30",
                    isCompleted && "bg-emerald-50/80 dark:bg-emerald-950/25 hover:bg-emerald-50/90 dark:hover:bg-emerald-950/35",
                    isCompleted && !isSelected && !isEditedByOthers && "border-l-4 border-l-emerald-400 dark:border-l-emerald-500",
                    isSelected && "bg-blue-50/60 dark:bg-blue-900/20 hover:bg-blue-50/80 dark:hover:bg-blue-900/30",
                    isSelected && !isEditedByOthers && "border-l-4 border-l-blue-500 dark:border-l-blue-400",
                    isEditedByOthers && "border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/15 dark:border-l-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-900/25"
                  )}
                  title={rowTitle}
                >
                  {visibleCells.map((cell) => {
                    const isPinnedLeft = cell.column.getIsPinned() === "left";
                    const isPinnedRight = cell.column.getIsPinned() === "right";
                    const baseSize = Math.max(cell.column.getSize(), 40);
                    const widthPct = Math.max((baseSize / totalSize) * 100, 2);
                    const completedCellBg = "bg-emerald-50/80 dark:bg-emerald-950/25";
                    const pinnedBg = isCompleted ? completedCellBg : "bg-white dark:bg-slate-800";
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "border-r border-slate-100 px-4 py-2 dark:border-slate-700 align-top",
                          isCompleted && completedCellBg,
                          isPinnedLeft && "sticky left-0 z-10 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)]",
                          isPinnedRight && "sticky right-0 z-10 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.2)]",
                          (isPinnedLeft || isPinnedRight) && pinnedBg
                        )}
                        style={{
                          width: `${widthPct}%`,
                          minWidth: `${widthPct}%`,
                          maxWidth: `${widthPct}%`,
                        }}
                      >
                        <div className="min-w-0 overflow-hidden text-slate-700 dark:text-slate-200">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
          <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-700">
            <ListTodo className="h-12 w-12 text-slate-400 dark:text-slate-500" aria-hidden />
          </div>
          <div>
            <p className="text-base font-medium text-slate-700 dark:text-slate-300">
              {tasks.length === 0 ? "Henüz görev yok" : "Filtreye uyan görev yok"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {tasks.length === 0
                ? "İlk görevinizi ekleyerek başlayın."
                : "Arama veya filtreleri değiştirerek tekrar deneyin."}
            </p>
          </div>
          {canCreateTask && (
            <Button
              type="button"
              size="sm"
              onClick={() => setNewTaskOpen(true)}
              className="bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus-visible:ring-blue-400"
            >
              <PlusCircle className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Yeni görev ekle
            </Button>
          )}
        </div>
      )}
    </div>
    </>
  );
}
