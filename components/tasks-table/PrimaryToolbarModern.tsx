"use client";

/* =============================================================================
 * PrimaryToolbarModern — Linear/Notion/Vercel dilinde TEK SATIR toolbar.
 *
 * Tasarım kaynağı: Claude Design "toolbar-redesign.jsx" prototipi.
 * Birebir port (lucide-react ikon, TypeScript, bizim state hook'larına bağlı).
 *
 * KATMAN 1 — Primary bar (h-12):
 *   SOL  (~45%) → FilterCombobox  (arama + filtre + ⌘K, 3 state)
 *   ORTA (~20%) → ViewTypeTabs    (Tablo·Kanban·Gantt·Takvim·Risk)
 *   SAĞ  (~35%) → Görünüm ▼ · Yeni (turuncu split) · ⛶ · ⋯
 * KATMAN 2 — ActiveFilterBar (koşullu, 1+ filtre)
 * KATMAN 3 — Bulk action bar (DOKUNULMADI, mevcut classic ile aynı)
 *
 * Klasik toolbar (TasksTableFiltersPanel) dondu — yeni feature sadece buraya.
 * ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle, ArrowDown, ArrowUp, BarChart3, Bookmark, Calendar, CalendarDays,
  CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDot, Columns,
  Download, FileDown, FileSpreadsheet, FileText, Flag, Flame, Folder, GanttChartSquare,
  Layers, ListFilter, Mail, MapPin, Maximize2, MoreHorizontal, Paintbrush, Plus,
  Printer, RotateCcw, Search, SlidersHorizontal, Table as TableIcon, Upload, User,
  UserX, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── METADATA ────────────────────────────────────────────────────── */

type Tone = "rose" | "indigo" | "amber" | "emerald" | "violet" | "sky" | "slate";

type QuickFilterDef = { id: string; label: string; icon: LucideIcon; tone: Tone };
const QUICK_FILTERS: QuickFilterDef[] = [
  { id: "overdue",    label: "Geciken",        icon: AlertCircle, tone: "rose" },
  { id: "thisWeek",   label: "Bu hafta",       icon: Calendar,    tone: "indigo" },
  { id: "priority",   label: "Yüksek öncelik", icon: Flame,       tone: "amber" },
  { id: "mine",       label: "Bana atanan",    icon: User,        tone: "emerald" },
  { id: "unassigned", label: "Atanmamış",      icon: UserX,       tone: "slate" },
];

type FilterKind = "single" | "multi" | "date";
type FilterPropDef = { key: string; label: string; icon: LucideIcon; tone: Tone; kind: FilterKind; extras?: boolean };
const FILTER_PROPS: FilterPropDef[] = [
  { key: "status",   label: "Durum",        icon: CircleDot,     tone: "amber",   kind: "single" },
  { key: "atanan",   label: "Atanan",       icon: User,          tone: "emerald", kind: "multi" },
  { key: "oncelik",  label: "Öncelik",      icon: Flag,          tone: "rose",    kind: "single" },
  { key: "proje",    label: "Proje",        icon: Folder,        tone: "sky",     kind: "multi" },
  { key: "date",     label: "Tarih aralığı",icon: CalendarRange, tone: "indigo",  kind: "date" },
];

export type ViewType = "table" | "kanban" | "gantt" | "calendar" | "risk";
const VIEWS: Array<{ id: ViewType; label: string; icon: LucideIcon }> = [
  { id: "table",    label: "Tablo",  icon: TableIcon },
  { id: "kanban",   label: "Kanban", icon: Columns },
  { id: "gantt",    label: "Gantt",  icon: GanttChartSquare },
  { id: "calendar", label: "Takvim", icon: CalendarDays },
  { id: "risk",     label: "Risk",   icon: AlertCircle },
];

export const GROUP_OPTIONS = [
  { value: "none", label: "Yok" },
  { value: "status", label: "Durum" },
  { value: "assignee", label: "Atanan" },
  { value: "priority", label: "Öncelik" },
  { value: "project", label: "Proje" },
  { value: "due", label: "Son tarih" },
] as const;
const DENSITY_OPTIONS = [
  { value: "compact", label: "Yoğun" },
  { value: "normal", label: "Normal" },
  { value: "comfortable", label: "Geniş" },
] as const;
const STYLE_OPTIONS = [
  { value: "modern", label: "Modern" },
  { value: "classic", label: "Klasik" },
] as const;

const ICON_TONE: Record<Tone, string> = {
  rose: "text-rose-500 dark:text-rose-400",
  indigo: "text-indigo-500 dark:text-indigo-400",
  amber: "text-amber-500 dark:text-amber-400",
  emerald: "text-emerald-500 dark:text-emerald-400",
  violet: "text-violet-500 dark:text-violet-400",
  sky: "text-sky-500 dark:text-sky-400",
  slate: "text-slate-400 dark:text-slate-500",
};
const CHIP_TONE: Record<Tone, string> = {
  rose:    "bg-rose-100 text-rose-700 ring-rose-200/70 dark:bg-rose-900/40 dark:text-rose-200 dark:ring-rose-800/60",
  indigo:  "bg-indigo-100 text-indigo-700 ring-indigo-200/70 dark:bg-indigo-900/40 dark:text-indigo-200 dark:ring-indigo-800/60",
  amber:   "bg-amber-100 text-amber-800 ring-amber-200/70 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800/60",
  emerald: "bg-emerald-100 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800/60",
  violet:  "bg-violet-100 text-violet-700 ring-violet-200/70 dark:bg-violet-900/40 dark:text-violet-200 dark:ring-violet-800/60",
  sky:     "bg-sky-100 text-sky-700 ring-sky-200/70 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-800/60",
  slate:   "bg-slate-200 text-slate-700 ring-slate-300/70 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600",
};

const POP =
  "z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5 " +
  "dark:border-slate-700 dark:bg-slate-900 animate-in fade-in-0 zoom-in-95 duration-150";

/* ─── TYPES ───────────────────────────────────────────────────────── */

export type FilterOption = { value: string; label: string; dot?: string };

export type SortCol = { key: string; dir: "asc" | "desc" };

export type SavedViewRef = { id: string; name: string };

export type CfRulePreview = { id: string; label: string; tone: Tone };

export type TaskMatch = { id: string; title: string; subtitle?: string; dot?: string };

export type PrimaryToolbarModernProps = {
  // Arama
  search: string;
  setSearch: (v: string) => void;
  appliedCount: number;
  matches: TaskMatch[];
  onOpenTask: (id: string) => void;

  // Kapsam
  scope: "proje" | "tümü";
  setScope: (v: "proje" | "tümü") => void;

  // Hızlı filtre
  smartFilter: string | null;
  setSmartFilter: (id: string | null) => void;
  smartCounts: Record<string, number>;

  // Filtreler (drill içinde kullanılır)
  filters: Record<string, unknown>;
  setFilter: (key: string, value: unknown) => void;
  filterOptions: Record<string, FilterOption[]>;

  // View
  view: ViewType;
  setView: (v: ViewType) => void;

  // Görünüm dropdown
  grouping: string;
  setGrouping: (g: string) => void;
  sortCols: SortCol[];
  sortableCols: Array<{ key: string; label: string }>;
  onSortToggleDir: (key: string) => void;
  onSortRemove: (key: string) => void;
  onSortAdd: (key: string) => void;
  onClearSort: () => void;
  cfActive: number;
  cfRules: CfRulePreview[];
  onEditCf: () => void;
  density: "compact" | "normal" | "comfortable";
  setDensity: (d: "compact" | "normal" | "comfortable") => void;
  stylePreset: "modern" | "classic";
  setStylePreset: (s: "modern" | "classic") => void;
  visibleCount: number;
  columnTotal: number;
  onManageColumns: () => void;
  savedViews: SavedViewRef[];
  activeViewId: string | null;
  setActiveViewId: (id: string) => void;
  viewIsModified: boolean;
  onSaveViewAs: () => void;
  onUpdateView: (id: string) => void;

  // Ekle
  onAddRow: () => void;
  onImport: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onPrint: () => void;
  onTemplate: () => void;

  // Yardımcı
  fullscreen: boolean;
  onFullscreen: () => void;

  // Daha fazla
  ozet: boolean;
  onToggleOzet: () => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  onExportSettings: () => void;
  onReset: () => void;

  // Klasik tasarıma dönüş (toolbarStyle switch)
  onSwitchToClassic?: () => void;

  /**
   * SavedViewsControl gibi mevcut component'leri toolbar'da göstermek için slot.
   * Görünüm dropdown'undan önce render edilir.
   */
  savedViewsSlot?: ReactNode;
};

/* ─── UTILITIES ───────────────────────────────────────────────────── */

function valueLabel(key: string, val: unknown, filterOptions: Record<string, FilterOption[]>): string | null {
  if (val == null) return null;
  if (val === "__empty__") return "(Boş)";
  if (val === "__filled__") return "(Dolu)";
  const o = (filterOptions[key] || []).find((opt) => opt.value === val);
  return o ? o.label : String(val);
}

function useIsMobile(bp = 768): boolean {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < bp);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width:${bp - 1}px)`);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return m;
}

function useDismiss(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [active, onClose]);
  return ref;
}

/* ─── SHARED UI ───────────────────────────────────────────────────── */

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] md:hidden">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] animate-in fade-in duration-150" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-2 py-2">{children}</div>
        <div className="mx-auto mb-1.5 mt-1 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-2.5">
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{children}</span>
      {right && <span className="shrink-0">{right}</span>}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex w-full items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/80" role="radiogroup">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-center text-[11px] font-medium transition-all",
              on ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50"
                 : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MenuRow({
  icon: Ic, iconClass, label, hint, right, active, onClick, danger,
}: {
  icon?: LucideIcon | (() => ReactNode);
  iconClass?: string;
  label: ReactNode;
  hint?: string;
  right?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
          : danger ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
      )}
    >
      {Ic && (typeof Ic === "function" && Ic.length === 0
        ? (Ic as () => ReactNode)()
        : (() => {
            const Component = Ic as LucideIcon;
            return <Component className={cn("h-4 w-4 shrink-0", active ? "" : (iconClass || "text-slate-400 dark:text-slate-500"))} strokeWidth={1.9} />;
          })()
      )}
      <span className="flex-1 truncate">{label}</span>
      {hint && <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{hint}</kbd>}
      {right}
    </button>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className={cn(
      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1",
      on ? "ring-indigo-500 dark:ring-indigo-400" : "ring-slate-300 dark:ring-slate-600"
    )}>
      {on && <span className="h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />}
    </span>
  );
}

function Countish({ n, on }: { n: number; on?: boolean }) {
  return (
    <span className={cn(
      "inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
      on ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-800/60 dark:text-indigo-100"
         : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
    )}>{n}</span>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SOL — FILTER COMBOBOX (3 state)
   ═══════════════════════════════════════════════════════════════════ */

type ComboMenuProps = Pick<PrimaryToolbarModernProps,
  | "search" | "setSearch" | "matches" | "onOpenTask"
  | "scope" | "setScope" | "smartFilter" | "setSmartFilter" | "smartCounts"
  | "filters" | "setFilter" | "filterOptions"
> & { onClose: () => void };

function ComboMenu(p: ComboMenuProps) {
  const [drill, setDrill] = useState<string | null>(null);
  const typing = p.search.trim().length > 0;

  // YAZMA state
  if (typing && !drill) {
    return (
      <div className="py-1">
        <SectionLabel>{p.matches.length} eşleşme</SectionLabel>
        {p.matches.length === 0 && <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">Sonuç yok</p>}
        <ul>
          {p.matches.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => { p.onOpenTask(m.id); p.onClose(); }}
                className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", m.dot || "bg-slate-300")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-800 dark:text-slate-100">{m.title}</span>
                  {m.subtitle && <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{m.subtitle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
        <SectionLabel>Filtre önerisi</SectionLabel>
        <MenuRow icon={Plus} iconClass="text-blue-600 dark:text-blue-300"
          label={<>Filtre olarak ekle: <span className="font-medium text-slate-800 dark:text-slate-100">&ldquo;{p.search.trim()}&rdquo;</span></>}
          onClick={p.onClose} />
      </div>
    );
  }

  // DRILL state — seçilen filtrenin değerleri
  if (drill) {
    const prop = FILTER_PROPS.find((x) => x.key === drill);
    if (!prop) return null;
    const back = (
      <button type="button" onClick={() => setDrill(null)} className="mb-0.5 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
        <ChevronLeft className="h-3 w-3" /> Geri · <span className="text-slate-700 dark:text-slate-200">{prop.label}</span>
      </button>
    );

    if (prop.kind === "date") {
      const f = (p.filters.dateFrom as string | null) || null;
      const t = (p.filters.dateTo as string | null) || null;
      return (
        <div className="py-1">
          {back}
          <div className="space-y-2 px-3 pb-2 pt-1">
            <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
              Başlangıç
              <input
                type="date"
                value={f || ""}
                onChange={(e) => p.setFilter("__date__", { dateFrom: e.target.value || null, dateTo: t })}
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
              Bitiş
              <input
                type="date"
                value={t || ""}
                onChange={(e) => p.setFilter("__date__", { dateFrom: f, dateTo: e.target.value || null })}
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </label>
            {(f || t) && (
              <button onClick={() => p.setFilter("__date__", { dateFrom: null, dateTo: null })}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30">
                Temizle
              </button>
            )}
          </div>
        </div>
      );
    }

    const opts = p.filterOptions[drill] || [];
    const cur = p.filters[drill];
    const isMulti = prop.kind === "multi";
    return (
      <div className="py-1">
        {back}
        <ul className="max-h-[260px] overflow-y-auto">
          {opts.map((opt) => {
            const sel = isMulti ? ((cur as string[] | undefined) || []).includes(opt.value) : opt.value === cur;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    if (isMulti) {
                      const arr = (cur as string[] | undefined) || [];
                      p.setFilter(drill, sel ? arr.filter((x) => x !== opt.value) : [...arr, opt.value]);
                    } else {
                      p.setFilter(drill, sel ? null : opt.value);
                      setDrill(null);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm transition-colors",
                    sel ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    {isMulti && (
                      <span className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded ring-1",
                        sel ? "bg-indigo-500 ring-indigo-500" : "ring-slate-300 dark:ring-slate-600"
                      )}>
                        {sel && <Check className="h-3 w-3 text-white" />}
                      </span>
                    )}
                    {opt.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dot)} />}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {!isMulti && sel && <Check className="h-3 w-3 shrink-0 text-indigo-600 dark:text-indigo-300" />}
                </button>
              </li>
            );
          })}
          {opts.length === 0 && <li className="px-3 py-3 text-center text-xs text-slate-500">Seçenek yok</li>}
        </ul>
      </div>
    );
  }

  // AÇIK state (boş input)
  return (
    <div className="py-1">
      <SectionLabel>Kapsam</SectionLabel>
      {[
        { id: "proje", label: "Proje görevleri", icon: Folder },
        { id: "tümü", label: "Tüm görevler", icon: Layers },
      ].map((o) => (
        <MenuRow
          key={o.id}
          active={p.scope === o.id}
          label={o.label}
          icon={() => <Radio on={p.scope === o.id} />}
          onClick={() => p.setScope(o.id as "proje" | "tümü")}
        />
      ))}

      <SectionLabel>Hızlı filtreler</SectionLabel>
      {QUICK_FILTERS.map((q) => {
        const on = p.smartFilter === q.id;
        return (
          <MenuRow
            key={q.id}
            icon={q.icon}
            iconClass={ICON_TONE[q.tone]}
            active={on}
            label={q.label}
            right={
              <span className="flex items-center gap-1.5">
                <Countish n={p.smartCounts[q.id] ?? 0} on={on} />
                {on && <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-300" />}
              </span>
            }
            onClick={() => p.setSmartFilter(on ? null : q.id)}
          />
        );
      })}

      <SectionLabel>Filtreler</SectionLabel>
      {FILTER_PROPS.map((fp) => {
        let v: string | null = null;
        if (fp.kind === "multi") {
          const a = (p.filters[fp.key] as string[] | undefined) || [];
          v = a.length ? (a.length === 1 ? valueLabel(fp.key, a[0], p.filterOptions) : `${a.length} seçili`) : null;
        } else if (fp.kind === "date") {
          const fmt = (d: string | null) => d ? d.split("-").reverse().join(".") : "…";
          const fromD = (p.filters.dateFrom as string | null) || null;
          const toD = (p.filters.dateTo as string | null) || null;
          v = (fromD || toD) ? `${fmt(fromD)} → ${fmt(toD)}` : null;
        } else {
          v = valueLabel(fp.key, p.filters[fp.key], p.filterOptions);
        }
        return (
          <MenuRow
            key={fp.key}
            icon={fp.icon}
            iconClass={ICON_TONE[fp.tone]}
            label={fp.label}
            right={
              <span className="flex items-center gap-1.5">
                {v ? (
                  <span className={cn("max-w-[120px] truncate rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset", CHIP_TONE[fp.tone])}>{v}</span>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">Tümü</span>
                )}
                <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
              </span>
            }
            onClick={() => setDrill(fp.key)}
          />
        );
      })}
    </div>
  );
}

function FilterCombobox(p: Omit<ComboMenuProps, "onClose"> & { appliedCount: number }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open && !mobile, () => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K kısayolu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
        if (!mobile) setTimeout(() => inputRef.current?.focus(), 20);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobile]);

  const menu = <ComboMenu {...p} onClose={() => setOpen(false)} />;

  if (mobile) {
    return (
      <div className="relative min-w-0 flex-1">
        <button type="button" onClick={() => setOpen(true)}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <span className="flex-1 truncate">{p.search || "Ara veya filtrele…"}</span>
          {p.appliedCount > 0 && <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">{p.appliedCount}</span>}
        </button>
        {open && (
          <BottomSheet title="Ara & filtrele" onClose={() => setOpen(false)}>
            <div className="mb-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input autoFocus value={p.search} onChange={(e) => p.setSearch(e.target.value)} placeholder="Ara…"
                className="h-5 flex-1 bg-transparent text-sm focus:outline-none dark:text-slate-100" />
              {p.search && <button onClick={() => p.setSearch("")} className="text-slate-400"><X className="h-3 w-3" /></button>}
            </div>
            {menu}
          </BottomSheet>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-w-0 flex-1 lg:max-w-[460px]" ref={ref}>
      <div className={cn(
        "flex h-9 items-center gap-2 rounded-lg border bg-white pl-3 pr-2 transition-colors dark:bg-slate-900/70",
        open ? "border-blue-400 ring-2 ring-blue-500/25 dark:border-blue-500"
             : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
      )}>
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
        <input
          ref={inputRef}
          value={p.search}
          onChange={(e) => p.setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder="Ara veya filtrele…"
          className="h-full min-w-0 flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        {p.search ? (
          <button type="button" onClick={() => { p.setSearch(""); inputRef.current?.focus(); }}
            className="shrink-0 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Temizle">
            <X className="h-3 w-3" />
          </button>
        ) : p.appliedCount > 0 ? (
          <span className="shrink-0 inline-flex h-5 items-center gap-1 rounded-md bg-indigo-100 px-1.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
            <ListFilter className="h-3 w-3" />{p.appliedCount}
          </span>
        ) : (
          <kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">⌘K</kbd>
        )}
      </div>
      {open && (
        <div className={cn("absolute left-0 top-[calc(100%+6px)] w-[min(420px,92vw)]", POP)}>
          <div className="max-h-[64vh] overflow-y-auto">{menu}</div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ORTA — VIEW TYPE TABS
   ═══════════════════════════════════════════════════════════════════ */

function ViewTypeTabs({ value, onChange, scroll }: { value: ViewType; onChange: (v: ViewType) => void; scroll?: boolean }) {
  return (
    <div className={cn("inline-flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/80", scroll && "w-max")}>
      {VIEWS.map((v) => {
        const on = value === v.id;
        const Ic = v.icon;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            aria-pressed={on}
            title={v.label}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
              on ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50"
                 : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            <Ic className="h-3 w-3" strokeWidth={1.9} />
            <span className={scroll ? "" : "hidden xl:inline"}>{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SAĞ — GÖRÜNÜM DROPDOWN
   ═══════════════════════════════════════════════════════════════════ */

function SortSection({
  sortCols, sortableCols, onToggleDir, onRemove, onAdd, onClear,
}: {
  sortCols: SortCol[];
  sortableCols: Array<{ key: string; label: string }>;
  onToggleDir: (key: string) => void;
  onRemove: (key: string) => void;
  onAdd: (key: string) => void;
  onClear: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const used = new Set(sortCols.map((s) => s.key));
  const avail = sortableCols.filter((c) => !used.has(c.key));
  const nameOf = (k: string) => sortableCols.find((c) => c.key === k)?.label || k;

  return (
    <div className="px-1 pb-1">
      {sortCols.length === 0 && <p className="px-1.5 py-1 text-xs text-slate-400 dark:text-slate-500">Sıralama yok</p>}
      <ul className="flex flex-col gap-1">
        {sortCols.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 dark:bg-slate-800/50">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300">{i + 1}</span>
            <span className="flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{nameOf(s.key)}</span>
            <button type="button" onClick={() => onToggleDir(s.key)} title="Yön"
              className="inline-flex h-6 items-center gap-0.5 rounded px-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700">
              {s.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {s.dir === "asc" ? "A→Z" : "Z→A"}
            </button>
            <button type="button" onClick={() => onRemove(s.key)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700" aria-label="Kaldır">
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {adding && avail.length > 0 ? (
          <select autoFocus onChange={(e) => { if (e.target.value) { onAdd(e.target.value); setAdding(false); } }} onBlur={() => setAdding(false)}
            className="h-7 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <option value="">Kolon seç…</option>
            {avail.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        ) : (
          <button type="button" disabled={avail.length === 0} onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent dark:text-blue-300 dark:hover:bg-blue-950/30 dark:disabled:text-slate-600">
            <Plus className="h-3 w-3" /> Kolon ekle
          </button>
        )}
        {sortCols.length > 0 && (
          <button type="button" onClick={onClear}
            className="rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            Temizle
          </button>
        )}
      </div>
    </div>
  );
}

type ViewMenuBodyProps = Pick<PrimaryToolbarModernProps,
  | "view" | "setView" | "grouping" | "setGrouping" | "sortCols" | "sortableCols"
  | "onSortToggleDir" | "onSortRemove" | "onSortAdd" | "onClearSort"
  | "cfActive" | "cfRules" | "onEditCf" | "density" | "setDensity" | "stylePreset" | "setStylePreset"
  | "visibleCount" | "columnTotal" | "onManageColumns"
  | "savedViews" | "activeViewId" | "setActiveViewId" | "viewIsModified" | "onSaveViewAs" | "onUpdateView"
  | "onSwitchToClassic"
> & { mobile: boolean; onClose: () => void };

function ViewMenuBody(props: ViewMenuBodyProps) {
  const active = props.savedViews.find((v) => v.id === props.activeViewId);
  const cfPreview = (props.cfRules || []).slice(0, 2);
  const cfSwatch: Record<Tone, string> = {
    rose: "bg-rose-400", amber: "bg-amber-400", emerald: "bg-emerald-400",
    sky: "bg-sky-400", violet: "bg-violet-400", indigo: "bg-indigo-400", slate: "bg-slate-400",
  };

  return (
    <div className="pb-1">
      {props.mobile && (
        <>
          <SectionLabel>Görünüm türü</SectionLabel>
          <div className="px-2 pb-1">
            <Segmented value={props.view} onChange={props.setView}
              options={VIEWS.map((v) => ({ value: v.id, label: v.label }))} />
          </div>
        </>
      )}

      <SectionLabel>Gruplama</SectionLabel>
      {GROUP_OPTIONS.map((g) => (
        <MenuRow
          key={g.value}
          active={props.grouping === g.value}
          label={g.label}
          icon={() => <Radio on={props.grouping === g.value} />}
          onClick={() => props.setGrouping(g.value)}
        />
      ))}

      <SectionLabel right={props.sortCols.length > 0 ? <Countish n={props.sortCols.length} on /> : null}>Sıralama</SectionLabel>
      <SortSection
        sortCols={props.sortCols} sortableCols={props.sortableCols}
        onToggleDir={props.onSortToggleDir} onRemove={props.onSortRemove}
        onAdd={props.onSortAdd} onClear={props.onClearSort}
      />

      <SectionLabel right={
        <button onClick={() => { props.onClose(); props.onEditCf(); }}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40">
          Düzenle
        </button>
      }>Koşullu biçim</SectionLabel>
      <div className="px-2.5 pb-1">
        {props.cfActive > 0 ? (
          <ul className="flex flex-col gap-1">
            {cfPreview.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className={cn("h-2.5 w-2.5 rounded-full", cfSwatch[r.tone] || "bg-slate-400")} />
                {r.label}
              </li>
            ))}
            {props.cfActive > 2 && <li className="text-[11px] text-slate-400">+{props.cfActive - 2} kural daha</li>}
          </ul>
        ) : <p className="text-xs text-slate-400 dark:text-slate-500">Kural yok</p>}
      </div>

      <SectionLabel>Yoğunluk</SectionLabel>
      <div className="px-2 pb-1">
        <Segmented value={props.density} onChange={props.setDensity}
          options={DENSITY_OPTIONS.map((d) => ({ value: d.value, label: d.label }))} />
      </div>

      <SectionLabel>Stil</SectionLabel>
      <div className="px-2 pb-1">
        <Segmented value={props.stylePreset} onChange={props.setStylePreset}
          options={STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
      </div>

      {/* Kayıtlı görünümler — boş savedViews ve onSaveViewAs no-op iken render etme
          (modern toolbar'da slot olarak SavedViewsControl gösteriliyor) */}
      {props.savedViews.length > 0 && (
      <SectionLabel right={
        <button onClick={() => { props.onClose(); props.onSaveViewAs(); }}
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40">
          <Plus className="h-2.5 w-2.5" /> Yeni
        </button>
      }>Kayıtlı görünümler</SectionLabel>)}
      {props.savedViews.length > 0 && (<>
      {props.viewIsModified && active && (
        <button onClick={() => { props.onClose(); props.onUpdateView(active.id); }}
          className="mx-1 mb-1 flex w-[calc(100%-8px)] items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40">
          <Check className="h-3 w-3" /> &ldquo;{active.name}&rdquo; görünümüne kaydet
        </button>
      )}
      <ul className="max-h-[150px] overflow-y-auto">
        {props.savedViews.map((v) => (
          <li key={v.id}>
            <button type="button" onClick={() => { props.setActiveViewId(v.id); props.onClose(); }}
              className={cn(
                "mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                v.id === props.activeViewId ? "bg-blue-50/70 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
              )}>
              <Bookmark className={cn("h-3 w-3", v.id === props.activeViewId ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500")} />
              <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{v.name}</span>
              {v.id === props.activeViewId && <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">varsayılan</span>}
            </button>
          </li>
        ))}
      </ul>
      </>)}

      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
      <MenuRow
        icon={Columns}
        label="Kolonlar"
        onClick={() => { props.onClose(); props.onManageColumns(); }}
        right={
          <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            Görünür: {props.visibleCount}/{props.columnTotal}
            <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
          </span>
        }
      />

      {props.onSwitchToClassic && (
        <>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <MenuRow
            icon={RotateCcw}
            iconClass="text-slate-400"
            label="Klasik arayüze dön"
            onClick={() => { props.onClose(); props.onSwitchToClassic!(); }}
          />
        </>
      )}
    </div>
  );
}

function ViewMenu(props: Omit<ViewMenuBodyProps, "mobile" | "onClose">) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open && !mobile, () => setOpen(false));
  const anyConfig = props.grouping !== "none" || props.sortCols.length > 0 || props.cfActive > 0;
  const close = useCallback(() => setOpen(false), []);
  const body = <ViewMenuBody {...props} mobile={mobile} onClose={close} />;

  return (
    <div className="relative" ref={mobile ? undefined : ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
          open ? "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
               : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        )}>
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Görünüm</span>
        {anyConfig && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
        <ChevronDown className="h-2.5 w-2.5 opacity-50" />
      </button>
      {open && !mobile && (
        <div className={cn("absolute right-0 top-[calc(100%+6px)] w-[320px]", POP)}>
          <div className="max-h-[74vh] overflow-y-auto">{body}</div>
        </div>
      )}
      {open && mobile && <BottomSheet title="Görünüm" onClose={close}>{body}</BottomSheet>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SAĞ — YENİ (turuncu split button)
   ═══════════════════════════════════════════════════════════════════ */

type AddListProps = Pick<PrimaryToolbarModernProps,
  | "onAddRow" | "onImport" | "onExportCsv" | "onExportXlsx" | "onPrint" | "onTemplate"
> & { onClose: () => void };

function AddList(p: AddListProps) {
  return (
    <div className="py-1">
      <MenuRow icon={Plus} iconClass="text-orange-500" label="Yeni satır" hint="Enter" onClick={() => { p.onClose(); p.onAddRow(); }} />
      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
      <MenuRow icon={Upload} label="CSV içe aktar" onClick={() => { p.onClose(); p.onImport(); }} />
      <MenuRow icon={FileDown} label="CSV olarak dışa aktar" onClick={() => { p.onClose(); p.onExportCsv(); }} />
      <MenuRow icon={FileSpreadsheet} label="Excel olarak dışa aktar" onClick={() => { p.onClose(); p.onExportXlsx(); }} />
      <MenuRow icon={Printer} label="PDF olarak yazdır" onClick={() => { p.onClose(); p.onPrint(); }} />
      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
      <MenuRow icon={FileText} label="Şablondan oluştur" onClick={() => { p.onClose(); p.onTemplate(); }} />
    </div>
  );
}

function AddSplitButton(p: Omit<AddListProps, "onClose">) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  if (mobile) return null; // FAB kullanılır
  return (
    <div className="relative" ref={ref}>
      <div className="inline-flex">
        <button
          type="button"
          onClick={p.onAddRow}
          className="inline-flex h-8 items-center gap-1.5 rounded-l-lg bg-orange-500 pl-2.5 pr-2.5 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          <span className="hidden sm:inline">Yeni</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Ekleme seçenekleri"
          className="inline-flex h-8 items-center rounded-r-lg border-l border-orange-400/60 bg-orange-500 px-1.5 text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className={cn("absolute right-0 top-[calc(100%+6px)] w-[248px]", POP)}>
          <AddList {...p} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export function AddFab(p: Omit<AddListProps, "onClose">) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  if (!mobile) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Yeni"
        className="fixed bottom-5 right-5 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 transition-transform active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>
      {open && (
        <BottomSheet title="Yeni" onClose={() => setOpen(false)}>
          <AddList {...p} onClose={() => setOpen(false)} />
        </BottomSheet>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SAĞ — ⛶ tam ekran · ⋯ daha fazla
   ═══════════════════════════════════════════════════════════════════ */

function MoreMenu({
  onReset, ozet, onToggleOzet, pageSize, setPageSize, onExportSettings,
}: Pick<PrimaryToolbarModernProps, "onReset" | "ozet" | "onToggleOzet" | "pageSize" | "setPageSize" | "onExportSettings">) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open && !mobile, () => setOpen(false));
  const body = (
    <div className="py-1">
      <MenuRow icon={RotateCcw} label="Varsayılan sıraya dön" onClick={() => { setOpen(false); onReset(); }} />
      <MenuRow
        icon={BarChart3}
        active={ozet}
        label="Özeti göster"
        onClick={() => { setOpen(false); onToggleOzet(); }}
        right={
          <span className={cn(
            "relative h-4 w-7 rounded-full transition-colors",
            ozet ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"
          )}>
            <span className={cn(
              "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
              ozet ? "left-[14px]" : "left-0.5"
            )} />
          </span>
        }
      />
      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200">
        <TableIcon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        <span className="flex-1">Sayfa boyutu</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="h-6 rounded-md border border-slate-200 bg-white px-1 text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {[10, 25, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <MenuRow icon={Download} label="Dışa aktarma ayarları" onClick={() => { setOpen(false); onExportSettings(); }} />
    </div>
  );
  return (
    <div className="relative" ref={mobile ? undefined : ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Daha fazla"
        title="Daha fazla"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
          open ? "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
               : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && !mobile && (
        <div className={cn("absolute right-0 top-[calc(100%+6px)] w-[248px]", POP)}>{body}</div>
      )}
      {open && mobile && <BottomSheet title="Daha fazla" onClose={() => setOpen(false)}>{body}</BottomSheet>}
    </div>
  );
}

function IconBtn({ icon: Ic, label, active, onClick }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
        active ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-200"
               : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
      )}
    >
      <Ic className="h-3.5 w-3.5" />
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PRIMARY TOOLBAR (tek satır) + mobil
   ═══════════════════════════════════════════════════════════════════ */

export function PrimaryToolbarModern(props: PrimaryToolbarModernProps) {
  const mobile = useIsMobile();

  const combo = (
    <FilterCombobox
      search={props.search} setSearch={props.setSearch} appliedCount={props.appliedCount}
      matches={props.matches} onOpenTask={props.onOpenTask}
      scope={props.scope} setScope={props.setScope}
      smartFilter={props.smartFilter} setSmartFilter={props.setSmartFilter} smartCounts={props.smartCounts}
      filters={props.filters} setFilter={props.setFilter} filterOptions={props.filterOptions}
    />
  );
  const viewMenu = (
    <ViewMenu
      view={props.view} setView={props.setView}
      grouping={props.grouping} setGrouping={props.setGrouping}
      sortCols={props.sortCols} sortableCols={props.sortableCols}
      onSortToggleDir={props.onSortToggleDir} onSortRemove={props.onSortRemove}
      onSortAdd={props.onSortAdd} onClearSort={props.onClearSort}
      cfActive={props.cfActive} cfRules={props.cfRules} onEditCf={props.onEditCf}
      density={props.density} setDensity={props.setDensity}
      stylePreset={props.stylePreset} setStylePreset={props.setStylePreset}
      visibleCount={props.visibleCount} columnTotal={props.columnTotal} onManageColumns={props.onManageColumns}
      savedViews={props.savedViews} activeViewId={props.activeViewId}
      setActiveViewId={props.setActiveViewId} viewIsModified={props.viewIsModified}
      onSaveViewAs={props.onSaveViewAs} onUpdateView={props.onUpdateView}
      onSwitchToClassic={props.onSwitchToClassic}
    />
  );
  const more = (
    <MoreMenu
      onReset={props.onReset} ozet={props.ozet} onToggleOzet={props.onToggleOzet}
      pageSize={props.pageSize} setPageSize={props.setPageSize}
      onExportSettings={props.onExportSettings}
    />
  );

  if (mobile) {
    return (
      <div className="shrink-0 border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex h-12 items-center gap-2 px-3">{combo}{viewMenu}{more}</div>
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 dark:border-slate-800/60">
          <ViewTypeTabs value={props.view} onChange={props.setView} scroll />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white px-4 dark:border-slate-800 dark:bg-slate-900/60">
      {combo}
      <div className="hidden flex-1 justify-center md:flex">
        <ViewTypeTabs value={props.view} onChange={props.setView} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {props.savedViewsSlot}
        {viewMenu}
        <AddSplitButton
          onAddRow={props.onAddRow} onImport={props.onImport}
          onExportCsv={props.onExportCsv} onExportXlsx={props.onExportXlsx}
          onPrint={props.onPrint} onTemplate={props.onTemplate}
        />
        <IconBtn icon={Maximize2} label="Tam ekran" active={props.fullscreen} onClick={props.onFullscreen} />
        {more}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   KATMAN 2 — ACTIVE FILTER BAR
   ═══════════════════════════════════════════════════════════════════ */

export type ActiveFilterChip = {
  key: string;
  label: string;
  value?: string;
  tone?: Tone;
  icon?: LucideIcon;
  onClear: () => void;
};

export function ActiveFilterBar({ chips, onClearAll }: { chips: ActiveFilterChip[]; onClearAll: () => void }) {
  if (!chips || chips.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50/60 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/20 sm:px-4">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-blue-700/80 dark:text-blue-300/80">
        <ListFilter className="h-3 w-3" /> Aktif filtreler
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => {
          const Ic = c.icon;
          return (
            <span key={c.key} className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
              CHIP_TONE[c.tone || "slate"]
            )}>
              {Ic && <Ic className="h-3 w-3" strokeWidth={1.9} />}
              <span>{c.label}</span>
              {c.value && (
                <>
                  <span className="h-3 w-px bg-current opacity-25" />
                  <span className="max-w-[150px] truncate font-normal">{c.value}</span>
                </>
              )}
              <button type="button" onClick={c.onClear}
                className="-mr-0.5 ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/15"
                aria-label={`${c.label} filtresini kaldır`}>
                <X className="h-2.5 w-2.5" strokeWidth={2.2} />
              </button>
            </span>
          );
        })}
      </div>
      <button onClick={onClearAll}
        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100/70 dark:text-blue-300 dark:hover:bg-blue-900/40">
        <X className="h-3 w-3" /> Tümünü temizle
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SUMMARY STRIP — "Özeti göster" açıkken
   ═══════════════════════════════════════════════════════════════════ */

export function SummaryStrip({ stats }: { stats: { total: number; done: number; inProgress: number; todo: number } }) {
  const total = stats.total || 1;
  const pct = {
    done: (stats.done / total) * 100,
    prog: (stats.inProgress / total) * 100,
    todo: (stats.todo / total) * 100,
  };
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50 sm:px-4">
      <div className="flex min-w-[180px] flex-1 items-center gap-3">
        <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <span className="bg-emerald-500" style={{ width: pct.done + "%" }} />
          <span className="bg-amber-500" style={{ width: pct.prog + "%" }} />
          <span className="bg-slate-300 dark:bg-slate-600" style={{ width: pct.todo + "%" }} />
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{Math.round(pct.done)}%</span>
      </div>
      {([
        ["bg-emerald-500", "Tamamlandı", stats.done],
        ["bg-amber-500", "Devam ediyor", stats.inProgress],
        ["bg-slate-400", "Yapılacak", stats.todo],
      ] as const).map(([dotClass, label, n]) => (
        <span key={label} className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <span className={cn("h-2 w-2 rounded-full", dotClass)} />
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{n}</span> {label}
        </span>
      ))}
    </div>
  );
}
